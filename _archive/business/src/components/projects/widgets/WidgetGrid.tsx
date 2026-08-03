import { ReactNode } from "react"

interface WidgetGridProps {
  children: ReactNode
  columns?: {
    sm?: number
    md?: number
    lg?: number
    xl?: number
  }
  gap?: number
  className?: string
}

/**
 * WidgetGrid - A customizable grid layout for widgets
 * 
 * @example
 * <WidgetGrid columns={{ md: 2, lg: 3 }} gap={4}>
 *   <TotalProjectsWidget {...props} />
 *   <UpcomingDeadlinesWidget {...props} />
 *   <TeamMembersWidget {...props} />
 * </WidgetGrid>
 */
export function WidgetGrid({ 
  children, 
  columns = { md: 2, lg: 3 },
  gap = 4,
  className = ""
}: WidgetGridProps) {
  const gridClasses = [
    'grid',
    `gap-${gap}`,
    columns.sm && `sm:grid-cols-${columns.sm}`,
    columns.md && `md:grid-cols-${columns.md}`,
    columns.lg && `lg:grid-cols-${columns.lg}`,
    columns.xl && `xl:grid-cols-${columns.xl}`,
    className
  ].filter(Boolean).join(' ')

  return (
    <div className={gridClasses}>
      {children}
    </div>
  )
}







