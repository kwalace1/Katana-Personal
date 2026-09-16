import { LegalLayout } from '../LegalLayout'
import { LEGAL_UPDATED, TermsBody } from '../legal-copy'

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Use" updated={LEGAL_UPDATED}>
      <TermsBody privacyTo="/privacy" />
    </LegalLayout>
  )
}
