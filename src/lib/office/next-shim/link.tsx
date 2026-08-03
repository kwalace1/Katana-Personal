/** next/link shim — translates office hrefs into Katana router links. */
import { forwardRef } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { officeToKatana } from './navigation'

export interface LinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string
  prefetch?: boolean
  replace?: boolean
  scroll?: boolean
  children?: React.ReactNode
}

const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, prefetch: _prefetch, replace, scroll: _scroll, children, ...rest },
  ref,
) {
  const external = /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')
  if (external) {
    return (
      <a ref={ref} href={href} {...rest}>
        {children}
      </a>
    )
  }
  return (
    <RouterLink ref={ref} to={officeToKatana(href)} replace={replace} {...rest}>
      {children}
    </RouterLink>
  )
})

export default Link
