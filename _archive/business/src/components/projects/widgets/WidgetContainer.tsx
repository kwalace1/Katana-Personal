import { ReactNode } from "react"

interface WidgetContainerProps {
  children: ReactNode
  span?: {
    sm?: number
    md?: number
    lg?: number
    xl?: number
  }
  className?: string
}

/**
 * WidgetContainer - A wrapper for individual widgets that controls their grid span
 * 
 * @example
 * <WidgetContainer span={{ md: 2, lg: 1 }}>
 *   <TotalProjectsWidget {...props} />
 * </WidgetContainer>
 */
export function WidgetContainer({ 
  children, 
  span,
  className = ""
}: WidgetContainerProps) {
  const spanClasses = [
    span?.sm && `sm:col-span-${span.sm}`,
    span?.md && `md:col-span-${span.md}`,
    span?.lg && `lg:col-span-${span.lg}`,
    span?.xl && `xl:col-span-${span.xl}`,
    className
  ].filter(Boolean).join(' ')

  return (
    <div className={spanClasses}>
      {children}
    </div>
  )
}







