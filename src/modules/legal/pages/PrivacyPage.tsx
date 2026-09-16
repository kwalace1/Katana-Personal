import { LegalLayout } from '../LegalLayout'
import { LEGAL_UPDATED, PrivacyBody } from '../legal-copy'

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated={LEGAL_UPDATED}>
      <PrivacyBody termsTo="/terms" />
    </LegalLayout>
  )
}
