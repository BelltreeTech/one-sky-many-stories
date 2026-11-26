export function ReadingHeader({ current, total, portrait }: { current: number; total: number; portrait: boolean }) {
  return <header className={portrait ? 'masthead strip-masthead' : 'masthead'}>
    <div className="edition-mark">
      <span className="emblem" aria-hidden="true"><i /><b>✦</b></span>
      <span>Cinematic Edition</span>
    </div>
    {portrait ? <span className="folio" data-current-scene={current}>{total} scenes</span> :
    <div className="folio" data-current-scene={current} aria-label={'Scene ' + current + ' of ' + total}>
      <span className="folio-label">Scene</span>
      <strong>{String(current).padStart(2, '0')}</strong><span className="folio-slash">/</span><span>{total}</span>
      <div className="meter" aria-hidden="true"><i style={{ transform: 'scaleX(' + current / total + ')' }} /></div>
    </div>}
  </header>
}
