import type { Employee } from '@/lib/hr-api'

const PLACEHOLDER_PHOTO = '/placeholder.svg?height=100&width=100'

function isUsablePhotoUrl(url: string | null | undefined): url is string {
  const trimmed = url?.trim()
  if (!trimmed) return false
  if (trimmed === PLACEHOLDER_PHOTO) return false
  return true
}

/** Prefer HR employee photo; fall back to the logged-in user's Katana profile avatar. */
export function resolveEmployeePhotoUrl(
  employee: Pick<Employee, 'photo_url'> | null | undefined,
  userAvatarUrl?: string | null
): string | null {
  if (isUsablePhotoUrl(employee?.photo_url)) return employee.photo_url.trim()
  if (isUsablePhotoUrl(userAvatarUrl)) return userAvatarUrl.trim()
  return null
}
