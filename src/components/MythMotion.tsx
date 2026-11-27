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

function SistersAscent() {
  return <RegisteredPair name="sisters-ascent">
    <img className="ascent-landscape" src={asset('motion/myth-sky.webp')} alt="" decoding="async" />
    <img className="ascent-figures" src={asset('motion/sisters-ascent.webp')} alt="" decoding="async" />
  </RegisteredPair>
}

function BookOpens() {
  return <span className="myth-motion book-opens" aria-hidden="true">
    <img className="unwritten-sky" src={asset('motion/unwritten-sky.webp')} alt="" decoding="async" onLoad={showAfterDecode} />
    <i className="light-from-pages" />
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
  return <RegisteredPair name="ridge-wind" style={{ '--runner-paint': 'url("' + runners + '")' } as CSSProperties}>
    <img className="ridge-landscape" src={asset('portrait/ridge.webp')} alt="" decoding="async" />
    <i className="distant-orion" />
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
    <img className="pegasus-reflection" src={asset('motion/pegasus-gilt.webp')}
      alt="" decoding="async" onLoad={showAfterDecode} />
  </span>
  return null
}
