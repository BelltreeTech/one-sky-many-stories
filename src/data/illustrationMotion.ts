// All coordinates are percentages of the upright source painting, before the
// camera transform. Areas describe centre x, centre y, width and height.
export type Area = readonly [number, number, number, number]
type Timing = { from?: number; to?: number }
type Travel = { x?: number; y?: number; turn?: number; pivot?: string; sway?: boolean }
export type PaintedLayer =
  | ({ kind: 'ink'; name: string; area: Area } & Travel & Timing)
  | ({ kind: 'light'; name: string; area: Area; tint: string; opacity: number } & Travel & Timing)
  | ({ kind: 'petal'; name: string; area: Area; tint: string; reverse?: boolean } & Timing)

function ink(name: string, area: Area, travel: Travel & Timing): PaintedLayer {
  return { kind: 'ink', name, area, ...travel }
}
function light(name: string, area: Area, tint: string, opacity: number, timing: Travel & Timing = {}): PaintedLayer {
  return { kind: 'light', name, area, tint, opacity, ...timing }
}
function petal(name: string, area: Area, tint: string, from: number, to: number, reverse = false): PaintedLayer {
  return { kind: 'petal', name, area, tint, from, to, reverse }
}
const amber = '#ffbf66', silver = '#d7edff', dawn = '#ffb094', lilac = '#c7b0ff'

