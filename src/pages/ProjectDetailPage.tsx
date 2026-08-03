import { useParams, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ProjectDetail } from '@/components/projects/project-detail'
import { getProjectById } from '@/lib/project-data-supabase'
import type { Project } from '@/lib/project-data'

export default function ProjectDetailPage() {
  const { id } = useParams()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadProject = async () => {
      if (!id) {
        setError('No project ID provided')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)
        const data = await getProjectById(id)
        if (data) {
          setProject(data)
        } else {
          setError('Project not found')
        }
      } catch (err) {
        console.error('Error loading project:', err)
        setError('Failed to load project')
      } finally {
        setLoading(false)
      }
    }

    loadProject()
  }, [id])

  if (!id) {
    return <div>Project not found</div>
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <Link to="/projects">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Katana PM
            </Button>
          </Link>
          <div className="mt-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-4" />
            <p className="text-lg font-semibold">{error || 'Project not found'}</p>
          </div>
        </div>
      </div>
    )
  }

  return <ProjectDetail projectId={id} />
}
