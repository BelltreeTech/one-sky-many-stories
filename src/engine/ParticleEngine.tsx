import { useEffect, useRef } from 'react'

export function ParticleEngine({ running }: { running: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')
    if (!ctx || !running) {
      canvas.dataset.running = 'false'
      ctx?.clearRect(0, 0, canvas.width, canvas.height)
      return
    }
    // A single half-density surface serves the visible viewport. Static positions
    // prevent stardust from competing with words or suggesting constellation lines.
    let width = 0, height = 0, frame = 0, last = -100
    const resize = () => {
      width = canvas.clientWidth
      height = canvas.clientHeight
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    }
    const fractional = (v: number) => v - Math.floor(v)
    const stars = Array.from({ length: 68 }, (_, index) => ({
      x: fractional(Math.sin(index * 77.31 + 1) * 4567.12),
      y: fractional(Math.sin(index * 19.91 + 2) * 8321.72),
      r: index % 9 === 0 ? 1.2 : 0.64,
      phase: index * 1.873,
    }))
    const draw = (time: number) => {
      if (time - last >= 65) {
        ctx.clearRect(0, 0, width, height)
        for (const star of stars) {
          ctx.globalAlpha = 0.12 + 0.30 * (1 + Math.sin(time / 2300 + star.phase)) / 2
          ctx.fillStyle = '#f6dfa8'
          ctx.beginPath()
          ctx.arc(star.x * width, star.y * height, star.r, 0, 2 * Math.PI)
          ctx.fill()
        }
        last = time
      }
      frame = requestAnimationFrame(draw)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    canvas.dataset.running = 'true'
    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      canvas.dataset.running = 'false'
      ctx.clearRect(0, 0, width, height)
    }
  }, [running])
  return <canvas ref={ref} className="starlight" aria-hidden="true" />
}
