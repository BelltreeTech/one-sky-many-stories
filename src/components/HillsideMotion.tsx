import { useState, type CSSProperties } from 'react'
import { asset } from '../data/edition'
import '../styles/hillside-motion.css'

// Each path uses the upright painting as its coordinate system. The moving
// marks stay inside the artwork when the reading strip or safe area changes.
function HandLantern() {
  const [ready, setReady] = useState(false)
  const source = asset('motion/hill-lantern.webp')
  return <span className="lantern-rig" data-ready={ready}>
    <span className="lantern-underpainting"><img src={source} alt="" decoding="async"
      onLoad={event => { const image = event.currentTarget
        void image.decode().then(() => { if (image.isConnected) setReady(true) }).catch(() => {})
      }} /></span>
    <span className="lantern-pivot"><span className="lantern-metal"><img src={source} alt="" decoding="async" /></span></span>
  </span>
}

function SkyStreak() {
  return <>
    <span className="shooting-path"><i className="shooting-head" /></span>
    <span className="lantern-cast" />
    <HandLantern />
  </>
}

const samaras = [[4,64,15,125,-18], [36,72,9,96,22], [-5,58,13,83,10], [55,69,16,130,-12]]
const blossoms = [[4,16,29,123,104], [22,23,12,78,129], [-3,25,22,96,158], [37,15,15,51,91], [9,37,10,119,98], [49,18,9,87,73]]

function Windborne({ flowers }: { flowers: boolean }) {
  const pattern = flowers ? blossoms : samaras
  return <>{pattern.map(([x,y,size,run,drop],i) =>
    <span className="windborne" key={i} style={{
      left: x+'%', top: y+'%', width: size+'px', '--fly-x': run/3.93+'cqw', '--fly-y': drop/3.93+'cqw',
      '--tilt': (i*47-35)+'deg', '--tumble': (i%2 ? -142 : 183)+'deg',
    } as CSSProperties}>
      <svg viewBox="0 0 40 40" className="windborne-art" focusable="false">
        {flowers ? <g>
          {[0,72,144,216,288].map(a => <g key={a} transform={'rotate('+a+' 20 20)'}>
            <path d="M20 22C15 18 10 13 12 6Q14 2 18 3L20 7L22 2Q30 2 28 10C27 15 23 20 20 22Z" fill="url(#petal-paint)" stroke="#c68da6" strokeWidth=".6" />
            <path d="M20 19Q17 13 16 9M20 18Q22 14 23 10" fill="none" stroke="#d698a4" opacity=".66" strokeWidth=".65" />
          </g>)}
          <circle cx="20" cy="20" r="2" fill="#f9c37a" />
        </g> : <g>
          <path d="M2 24C12 20 18 5 38 7C34 21 21 34 2 24Z" fill="url(#leaf-paint)" stroke="#85734f" strokeWidth=".8"/>
          <path d="M0 26Q21 22 36 9M15 21L17 14M20 19L27 19" fill="none" stroke="#ead198" strokeWidth="1"/>
        </g>}
      </svg>
    </span>)}
    <svg className="paint-definitions" aria-hidden="true"><defs>
      {flowers ? <radialGradient id="petal-paint" cx=".6" cy=".17" r=".93"><stop stopColor="#fff6e7"/><stop offset=".54" stopColor="#f5ced8"/><stop offset="1" stopColor="#c67f9f"/></radialGradient> :
        <linearGradient id="leaf-paint" x2=".5" y2="1"><stop stopColor="#f4d596"/><stop offset=".48" stopColor="#c89e63"/><stop offset="1" stopColor="#655f43"/></linearGradient>}
    </defs></svg>
  </>
}

function PaintedSweep({ id }: { id: number }) {
  // The irregular second stroke gives the light a brush edge. It never
  // connects or supplies any of the numbered stars in scene seven.
  const [main, fine, color] = id === 3
    ? ['M75 52 Q90 40 82 31 T70 24', 'M77 48 Q87 38 82 34', '#c4daff']
    : id === 4
    ? ['M54 29 Q62 17 77 21 T102 6', 'M65 23 Q73 18 84 20 T101 9', '#ffdfa0']
    : ['M14 70 Q24 66 39 69 T65 69', 'M17 70 Q28 68 42 70', '#ffe3a8']
  return <svg className={'painted-sweep sweep-'+id} viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
    <defs><linearGradient id={'sweep-color-'+id} x1="0" x2="1" y1=".8" y2=".2">
      <stop stopColor={color} stopOpacity=".06"/><stop offset=".38" stopColor={color} stopOpacity=".62"/><stop offset=".75" stopColor={color}/><stop offset="1" stopColor={color} stopOpacity=".35"/>
    </linearGradient></defs>
    <g fill="none" stroke={'url(#sweep-color-'+id+')'} strokeLinecap="round">
      <path d={main} className="sweep-wash" pathLength="1" strokeWidth={id===6 ? '1.8' : '1.2'} />
      <path d={main} className="sweep-line" pathLength="1" strokeWidth=".22"/>
      <path d={fine} className="sweep-line fine" pathLength="1" strokeWidth=".11"/>
    </g>
  </svg>
}

export function HillsideMotion({ id }: { id: number }) {
  return <span className="hillside-motion" data-cinematic-scene={id} aria-hidden="true">
    {id===1 && <SkyStreak />}
    {(id===2 || id===5) && <Windborne flowers={id===5} />}
    {(id===3 || id===4 || id===6) && <PaintedSweep id={id} />}
    {id===3 && <i className="gaze-light"/>}
    {id===4 && <i className="memory-window"/>}
    {id===6 && <><i className="lamplight-fan"/><i className="moving-flame"/></>}
    {id===8 && <><span className="telescope-axis"><i className="brass-flash"/></span><i className="lens-bloom"/></>}
  </span>
}
