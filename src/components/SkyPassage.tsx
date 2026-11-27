import type { CSSProperties, SyntheticEvent } from 'react'
import { asset } from '../data/edition'
import '../styles/sky-passage.css'

function showDecoded(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget
  void image.decode().then(() => {
    if (!image.isConnected) return
    const stage = image.closest<HTMLElement>('.portrait-stage')
    const elapsed = Number(stage?.style.getPropertyValue('--cinematic-progress'))
    if (elapsed > .025) image.dataset.late = 'true'
    image.dataset.ready = 'true'
  }).catch(() => {})
}

// The upper stream crosses the sky; the nearest petals pass down the left
// of the veranda, below the branch and clear of the two readers' faces.
const petals = [
  { x: 8, y: 8, size: 12, drift: 82, fall: 23, start: .03, spin: 128, tile: 1 },
  { x: 30, y: 13, size: 5, drift: 52, fall: 15, start: .14, spin: -156, tile: 2 },
  { x: -9, y: 23, size: 16, drift: 33, fall: 26, start: .10, spin: -108, tile: 0 },
  { x: 52, y: 7, size: 7, drift: 50, fall: 19, start: .22, spin: 178, tile: 3 },
  { x: -4, y: 16, size: 8, drift: 68, fall: 13, start: .26, spin: 122, tile: 2 },
  { x: 71, y: 15, size: 9, drift: 32, fall: 18, start: .13, spin: -136, tile: 0 },
]

export function SkyPassage({ id }: { id: 1 | 5 }) {
  if (id === 1) return <span className="sky-passage" data-sky-passage="cloud-descent" aria-hidden="true">
    <img className="valley-flight" src={asset('cinema/cloud-descent.webp')} alt="" decoding="async" onLoad={showDecoded} />
    <span className="cloud-wing cloud-wing-west" style={{backgroundImage: 'url(' + asset('cinema/cloudbank.webp') + ')'}} />
    <span className="cloud-wing cloud-wing-east" style={{backgroundImage: 'url(' + asset('cinema/cloudbank.webp') + ')'}} />
  </span>

  return <span className="sky-passage" data-sky-passage="cherry-wind" aria-hidden="true">
    <img className="cherry-bough" src={asset('cinema/cherry-bough.webp')} alt="" decoding="async" onLoad={showDecoded} />
    {petals.map(({ x, y, size, drift, fall, start, spin, tile }, i) =>
      <span className="near-petal" key={i} style={{
        left: x + '%', top: y + '%', width: size + '%', '--drift': drift + 'cqw', '--fall': fall + 'cqh',
        '--start': start, '--spin': spin + 'deg', '--tile-x': -(tile % 2) * 50 + '%',
        '--tile-y': -Math.floor(tile / 2) * 50 + '%',
      } as CSSProperties}>
        <span className="petal-curl"><img src={asset('cinema/cherry-petals.webp')} alt="" decoding="async" onLoad={showDecoded} /></span>
      </span>)}
  </span>
}
