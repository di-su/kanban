import html
import json
import random
import re

import requests
from aws import async_invoke
from sw.core import (
    broadcast_to_user,
    get_campaign,
    get_user,
    html_to_text,
    json_response,
    process_authorizer,
)
from sw.errors import catch_errors
from sw.sourcewhale import content_suggestions
from sw.vendor.other import open_ai_chat

VALID_CUSTOM_VARS = [
    "{{firstName}}",
    "{[senderFirstName]}",
    "{{company}}",
    "{{previousCompany}}",
    "{{role}}",
    "{{city}}",
    "{[timeOfDay]}",
    "{[dayOfWeek]}",
    "{[tomorrow]}",
    "{[twoWorkingDays]}",
    "{[previousStepDay]}",
    "{[senderCalendarLink]}",
]


def validate_content(step, stepIndex, teamId):
    def text_to_html(text):
        return re.sub(
            r"(\{{2}\w+\}{2}|\{\[\w+\]\})",
            r'<span class="custom-var">\1</span>',
            html.escape(text).replace("\n", "<br>"),
        )

    stepSubject = step.get("subject", "")
    stepBody = step.get("body", "")
    mailType = step.get("mailType", "")

    contentSuggestionsBody = {
        "content": text_to_html(stepBody),
        "isFollowUp": stepIndex > 0,
        "isSendAsReply": False,
        "outreachType": mailType,
        "subject": text_to_html(stepSubject),
    }

    suggestions = content_suggestions(contentSuggestionsBody, teamId)

    # check for invalid custom variables
    invalidVars = []
    pattern = r"(\{{2}\w+\}{2}|\{\[\w+\]\})"
    for text in [stepSubject, stepBody]:
        matches = re.findall(pattern, text)
        invalidVars.extend(
            [match for match in matches if match not in VALID_CUSTOM_VARS]
        )

    if invalidVars:
        suggestions["totalScore"]["num"] = 0
        suggestions["invalidCustomVars"] = list(set(invalidVars))

    # check for spam words
    if any(
        word in stepBody.strip().lower() for word in ["hope", "trust", "well"]
    ) or re.search(r"\[.*?\]", stepBody):
        suggestions["totalScore"]["num"] = 0

    return suggestions


def modify_failed_steps(failedSteps):
    systemPrompt = """As a chatbot designed to help users update content, your job is to remove the provided words that are considered spammy, make the content more concise, remove any "hope", "trust", or "well" phrases, remove any invalid custom variables, and replace any text wrapped with [] with {[]} instead, (so that the updated text has both [] and {}), whilst ensuring that the content still reads well.

        # **Subject:**
        This is text that needs to be updated.

        # **Body:**
        This is the text that needs to be updated with \\n for line breaks.

        # **Spam words:** These are the words that need to be removed from the text.

        # **Invalid Custom Variables:** These are the invalid custom variables that need to be removed from the text.

        ## Example JSON Structure

        Your output should be structured in JSON format as follows, for example:

        {{"templates":{{"subject":"The updated subject","body": "The updated body"}}"""

    samplePrompt = {
        "user": """
            **Subject:**
            "Opportunity for Senior Software Architect with 15+ Years Experience"

            **Body:**
            "Dear {{firstName}},\n\nThis will {{wrong}} be my final follow-up regarding the skilled Senior Software Architect I previously introduced. They bring 15+ years of experience in Microservices, cloud computing, and DevOps to the {[role]} and are seeking remote work in fast-paced, agile environments.\n\nIf you are open to scheduling a call to discuss this potential fit, please let me know.\n\nBest regards,\n{[senderFirstName]}"

            **Spam words:** ["call", "open", "please", "regarding", "fast", "opportunity"]

            **Invalid Custom Variables:** ["{{wrong}}", "{[role]}"]

            **Subject:**
            "Exciting Opportunity at Innovatech Solutions!"

            **Body:**
            "Hi {{firstName}},\n\nI wanted to follow up on my {{invalidVar}} email regarding the Full Stack Developer position at Innovatech Solutions. Your experience in modern technologies like React, Node.js, and MongoDB makes you an excellent fit for our team.\n\nWe offer a culture of continuous learning and growth, competitive compensation packages, and flexible work arrangements. If you're still interested, please use this link to schedule a brief introductory call: {[senderCalendarLink]}.\n\nLooking forward to connecting,\n{[senderFirstName]}"

            **Spam words:** ["call", "please", "regarding", "offer", "opportunity"]

            **Invalid Custom Variables:** ["{{invalidVar}}"]
            """,
        "assistant": """{{"templates": [{{"subject":"Senior Software Architect with 15+ Years Experience","body": Dear {{firstName}},\\n\\nFollowing up on my previous email about the Senior Software Architect position. This candidate has over 15 years of experience in Microservices, cloud computing, and DevOps.\\n\\nThey are well-versed in agile methodologies and available for remote work – a perfect fit for {{company}}'s needs.\\n\\nCould we explore this opportunity further?\\n\\nBest regards,\\n{[senderFirstName]},{{"subject":"Exciting role at Innovatech Solutions!","body": Hi {{firstName}},\\n\\nFollowing up on my previous email about the Full Stack Developer position at Innovatech Solutions. Your expertise in React, Node.js, and MongoDB align perfectly with our requirements.\\n\\nWe provide a culture of continuous learning, competitive compensation, and flexible work arrangements. If you're still interested, use this link to schedule a brief introductory chat: {[senderCalendarLink]}.\\n\\nLooking forward to connecting,\\n{[senderFirstName]}]}""",
    }

    userPrompt = create_modification_prompt(failedSteps)

    maxRetries = 3
    retries = 0

    messages = [
        {"role": "system", "content": systemPrompt},
        {"role": "user", "content": samplePrompt["user"]},
        {"role": "assistant", "content": samplePrompt["assistant"]},
        {"role": "user", "content": userPrompt},
    ]

    while retries < maxRetries:
        finalContent = open_ai_chat(
            messages,
            temperature=1,
            asyncKey=False,
            maxTokens=4095,
            timeout=45,
            jsonMode=True,
            model="gpt-4o",
        )

        updatedData = json.loads(finalContent[0]).get("templates", [])

        # We have the correct number of templates
        if isinstance(updatedData, list) and len(updatedData) == len(failedSteps):
            break

        retries += 1
        print(f"Attempt {retries}: Incorrect number of templates. Retrying...")

    if retries == maxRetries:
        print("Max retries reached. Aborting the modification process.")
        return failedSteps

    return [
        {
            **originalStep,
            "body": updatedStep["body"],
            "subject": updatedStep["subject"],
        }
        for (originalStep, _), updatedStep in zip(failedSteps, updatedData)
    ]


