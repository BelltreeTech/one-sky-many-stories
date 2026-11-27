import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type SyntheticEvent } from 'react'
import { asset } from '../data/edition'
import '../styles/myth-motion.css'

async function showAfterDecode(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget
  try {
    await image.decode()
    if (image.isConnected) image.dataset.ready = 'true'
  } catch { /* The complete original portrait remains underneath. */ }
}

function RegisteredPair({ name, children, style }: { name: string; children: ReactNode; style?: CSSProperties }) {
  const root = useRef<HTMLSpanElement>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let mounted = true
    // Keep the original complete painting until both the clean landscape and
    // registered figures can be shown together in the same frame.
    const images = Array.from(root.current!.querySelectorAll('img'))
    void Promise.all(images.map(image => image.decode())).then(() => {
      if (mounted) setReady(true)
    }).catch(() => {})
    return () => { mounted = false }
  }, [])
  return <span className={'myth-motion registered-pair ' + name} style={style}
    ref={root} data-ready={ready} aria-hidden="true">{children}</span>
}

// The vanishing point is the brightest painted star above the sisters. The
// currents pass behind the registered figure plate, including every face.
function AscentSky() {
  return <>
    <i className="ascent-lightshaft" />
    <svg className="ascent-currents" viewBox="0 0 400 700" preserveAspectRatio="none" focusable="false">
      <defs>
        <linearGradient id="ascent-silver" x1=".12" y1=".94" x2=".78" y2=".19" gradientUnits="objectBoundingBox">
          <stop stopColor="#8174f8" stopOpacity=".04" /><stop offset=".30" stopColor="#aca4ff" />
          <stop offset=".74" stopColor="#dbdcff" /><stop offset="1" stopColor="#ffedbd" />
        </linearGradient>
        <path pathLength="1" id="ascent-west" d="M-30 660 C-9 567 107 583 178 475 S253 267 307 149" />
        <path pathLength="1" id="ascent-middle" d="M80 647 C85 573 173 536 208 457 S275 253 307 149" />
        <path pathLength="1" id="ascent-east" d="M342 628 C309 545 359 484 328 391 S290 225 307 149" />
      </defs>
      {([['west', .02], ['middle', .11], ['east', .19]] as const).map(([side, delay]) =>
        <g key={side} fill="none" stroke="url(#ascent-silver)" strokeLinecap="round"
          style={{ '--wake-delay': delay } as CSSProperties}>
          <use href={'#ascent-'+side} className="silk-wash" />
          <use href={'#ascent-'+side} className="silk-edge" />
        </g>)}
    </svg>
    <span className="ascent-clouds"><i /><i /></span>
    <i className="ascent-star" />
  </>
}

const cloudPaint = { '--myth-cloud': 'url("' + asset('cinema/cloudbank.webp') + '")' } as CSSProperties

function SistersAscent() {
  return <RegisteredPair name="sisters-ascent" style={cloudPaint}>
    <img className="ascent-landscape" src={asset('motion/myth-sky.webp')} alt="" decoding="async" />
    <AscentSky />
    <img className="ascent-figures" src={asset('motion/sisters-ascent.webp')} alt="" decoding="async" />
  </RegisteredPair>
}

function BookOpens() {
  return <span className="myth-motion book-opens" style={cloudPaint} aria-hidden="true">
    <img className="unwritten-sky" src={asset('motion/unwritten-sky.webp')} alt="" decoding="async" onLoad={showAfterDecode} />
    <i className="page-horizon" />
    <i className="light-from-pages" />
    <svg className="page-reflections" viewBox="0 0 400 700" preserveAspectRatio="none" focusable="false">
      <defs>
        <linearGradient id="page-gold" x1="0" y1="1" x2=".06" y2="0">
          <stop stopColor="#ffdb85" /><stop offset=".38" stopColor="#ffd9a6" />
          <stop offset=".76" stopColor="#e2c6ff" /><stop offset="1" stopColor="#c9b6ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#page-gold)" strokeLinecap="round">
        <path d="M186 416 C156 396 109 400 90 360 S93 292 47 276 Q23 266 -10 269" />
        <path d="M186 416 C202 389 259 406 279 367 S289 299 346 280 Q373 272 409 275" />
      </g>
    </svg>
    <i className="lit-page-edge" />
  </span>
}

// Airborne dust originates at the three pairs of running feet. Its direction
// opposes their stride so even the small farthest figures read as moving east.
const dust = [
  [73,54,0], [75,55,.23], [69,56,.41],
  [73,78,.16], [75,77,.38], [63,82,.08], [57,83,.33],
  [27,94,.17], [24,95,.39], [31,92,.50],
]
function RidgeWind() {
  const runners = asset('motion/ridge-runners.webp')
  return <RegisteredPair name="ridge-wind" style={{ ...cloudPaint, '--runner-paint': 'url("' + runners + '")' } as CSSProperties}>
    <img className="ridge-landscape" src={asset('portrait/ridge.webp')} alt="" decoding="async" />
    <i className="distant-orion" />
    <i className="ridge-dust-veil" />
    <img className="ridge-runners" src={runners} alt="" decoding="async" />
    {dust.map(([x,y,delay], index) =>
      <i key={index} className="running-dust" style={{
        '--foot-x': x+'%', '--foot-y': y+'%', '--delay': delay,
      } as CSSProperties} />)}
  </RegisteredPair>
}

export function MythMotion({ id }: { id: number }) {
  if (id === 9) return <BookOpens />
  if (id === 10) return <RidgeWind />
  if (id === 11) return <SistersAscent />
  if (id === 12) return <span className="myth-motion book-closes" aria-hidden="true">
    <i className="closing-light" />
    <i className="pegasus-arrival" />
    <img className="pegasus-reflection" src={asset('motion/pegasus-gilt.webp')}
      alt="" decoding="async" onLoad={showAfterDecode} />
  </span>
  return null
}
