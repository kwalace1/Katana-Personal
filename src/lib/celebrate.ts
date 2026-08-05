/** Lightweight DOM confetti — no extra dependency, works in iOS Safari / PWA. */
export function burstConfetti(origin?: HTMLElement | null) {
  if (typeof document === 'undefined') return

  const rect = origin?.getBoundingClientRect()
  const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
  const y = rect ? rect.top + rect.height / 2 : window.innerHeight * 0.35

  const root = document.createElement('div')
  root.setAttribute('aria-hidden', 'true')
  root.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden'
  document.body.appendChild(root)

  const colors = ['#10b981', '#34d399', '#f59e0b', '#3b82f6', '#ec4899', '#a78bfa', '#f472b6']
  const count = 32

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('span')
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5
    const dist = 48 + Math.random() * 100
    const w = 5 + Math.random() * 7
    const h = 4 + Math.random() * 5
    const rot = Math.random() * 360
    const dx = Math.cos(angle) * dist
    const dy = Math.sin(angle) * dist - 20 - Math.random() * 40

    piece.style.cssText = [
      'position:fixed',
      `left:${x}px`,
      `top:${y}px`,
      `width:${w}px`,
      `height:${h}px`,
      `background:${colors[i % colors.length]}`,
      'border-radius:1px',
      `transform:translate(-50%,-50%) rotate(${rot}deg) scale(0.4)`,
      'opacity:1',
      'transition:transform 720ms cubic-bezier(0.12,0.8,0.28,1), opacity 720ms ease',
    ].join(';')

    root.appendChild(piece)

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        piece.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${rot + 480 + Math.random() * 240}deg) scale(1)`
        piece.style.opacity = '0'
      })
    })
  }

  window.setTimeout(() => root.remove(), 850)
}
