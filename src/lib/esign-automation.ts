/**
 * Optional quiet hooks for future automation.
 * Intentionally does NOT POST to external webhook URLs from the product UI.
 */
export type EsignAutomationEvent =
  | 'document_created'
  | 'document_sent'
  | 'document_signed'
  | 'document_cancelled'
  | 'document_reminded'
  | 'signer_signed'

export async function emitEsignAutomationEvent(
  eventName: EsignAutomationEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  if (import.meta.env.DEV) {
    console.debug('[esign]', eventName, payload)
  }
}
