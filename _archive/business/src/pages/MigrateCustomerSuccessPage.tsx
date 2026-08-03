import { useState } from 'react'
import { MotionPage } from '@/components/motion-page'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, XCircle, Loader2, AlertCircle, Trash2 } from "lucide-react"
import * as api from '@/lib/customer-success-api'

export default function MigrateCustomerSuccessPage() {
  const [isRunning, setIsRunning] = useState(false)
  const [isWiping, setIsWiping] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle')

  const addLog = (message: string) => {
    setLogs(prev => [...prev, message])
  }

  const wipeCSPData = async () => {
    if (!window.confirm('Permanently delete all clients, CSM users, tasks, milestones, and interactions from the CSP? This cannot be undone.')) return
    setIsWiping(true)
    setLogs([])
    setStatus('running')
    try {
      addLog('🗑️ Wiping all CSP data...')
      const result = await api.wipeAllCSPData()
      if (result.success) {
        addLog('✅ All CSP data deleted. System is now blank.')
        addLog('🎉 Wipe completed. Redirecting to CSP...')
        setStatus('success')
        setTimeout(() => {
          window.location.href = '/customer-success?t=' + Date.now()
        }, 800)
      } else {
        addLog(`❌ Wipe failed: ${result.error ?? 'Unknown error'}`)
        setStatus('error')
      }
    } catch (error) {
      addLog(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setStatus('error')
    } finally {
      setIsWiping(false)
    }
  }

  const runMigration = async () => {
    setIsRunning(true)
    setStatus('running')
    setLogs([])

    try {
      addLog('🚀 Katana Customers migration (blank system)...')

      const existingClients = await api.getAllClients()

      if (existingClients.length > 0) {
        addLog(`✅ ${existingClients.length} client(s) already in database. No sample data added.`)
      } else {
        addLog('✅ Blank system – no sample data inserted. Add clients via the app.')
      }
      addLog('🎉 Migration check completed.')
      setStatus('success')
    } catch (error) {
      console.error('Migration error:', error)
      addLog(`❌ Error during migration: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setStatus('error')
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <MotionPage subtle className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Customer Success Data Migration</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              This is a blank system. The migration does not insert sample data; add clients via the Customer Success Platform.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border rounded-lg bg-muted/50">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Before Running:
              </h3>
              <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
                <li>Ensure you've run the <code className="bg-muted px-1 py-0.5 rounded">customer-success-schema.sql</code> in the SQL Editor</li>
                <li>Verify your <code className="bg-muted px-1 py-0.5 rounded">.env</code> file has correct database credentials</li>
                <li>This migration is safe to run multiple times (it checks for existing data)</li>
              </ul>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <Button 
                onClick={runMigration} 
                disabled={isRunning || isWiping}
                className="flex items-center gap-2"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Running Migration...
                  </>
                ) : (
                  <>
                    {status === 'success' && !isWiping ? 'Run Again' : 'Start Migration'}
                  </>
                )}
              </Button>
              <Button 
                variant="destructive" 
                onClick={wipeCSPData} 
                disabled={isRunning || isWiping}
                className="flex items-center gap-2"
              >
                {isWiping ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Wiping...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Wipe all CSP data
                  </>
                )}
              </Button>
              {(status === 'success' || status === 'idle') && (
                <Button variant="outline" onClick={() => window.location.href = '/customer-success'}>
                  Go to Katana Customers
                </Button>
              )}
            </div>

            {/* Migration Log */}
            {logs.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    {status === 'running' && <Loader2 className="w-4 h-4 animate-spin" />}
                    {status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                    {status === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
                    Migration Log
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-black/90 text-white p-4 rounded-lg font-mono text-sm space-y-1 max-h-96 overflow-y-auto">
                    {logs.map((log, index) => (
                      <div key={index} className="whitespace-pre-wrap">
                        {log}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Status Messages */}
            {status === 'success' && (
              <div className="p-4 border border-green-500/20 bg-green-500/10 rounded-lg">
                <div className="flex items-center gap-2 text-green-500 font-semibold mb-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Migration Completed Successfully!
                </div>
                <p className="text-sm text-muted-foreground">
                  Your database has been populated with sample data. You can now navigate to Katana Customers to see it in action.
                </p>
              </div>
            )}

            {status === 'error' && (
              <div className="p-4 border border-red-500/20 bg-red-500/10 rounded-lg">
                <div className="flex items-center gap-2 text-red-500 font-semibold mb-2">
                  <XCircle className="w-5 h-5" />
                  Migration Failed
                </div>
                <p className="text-sm text-muted-foreground">
                  Check the migration log above for details. Common issues:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc mt-2">
                  <li>Database schema not created (run customer-success-schema.sql first)</li>
                  <li>Invalid database credentials in .env file</li>
                  <li>Network connection issues</li>
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MotionPage>
  )
}

