import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { asset } from '../data/edition'
import '../styles/cinema.css'

type Shot = { file?: string; focus: string; scale: number; angle?: number }
// The opening looks past the flame toward the other travelers. The ending
// makes the opposite journey, from the friends' shoulders to the entire valley.
const shots: Record<number, Shot> = {
  1: { file: 'prologue', focus: '22% 69%', scale: 1.24 },
  2: { focus: '45% 49%', scale: 1.85, angle: -2 },
  3: { focus: '71% 25%', scale: 1.56 },
  5: { file: 'veranda', focus: '74% 68%', scale: 1.18 },
  6: { focus: '33% 68%', scale: 2.2, angle: -2 },
  8: { focus: '59% 40%', scale: 1.95, angle: -3 },
  9: { file: 'myth', focus: '56% 46%', scale: 1.26 },
  13: { file: 'lake', focus: '70% 49%', scale: 1.21 },
  16: { focus: '41% 65%', scale: 1.75 },
  17: { focus: '66% 52%', scale: 1.72, angle: 2 },
  19: { focus: '82% 43%', scale: 1.86 },
  20: { file: 'valley', focus: '47% 76%', scale: 1.17 },
}

export function warmEstablishingShot(id: number) {
  const file = shots[id]?.file
  if (!file || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const image = new Image()
  image.fetchPriority = 'low'
  image.src = asset('cinema/'+file+'.webp')
}

export function CinematicShot({ id, source }: { id: number; source: string }) {
  const [arrival, setArrival] = useState<'pending'|'ready'|'late'>('pending')
  const entered = useRef(performance.now())
  const exposure = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (arrival !== 'late' || id === 1 || id === 20) return
    // A slow download must not replace a face while a reader is studying it.
    // Join the new exposure progressively on the next natural stroke.
    const start = window.scrollY
    const element = exposure.current!
    const advance = () => {
      const alpha = Math.min(1, Math.abs(window.scrollY - start) / 88)
      element.style.setProperty('--loaded-mix', String(alpha))
      if (alpha === 1) window.removeEventListener('scroll', advance)
    }
    window.addEventListener('scroll', advance, { passive: true })
    return () => window.removeEventListener('scroll', advance)
  }, [arrival,id])
  const shot = shots[id]
  if (!shot) return null
  const type = id === 1 ? 'prologue' : id === 20 ? 'epilogue' : shot.file ? 'establish' : 'insert'
  return <span className={'film-shot shot-'+type} data-film-shot={shot.file ?? 'detail'} data-ready={arrival !== 'pending'} data-arrival={arrival}
    style={{ '--shot-focus': shot.focus, '--shot-zoom': shot.scale - 1, '--shot-roll': (shot.angle ?? 0)+'deg' } as CSSProperties}
    aria-hidden="true">
    <span ref={exposure} className="film-exposure"><img className="film-frame" alt="" decoding="async"
      src={shot.file ? asset('cinema/'+shot.file+'.webp') : source} onLoad={event=>{
        const image = event.currentTarget
        void image.decode().then(() => {
          if (image.isConnected) setArrival(performance.now() - entered.current < 700 ? 'ready' : 'late')
        }).catch(() => {})
      }} />
    </span>
  </span>
}

// The geometry of each atmospheric band follows the painted horizon. Interior
// sequences use window light in the room instead of clouds crossing the walls.
const cloudBands: Record<number, [number,number,number]> = {
  1:[17,16,1], 2:[14,13,-1], 3:[21,13,1], 4:[9,13,-1], 5:[24,13,1],
  8:[16,11,-1], 9:[19,13,1], 10:[17,18,-1], 11:[71,14,1], 12:[8,12,-1],
  13:[19,13,1], 15:[58,12,1], 16:[15,8,1], 19:[19,13,-1], 20:[31,19,-1],
}
export function SceneWeather({ id }: { id: number }) {
  const band = cloudBands[id]
  const light = [4,5,6,9,10,13,14,17,19].includes(id) ? 'amber' : 'silver'
  return <span className={'scene-weather weather-'+light} aria-hidden="true">
    {band && <span className="cloud-plane" style={{top:band[0]+'%',height:band[1]+'%','--wind-side':band[2],
      '--cloud-paint':'url("'+asset('cinema/cloudbank.webp')+'")'} as CSSProperties}><i /></span>}
    <span className="passing-light" />
  </span>
}
