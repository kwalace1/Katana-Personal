import { Link } from 'react-router-dom'
import { SUPPORT_EMAIL, TAGLINE } from '@/lib/brand'

export const LEGAL_UPDATED = 'September 16, 2026'

export const legalProseClass =
  'space-y-6 text-sm leading-relaxed text-muted-foreground [&_h2]:font-display [&_h2]:text-xl [&_h2]:tracking-tight [&_h2]:text-foreground [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline'

export function PrivacyBody({ termsTo }: { termsTo: string }) {
  return (
    <>
      <p>
        {TAGLINE} Katana is local-first. Your day lives on this device unless you choose to sign in to
        Together or connect an app.
      </p>

      <h2>On this device</h2>
      <p>
        Tasks, calendar, habits, journal, health logs, notes, and files stay in your browser’s storage
        (IndexedDB). Opening Katana without a cloud account does not send that data to us.
      </p>

      <h2>Together (optional cloud)</h2>
      <p>
        If you create a Together account, we store the email you use to sign in, your display name, friend
        code, and only the posts, plans, and Circles you choose to share. Cloud workspace sync is opt-in.
        You can erase this device and delete your Together account in Settings → Privacy & data.
      </p>

      <h2>Ask and meal AI</h2>
      <p>
        Rules-based Ask runs on your device. Open-ended Ask and meal photo / Nutrition Facts estimates send
        your question or a compressed image — plus a short snapshot of your day when needed — to our model
        provider (OpenRouter). We do not use that content to train our own models.
      </p>

      <h2>Integrations</h2>
      <p>
        Calendar subscribe URLs (.ics) are fetched so events can live on this device. Google Calendar,
        Outlook, Google Tasks, and Todoist (when connected) read the data you authorize and store copies
        locally. Weather uses Open-Meteo with your device location. Apple Health and Fitbit file imports
        stay on this device. We don’t sell this data.
      </p>

      <h2>Notifications</h2>
      <p>
        If you enable reminders or push, we store a device token so we can send habit, event, and
        orchestration nudges you asked for. You can turn this off in Settings.
      </p>

      <h2>Contact</h2>
      <p>
        Questions or a deletion request:{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        . See also our <Link to={termsTo}>Terms</Link>.
      </p>
    </>
  )
}

export function TermsBody({ privacyTo }: { privacyTo: string }) {
  return (
    <>
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
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        . Privacy details: <Link to={privacyTo}>Privacy Policy</Link>.
      </p>
    </>
  )
}
