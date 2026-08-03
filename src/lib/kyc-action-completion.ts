/**
 * Side effects when a KYC-linked CS task is marked completed — updates contact data and logs touchpoints.
 */

import { supabase } from './supabase'
import { updateClient, createInteraction } from './customer-success-api'
import {
  findKnownAction,
  interactionSubjectForAction,
  interactionTypeForKycAction,
  isKycTouchpointAction,
} from './kyc-action-resolution'
import { outreachStatusFromKycActionCompletion, syncClientOutreachStatus } from './kyc-outreach-sync'

export async function applyKycActionCompletionEffects(
  clientId: string,
  actionId: string,
  options?: { csmId?: string | null },
): Promise<void> {
  const known = findKnownAction(actionId)
  if (!known) return

  const nowIso = new Date().toISOString()

  if (isKycTouchpointAction(actionId)) {
    await updateClient(clientId, { last_contact_date: nowIso })

    if (actionId === 'executive-meeting') {
      await touchDecisionMakerContacts(clientId, nowIso)
    }

    await createInteraction({
      client_id: clientId,
      type: interactionTypeForKycAction(actionId),
      subject: interactionSubjectForAction(known),
      description: `Logged automatically when the "${known.label}" customer success task was marked complete.`,
      csm_id: options?.csmId ?? null,
      interaction_date: nowIso,
    })
  }

  if (actionId === 'find-sponsor') {
    await updateClient(clientId, { last_contact_date: nowIso })
  }

  const outreach = outreachStatusFromKycActionCompletion(actionId)
  if (outreach) {
    await syncClientOutreachStatus(clientId, outreach)
  }
}

async function touchDecisionMakerContacts(clientId: string, touchedAt: string): Promise<void> {
  const { data: contacts, error } = await supabase
    .from('cs_contacts')
    .select('id, is_decision_maker, contact_role')
    .eq('client_id', clientId)

  if (error) {
    console.error('touchDecisionMakerContacts:', error)
    return
  }

  const dmIds = (contacts ?? [])
    .filter((c) => c.is_decision_maker === true || c.contact_role === 'decision_maker')
    .map((c) => c.id as string)

  if (dmIds.length === 0) return

  const { error: updateError } = await supabase
    .from('cs_contacts')
    .update({ last_contact_date: touchedAt })
    .in('id', dmIds)

  if (updateError) {
    console.error('touchDecisionMakerContacts update:', updateError)
  }
}
