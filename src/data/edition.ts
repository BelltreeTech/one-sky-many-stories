export interface Scene {
  id: number
  chapter: number
  text: string
  alt: string
  image: string
  width: number
  height: number
  portrait?: { image: string; width: number; height: number }
}

export const chapters = [
  { numeral: 'I', name: 'The Starry Hill' },
  { numeral: 'II', name: 'Subaru' },
  { numeral: 'III', name: 'The Seven Sisters' },
  { numeral: 'IV', name: 'Matariki' },
  { numeral: 'V', name: 'One Sky' },
] as const

export function asset(path: string) {
  return import.meta.env.BASE_URL + path
}
