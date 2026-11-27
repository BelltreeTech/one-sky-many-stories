import { useEffect, useRef, type CSSProperties } from 'react'
import { asset } from '../data/edition'
import '../styles/matariki-motion.css'

// Each painted tile is transparent and registered to an object on the full
// portrait. In particular, the steam's transform origin is the real bowl rim.
const motifs = {
  13: { name: 'lake-memory', layers: [['night-over-memory', 0], ['memory-cloud', 1], ['memory-water', 2]] },
  14: { name: 'winter-dawn', layers: [['dawn-sill', 3], ['far-water', 2], ['breaking-water', 2]] },
  15: { name: 'luminous-mantle', layers: [['outer-mantle', 5], ['inner-mantle', 4], ['trailing-sleeve', 4]] },
  16: { name: 'river-garden', layers: [['river-current', 7], ['new-frond', 6], ['lower-frond', 6]] },
  17: { name: 'shared-meal', layers: [['pot-steam', 9], ['bowl-steam', 8], ['bowl-wisp', 9]] },
  18: { name: 'graphite-and-paper', layers: [['undrawn-paper', 10], ['paper-shadow', 18]] },
  19: { name: 'lamplit-road', layers: [['path-light', 12], ['window-light', 13]] },
  20: { name: 'farewell', layers: [['far-cloud', 14], ['near-cloud', 1], ['near-flowers', 15], ['left-flowers', 15]] },
} as const

type IllustratedScene = keyof typeof motifs

function tilePosition(tile: number) {
  return { backgroundPosition: ((tile % 4) * 100 / 3) + '% ' + (Math.floor(tile / 4) * 25) + '%' }
}

// A bent sheet has several local angles through the turn: at its midpoint
// the gutter is still visible while the outer edge already shows its verso.
const strips = 9

function PageStrip({ index }: { index: number }) {
  return <span className="notebook-strip" style={{ '--strip': index } as CSSProperties}>
    <i data-detail="turning-page" style={tilePosition(11)} />
    <i data-detail="back-of-page" style={tilePosition(16)} />
    {index < strips - 1 && <PageStrip index={index + 1} />}
  </span>
}

function TurningLeaf() {
  return <>
    <span className="notebook-hinge" style={{ '--strips': strips } as CSSProperties}><PageStrip index={0} /></span>
    <i data-detail="pencil-grip" style={tilePosition(17)} />
  </>
}

// The distant reflection is almost a single stroke. Toward the shore it
// breaks into broader, irregular facets of water. Paint this small transparent
// texture once; the scene clock moves its light across the lake.
function SunPath() {
  const surface = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = surface.current?.getContext('2d')
    if (!ctx) return
    const width = ctx.canvas.width, height = ctx.canvas.height
    let seed = 4141
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 4294967296
    }
    ctx.clearRect(0, 0, width, height)
    for (let i = 0; i < 230; i++) {
      const depth = random()
      const y = 1 + depth * (height - 4)
      const spread = .05 + .43 * depth
      const x = width * (.50 + (random() + random() - 1) * spread)
      const reach = 1.2 + (2 + 15 * depth) * random()
      const glint = ctx.createLinearGradient(x - reach, 0, x + reach, 0)
      glint.addColorStop(0, 'rgba(255,170,96,0)')
      glint.addColorStop(.44, 'rgba(255,208,151,.75)')
      glint.addColorStop(.58, 'rgba(255,242,191,.90)')
      glint.addColorStop(1, 'rgba(238,170,174,0)')
      ctx.fillStyle = glint
      ctx.globalAlpha = (.48 + random() * .48) * (1 - depth * .44)
      ctx.beginPath()
      ctx.ellipse(x, y, reach, .40 + depth * .88, (random() - .5) * .08, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }, [])
  return <canvas ref={surface} className="sun-path" width="280" height="138" />
}

function LandscapeLights({ id }: { id: number }) {
  if (id === 14) return <span className="winter-light">
    <i className="blue-hour" /><i className="dawn-rays" /><i className="sun-rim" /><SunPath />
  </span>
  if (id === 20) return <span className="farewell-light">
    <i className="lantern-falloff" /><i className="passing-star"><i /></i>
  </span>
  return <i className="painted-light" />
}

export function MatarikiMotion({ id, source }: { id: number; source: string }) {
  const motif = motifs[id as IllustratedScene]
  if (!motif) return null
  return <span className="matariki-motion" data-motif={motif.name} aria-hidden="true"
    style={{ '--matariki-paint': 'url("' + asset('motion/matariki-paint.webp') + '")',
      '--portrait-ink': 'url("' + source + '")' } as CSSProperties}>
    {motif.layers.map(([name, tile]) => <i key={name} data-detail={name}
      style={tilePosition(tile)} />)}
    {id === 18 && <TurningLeaf />}
    <LandscapeLights id={id} />
  </span>
}
