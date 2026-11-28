import type { CSSProperties } from 'react'
import { asset } from '../data/edition'
import '../styles/nightfall-motion.css'

export function NightfallMotion({ id, source }: { id: 3 | 4; source: string }) {
  if (id === 3) return <span className="nightfall-film" data-nightfall="starward" aria-hidden="true"
    style={{ '--nightfall-plate': 'url("' + source + '")' } as CSSProperties}>
    <span className="starward-camera">
      <i className="galactic-light" />
      <i className="cluster-halo" />
    </span>
  </span>

  return <span className="nightfall-film" data-nightfall="remembering" aria-hidden="true">
    <i className="memory-lantern" />
    <span className="memory-air">
      <span className="snow-country">
        <img src={asset('cinema/veranda.webp')} alt="" decoding="async" onLoad={event => {
          const image = event.currentTarget
          void image.decode().then(() => {
            if (image.isConnected) image.dataset.ready = 'true'
          }).catch(() => {})
        }} />
      </span>
    </span>
  </span>
}
