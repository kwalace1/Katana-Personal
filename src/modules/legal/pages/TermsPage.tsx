import { Link } from 'react-router-dom'
import { SUPPORT_EMAIL, TAGLINE } from '@/lib/brand'
import { LegalLayout } from '../LegalLayout'

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Use" updated="September 16, 2026">
      <p>
        {TAGLINE} By using Katana Personal you agree to these terms. If you don’t, please don’t use the
        app.
      </p>

      <h2>What Katana is</h2>
      <p>
        Katana is a personal daily OS — Today, Ask, optional Together, and Plan / Life tools. It is not
        medical advice, therapy, or a substitute for a clinician. Health logging is for your own tracking.
      </p>

      <h2>Your space</h2>
      <p>
        You are responsible for what you capture, log, and share. Don’t use Katana to harm others or to
        store content you don’t have the right to keep. You can export a copy and erase this device anytime
        in Settings.
      </p>

      <h2>Together and Plus</h2>
      <ul>
        <li>Together is optional. Only share what you’re comfortable friends seeing.</li>
        <li>
          Katana Plus (the Accountability pack) is optional paid access to extra Ask depth, meal AI, live
          integrations, Circle challenges, and advanced templates. Billing will run through the store or
          Stripe when enabled.
        </li>
      </ul>

      <h2>Accounts</h2>
      <p>
        Keep your Together password to yourself. You can delete your account in Settings → Privacy & data.
        We may suspend accounts that abuse friends, Circles, or our APIs.
      </p>

      <h2>Contact</h2>
      <p>
        <a className="text-primary underline-offset-2 hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
          {SUPPORT_EMAIL}
        </a>
        . Privacy details: <Link to="/privacy">Privacy Policy</Link>.
      </p>
    </LegalLayout>
  )
}