def process_content_validation(content, teamId, stepIndex=0, threshold=70):
    failedSteps = []

    for index, item in enumerate(content if isinstance(content, list) else [content]):
        currentStepIndex = stepIndex + index
        suggestions = validate_content(item, currentStepIndex, teamId)

        if suggestions["totalScore"]["num"] < threshold:
            failedSteps.append((item, suggestions))

    if failedSteps:
        modifiedSteps = modify_failed_steps(failedSteps)
        # Replace failed steps with modified versions
        if isinstance(content, list):
            for (oldStep, _), newStep in zip(failedSteps, modifiedSteps):
                content[content.index(oldStep)] = newStep
        else:
            # on regeneration it's a single step
            content = modifiedSteps[0]

    return content


@catch_errors()
def chatbot_regenerate_response(userId, teamId, body):
    systemPrompt = """As a chatbot designed to help users update content, your job is to reword the content, whilst ensuring that the content is still concise. Make sure that both the Subject and Body are updated. The number of templates returned must match the number of templates submitted by the user. Never use the phrase "I hope this email/message finds you well". Never use emojis."

        # **Subject:**
        This is text that needs to be updated.

        # **Body:**
        This is the text that needs to be updated with \\n for line breaks.

        ## Example JSON Structure

        Your output should be structured in JSON format as follows, for example:

        {{"templates":{{"subject":"The updated subject","body": "The updated body"}}"""

    samplePrompt = {
        "user": """

            **Subject:**
            "{{firstName}}, A Creative Opportunity Awaits"

            **Body:**
            "Hey {{firstName}},\n\nIt's {[senderFirstName]} from DesignSphere,\n\nGot a minute to chat?\n We have an exciting Graphics Designer role in London.\nLet's connect!\n\nBest,\n{[senderFirstName]}"

            """,
        "assistant": """{{"templates": {{"subject":"An Exciting Opportunity Awaits!","body": It's {[senderFirstName]} from DesignSphere,\\n\\nWe have a promising Graphics Designer role in London.\\n\\nLet's chat! Best,\\n{[senderFirstName]}""",
    }

    userPrompt = f"""
        **Subject:**
        {body["subject"]}

        **Body:**
        {body["body"]}
    """

    messages = [
        {"role": "system", "content": systemPrompt},
        {"role": "user", "content": samplePrompt["user"]},
        {"role": "assistant", "content": samplePrompt["assistant"]},
        {"role": "user", "content": userPrompt},
    ]

    maxRetries = 3
    retries = 0
    originalBody = body["body"]

    while retries < maxRetries:
        regeneratedStep = open_ai_chat(
            messages,
            temperature=1,
            asyncKey=False,
            maxTokens=4095,
            timeout=45,
            jsonMode=True,
            model="gpt-4o",
        )

        data = {"content": json.loads(regeneratedStep[0]), "id": body["messageId"]}

        newBody = data["content"]["templates"]["body"]

        if newBody != originalBody:
            break

        retries += 1
        print(
            f"Attempt {retries}: Generated content is the same as original. Retrying..."
        )

    if retries == maxRetries:
        print("Max retries reached. Using the last generated content.")

    _, stepStr = body["messageId"].split("-step")

    data["content"]["templates"] = process_content_validation(
        data["content"]["templates"], teamId, int(stepStr) - 1
    )

    broadcast_to_user(
        userId, "aiRegenerateCampaignResponse", data, pathnames=["/campaigns"]
    )


