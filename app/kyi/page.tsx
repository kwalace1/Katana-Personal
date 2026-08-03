"use client"

/**
 * Know Your Investor (KYI) module.
 * Embeds the KYI Flask app when VITE_KYI_APP_URL is set (e.g. http://localhost:5000).
 */
const KYI_APP_URL = typeof import.meta !== "undefined" && (import.meta as { env?: { VITE_KYI_APP_URL?: string } }).env?.VITE_KYI_APP_URL

export default function KYIPage() {
  if (KYI_APP_URL) {
    return (
      <div className="h-[calc(100vh-4rem)] w-full">
        <iframe
          title="Know Your Investor"
          src={KYI_APP_URL}
          className="h-full w-full border-0 rounded-lg"
        />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Know Your Investor</h1>
      <p className="text-muted-foreground mb-4">
        KYI helps you manage investors and find potential investor matches using public records (SEC filings, FEC donors, Wikidata, and more).
      </p>
      <p className="text-sm text-muted-foreground">
        To use KYI here, run the KYI app and set <code className="bg-muted px-1 rounded">VITE_KYI_APP_URL</code> in your <code className="bg-muted px-1 rounded">.env</code> (e.g. <code className="bg-muted px-1 rounded">VITE_KYI_APP_URL=http://localhost:5000</code>), then refresh.
      </p>
    </div>
  )
}
