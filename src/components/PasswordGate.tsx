import { useState, type ReactNode } from 'react'

const ACCESS_PASSWORD = import.meta.env.VITE_ACCESS_PASSWORD || ''
const STORAGE_KEY = 'katana-unlocked'
const EXPIRY_MS = 5 * 60 * 1000

function hasValidToken(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const { exp } = JSON.parse(raw)
    if (typeof exp === 'number' && Date.now() < exp) return true
    localStorage.removeItem(STORAGE_KEY)
    return false
  } catch {
    return false
  }
}

export function PasswordGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(
    !ACCESS_PASSWORD || hasValidToken(),
  )
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  if (unlocked) return <>{children}</>

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value === ACCESS_PASSWORD) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ exp: Date.now() + EXPIRY_MS }),
      )
      setUnlocked(true)
    } else {
      setError(true)
      setShake(true)
      setTimeout(() => setShake(false), 500)
      setValue('')
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0a0a0f]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 left-1/2 h-[800px] w-[800px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(74,144,226,0.08)_0%,transparent_70%)]" />
      </div>

      <form
        onSubmit={handleSubmit}
        className={`relative flex w-full max-w-sm flex-col items-center gap-6 px-6 ${shake ? 'animate-shake' : ''}`}
      >
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-[#4A90E2] to-[#5B5FF6] text-2xl font-bold tracking-tight text-white shadow-lg shadow-blue-500/20">
            K
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-white/90">
            Katana
          </h1>
          <p className="text-sm text-white/40">Enter access code to continue</p>
        </div>

        <div className="w-full">
          <input
            type="password"
            autoFocus
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setError(false)
            }}
            placeholder="Access code"
            className={`w-full rounded-lg border bg-white/5 px-4 py-3 text-center text-sm tracking-widest text-white placeholder-white/25 outline-none transition-colors focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 ${
              error ? 'border-red-500/60' : 'border-white/10'
            }`}
          />
          {error && (
            <p className="mt-2 text-center text-xs text-red-400/80">
              Incorrect access code
            </p>
          )}
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-gradient-to-r from-[#4A90E2] to-[#5B5FF6] px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition-all hover:shadow-blue-500/30 hover:brightness-110 active:scale-[0.98]"
        >
          Continue
        </button>
      </form>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  )
}