// Details are registered to specific objects in each plate. Scene 12 has its
// own hinged cover and page mechanism. No decoration supplies story text.
export const illustrationMotion: Record<number, readonly PaintedLayer[]> = {
  1: [
    ink('lantern-swing', [15.9, 52.3, 18, 19], { turn: 8, pivot: '52% 16%', sway: true }),
    light('light-on-the-path', [25, 66.4, 37, 7.5], amber, .40, { x: 20, from: .18, to: .80 }),
    ink('flowers-by-the-path', [91, 77, 20, 30], { turn: -4.5, pivot: '50% 95%', sway: true }),
  ],
  2: [
    ink('welcoming-hand', [44.2, 45.9, 17.5, 15], { y: -5, turn: -5.5, pivot: '50% 14%' }),
    ink('noah-makes-room', [80.2, 56.4, 18, 13], { x: 4.4, turn: 2.4, pivot: '50% 14%', from: .34, to: .81 }),
    light('lantern-on-the-grass', [35, 68, 41, 8], amber, .26, { x: 12 }),
  ],
  3: [
    ink('pointing-sleeve', [81.8, 50.5, 19, 21], { turn: 3.6, pivot: '20% 87%' }),
    light('star-above-their-hands', [69, 24.7, 21, 9], silver, .29, { from: .34, to: .77 }),
  ],
  4: [
    ink('leo-opens-his-hand', [40.4, 48.4, 14, 15], { turn: -4.5, pivot: '80% 90%' }),
    light('memory-lantern', [49, 81.1, 21, 19], amber, .40, { from: .30, to: .81 }),
  ],
  5: [
    ink('blossoming-branch', [17, 13, 35, 22], { turn: 4, x: 1.2, pivot: '10% 80%', sway: true }),
    petal('blossom-over-the-valley', [26, 20, 13, 24], '#eab6c1', .22, .68),
    petal('blossom-by-the-veranda', [17.4, 29, 10, 19], '#ecb4d3', .40, .83, true),
    light('subaru-in-the-opening', [51, 36.0, 27, 12], silver, .28, { from: .35, to: .81 }),
  ],
  6: [
    ink('brush-stroke', [35.3, 61.9, 18, 20], { turn: -5.5, x: 2.8, pivot: '54% 48%' }),
    ink('wick-in-the-draft', [18.9, 55.1, 7.6, 7.2], { turn: 7, pivot: '50% 92%', sway: true }),
    light('lamplight-across-paper', [34, 69.2, 38, 5], amber, .29, { x: 20, from: .3, to: .82 }),
  ],
  7: [
    ink('counting-hand', [44.8, 36.7, 16, 16], { turn: 3.4, pivot: '44% 89%' }),
    // These are the six stars already present in the original night sky.
    ...([[42.2, 18.2], [49.2, 16.7], [55.4, 14.1], [61.4, 16.7], [53.1, 20.1], [45.8, 22.4]] as const)
      .map(([x, y], i) => light('counted-star-' + (i + 1), [x, y, 6.8, 4.25], silver, .64, { from: .18 + i * .072, to: .39 + i * .072 })),
  ],
  8: [
    ink('sleeve-at-the-eyepiece', [40.8, 53.9, 15, 13], { turn: -3.2, pivot: '23% 95%' }),
    light('brass-catches-light', [60, 39.8, 16, 3.5], amber, .43, { x: 24, y: -21, turn: -37 }),
  ],
  9: [
    ink('leaves-above-the-book', [22, 8.6, 43, 17], { turn: 3.7, pivot: '6% 8%', sway: true }),
    light('gilt-page-edges', [48.2, 59.3, 29, 5.1], amber, .42, { x: 13, from: .18, to: .63 }),
    light('sisters-in-the-story', [53, 36, 49, 12], lilac, .28, { from: .37, to: .82 }),
  ],
  10: [
    ink('running-sisters-ribbons', [28, 41, 31, 14], { x: -3.8, turn: -3.8, pivot: '90% 62%', sway: true }),
    ink('trailing-skirt', [15.5, 77.2, 29, 20], { x: -4.7, turn: -3.2, pivot: '85% 20%', sway: true }),
    light('evening-on-the-ridge', [53, 33, 50, 7], dawn, .26, { x: 12, from: .34, to: .81 }),
  ],
  11: [
    light('light-beneath-the-cloud', [46, 9.2, 36, 8], silver, .29, { x: 14, from: .28, to: .78 }),
  ],
  13: [
    ink('noah-tells-his-story', [55.9, 46.8, 18, 14], { turn: -4, pivot: '88% 80%' }),
    light('first-light-in-the-lake', [76, 26, 38, 8], dawn, .34, { x: 10, from: .35, to: .85 }),
  ],
  14: [
    ink('ripple-near-the-shore', [77, 59.3, 40, 7], { x: 4.5, y: 2, sway: true }),
    ink('farther-ripple', [74, 62.5, 33, 4], { x: -5, sway: true, from: .27, to: .87 }),
    light('ripple-in-the-dawn', [79, 61.5, 29, 3.1], dawn, .37, { x: -17 }),
  ],
  15: [
    ink('matariki-hair', [29, 21, 30, 13], { x: -2.8, turn: 3, pivot: '87% 46%', sway: true }),
    light('mother-to-daughters', [43, 47, 36, 19], lilac, .31, { x: -12, from: .17, to: .60 }),
    light('daughters-together', [73, 49, 31, 17], silver, .28, { x: 8, from: .39, to: .83 }),
  ],
  16: [
    ink('fern-frond', [39, 64, 17, 16], { turn: 5.1, pivot: '48% 92%', sway: true }),
    ink('river-behind-the-fern', [70, 57.7, 31, 6], { x: 4.5, sway: true }),
    light('water-on-the-frond', [44.5, 64.4, 17, 9], amber, .35, { x: 11, from: .37, to: .83 }),
  ],
  17: [
    ink('passing-the-bowl', [67.5, 51.3, 31, 12], { x: 5.9, y: -1.6, turn: 2, pivot: '24% 65%' }),
    ink('steam-above-the-bowl', [66.3, 46.4, 11, 10], { x: 5.9, y: -4.3, sway: true, from: .25, to: .85 }),
    light('firelight-on-the-rim', [67.5, 50.8, 12, 2.6], amber, .40, { x: 23, from: .36, to: .80 }),
  ],
  18: [
    ink('pencil-over-the-sketch', [51.7, 65.2, 26, 16], { x: 3, y: -2.4, turn: -4.4, pivot: '28% 82%' }),
    light('light-on-the-open-notebook', [59, 62, 32, 13], amber, .22, { x: 14, from: .29, to: .78 }),
  ],
  19: [
    ink('travelling-cloak', [40, 61.2, 23, 22], { x: -2.8, turn: 4, pivot: '58% 18%', sway: true }),
    light('lantern-at-lunas-side', [54.1, 63, 15, 13], amber, .39, { x: 13 }),
    light('lamps-in-the-distant-town', [86, 40.2, 18, 5.4], amber, .44, { from: .4, to: .84 }),
  ],
  20: [
    ink('flowers-at-the-farewell', [92, 85, 18, 23], { turn: -4.6, pivot: '48% 95%', sway: true }),
    light('last-lantern', [21.2, 73.4, 17, 14.2], amber, .40, { from: .17, to: .64 }),
    light('one-sky', [70.5, 23.3, 23, 10], silver, .29, { from: .40, to: .89 }),
  ],
}
