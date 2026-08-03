import { useEffect, useRef } from 'react'
import { KATANA_AQUA_RGB, KATANA_BLUE_RGB } from '@/lib/inventory-stockroom'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  beam: number
}

/** Floating dust motes in volumetric light shafts. */
export function StockroomAtmosphere({ active = true }: { active?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !active) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let particles: Particle[] = []
    const beams = [
      { x: 0.22, spread: 0.12 },
      { x: 0.5, spread: 0.18 },
      { x: 0.78, spread: 0.12 },
    ]

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = parent.clientWidth * dpr
      canvas.height = parent.clientHeight * dpr
      canvas.style.width = `${parent.clientWidth}px`
      canvas.style.height = `${parent.clientHeight}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const w = parent.clientWidth
      const h = parent.clientHeight
      particles = Array.from({ length: Math.floor((w * h) / 12000) }, (_, i) => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.15,
        vy: -0.08 - Math.random() * 0.2,
        size: 0.6 + Math.random() * 1.4,
        alpha: 0.15 + Math.random() * 0.35,
        beam: i % beams.length,
      }))
    }

    const draw = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      ctx.clearRect(0, 0, w, h)

      for (const beam of beams) {
        const cx = w * beam.x
        const grad = ctx.createLinearGradient(cx - w * beam.spread, 0, cx + w * beam.spread, h)
        grad.addColorStop(0, `rgba(${KATANA_BLUE_RGB}, 0)`)
        grad.addColorStop(0.35, `rgba(${KATANA_BLUE_RGB}, 0.04)`)
        grad.addColorStop(1, `rgba(${KATANA_BLUE_RGB}, 0)`)
        ctx.fillStyle = grad
        ctx.fillRect(cx - w * beam.spread, 0, w * beam.spread * 2, h)
      }

      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        if (p.y < -4) {
          p.y = h + 4
          p.x = Math.random() * w
        }
        if (p.x < 0) p.x = w
        if (p.x > w) p.x = 0

        const beam = beams[p.beam]
        const beamDist = Math.abs(p.x - w * beam.x) / (w * beam.spread)
        const glow = Math.max(0, 1 - beamDist) * p.alpha

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${KATANA_AQUA_RGB}, ${glow})`
        ctx.fill()
      }

      raf = requestAnimationFrame(draw)
    }

    resize()
    draw()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas.parentElement!)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [active])

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-[1]" aria-hidden />
}
