# Kanban Board

A server-side rendered Kanban board application built with Next.js 15, React 19, and TypeScript.

## Features

- **Server-Side Rendering (SSR)**: Initial page load is rendered on the server
- **Server Actions**: All CRUD operations are handled server-side
- **Drag and Drop**: Move cards between columns and reorder columns
- **Persistent Storage**: Data is stored in JSON files on the server
- **Real-time Updates**: Optimistic UI updates with server validation

## Tech Stack

- **Framework**: Next.js 15.3.4 (App Router)
- **UI Library**: React 19.1.0
- **Language**: TypeScript
- **Styling**: Tailwind CSS (configured) + inline styles
- **Storage**: File-based JSON storage

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
/app              - Next.js App Router pages
/src
  /components     - React components
  /hooks         - Custom React hooks (drag & drop)
  /lib           - Server actions and storage logic
  /styles        - Shared styles
  /types         - TypeScript type definitions
/data            - JSON data storage
```

## Usage

- **Add Column**: Use the form on the right to create new columns
- **Add Card**: Use the input at the bottom of each column
- **Edit Column Title**: Click on a column title to edit it
- **Delete**: Click the × button on cards or columns
- **Drag & Drop**: Drag cards between columns or reorder columns

## Data Storage

The application stores data in `/data/kanban.json`. This file is automatically created on first use.