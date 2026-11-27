import type { SyntheticEvent } from 'react'
import { asset } from '../data/edition'
import '../styles/leo-book.css'

async function registerPainting(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget
  try {
    await image.decode()
    if (image.isConnected) {
      image.dataset.decoded = 'true'
      image.dispatchEvent(new Event('leo-book-decoded', { bubbles: true }))
    }
  } catch { /* The closed book is part of the main illustration. */ }
}

export function LeoBook() {
  return <span className="leo-book" aria-hidden="true">
    <img hidden alt="" decoding="async" src={asset('motion/leo-book.webp')} onLoad={registerPainting} />
    <canvas width="215" height="206" />
  </span>
}