@catch_errors()
def chatbot_response(userId, teamId, body):
    timezone = get_user(userId).get("timezone") or ""
    locale = "British English" if timezone.startswith("Europe") else "American English"

    outreachPrompts = {
        "businessDevelopment": "As a chatbot designed to assist users in crafting targeted outreach campaigns for business development, your task involves creating an outreach campaign based on the user-provided details, which will include the types of steps and their sequence. Each step is designed to leverage user-provided information to effectively connect with potential clients and promote the advantages of the user's services.",
        "candidateSourcing": "As a chatbot designed to assist users in crafting targeted outreach campaigns to source candidates for specific job roles, your task involves creating an outreach campaign based on the user-provided details about the position and the ideal candidate. Each step in the campaign should be tailored to attract and engage potential candidates, highlighting the key aspects of the job opportunity and the company.",
        "candidateSpec": "As a chatbot designed to assist users in presenting highly qualified candidates to potential employers, your task involves creating an outreach campaign to showcase the candidate's skills, experience, and suitability for the target job roles. Each step in the campaign should highlight the candidate's strengths and value proposition, aiming to capture the attention of potential employers and secure the next steps in the hiring process.",
    }

    systemPrompt = outreachPrompts[body["outreachType"]]
    systemPrompt += """

    When generating the campaign, the content of each step should take into account the previous step content, ensuring a coherent sequence. Where sensible, use at least three custom variables each step, ensuring they're selected from the list provided and used correctly. To help you understand the expected response, you will be provided with sample user input and expected assistant responses. Your output should only include data from the latest user input and should not include copied data from the expected assistant responses.


        ## Outreach Campaign Step Types

        The campaign consists of various outreach steps, each with its unique format and guidelines optimized for engagement and response rates. Steps are not necessarily sequential and can be customized according to the campaign's needs.

        ### **Email**
        - **Subject**: Relevant subject line to capture attention.
        - **Body**: A concise introduction of the sender and their purpose, focusing on the value they can bring to the potential recipient's business. The content should be brief, aiming for 2-4 sentences.
        - **mailType**: email

        ### **Phone Call**
        - **mailType**: phoneCall
        - **Body**: Often to discuss details from a previous outreach step, providing a more personal touch to the engagement process.

        ### **LinkedIn Connection Request**
        - **Body**: Starts with a personalized greeting using '{{firstName}}'. It may refer to a previous email to spark curiosity and acknowledges the potential recipient's busy schedule as a reason for reaching out on LinkedIn.
        - **mailType**: linkedinConnectionRequest

        ### **LinkedIn inmail**
        - **Subject**: Relevant subject line to immediately convey the message's value.
        - **Body**: Opens with a personal note to {{firstName}}, recognizing previous attempts to connect and possibly an overflowing inbox. It should offer industry insights briefly and suggest how the sender's services could meet the recipient's current challenges. Keep it succinct, aiming for 1-2 sentences.
        - **mailType**: inmail

        ### **SMS**
        - **Body**: Designed for brevity, this step involves sending a short message to prompt a quick update or reminder about the campaign's offerings. It's direct and meant to engage the recipient efficiently. This must not exceed 300 characters.
        - **mailType**: sms

        Each step is crafted to build upon the previous outreach attempts, fostering a relationship and encouraging a dialogue between the sender and the potential recipient. The choice and order of steps are tailored to each campaign, allowing for flexibility in strategy and approach.

        ## Example JSON Structure

        Your campaign content should be structured in JSON format as follows, for example:

        {{"title":"Campaign Title", "templates": [{{"subject": "Email subject line for the introductory email", "body": "Email body content for the introductory email with \\n for line breaks", "mailType": "email"}},{{"mailType": "phoneCall", "body": "Call to discuss email"}},{{"body": "LinkedIn Connection Request content with \\n for line breaks", "mailType": "linkedinConnectionRequest"}},{{"subject": "", "body": "Email body content for the follow-up email with \\n for line breaks", "mailType": "email"}},{{"subject": "Subject line for LinkedIn inmail", "body": "LinkedIn inmail content with \\n for line breaks", "mailType": "inmail"}},{{"mailType": "phoneCall", "body": "Call to discuss email"}},{{"subject": "", "body": "Consolidated Follow-Up Email with \\n for line breaks", "mailType": "email"}},{{"subject": "", "body": "Final Touch Base Email with \\n for line breaks", "mailType": "email"}}]}

        ## Campaign Guidelines

        ### Overview
        Create engaging, approachable, and professional campaign communications. Strike a balance between casual language and professionalism, avoiding sales clichés for genuine interaction.

        ### Communication Strategy
        - **Calls to Action**: Frame them as inviting suggestions, emphasizing the recipient's convenience and preference.

        - **Empathy and Personal Touch**: Start with genuine greetings. Show understanding for the recipient's time and priorities, offering flexibility.

        ### Engaging and Building Rapport
        - **Reference Past Interactions**: Mention previous communications subtly, without assuming they were remembered.
        - **Avoid Sales Language**: Focus on genuine, value-oriented communication rather than overused sales phrases.

        **Always make sure to**: Never use the phrase "I hope this email/message finds you well". Never use emojis."""

    systemPrompt += f"""

        ### Personalization and Connection
        - **Custom Variables**: Only use the following custom variables: {", ".join(VALID_CUSTOM_VARS)}. Integrate at least three in each step, ensuring they're used correctly.

        ### Content Requirements
        - **Language**: Use {locale}, avoiding spam terms and clichés. Strive for concise, clear emails.
        - **Relevance**: Ensure content is specific to the recipient's needs and straightforward, without unnecessary details or complex explanations."""

    samplePrompts = {
        "candidateSourcing": {
            "userNonHiringName": """## User-Provided Details

                - **Include Hiring Company Name**
                "no"

                - **Hiring Company Name**
                ""

                - **Position title & description:**
                "Head of Product, will establish industry-leading product management practices tailored, driving both strategic direction and agile execution, shaping the product roadmap and ensuring every decision aligns with the company mission"

                - **Job Location:**
                "Oregon"

                - **Call to Action:**
                "Ask candidate if they would be interested in discussing the role in more detail"

                - **Additional Information:**
                "Collaborate closely with the CEO, remote options available"

                ## Campaign Step Sequence

                1. email
                2. phoneCall
                3. email
                4. phoneCall
                5. email
                6. linkedinConnectionRequest""",
            "assistantNonHiringName": """
                {{"title":"Search - Head of Product, Oregon", "templates": [{{"subject": "{{firstName}} : Head of Product - Oregon", "body": "Dear {{firstName}},\\n\\nI wanted to reach out and share an exciting role that I believe aligns with your expertise and experience. We're currently seeking a talented and driven individual to join our client as a critical position in their Product team based in Oregon.\\n\\nYour background is very impressive and i'd love to speak in more detail. What date works best?\\n\\nKind regards,\\n{[senderFirstName]}", "mailType": "email"}},{{"body": "Call candidate", "mailType": "phoneCall"}},{{"subject": "{{firstName}} : Head of Product - Oregon", "body": "Hi {{firstName}},\\n\\nI messaged you on {[previousStepDay]}, as having reviewed your profile I was keen to speak with you about a role I am currently working on.\\n\\nI appreciated how these messages can be caught up in email filters, so thought I would message you again.\\n\\nThe role we are working on is for a Head of Product, who will shape the product roadmap and establish industry leading processes.\\n\\nI thought that your experience, including your time working for {{company}}, made you a potential fit. What do you think?\\n\\nRegards,\\n{[senderFirstName]}", "mailType": "email"}},{{"body": "Call candidate", "mailType": "phoneCall"}},{{"subject": "{{firstName}} : Head of Product - Oregon", "body": "Hi {{firstName}}, I appreciate you will be busy.\\n\\nLet me know if this is worth discussing {[tomorrow]} or {[twoWorkingDays]}, or whether there is someone else I should speak to?\\n\\nRegards,\\n{[senderFirstName]}", "mailType": "email"}},{{"body": "Hi {{firstName}},\\n\\nI am working across the tech space specialising in product roles to build and scale teams, it would be good to connect.", "mailType": "linkedinConnectionRequest"}}]}""",
            "userHiringName": """## User-Provided Details

                - **Include Hiring Company Name**
                "yes"

                - **Hiring Company Name**
                "SWCompanyExample"

                - **Position title & description:**
                "Oracle Database Developer - PL/SQL"

                - **Job Location:**
                "Remote"

                - **Call to Action:**
                "Discuss next steps tomorrow"

                ## Campaign Step Sequence

                1. email
                2. inmail
                3. sms
                4. email
                5. phoneCall
                6. email
                7. linkedinConnectionRequest""",
            "assistantHiringName": """
                {{"title":"SWCompanyExample - PL/SQL - Oracle Database Developer", "templates": [{{"subject": "{{firstName}}, Would Love To Chat!", "body": "Good {[timeOfDay]} {{firstName}}, happy {[dayOfWeek]}!\\n\\nI'm guessing you're a pretty solid {{role}} given your experience at {{company}}. Your background over the last several years really impressed me!\\n\\nJust out of curiosity, are you considering a change? A client of mine at SWCompanyExample has a remote Oracle Database Developer role available and is looking for someone like yourself to join them.\\n\\nDo you have time {[tomorrow]} to discuss?", "mailType": "email"}},{{"subject": "{{firstName}}, Do You Have A Minute?", "body": "Good {[timeOfDay]} {{firstName}},\\n\\nI tried to connect with you via e-mail {[previousStepDay]}.\\n\\nDo you have time to discuss later or {[tomorrow]}?\\n\\nRegards, {[senderFirstName]}", "mailType": "inmail"}},{{"body": "{{firstName}},\\n\\nThis is {[senderFirstName]} from The Jupiter Group. Are you currently on the market? There's a PL/SQL - Database Developer position available you'd be a great fit for. Let me know if you have a minute.", "mailType": "sms"}},{{"subject": "{{firstName}}, Would Love To Chat!", "body": "Hi {{firstName}},\\n\\nFollowing up on my previous e-mail...\\n\\nHave time for a quick chat {[tomorrow]}?\\n\\nRegards,\\n\\n{[senderFirstName]}", "mailType": "email"}},{{"body": "Call Candidate", "mailType": "phoneCall"}},{{"subject": "{{firstName}}, Would Love To Chat!", "body": "{{firstName}},\\n\\nThings must be going well at {{company}} and I very much respect that! Let's connect on Linkedin instead?\\n\\nRegards,\\n\\n{[senderFirstName]}", "mailType": "email"}},{{"body": "{{firstName}}, I'd love to connect and share our networks! If you were ever exploring the job market, will you let me know?", "mailType": "linkedinConnectionRequest"}}]}""",
            "userInHouse": """## User-Provided Details

                - **Position title & description:**
                Head of Product, will establish industry-leading product management practices at our fintech company that operates in 13 markets. Head of product will drive both strategic direction and agile execution, shaping the product roadmap and ensuring every decision aligns with the company mission as well as driving new product growth.

                - **Job Location:**
                Oregon

                - **Call to Action:**
                Ask candidate if they would be interested in discussing the role in more detail

                - **Additional Information:**
                Collaborate closely with the CEO, remote options available. Nexa solutions is a fintech company operating in 13 markets.

                ## Campaign Step Sequence

                1. email
                2. phoneCall
                3. email
                4. phoneCall
                5. email
                6. linkedinConnectionRequest
                7. email""",
            "assistantInHouse": """
                 {{"title":"Head of Product Outreach - Oregon", "templates": [{{"subject": "{{firstName}} : Head of Product - Oregon", "body": "Dear {{firstName}},\\n\\nWe're currently on the look out for a Head of Product to join our rapidly growing FinTech company, with ambitious plans operating in 13 markets.\\n\\nI wanted to reach out and share an exciting role that I believe aligns with your expertise and experience. We're looking for someone to drive the strategic direction and join the team based in Oregon.\\n\\nYour background is very impressive and i'd love to speak in more detail. What date works best?\\n\\nKind regards, {[senderFirstName]}", "mailType": "email"}},{{"body": "Call candidate", "mailType": "phoneCall"}},{{"subject": "{{firstName}} : Head of Product - Oregon", "body": "Hi {{firstName}},\\n\\nI messaged you on {[previousStepDay]}, regarding a Head of Product role I am currently hiring for.\\n\\nI appreciated how these messages can be caught up in email filters, so thought I would message you again. The right fit will be instrumental in shaping our product strategy. Head of Product will oversee the development of new products, as well as drive the growth of existing ones.\\n\\nYour experience, including your time working for {{company}}, makes you a potential fit.\\n\\nWhat do you think?\\n\\nRegards, {[senderFirstName]}", "mailType": "email"}},{{"body": "Call candidate", "mailType": "phoneCall"}},{{"subject": "{{firstName}} : Head of Product - Oregon", "body": "Hi {{firstName}},\\n\\nI appreciate you will be busy. Let me know if this is worth discussing {[tomorrow]} or perhaps {[twoWorkingDays]}?\\n\\nRegards, {[senderFirstName]}", "mailType": "email"}},{{"body": "Hi {{firstName}},\\n\\nI emailed you about a Head of Product role we are recruiting for. We are expanding our tech hub in Oregon and looking for professionals to join. It would be great to connect!\\n\\n{[senderFirstName]}", "mailType": "linkedinConnectionRequest"}},{{"subject": "{{firstName}} : Head of Product - Oregon", "body": "Hi {{firstName}},\\n\\nAppreciate inboxes can be busy, so thought I would try reaching out just one last time about a role we are recruiting for.\\n\\nOf course, if you are not looking for a change, just let me know. Either way, I will be happy to stay in touch!\\n\\nRegards, {[senderFirstName]}", "mailType": "email"}}]}}""",
        },
        "businessDevelopment": {
            "userOne": """## User-Provided Details

                - **What we offer:**
                "SourceWhale is a cutting-edge technology designed for recruiters in the recruitment technology (rec-tech) space. It enables seamless booking of meetings with both candidates and clients, improving efficiency and response rates."

                - **Pain point:**
                "Are you finding it increasingly difficult to source new business and get responses from existing candidates? The recruitment landscape is becoming more challenging, with recruiters struggling to engage effectively with their targets."

                - **Value proposition:**
                "SourceWhale offers a powerful solution that integrates with your existing technology stack, including CRM, email, and LinkedIn. Our platform simplifies your workflow, enhances targeted outreach, and ensures comprehensive tracking so that no opportunity gets missed. Whether you're focusing on candidate sourcing or business development, SourceWhale is designed to boost your engagement, drive more meetings, and ultimately, increase your revenue."

                - **Call to action:**
                "Interested in transforming your recruitment process and booking more meetings? Let's have a quick chat to explore how SourceWhale can work for you. Click here to schedule a call."

                - **Additional context:**
                "Working with recruiters across various sectors, SourceWhale has been instrumental in shifting focus from solely candidate sourcing to encompassing more business development activities. This change is helping recruiters to adapt to the evolving market dynamics and maintain a competitive edge."

                ## Campaign Step Sequence

                1. email
                2. phoneCall
                3. linkedinConnectionRequest
                4. email
                5. inmail
                6. phoneCall
                7. email
                8. email""",
            "assistantOne": """
                {{"title":"BD Outreach - Nurture", "templates": [{{"subject": "Source Business With SourceWhale", "body": "{{firstName}},\\n\\nWe're finding many recruiters are currently struggling to source business and receive responses from existing candidates.\\n\\nNot sure if this is something you're bumping into at {{company}} but SourceWhale is a piece of tech that enables recruiters in the rec-tech space to book more meetings with candidates and clients.\\n\\nFancy having a quick chat to see what we do?\\n\\nThanks,\\n{[senderFirstName]}", "mailType": "email"}},{{"body": "Call to discuss email", "mailType": "phoneCall"}},{{"body": "{{firstName}} - good to connect! I sent an email across this morning, wasn't sure if it was relevant in the end? (My guess is your inbox is rather crowded, so thought I'd shoot a quick message on LinkedIn!)", "mailType": "linkedinConnectionRequest"}},{{"subject": "Source Business With SourceWhale", "body": "Hi {{firstName}},\\n\\nConscious my first email was a little vague and I didn't explain how we actually do it! SourceWhale integrates with your existing tech (CRM/Email/LinkedIn) to simplify workflow, offer targeted outreach and track everything so nothing gets missed.\\n\\nOther recruiters are using it on both the candidate and BD side - What are you primarily focused on at the moment?\\n\\nThanks again,\\n{[senderFirstName]}", "mailType": "email"}},{{"subject": "Source Business With SourceWhale", "body": "Hi {{firstName}} - I've sent a few emails but can imagine your inbox is rather crowded!\\n\\nWe're working with several headhunters who are saying focus has changed - from candidate short to more Business Development. Not sure if you're seeing something similar?\\n\\nIf you are, we can help - might not be a bad idea to have a chat?", "mailType": "inmail"}},{{"body": "Call to discuss email", "mailType": "phoneCall"}},{{"subject": "Source Business With SourceWhale", "body": "Hi {{firstName}},\\n\\nFollowing up on my previous email, SourceWhale's technology accelerates candidate sourcing. Streamlining your recruitment processes with our extension which can boost engagement, drive more meetings, and increase your revenue.\\n\\nDo you have time for a quick chat this week?\\n\\n{[senderFirstName]}", "mailType": "email"}},{{"subject": "Source Business With SourceWhale", "body": "{{firstName}},\\n\\nI'm guessing a candidate/business development push isn't the priority right now - which is completely fine.\\nAlways keen to share how you can drive engagement, happy to catch up later in the year?\\n\\nBest,\\n{[senderFirstName]}", "mailType": "email"}}]}""",
        },
        "candidateSpec": {
            "userOne": """## User-Provided Details

                - **Candidate experience and qualifications:**
                "Principal Firmware Engineer"

                - **Candidate key skills:**
                "20+ years' experience in Embedded Software Engineering, Products include Robotics, Surgical Equipment, Heart Pumps, Background in Bluetooth & Wireless devices."

                - **Call to action:**
                "Book call to discuss next steps this week"

                - **Additional context:**
                "Candidate is looking for a role in Boston, MA"

                ## Campaign Step Sequence

                1. email
                2. linkedinConnectionRequest
                3. email
                4. phoneCall
                5. email
                6. phoneCall
                7. email""",
            "assistantOne": """
                {{"title":"Spec - Principal Firmware Engineer - Boston, MA", "templates": [{{"subject": "Principal Firmware Engineer - Actively Looking in Boston, MA", "body": "Hi {{firstName}},\\n\\nI am representing a highly skilled Principal Firmware Engineer that is actively looking for a role in Boston, MA and has asked me to make an introduction to {{company}} on their behalf.\\n\\nA summary of their experience is below.\\nPrincipal Firmware Engineer - 20+ years' experience in Embedded Software Engineering.\\nProducts include Robotics, Surgical Equipment, Heart Pumps\\nBackground in Bluetooth & Wireless devices.\\n\\nThey would like to start having conversations early next week and have highlighted {{company}} as one they are interested in as part of their targeted search.\\nAre you available this week to discuss next steps?\\n\\nRegards, {[senderFirstName]}", "mailType": "email"}},{{"body": "Hi {{firstName}},\\n\\nI am representing a number of candidates that would be interested in being introduced to {{company}}.\\n\\nI have 10+ years experience in Medical Device Staffing.\\n\\nWould you be interested in connecting? {[senderFirstName]}", "mailType": "linkedinConnectionRequest"}},{{"subject": "Principal Firmware Engineer - Actively Looking in Boston, MA", "body": "Hi {{firstName}},\\n\\nFurther to my connection on LinkedIn, I just wanted to follow up on my previous email about a Principal Firmware Engineer who mentioned {{company}} as a company of interest in their search in Boston.\\n\\n- 20+ year experience in Firmware Engineering\\n- 8+ years in Complex Med-Devices\\n- Immediate start\\n\\nCould we arrange an exploratory discussion with the candidate?\\n\\nRegards, {[senderFirstName]}", "mailType": "email"}},{{"body": "Call Client", "mailType": "phoneCall"}},{{"subject": "Principal Firmware Engineer - Actively Looking in Boston, MA", "body": "Hi {{firstName}},\\n\\nI attempted to contact your mobile but we didn't manage to connect. What did you think about the resume I sent? {{company}} may not be looking to add additional resource currently.\\n\\nI recently placed candidates for another client and they were able to complete national installs ahead of time resulting in significant reduction in time taken to generate multiple additional revenue streams.\\n\\nWould something like this add value to {{company}}? When can we discuss?\\n\\nRegards,\\n{[senderFirstName]}", "mailType": "email"}},{{"body": "Call Client", "mailType": "phoneCall"}},{{"subject": "Principal Firmware Engineer - Actively Looking in Boston, MA", "body": "Hi, {{firstName}},\\n\\n{{company}} remain a business of interest due to success we have had locally and in the same industry. Let me know if you're interested in viewing some data on our global clients, and technical capabilities.\\n\\nI would be really keen to have a further conversation about {{company}} and Proclinical working together. Would a partner like us add any value?\\n\\nThanks, {[senderFirstName]}", "mailType": "email"}}]}""",
        },
    }

    def randomize_campaign_steps(data):
        outreachType = data["outreachType"]
        channels = data["channels"]
        numSteps = int(data["selectedNumOfSteps"])

        firstStep = (
            "email"
            if outreachType in ["businessDevelopment", "candidateSpec"]
            and "email" in channels
            else random.choice([ch for ch in ["email", "inmail"] if ch in channels])
            if outreachType == "candidateSourcing"
            and any(ch in channels for ch in ["email", "inmail"])
            else next((ch for ch in channels if ch != "phoneCall"), channels[0])
        )

        # Ensure that each channel is included at least once
        remainingChannels = [ch for ch in channels if ch != firstStep]
        campaignSteps = [firstStep] + random.sample(
            remainingChannels, min(len(remainingChannels), numSteps - 1)
        )

        # If additional steps are still needed, add random steps from original channels
        while len(campaignSteps) < numSteps:
            campaignSteps.append(random.choice(channels))

        # Only 1 linkedinConnectionRequest is allowed
        if campaignSteps.count("linkedinConnectionRequest") > 1:
            linkedinIndices = [
                i
                for i, step in enumerate(campaignSteps)
                if step == "linkedinConnectionRequest"
            ]
            for index in linkedinIndices[1:]:
                campaignSteps[index] = random.choice(
                    [ch for ch in channels if ch != "linkedinConnectionRequest"]
                )

        # Shuffle the steps (apart from the first step) to randomize the campaign
        campaignSteps = [campaignSteps[0]] + random.sample(
            campaignSteps[1:], len(campaignSteps) - 1
        )

        # Create the new campaign step sequence
        campaignSteps = "\n".join(
            f"{i+1}. {step}" for i, step in enumerate(campaignSteps)
        )

        return campaignSteps

    def add_system_and_sample_prompt(body, systemPrompt):
        messages = [
            {"role": "system", "content": systemPrompt},
        ]
        # only candidateSourcing displays includeHiringCompanyName
        # if user is inHouse, includeHiringCompanyName is hidden and we use a different samplePrompt
        if body["outreachType"] == "candidateSourcing":
            if body["includeHiringCompanyName"] == "yes":
                messages.extend(
                    [
                        {
                            "role": "user",
                            "content": samplePrompts[body["outreachType"]][
                                "userHiringName"
                            ],
                        },
                        {
                            "role": "assistant",
                            "content": samplePrompts[body["outreachType"]][
                                "assistantHiringName"
                            ],
                        },
                    ]
                )
            else:
                if body["isInHouse"]:
                    messages.extend(
                        [
                            {
                                "role": "user",
                                "content": samplePrompts[body["outreachType"]][
                                    "userInHouse"
                                ],
                            },
                            {
                                "role": "assistant",
                                "content": samplePrompts[body["outreachType"]][
                                    "assistantInHouse"
                                ],
                            },
                        ]
                    )
                else:
                    messages.extend(
                        [
                            {
                                "role": "user",
                                "content": samplePrompts[body["outreachType"]][
                                    "userNonHiringName"
                                ],
                            },
                            {
                                "role": "assistant",
                                "content": samplePrompts[body["outreachType"]][
                                    "assistantNonHiringName"
                                ],
                            },
                        ]
                    )
        else:
            messages.extend(
                [
                    {
                        "role": "user",
                        "content": samplePrompts[body["outreachType"]]["userOne"],
                    },
                    {
                        "role": "assistant",
                        "content": samplePrompts[body["outreachType"]]["assistantOne"],
                    },
                ]
            )

        return messages

    def build_user_prompt(body):
        parts = ["## User-Provided Details", ""]

        # Candidate Sourcing fields
        if body["outreachType"] == "candidateSourcing":
            parts.append(
                f'- **Include Hiring Company Name:** {body["includeHiringCompanyName"]}'
            )

            parts.append(
                f'- **Hiring Company Name:** {body["hiringCompanyName"]}'
                if "hiringCompanyName" in body
                else ""
            )

            parts.append(
                f'- **Position title & description:** {body["positionDetails"]}'
            )

            parts.append(f'- **Job Location:** {body["jobLocation"]}')

        # Business development fields
        if body["outreachType"] == "businessDevelopment":
            parts.append(f'- **What we offer:** {body["whatWeOffer"]}')
            parts.append(f'- **Pain point:** {body["buyerPainPoint"]}')
            parts.append(f'- **Value proposition:** {body["valueProposition"]}')

        # Candidate Spec fields
        if body["outreachType"] == "candidateSpec":
            parts.append(
                f'- **Candidate experience and qualifications:** {body["experience"]}'
            )
            parts.append(f'- **Candidate key skills:** {body["skills"]}')

        # Generic fields
        if body["campaignTone"] == "casual":
            parts.append(
                "- **Tone:** Keep it clear, engaging, and personable. Use conversational language and contractions to make messages feel like a friendly chat."
            )
        elif body["campaignTone"] == "professional":
            parts.append(
                "- **Tone:** Maintain a professional and formal tone. Use clear and concise language, avoid contractions, and ensure messages convey a sense of expertise and credibility."
            )
        elif body["campaignTone"] == "replicateTone":
            campaign = get_campaign(body["selectedCampaign"])
            content = " ".join(
                html_to_text(template["content"])
                for template in campaign["templates"].values()
            )
            parts.append(
                f'- **Tone:** Mimic the tone from the following text: "{content}"'
            )

        if "callToAction" in body:
            parts.append(f'- **Call to action:** {body["callToAction"]}')
        if "additionalContext" in body:
            parts.append(f'- **Additional context:** {body["additionalContext"]}')

        if "replicateUserStyle" in body:
            parts.extend(
                [
                    "",
                    "## Writing Style",
                    "",
                    "Replicate the user's writing style from the following text snippets:",
                    "",
                    '- ""',
                    '- ""',
                    '- ""',
                ]
            )

        parts.extend(
            ["", "## Campaign Step Sequence", "", randomize_campaign_steps(body)]
        )

        return "\n".join(parts)

    userPrompt = build_user_prompt(body)

    messages = add_system_and_sample_prompt(body, systemPrompt)
    messages.append({"role": "user", "content": userPrompt})

    try:
        initialContent = open_ai_chat(
            messages,
            temperature=1,
            asyncKey=False,
            maxTokens=4095,
            timeout=45,
            jsonMode=True,
            model="gpt-4o",
        )

    except requests.Timeout:
        return None

    output = json.loads(initialContent[0])

    steps = process_content_validation(output["templates"], teamId)

    # fallback in case the output is missing title
    title = output.get("title", "AI Generated Campaign")

    def replace_sw_company(title, steps):
        def replace_in_string(text):
            if isinstance(text, str) and "SWCompanyExample" in text:
                return text.replace("SWCompanyExample", body["hiringCompanyName"])
            return text

        title = replace_in_string(title)

        steps = [dict(step) if isinstance(step, tuple) else step for step in steps]

        for step in steps:
            step["subject"] = replace_in_string(step.get("subject"))
            for key, value in step.items():
                step[key] = replace_in_string(value)

        return title, steps

    # in case the output includes SWCompanyExample (taken from samplePrompts)
    if (
        body["outreachType"] == "candidateSourcing"
        and body["includeHiringCompanyName"] == "yes"
    ):
        title, steps = replace_sw_company(title, steps)

    data = {"title": title, "content": steps, "id": body["messageId"]}

    broadcast_to_user(userId, "aiCampaignResponse", data, pathnames=["/campaigns"])


def create_modification_prompt(failedSteps):
    userPrompt = ""
    for step, suggestions in failedSteps:
        spamWords = suggestions["highlights"].get("spamWords", [])
        invalidCustomVars = suggestions["highlights"].get("invalidCustomVars", [])
        userPrompt += f"""

        - **Subject:**
        {step.get("subject", "")}

        - **Content:**
        {step["body"]}

        - **Spam words:**
        {", ".join(spamWords)}

        - **Invalid Custom Variables:**
        {", ".join(invalidCustomVars)}

        """
    return userPrompt


def lambda_handler(event, context):
    print("event =", event)

    if event.get("regenerateSingle"):
        return chatbot_regenerate_response(
            event["userId"], event["teamId"], event["body"]
        )

    if event.get("async"):
        return chatbot_response(event["userId"], event["teamId"], event["body"])

    userId, teamId = process_authorizer(event)

    body = json.loads(event["body"])

    payload = {
        "body": body,
        "userId": userId,
        "teamId": teamId,
        "async": True,
        "regenerateSingle": body.get("regenerateSingle", False),
    }

    async_invoke(context.function_name, payload)

    return json_response("success")