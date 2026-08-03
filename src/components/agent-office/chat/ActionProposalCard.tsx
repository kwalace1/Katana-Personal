import { memo, useEffect, useState } from 'react'
import { AlertTriangle, Check, ClipboardCheck, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { KatanaActionProposal } from '@/lib/office/actions/proposals'
import { actionLabel, proposalFields } from '@/lib/office/actions/proposals'
import {
  executeActionProposal,
  getApprovalStatus,
  getLocalActionOutcome,
  isExecutableAction,
  markActionResolved,
  postApprovalDecision,
  type ActionExecContext,
} from '@/lib/office/actions/execute'

/**
 * Inline card for a proposed agent action.
 *
 * Level 0 (propose-only): a read-only preview — nothing executes.
 * Level 1 (approve-each): Approve runs the org-stamped ai_act_* RPC as the
 * signed-in user (RLS-enforced, audited), then tells the engine so the paused
 * agent resumes and confirms. Decline changes nothing.
 */

type CardStatus =
  | 'preview' // level 0 — no controls
  | 'checking' // resolving prior state on mount
  | 'idle' // awaiting the user's decision
  | 'executing'
  | 'executed'
  | 'denying'
  | 'denied'
  | 'error'

function StatusBadge({ status }: { status: CardStatus }) {
  if (status === 'executed') {
    return (
      <span className="ml-auto rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
        Applied
      </span>
    )
  }
  if (status === 'denied') {
    return (
      <span className="ml-auto rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        Declined
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="ml-auto rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
        Failed
      </span>
    )
  }
  return (
    <span className="ml-auto rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
      {status === 'preview' ? 'Proposal' : 'Needs approval'}
    </span>
  )
}

export const ActionProposalCard = memo(function ActionProposalCard({
  proposal,
  context,
}: {
  proposal: KatanaActionProposal
  /** Acting agent + chat session, recorded on the audit row. */
  context?: ActionExecContext
}) {
  const fields = proposalFields(proposal)
  const executable = isExecutableAction(proposal)
  const approvalId = proposal.approvalId

  const [status, setStatus] = useState<CardStatus>(executable ? 'checking' : 'preview')
  const [error, setError] = useState<string | null>(null)

  // On mount, settle the initial state for an executable card: a decision made
  // in this browser wins instantly; otherwise ask the engine so a decision made
  // elsewhere (or before a reload) doesn't re-arm the buttons.
  useEffect(() => {
    if (!executable || !approvalId) return
    let cancelled = false
    const local = getLocalActionOutcome(approvalId)
    if (local) {
      setStatus(local === 'executed' ? 'executed' : 'denied')
      return
    }
    void getApprovalStatus(approvalId).then((s) => {
      if (cancelled) return
      if (s === 'approved') setStatus('executed')
      else if (s === 'rejected') setStatus('denied')
      else setStatus('idle') // pending or unknown → still actionable
    })
    return () => { cancelled = true }
  }, [executable, approvalId])

  const onApprove = async () => {
    if (!approvalId) return
    setStatus('executing')
    setError(null)
    const res = await executeActionProposal(proposal, context ?? {})
    if (!res.ok) {
      setError(res.error)
      setStatus('error')
      return
    }
    // Mark locally BEFORE posting the decision so a failed post can never leave
    // the card re-armed for a second (duplicate) execution.
    markActionResolved(approvalId, 'executed')
    setStatus('executed')
    void postApprovalDecision(approvalId, true).catch(() => {
      // The write already landed; the agent just won't post its confirmation.
    })
  }

  const onDeny = async () => {
    if (!approvalId) return
    setStatus('denying')
    setError(null)
    markActionResolved(approvalId, 'denied')
    try {
      await postApprovalDecision(approvalId, false)
    } catch {
      // best-effort — the decision is recorded locally regardless
    }
    setStatus('denied')
  }

  const busy = status === 'executing' || status === 'denying'

  return (
    <div className="w-full max-w-md rounded-xl border border-primary/25 bg-primary/[0.04] px-3.5 py-3 shadow-sm">
      <div className="flex items-center gap-1.5">
        <ClipboardCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="text-xs font-semibold">{actionLabel(proposal.action)}</span>
        <StatusBadge status={status} />
      </div>

      <p className="mt-1.5 text-sm leading-snug">{proposal.summary}</p>

      {fields.length > 0 && (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
          {fields.map(({ label, value }) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="break-words">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* --- controls / status footer --- */}
      {status === 'preview' && (
        <p className="mt-2 border-t border-border/40 pt-1.5 text-[11px] text-muted-foreground">
          Preview only — nothing has been changed.
        </p>
      )}

      {status === 'checking' && (
        <p className="mt-2 border-t border-border/40 pt-1.5 text-[11px] text-muted-foreground">
          Checking…
        </p>
      )}

      {(status === 'idle' || status === 'error') && (
        <div className="mt-2.5 border-t border-border/40 pt-2.5">
          {status === 'error' && error && (
            <p className="mb-2 flex items-start gap-1.5 text-[11px] text-destructive">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span className="break-words">{error}</span>
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onApprove}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <Check className="h-3 w-3" />
              {status === 'error' ? 'Try again' : 'Approve'}
            </button>
            <button
              type="button"
              onClick={onDeny}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              <X className="h-3 w-3" />
              Decline
            </button>
            <span className="ml-auto text-[10px] text-muted-foreground">Runs as you</span>
          </div>
        </div>
      )}

      {status === 'executing' && (
        <p className="mt-2 flex items-center gap-1.5 border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Applying…
        </p>
      )}

      {status === 'executed' && (
        <p className="mt-2 flex items-center gap-1.5 border-t border-emerald-500/20 pt-2 text-[11px] text-emerald-600 dark:text-emerald-400">
          <Check className="h-3 w-3" /> Applied — the change is live.
        </p>
      )}

      {status === 'denying' && (
        <p className="mt-2 flex items-center gap-1.5 border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Declining…
        </p>
      )}

      {status === 'denied' && (
        <p className="mt-2 border-t border-border/40 pt-1.5 text-[11px] text-muted-foreground">
          Declined — nothing was changed.
        </p>
      )}
    </div>
  )
})
