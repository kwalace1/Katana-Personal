/** next/dynamic shim — React.lazy with built-in Suspense boundary. */
import { lazy, Suspense, type ComponentType } from 'react'

type Loader<P> = () => Promise<{ default: ComponentType<P> } | ComponentType<P>>

interface DynamicOptions {
  ssr?: boolean
  loading?: ComponentType
}

export default function dynamic<P extends object = Record<string, never>>(
  loader: Loader<P>,
  options?: DynamicOptions,
): ComponentType<P> {
  const LazyComp = lazy(async () => {
    const mod = await loader()
    return 'default' in mod ? (mod as { default: ComponentType<P> }) : { default: mod as ComponentType<P> }
  })
  const Loading = options?.loading
  const AnyLazy = LazyComp as unknown as ComponentType<P>
  function DynamicComponent(props: P) {
    return (
      <Suspense fallback={Loading ? <Loading /> : null}>
        <AnyLazy {...props} />
      </Suspense>
    )
  }
  return DynamicComponent
}
