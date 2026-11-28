import { useState, type CSSProperties } from 'react'
import { asset } from '../data/edition'
import '../styles/fieldnotes-motion.css'

function CourtBlinds({ source }: { source: string }) {
  // The silk hems and tassels are cuts from the plate. Repeat a short length
  // of the actual woven reed above them to unroll the blinds without stretching
  // the spacing of the slats. The window mask leaves the writer in front.
  return <svg className="court-blinds" data-field-notes="pillow-book" viewBox="0 0 438 700"
    preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <defs>
      <image id="court-original" href={source} width="438" height="700" preserveAspectRatio="none" />
      <pattern id="court-reeds" patternUnits="userSpaceOnUse" width="438" height="18">
        <use href="#court-original" y="-17" />
      </pattern>
      <clipPath id="court-window"><path d="M0 0H355V165H304Q287 175 270 180Q222 181 207 229L196 284 203 354H0Z" /></clipPath>
      <clipPath id="court-left-hem"><path d="M0 77L133 98 130 124 0 104Z M22 99L47 99 45 147 44 182 18 185 20 150Z" /></clipPath>
      <clipPath id="court-right-hem"><path d="M133 38L355 91 355 118 133 65Z M293 62L315 65 313 126 294 129Z" /></clipPath>
      <radialGradient id="court-starlight">
        <stop stopColor="#c8ddff" stopOpacity=".72"/><stop offset=".32" stopColor="#a2bdf9" stopOpacity=".23"/>
        <stop offset="1" stopColor="#8bb2ff" stopOpacity="0"/>
      </radialGradient>
    </defs>
    <g clipPath="url(#court-window)">
      <ellipse className="court-star-glow" fill="url(#court-starlight)" cx="193" cy="138" rx="72" ry="28" />
      <g className="court-blind court-left">
        <path d="M0 -230H133V100L0 80Z" fill="url(#court-reeds)" />
        <use href="#court-original" clipPath="url(#court-left-hem)" />
      </g>
      <g className="court-blind court-right">
        <path d="M133 -240H355V95L133 48Z" fill="url(#court-reeds)" />
        <use href="#court-original" clipPath="url(#court-right-hem)" />
      </g>
    </g>
  </svg>
}

function ThreeLandscapes() {
  const [arrival, setArrival] = useState<'pending' | 'ready' | 'late'>('pending')
  const source = asset('cinema/notebook-memories.webp')
  return <span className="notebook-memory" data-field-notes="three-skies" data-ready={arrival !== 'pending'} data-arrival={arrival}
    style={{ '--watercolours': 'url("' + source + '")' } as CSSProperties} aria-hidden="true">
    <img className="notebook-pigment" src={source} alt="" decoding="async" onLoad={event => {
      const image = event.currentTarget
      void image.decode().then(() => {
        if (!image.isConnected) return
        const stage = image.closest<HTMLElement>('.portrait-stage')
        const progress = Number(stage?.style.getPropertyValue('--cinematic-progress'))
        setArrival(progress > .025 ? 'late' : 'ready')
      }).catch(() => {})
    }} />
    <span className="notebook-wash wash-subaru" /><span className="notebook-wash wash-sisters" />
    <span className="notebook-wash wash-matariki" />
    <svg viewBox="0 0 438 700" preserveAspectRatio="none" focusable="false" className="notebook-skyward">
      <defs><linearGradient id="graphite-to-stars" x1="1" x2=".9" y1="1" y2="0">
        <stop stopColor="#e7c18b" stopOpacity=".15" /><stop offset=".3" stopColor="#ffe5b6" />
        <stop offset=".82" stopColor="#d2dcff" /><stop offset="1" stopColor="#fff7e6" />
      </linearGradient><radialGradient id="notebook-starlight"><stop stopColor="#fff5de" />
        <stop offset=".19" stopColor="#c6daff" stopOpacity=".8" /><stop offset="1" stopColor="#9db9ff" stopOpacity="0" />
      </radialGradient></defs>
      <path className="notebook-trail" pathLength="1" fill="none" stroke="url(#graphite-to-stars)"
        d="M292 420C330 422 380 411 411 368C453 309 462 201 435 132C420 95 391 63 347 49" />
      <ellipse className="notebook-last-star" fill="url(#notebook-starlight)" cx="347" cy="49" rx="28" ry="11"/>
    </svg>
  </span>
}

export function FieldNotesMotion({ id, source }: { id: number; source: string }) {
  if (id === 6) return <CourtBlinds source={source} />
  if (id === 18) return <ThreeLandscapes />
  return null
}
