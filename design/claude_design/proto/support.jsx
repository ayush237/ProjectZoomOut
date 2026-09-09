/* Failure states. A failure is a connection that hasn't resolved yet, not a broken one — no red, no warning triangle, no bug icon. */
(()=>{
const {Button,Icon}=window.ZoomOutDesignSystem_442bf9;
function Pending(){const pts=[{x:38,y:96},{x:104,y:60},{x:176,y:88},{x:246,y:52},{x:306,y:80}];
return<svg viewBox="0 0 340 130" width="100%" height="130" role="img" aria-label="A connection still resolving">
{pts.slice(1).map((p,i)=><line key={i} x1={pts[i].x} y1={pts[i].y} x2={p.x} y2={p.y} stroke="var(--border-hairline)" strokeWidth="1.5" strokeDasharray="2 6" strokeLinecap="round"/>)}
{pts.map((p,i)=>i===2
?<g key={i}><circle cx={p.x} cy={p.y} r="10" fill="none" stroke="var(--primary)" strokeWidth="1.5" opacity="0.5"><animate attributeName="r" values="8;14;8" dur="2.4s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.5;0.05;0.5" dur="2.4s" repeatCount="indefinite"/></circle>
<circle cx={p.x} cy={p.y} r="5" fill="var(--surface-page)" stroke="var(--primary)" strokeWidth="1.75"/></g>
:<circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--graph-node-unreached)"/>)}
</svg>}
function Unresolved({app,kind}){const offline=kind==='offline';
return<div className="screen" data-screen-label={offline?'No connection':'Content failed to load'}>
<div className="body" style={{justifyContent:'center',gap:'var(--space-xl)'}}>
<Pending/>
<div style={{display:'flex',flexDirection:'column',gap:'var(--space-sm)'}}>
<span className="zo-caption" style={{color:'var(--text-secondary)'}}>{offline?'No connection':'Leaf '+(app.leafN||1)}</span>
<h1 style={{margin:0,fontFamily:'var(--font-display)',fontWeight:700,fontSize:'var(--text-h1-size)',lineHeight:'var(--text-h1-leading)',color:'var(--text-heading)',textWrap:'pretty'}}>{offline?'You\u2019re offline.':'This leaf hasn\u2019t loaded yet.'}</h1>
<p className="zo-body" style={{margin:0,color:'var(--text-secondary)',textWrap:'pretty'}}>{offline?'ZoomOut needs a connection to load leaves. Reconnect, and this picks up right where it left off.':'The connection to it hasn\u2019t resolved. Your progress is saved — try again when you\u2019re ready.'}</p></div></div>
<div className="foot">
<Button fullWidth size="lg" icon="refresh-cw" onClick={app.back}>Try again</Button>
<Button fullWidth size="lg" variant="ghost" onClick={app.back}>Back</Button></div>
</div>}
function LoadFailedScreen({app}){return<Unresolved app={app} kind="load"/>}
function OfflineScreen({app}){return<Unresolved app={app} kind="offline"/>}
Object.assign(window,{LoadFailedScreen,OfflineScreen});
})();
