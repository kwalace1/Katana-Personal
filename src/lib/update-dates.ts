import { supabase } from './supabase'
import { getOrganizationId } from './auth-helpers'

/**
 * Clear deadlines from tasks and projects for the current organization only
 */
export async function clearAllDeadlines() {
  console.log('Clearing org-scoped task and project deadlines...')

  try {
    const organizationId = await getOrganizationId()
    if (!organizationId) {
      return { success: false, error: new Error('No organization found for current user') }
    }

    const { data: orgProjects, error: projectsQueryError } = await supabase
      .from('projects')
      .select('id')
      .eq('organization_id', organizationId)

    if (projectsQueryError) {
      console.error('Error fetching org projects:', projectsQueryError)
      return { success: false, error: projectsQueryError }
    }

    const projectIds = (orgProjects ?? []).map((p) => p.id as string)

    if (projectIds.length > 0) {
      const { error: taskError } = await supabase
        .from('tasks')
        .update({ deadline: null })
        .in('project_id', projectIds)

      if (taskError) {
        console.error('Error clearing task deadlines:', taskError)
        return { success: false, error: taskError }
      }
    }

    const { error: projectError } = await supabase
      .from('projects')
      .update({ deadline: null })
      .eq('organization_id', organizationId)

    if (projectError) {
      console.error('Error clearing project deadlines:', projectError)
      return { success: false, error: projectError }
    }

    console.log('Successfully cleared org deadlines')
    return { success: true }
  } catch (err) {
    console.error('Error:', err)
    return { success: false, error: err }
  }
}

/**
 * Update all tasks in database to have today's date (kept for backwards compatibility)
 */
export async function updateAllTaskDatesToToday() {
  return clearAllDeadlines()
}
