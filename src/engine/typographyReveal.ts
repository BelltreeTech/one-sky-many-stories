import type { Scene } from '../data/edition'
import { portraitDirections } from '../data/portrait'

// Each discovery is a separate, selectable passage reached by native scrolling.
export function portraitBeats(scene: Scene): string[] {
  const marker = portraitDirections[scene.id]?.nextBeat
  const index = marker ? scene.text.indexOf(marker) : -1
  // The space preceding the next sentence stays in the original text node.
  return index > 0 ? [scene.text.slice(0, index), scene.text.slice(index)] : [scene.text]
}
