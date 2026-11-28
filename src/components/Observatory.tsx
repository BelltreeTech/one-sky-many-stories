import type { SyntheticEvent } from 'react'
import { asset } from '../data/edition'
import '../styles/observatory.css'

// The star field has its own recovery and starts the scene clock. Developing a
// decorative plate later must never hold that clock or replace the final view.
function develop(event: SyntheticEvent<HTMLImageElement>) {
  const plate = event.currentTarget
  void plate.decode().then(() => {
    if (!plate.isConnected) return
    const lens = plate.closest<HTMLElement>('.lens-field')
    plate.dataset.arrival = Number(lens?.style.getPropertyValue('--optical-time')) > .03 ? 'late' : 'ready'
  }).catch(() => {})
}

export function Observatory() {
  return <span className="observatory" aria-hidden="true">
    <span className="observatory-dust">
      <img src={asset('cinema/reflection-dust.webp')} alt="" decoding="async" onLoad={develop} />
    </span>
    <span className="observatory-eyepiece">
      <span className="brass-flight">
        <img src={asset('cinema/brass-eyepiece.webp')} alt="" decoding="async" onLoad={develop} />
      </span>
    </span>
  </span>
}
