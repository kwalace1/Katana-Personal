import { useState } from 'react'
import { MotionPage } from '@/components/motion-page'
import { migrateInitialData, clearAllData } from '@/lib/migrate-data'
import { updateAllTaskDatesToToday } from '@/lib/update-dates'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2, Database, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { isUsingSupabase } from '@/lib/project-data-supabase'

export default function MigratePage() {
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  
  const usingSupabase = isUsingSupabase()
  
  const handleMigrate = async () => {
    setLoading(true)
    setStatus('Migrating data to database...')
    setSuccess(false)
    
    try {
      const result = await migrateInitialData()
      
      if (result.success) {
        setStatus('✅ Migration completed successfully! You can now use your project management system.')
        setSuccess(true)
      } else {
        setStatus('❌ Migration failed. Check console for details.')
        console.error('Migration error:', result.error)
      }
    } catch (err) {
      setStatus('❌ Error: ' + String(err))
      console.error('Migration error:', err)
    } finally {
      setLoading(false)
    }
  }
  
  const handleClear = async () => {
    if (!window.confirm('⚠️ This will DELETE ALL data from your database. Are you absolutely sure?')) {
      return
    }
    
    if (!window.confirm('⚠️ FINAL WARNING: This action cannot be undone. Continue?')) {
      return
    }
    
    setLoading(true)
    setStatus('Clearing all data...')
    setSuccess(false)
    
    try {
      const result = await clearAllData()
      
      if (result.success) {
        setStatus('✅ All data cleared successfully.')
        setSuccess(true)
      } else {
        setStatus('❌ Clear failed. Check console for details.')
        console.error('Clear error:', result.error)
      }
    } catch (err) {
      setStatus('❌ Error: ' + String(err))
      console.error('Clear error:', err)
    } finally {
      setLoading(false)
    }
  }
  
  const handleUpdateDates = async () => {
    setLoading(true)
    setStatus('Clearing all deadlines from tasks and projects...')
    setSuccess(false)
    
    try {
      const result = await updateAllTaskDatesToToday()
      
      if (result.success) {
        setStatus(`✅ Successfully cleared all deadlines!`)
        setSuccess(true)
        
        // Trigger a page reload to refresh the UI
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      } else {
        setStatus('❌ Clear failed. Check console for details.')
        console.error('Update error:', result.error)
      }
    } catch (err) {
      setStatus('❌ Error: ' + String(err))
      console.error('Update error:', err)
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <MotionPage subtle className="min-h-screen flex items-center justify-center p-8 bg-background">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <Database className="h-8 w-8" />
            <CardTitle className="text-2xl">Database Migration</CardTitle>
          </div>
          <CardDescription>
            Populate your database with initial project data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Card */}
          <div className={`p-4 rounded-lg border ${
            usingSupabase 
              ? 'bg-green-500/10 border-green-500/20' 
              : 'bg-yellow-500/10 border-yellow-500/20'
          }`}>
            <div className="flex items-center gap-2">
              {usingSupabase ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="font-semibold text-green-700 dark:text-green-400">
                    Database Connected
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  <span className="font-semibold text-yellow-700 dark:text-yellow-400">
                    Database Not Configured
                  </span>
                </>
              )}
            </div>
            {!usingSupabase && (
              <p className="text-sm text-muted-foreground mt-2">
                Make sure your .env file has VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY set, then restart the dev server.
              </p>
            )}
          </div>

          {/* Instructions */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <h3 className="font-semibold">What this does:</h3>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Creates 5 sample projects</li>
              <li>Adds tasks, team members, and milestones to first project</li>
              <li>Populates files and activities</li>
              <li>Sets up demo data for testing</li>
            </ul>
          </div>

          {/* Migration Button */}
          <Button 
            onClick={handleMigrate} 
            className="w-full"
            disabled={loading || !usingSupabase}
            size="lg"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {success ? 'Migrate Again' : 'Migrate Initial Data'}
          </Button>

          {/* Clear Button */}
          <Button 
            onClick={handleClear} 
            variant="destructive" 
            className="w-full"
            disabled={loading || !usingSupabase}
            size="lg"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Clear All Data (Danger!)
          </Button>

          {/* Clear Deadlines Button */}
          <Button 
            onClick={handleUpdateDates} 
            variant="outline" 
            className="w-full"
            disabled={loading || !usingSupabase}
            size="lg"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Clear All Deadlines (Tasks & Projects)
          </Button>

          {/* Status Message */}
          {status && (
            <div className={`p-4 rounded-lg border ${
              success 
                ? 'bg-green-500/10 border-green-500/20' 
                : status.includes('❌')
                ? 'bg-red-500/10 border-red-500/20'
                : 'bg-blue-500/10 border-blue-500/20'
            }`}>
              <p className="text-center font-semibold">{status}</p>
              {success && (
                <div className="mt-3 text-center">
                  <Button variant="outline" onClick={() => window.location.href = '/projects'}>
                    Go to Projects →
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Help Text */}
          <div className="text-sm text-muted-foreground text-center pt-4 border-t">
            <p>Run migration once after setting up your database.</p>
            <p className="mt-1">You can safely delete this page after migration.</p>
          </div>
        </CardContent>
      </Card>
    </MotionPage>
  )
}

