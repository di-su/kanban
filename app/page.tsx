import Board from '../src/components/Board'
import { getColumns } from '../src/lib/storage'

export default async function HomePage() {
  const columns = await getColumns();
  
  return (
    <>
      <h1>My kanban board</h1>
      <Board initialColumns={columns} />
    </>
  )
}