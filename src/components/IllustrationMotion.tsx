import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { illustrationMotion, type PaintedLayer } from '../data/illustrationMotion'
import { bindInk, followPainting } from '../engine/illustrationMotion'
import { attachLeoBook } from '../engine/leoBook'
import { LeoBook } from './LeoBook'
import '../styles/illustration-motion.css'

// Only a small window of the already decoded painting is composited. The ink
// extends past its feathered window so turning a sleeve never exposes a seam.
const bleed = .16
function PaintedDetail({ layer, source }: { layer: PaintedLayer; source: string }) {
  const [cx, cy, width, height] = layer.area
  const box: CSSProperties & { '--tint'?: string } = { left: (cx-width/2)+'%', top: (cy-height/2)+'%', width: width+'%', height: height+'%' }
  let paint: CSSProperties | undefined
  if (layer.kind === 'ink') {
    const w = width * (1 + 2 * bleed), h = height * (1 + 2 * bleed)
    const x = (cx - w/2) / (100 - w) * 100, y = (cy - h/2) / (100 - h) * 100
    paint = {
      inset: (-bleed * 100)+'%', backgroundImage: 'url("'+source+'")',
      backgroundSize: (10000/w)+'% '+(10000/h)+'%', backgroundPosition: x+'% '+y+'%',
      transformOrigin: layer.pivot ?? '50% 50%',
    }
  } else {
    box['--tint'] = layer.tint
  }
  return <span data-painted-detail={layer.name} className={'detail-'+layer.kind} style={box}>
    <i style={paint}>{layer.kind === 'petal' && <b />}</i>
  </span>
}

export function IllustrationMotion({ id, source }: { id: number; source: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const layers = illustrationMotion[id]
  useLayoutEffect(() => {
    const root = ref.current!
    const stage = root.closest<HTMLElement>('.portrait-stage')!
    if (id === 12) {
      const book = attachLeoBook(stage)
      const release = followPainting(stage, book.update)
      return () => { release(); book.destroy() }
    }
    return followPainting(stage, bindInk(root, layers))
  }, [id,layers])
  return <span ref={ref} className="illustration-details" data-illustration-motion={id} aria-hidden="true">
    {id === 12 ? <LeoBook /> : layers.map(layer => <PaintedDetail key={layer.name} layer={layer} source={source} />)}
  </span>
}
