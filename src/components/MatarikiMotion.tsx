import type { CSSProperties } from 'react'
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

export function MatarikiMotion({ id }: { id: number }) {
  const motif = motifs[id as IllustratedScene]
  if (!motif) return null
  return <span className="matariki-motion" data-motif={motif.name} aria-hidden="true"
    style={{ '--matariki-paint': 'url("' + asset('motion/matariki-paint.webp') + '")' } as CSSProperties}>
    {motif.layers.map(([name, tile]) => <i key={name} data-detail={name}
      style={tilePosition(tile)} />)}
    {id === 18 && <TurningLeaf />}
  </span>
}
