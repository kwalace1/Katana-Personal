import React from 'react'

interface EmployeeAvatarProps {
  name: string
  photoUrl?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'profile'
  className?: string
  showStatus?: boolean
  status?: 'active' | 'away' | 'offline'
}

const sizeClasses = {
  xs: 'w-10 h-10 text-sm',
  sm: 'w-8 h-8 text-sm',
  md: 'w-12 h-12 text-base',
  lg: 'w-20 h-20 text-2xl',
  xl: 'w-14 h-14 text-lg',
  profile: 'w-32 h-32 text-4xl',
}

export function EmployeeAvatar({ 
  name, 
  photoUrl, 
  size = 'md', 
  className = '',
  showStatus = false,
  status = 'active'
}: EmployeeAvatarProps) {
  const [imageError, setImageError] = React.useState(false)
  const initials = name.split(' ').map(n => n[0]).join('')
  const hasValidPhoto = photoUrl && photoUrl !== "/placeholder.svg?height=100&width=100" && !imageError

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500'
      case 'away': return 'bg-yellow-500'
      case 'offline': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className={`relative ${className}`}>
      {hasValidPhoto ? (
        <img 
          src={photoUrl!} 
          alt={name}
          className={`${sizeClasses[size]} rounded-full object-cover border-2 border-background`}
          onError={() => setImageError(true)}
        />
      ) : (
        <div className={`${sizeClasses[size]} rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary`}>
          {initials}
        </div>
      )}
      {showStatus && (
        <div className={`absolute bottom-0 right-0 ${size === 'lg' ? 'w-4 h-4' : 'w-3 h-3'} rounded-full ${getStatusColor(status)} border-2 border-background`} />
      )}
    </div>
  )
}







