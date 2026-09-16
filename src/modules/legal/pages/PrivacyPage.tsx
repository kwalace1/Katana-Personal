import { Link } from 'react-router-dom'
import { SUPPORT_EMAIL, TAGLINE } from '@/lib/brand'
import { LegalLayout } from '../LegalLayout'

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="September 16, 2026">
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
        Fitbit, and Strava (Plus) read the data you authorize and store copies locally. We don’t sell this
        data.
      </p>

      <h2>Notifications</h2>
      <p>
        If you enable reminders or push, we store a device token so we can send habit, event, and
        orchestration nudges you asked for. You can turn this off in Settings.
      </p>

      <h2>Contact</h2>
      <p>
        Questions or a deletion request:{' '}
        <a className="text-primary underline-offset-2 hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
          {SUPPORT_EMAIL}
        </a>
        . See also our <Link to="/terms">Terms</Link>.
      </p>
    </LegalLayout>
  )
}
