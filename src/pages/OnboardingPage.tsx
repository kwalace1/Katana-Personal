import { OrganizationSetup } from '@/components/onboarding/OrganizationSetup'
import { MotionPage } from '@/components/motion-page'

export default function OnboardingPage() {
  return (
    <MotionPage subtle className="min-h-screen bg-background min-w-0">
      <OrganizationSetup />
    </MotionPage>
  )
}







