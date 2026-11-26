export function ReadingHeader({ current, total }: { current: number; total: number }) {
  return <header className="masthead strip-masthead">
    <div className="edition-mark">
      <span className="emblem" aria-hidden="true"><i /><b>✦</b></span>
      <span>Cinematic Edition</span>
    </div>
    <span className="folio" data-current-scene={current}>{total} scenes</span>
  </header>
}
