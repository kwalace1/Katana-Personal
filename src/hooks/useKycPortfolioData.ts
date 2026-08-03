import { useCallback, useEffect, useState } from 'react'
import type { Client } from '@/lib/customer-success-api'
import {
  getPortfolioAccountRows,
  getPortfolioSummary,
  type KycAccountAttentionRow,
  type KycPortfolioSummary,
} from '@/lib/kyc-api'

export function useKycPortfolioData(clients: Client[]) {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<KycPortfolioSummary | null>(null)
  const [accountRows, setAccountRows] = useState<KycAccountAttentionRow[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [portfolio, accounts] = await Promise.all([
        getPortfolioSummary(clients),
        getPortfolioAccountRows(clients),
      ])
      setSummary(portfolio)
      setAccountRows(accounts)
    } finally {
      setLoading(false)
    }
  }, [clients])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const accountRowByClientId = new Map(accountRows.map((row) => [row.client_id, row]))

  return { loading, summary, accountRows, accountRowByClientId, refresh: loadData }
}
