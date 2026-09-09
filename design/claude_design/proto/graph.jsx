/* Track roadmap: one screen, driven by how many leaves are done. */
(()=>{
const {Button,IconButton,ProgressBar,TabBar}=window.ZoomOutDesignSystem_442bf9;
const R={next:15,done:6.5,revisit:12,locked:11};
function stateOf(i,done){return i<done?(REVISIT.indexOf(i)>=0?'revisit':'done'):i===done?'next':'locked'}
function segments(pts){const s=[];for(let i=0;i<pts.length-1;i+=1){const p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||pts[i+1];
s.push('C '+(p1.x+(p2.x-p0.x)/6).toFixed(1)+' '+(p1.y+(p2.y-p0.y)/6).toFixed(1)+', '+(p2.x-(p3.x-p1.x)/6).toFixed(1)+' '+(p2.y-(p3.y-p1.y)/6).toFixed(1)+', '+p2.x+' '+p2.y)}return s}
function subPath(from,to){const segs=segments(NODES);let d='M '+NODES[from].x+' '+NODES[from].y;for(let i=from;i<to;i+=1)d+=' '+segs[i];return d}
function tangent(i){const a=NODES[Math.max(0,i-1)],b=NODES[Math.min(NODES.length-1,i+1)],dx=b.x-a.x,dy=b.y-a.y;return Math.atan2(dy,dx)}
/* Recursive tapering arbor: each level thinner, shorter, and independently bent — no two branches mirror each other. */
function grow(out,rand,st){const{x,y,ang,len,w,depth,color,op,k}=st;const bend=(rand()-0.5)*1.8,c=curve(x,y,ang,len,bend);
out.push(<path key={k} d={c.d} fill="none" stroke={color} strokeWidth={w.toFixed(2)} opacity={op.toFixed(2)}/>);
if(depth<=0){const tips=3+Math.floor(rand()*4);
for(let i=0;i<tips;i+=1){const tAng=ang+bend*0.7+(rand()-0.5)*2.2,tLen=len*(0.14+rand()*0.24),t=curve(c.ex,c.ey,tAng,tLen,(rand()-0.5)*2.6);
out.push(<path key={k+'t'+i} d={t.d} fill="none" stroke={color} strokeWidth={Math.max(0.3,w*0.46).toFixed(2)} opacity={(op*0.88).toFixed(2)}/>);
if(rand()>0.45){const t2=curve(t.ex,t.ey,tAng+(rand()-0.5)*2.4,tLen*(0.4+rand()*0.3),(rand()-0.5)*2.8);
out.push(<path key={k+'tt'+i} d={t2.d} fill="none" stroke={color} strokeWidth="0.32" opacity={(op*0.75).toFixed(2)}/>);
if(rand()>0.6)out.push(<circle key={k+'e'+i} cx={t2.ex.toFixed(1)} cy={t2.ey.toFixed(1)} r="0.7" fill={color} opacity={(op*0.7).toFixed(2)}/>)}
else if(rand()>0.5)out.push(<circle key={k+'e'+i} cx={t.ex.toFixed(1)} cy={t.ey.toFixed(1)} r="0.8" fill={color} opacity={(op*0.75).toFixed(2)}/>)}return}
const kids=rand()>0.6?3:2;
for(let i=0;i<kids;i+=1){const spread=(rand()-0.5)*2.6;
grow(out,rand,{x:c.ex,y:c.ey,ang:ang+bend*0.8+spread,len:len*(0.46+rand()*0.28),w:Math.max(0.38,w*0.58),depth:depth-1,color,op:op*0.94,k:k+'-'+i})}}
function arbors(done){const rand=prng(70241),out=[];
NODES.forEach((node,i)=>{const st=stateOf(i,done),reached=i<=done,color=reached?'var(--primary)':'var(--graph-edge)',op=reached?0.44:0.8,
big=st==='next',count=big?6:4,base=R[st];
for(let kk=0;kk<count;kk+=1){const ang=rand()*Math.PI*2,len=(big?15:8)+rand()*(big?32:20);
grow(out,rand,{x:node.x+Math.cos(ang)*base*0.75,y:node.y+Math.sin(ang)*base*0.75,ang,len,w:big?1.6:1,depth:big?4:3,color,op,k:'a'+i+'-'+kk})}
const axAng=tangent(i)+(rand()>0.5?1:-1)*(1.9+rand()*0.9);let ax=node.x+Math.cos(axAng)*base*0.85,ay=node.y+Math.sin(axAng)*base*0.85,a=axAng,w=big?1.0:0.7;
for(let s=0;s<4;s+=1){const seg=curve(ax,ay,a,(big?30:22)-s*3,(rand()-0.5)*0.8);
out.push(<path key={'ax'+i+s} d={seg.d} fill="none" stroke={color} strokeWidth={w.toFixed(2)} opacity={(op*0.9).toFixed(2)}/>);
ax=seg.ex;ay=seg.ey;a+=(rand()-0.5)*0.6;w=Math.max(0.32,w*0.68)}
const tuft=4+Math.floor(rand()*3);
for(let i2=0;i2<tuft;i2+=1){const t=curve(ax,ay,a+(rand()-0.5)*2.4,4+rand()*7,(rand()-0.5)*2.8);
out.push(<path key={'axt'+i+i2} d={t.d} fill="none" stroke={color} strokeWidth="0.4" opacity={(op*0.85).toFixed(2)}/>)}});
return out}
/* Ambient web: knowledge not yet reached. Curved arcs only — depth from density, not mass. */
function ambient(){const rand=prng(31877),pts=[];for(let i=0;i<58;i+=1)pts.push({x:8+rand()*374,y:10+rand()*824,r:0.8+rand()*0.9});
const arcs=[];pts.forEach((p,i)=>{for(let j=i+1;j<pts.length;j+=1){const q=pts[j],dist=Math.hypot(p.x-q.x,p.y-q.y);if(dist<74&&rand()>0.5){
const mx=(p.x+q.x)/2,my=(p.y+q.y)/2,ux=-(q.y-p.y)/dist,uy=(q.x-p.x)/dist,bend=dist*(0.18+rand()*0.36)*(rand()<0.5?-1:1);
arcs.push('M '+p.x.toFixed(1)+' '+p.y.toFixed(1)+' Q '+(mx+ux*bend).toFixed(1)+' '+(my+uy*bend).toFixed(1)+', '+q.x.toFixed(1)+' '+q.y.toFixed(1))}}});
const wisps=[];for(let i=0;i<26;i+=1){const p=pts[Math.floor(rand()*pts.length)],c=curve(p.x,p.y,rand()*Math.PI*2,10+rand()*22,(rand()-0.5)*2.2);wisps.push(c.d)}
return<g>{arcs.map((d,i)=><path key={'w'+i} d={d} fill="none" stroke="var(--graph-edge)" strokeWidth="0.9" opacity="0.4"/>)}
{wisps.map((d,i)=><path key={'v'+i} d={d} fill="none" stroke="var(--graph-edge)" strokeWidth="0.65" opacity="0.36"/>)}
{pts.map((p,i)=><circle key={'n'+i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r={p.r.toFixed(1)} fill="var(--graph-node-unreached)"/>)}</g>}
function GraphNode({node,st,rand}){const{x,y,n}=node;
if(st==='next')return<g>
<path d={blob(x,y,25,rand,0.09)} fill="var(--primary)" opacity="0.07"/>
<path d={blob(x,y,25,rand,0.09)} fill="none" stroke="var(--primary)" strokeWidth="1.5" opacity="0.32"/>
<path d={blob(x,y,15,rand,0.13)} fill="var(--primary)"/>
<text x={x} y={y+5.5} textAnchor="middle" fill="var(--text-on-primary)" style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:'15px'}}>{n}</text></g>;
if(st==='done')return<g>
<path d={blob(x,y,6.5,rand,0.18)} fill="var(--surface-page)" stroke="var(--reward)" strokeWidth="1.5"/>
<path d={blob(x,y,2.9,rand,0.22)} fill="var(--reward)"/></g>;
if(st==='revisit')return<g>
<path d={blob(x,y,12,rand,0.15)} fill="var(--surface-page)"/>
<path d={blob(x,y,12,rand,0.15)} fill="none" stroke="var(--reward)" strokeWidth="1.5" strokeDasharray="3.5 4" opacity="0.85"/>
<path d={blob(x,y,2.9,rand,0.22)} fill="var(--reward)"/></g>;
return<g>
<path d={blob(x,y,11,rand,0.16)} fill="var(--surface-page)"/>
<path d={blob(x,y,11,rand,0.16)} fill="none" stroke="var(--border-hairline)" strokeWidth="1.25"/></g>}
function labelLayout(done){const sides={left:[],right:[]},out={};
NODES.forEach((n,i)=>{if(stateOf(i,done)==='next')return;sides[n.x<195?'left':'right'].push({i,n})});
Object.keys(sides).forEach(side=>{let prev=-1e9;sides[side].sort((a,b)=>a.n.y-b.n.y).forEach(({i,n})=>{
const h=n.lines.length*15;let top=n.y-h/2;if(top<prev+7)top=prev+7;prev=top+h;out[i]={side,top,h}})});
return out}
function Labels({done,hide}){const L=labelLayout(done);
return<g>{NODES.map((n,i)=>{const l=L[i];if(!l||(hide&&hide.indexOf(i)>=0))return null;const reached=i<=done,r=R[stateOf(i,done)],
lx=l.side==='left'?n.x-r-11:n.x+r+11,cy=l.top+l.h/2,drift=Math.abs(cy-n.y)>9,
lead=drift?'M '+(l.side==='left'?n.x-r*0.9:n.x+r*0.9).toFixed(1)+' '+n.y+' Q '+(l.side==='left'?lx+6:lx-6).toFixed(1)+' '+((n.y+cy)/2).toFixed(1)+', '+(l.side==='left'?lx+2:lx-2).toFixed(1)+' '+cy.toFixed(1):null;
return<g key={'l'+i}>
{lead&&<path d={lead} fill="none" stroke={reached?'var(--primary)':'var(--graph-edge)'} strokeWidth="0.8" opacity="0.55"/>}
<text x={lx.toFixed(1)} y={(l.top+11).toFixed(1)} textAnchor={l.side==='left'?'end':'start'} fill="var(--text-secondary)" style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:'12px',letterSpacing:'0.8px',textTransform:'uppercase'}}>
{n.lines.map((t,j)=><tspan key={j} x={lx.toFixed(1)} dy={j?15:0}>{t}</tspan>)}</text></g>})}</g>}
/* The next-leaf callout goes wherever the graph is empty: the label layout decides. */
const CARD_W=174,CARD_H=74;
function boxes(done){const L=labelLayout(done),out=[];
NODES.forEach((n,i)=>{const r=R[stateOf(i,done)]+3;
out.push({i,x0:n.x-r,x1:n.x+r,y0:n.y-r,y1:n.y+r,label:false});
const l=L[i];if(!l)return;
const lx=l.side==='left'?n.x-r-11:n.x+r+11;
out.push({i,x0:l.side==='left'?lx-100:lx,x1:l.side==='left'?lx:lx+100,y0:l.top,y1:l.top+l.h,label:true})});
return out}
function placeCard(done){const nextI=Math.min(done,NODES.length-1),next=NODES[nextI],bs=boxes(done);let best=null;
['left','right'].forEach(side=>{[next.y+34,next.y-CARD_H-30,next.y+120,next.y-CARD_H-116,140,632].forEach(raw=>{
const top=Math.max(244,Math.min(raw,584)),x0=side==='left'?16:200,x1=x0+CARD_W,hidden=[];let cost=Math.abs(top-next.y)*0.01;
bs.forEach(b=>{if(b.i===nextI)return;
if(b.x1>x0&&b.x0<x1&&b.y1>top&&b.y0<top+CARD_H){if(b.label){cost+=3;if(hidden.indexOf(b.i)<0)hidden.push(b.i)}else cost+=40}});
if(!best||cost<best.cost)best={side,top,cost,hidden}})});
return best}
function TrackScreen({app}){const done=app.leavesDone,next=NODES[Math.min(done,NODES.length-1)],total=NODES.length;
const art=React.useMemo(()=>({web:ambient(),arb:arbors(done),rand:prng(9051)}),[done]);
const card=React.useMemo(()=>placeCard(done),[done]);
const finished=done>=total;
return<div className="screen" data-screen-label="Track roadmap">
<svg viewBox="0 0 390 844" width="390" height="844" style={{position:'absolute',inset:0}} role="img" aria-label={'Track roadmap: '+done+' of '+total+' leaves complete'}>
{art.web}
<path d={subPath(Math.min(done,total-1),total-1)} fill="none" stroke="var(--graph-edge)" strokeWidth="2"/>
<path d={subPath(0,Math.min(done,total-1))} fill="none" stroke="var(--graph-edge-reached)" strokeWidth="1.75"/>
<g>{art.arb}</g>
{NODES.map((nd,i)=><GraphNode key={nd.n} node={nd} st={stateOf(i,done)} rand={art.rand}/>)}
<Labels done={done} hide={finished?[]:card.hidden}/>
{NODES.map((nd,i)=>stateOf(i,done)==='next'?<circle key={'hit'+i} cx={nd.x} cy={nd.y} r="26" fill="transparent" style={{cursor:'pointer'}} onClick={()=>app.startLeaf(nd.n)}/>:null)}
</svg>
<div style={{position:'absolute',left:0,right:0,top:0,height:236,background:'linear-gradient(to bottom, var(--surface-0) 0%, var(--surface-0) 54%, rgba(11,15,18,0.84) 76%, rgba(11,15,18,0) 100%)',pointerEvents:'none'}}></div>
<header style={{position:'absolute',left:0,right:0,top:0,padding:'8px var(--gutter) var(--space-lg)',display:'flex',flexDirection:'column',gap:'var(--space-md)'}}>
<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',minHeight:44}}>
<IconButton icon="chevron-left" label="Back" onClick={app.back} style={{marginLeft:-10}}/>
<IconButton icon="bookmark" label="Save track" onClick={app.toggleSaved} style={{marginRight:-10}}/></div>
<div style={{display:'flex',flexDirection:'column',gap:'var(--space-xs)'}}>
<span className="zo-caption" style={{color:'var(--text-secondary)'}}>Track</span>
<h1 style={{margin:0,fontFamily:'var(--font-display)',fontWeight:700,fontSize:'var(--text-h2-size)',lineHeight:1.25,color:'var(--text-heading)'}}>{TRACKS.t1.title}</h1>
<span style={{fontFamily:'var(--font-body)',fontSize:'var(--text-small-size)',color:'var(--text-secondary)'}}>{TRACKS.t1.author}</span></div>
<ProgressBar value={done/total} valueLabel={done+' of '+total} label="Leaves" height={6} style={{marginTop:'var(--space-xs)'}}/>
</header>
{!finished&&<div style={{position:'absolute',left:card.side==='left'?16:undefined,right:card.side==='left'?undefined:16,top:card.top,width:CARD_W,padding:'var(--space-md) var(--space-lg)',borderRadius:'var(--radius-md)',background:'var(--surface-raised)',border:'1px solid var(--border-hairline)',display:'flex',flexDirection:'column',gap:'var(--space-xs)',pointerEvents:'none'}}>
<span className="zo-caption" style={{color:'var(--primary)'}}>Leaf {next.n} · next</span>
<span style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:'var(--text-h3-size)',lineHeight:'var(--text-h3-leading)',color:'var(--text-heading)',textWrap:'pretty'}}>{next.title}</span></div>}
<div style={{position:'absolute',left:0,right:0,bottom:0}}>
<div style={{position:'absolute',left:0,right:0,bottom:0,height:186,background:'linear-gradient(to top, var(--surface-0) 0%, var(--surface-0) 48%, rgba(11,15,18,0.82) 74%, rgba(11,15,18,0) 100%)',pointerEvents:'none'}}></div>
<div style={{position:'relative',padding:'0 var(--gutter) var(--space-lg)'}}>
{app.minsLeft<=0
?<Button fullWidth size="lg" variant="secondary" icon="check" onClick={()=>app.go('done')}>Done for today</Button>
:<Button fullWidth size="lg" icon="play" onClick={()=>app.startLeaf(next.n)}>Continue leaf {next.n}</Button>}</div>
<TabBar activeKey="journey" style={{position:'relative'}} items={TAB_ITEMS} onSelect={app.setTab}/>
</div></div>}
Object.assign(window,{TrackScreen});
})();
