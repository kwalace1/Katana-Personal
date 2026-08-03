/** next/image shim — plain <img> passthrough (no server-side optimization in Vite). */
import { forwardRef } from 'react'

export interface ImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string
  fill?: boolean
  priority?: boolean
  quality?: number
  unoptimized?: boolean
}

const Image = forwardRef<HTMLImageElement, ImageProps>(function Image(
  { src, fill, priority: _priority, quality: _quality, unoptimized: _unoptimized, style, alt = '', ...rest },
  ref,
) {
  const fillStyle: React.CSSProperties | undefined = fill
    ? { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', ...style }
    : style
  return <img ref={ref} src={src} alt={alt} style={fillStyle} {...rest} />
})

export default Image
