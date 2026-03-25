import { PenLine } from 'lucide-react'

function App() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-white">
      <div className="text-center">
        <div className="mb-6 flex justify-center">
          <div className="rounded-2xl bg-brand-500 p-4 shadow-glow">
            <PenLine className="h-10 w-10 text-white" />
          </div>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-ink-900">
          Writing Platform
        </h1>
        <p className="mt-3 text-lg text-ink-600">
          Ready to build something great.
        </p>
      </div>
    </div>
  )
}

export default App
