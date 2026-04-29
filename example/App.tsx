import { desc } from 'drizzle-orm'
import { useEffect, useState } from 'react'
import { db, setupDB } from './db'
import { notes } from './schema'

export default function App() {
  const [ready, setReady] = useState(false)
  const [allNotes, setNotes] = useState<typeof notes.$inferSelect[]>([])
  const [input, setInput] = useState('')

  useEffect(() => {
    setupDB().then(() => setReady(true))
  }, [])

  useEffect(() => {
    if (!ready) return
    db.select().from(notes).orderBy(desc(notes.createdAt)).then(setNotes)
  }, [ready])

  async function addNote() {
    if (!input.trim()) return
    await db.insert(notes).values({
      title: input,
      body: '',
      createdAt: Date.now()
    })
    setNotes(await db.select().from(notes).orderBy(desc(notes.createdAt)))
    setInput('')
  }

  if (!ready) return <div>Loading...</div>

  return (
    <div>
      <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Note title" />
      <button onClick={addNote}>Add</button>
      {allNotes.map((note) => (
        <div key={note.id}>{note.title}</div>
      ))}
    </div>
  )
}
