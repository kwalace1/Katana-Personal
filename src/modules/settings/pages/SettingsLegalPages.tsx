import { LEGAL_UPDATED, PrivacyBody, TermsBody, legalProseClass } from '@/modules/legal/legal-copy'
import { SettingsDetail } from '../components/settings-ui'

export function SettingsLegalPrivacyPage() {
  return (
    <SettingsDetail title="Privacy Policy" description={`Last updated ${LEGAL_UPDATED}`}>
      <article className={legalProseClass}>
        <PrivacyBody termsTo="/settings/legal/terms" />
      </article>
    </SettingsDetail>
  )
}

export function SettingsLegalTermsPage() {
  return (
    <SettingsDetail title="Terms of Use" description={`Last updated ${LEGAL_UPDATED}`}>
      <article className={legalProseClass}>
        <TermsBody privacyTo="/settings/legal/privacy" />
      </article>
    </SettingsDetail>
  )
}
