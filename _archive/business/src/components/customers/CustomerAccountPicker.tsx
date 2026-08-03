import { useEffect, useState } from 'react'
import type { Client } from '@/lib/customer-success-api'
import { getAllClients } from '@/lib/customer-success-api'

interface CustomerAccountPickerProps {
  value: string
  onChange: (clientId: string, client: Client | null) => void
  label?: string
  className?: string
}

/** Lazy-loading customer account selector for WFM / Support linking */
export function CustomerAccountPicker({
  value,
  onChange,
  label = 'Customer account',
  className,
}: CustomerAccountPickerProps) {
  const [clients, setClients] = useState<Client[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (loaded) return
    void getAllClients().then((rows) => {
      setClients(rows)
      setLoaded(true)
    })
  }, [loaded])

  return (
    <div className={className}>
      <label className="text-sm font-medium leading-none">{label}</label>
      <select
        className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm"
        value={value}
        onChange={(e) => {
          const id = e.target.value
          onChange(id, clients.find((c) => c.id === id) ?? null)
        }}
      >
        <option value="">No linked account</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({c.account_type === 'individual' ? 'B2C' : 'B2B'})
          </option>
        ))}
      </select>
    </div>
  )
}
