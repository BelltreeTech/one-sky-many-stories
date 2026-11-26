import type { Scene } from './edition'

// Each move travels from one composed view to another inside the same portrait.
// Values are fractions of the portrait height and scale, independent of screen DPI.
export interface PortraitDirection {
  focus: string
  start: number
  end: number
  rise: number
  entry?: 'memory' | 'myth' | 'return'
  nextBeat?: string
}

export const portraitDirections: Record<number, PortraitDirection> = {
  1:  { focus: '48% 65%', start: .966, end: 1, rise: -.013 },
  2:  { focus: '50% 59%', start: .975, end: 1, rise: -.011 },
  3:  { focus: '49% 33%', start: .982, end: 1, rise: -.013 },
  4:  { focus: '46% 52%', start: .992, end: .976, rise: -.008 },
  5:  { focus: '52% 38%', start: .975, end: 1, rise: -.01, entry: 'memory' },
  6:  { focus: '54% 47%', start: .987, end: 1, rise: -.004, entry: 'memory' },
  7:  { focus: '50% 47%', start: .986, end: 1, rise: -.006, entry: 'memory', nextBeat: 'Luna counted them slowly.' },
  8:  { focus: '46% 48%', start: .96, end: 1, rise: -.007, entry: 'return', nextBeat: '“Some are hard' },
  9:  { focus: '49% 45%', start: .971, end: .995, rise: -.008 },
  10: { focus: '50% 49%', start: .989, end: 1, rise: -.006, entry: 'myth' },
  11: { focus: '50% 42%', start: .964, end: .995, rise: -.024, nextBeat: '“In one version' },
  12: { focus: '49% 41%', start: 1, end: .974, rise: .013, entry: 'return' },
  13: { focus: '54% 45%', start: .985, end: 1, rise: -.01 },
  14: { focus: '53% 40%', start: .968, end: .995, rise: -.012, entry: 'memory' },
  15: { focus: '50% 45%', start: .984, end: 1, rise: -.006, entry: 'myth' },
  16: { focus: '53% 64%', start: .983, end: 1, rise: .012 },
  17: { focus: '51% 53%', start: .984, end: 1, rise: -.006, entry: 'return' },
  18: { focus: '48% 62%', start: .972, end: 1, rise: .007 },
  19: { focus: '57% 44%', start: .985, end: 1, rise: -.013 },
  20: { focus: '50% 38%', start: 1, end: .971, rise: -.016 },
}

// Reserve the real strip height before a lazy image arrives, including when its
// landscape fallback has a different aspect ratio.
export function portraitDimensions(id: number): [number, number] {
  if ([2, 9, 10, 11, 13, 15].includes(id)) return [941, 1672]
  if (id === 4) return [1086, 1448]
  if (id === 12) return [1051, 1496]
  return [992, 1586]
}

export function portraitBeats(scene: Scene): string[] {
  const marker = portraitDirections[scene.id]?.nextBeat
  const index = marker ? scene.text.indexOf(marker) : -1
  // The space preceding the next sentence stays in the original text node.
  return index > 0 ? [scene.text.slice(0, index), scene.text.slice(index)] : [scene.text]
}

export function portraitFile(id: number) {
  return 'portrait/' + String(id).padStart(2, '0') + '.webp'
}
