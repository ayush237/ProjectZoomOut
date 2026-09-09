/* The leaf: five slides, with the payoff gated on a correct answer. */
(()=>{
const {Badge,Button,Card,FeedbackNote,Icon,IconButton,Input,OptionButton,ProgressBar,SlideFrame,SlideProgress,StickyNote,StreakBadge,TabBar,XpChip}=window.ZoomOutDesignSystem_442bf9;
const KINDS=['Summary','Scenario','Payoff','Sticky notes','Takeaway'];
function LeafScreen({app,leafN}){const leaf=Object.assign({},LEAVES[leafN]||LEAVES[8],{n:leafN});
const [slide,setSlide]=React.useState(0),[picked,setPicked]=React.useState(null),[solved,setSolved]=React.useState(false),[sheet,setSheet]=React.useState(false),[draft,setDraft]=React.useState('');
const [report,setReport]=React.useState(false),[reportText,setReportText]=React.useState(''),[reportSent,setReportSent]=React.useState(false);
const closeReport=()=>{setReport(false);setReportSent(false);setReportText('')};
const answer=i=>{setPicked(i);if(i===leaf.correct)setSolved(true)};
const next=()=>setSlide(s=>Math.min(s+1,4));
return<div className="screen" data-screen-label={'Leaf '+leaf.n+' · '+KINDS[slide]}>
<header style={{padding:'8px var(--gutter) var(--space-md)',display:'flex',flexDirection:'column',gap:'var(--space-md)'}}>
<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'var(--space-sm)',minHeight:44}}>
<IconButton icon="x" label="Close leaf" onClick={app.back} style={{marginLeft:-10}}/>
<span className="zo-caption" style={{color:'var(--text-secondary)'}}>Leaf {leaf.n} · 3 min</span>
<div style={{display:'flex',alignItems:'center',gap:2,marginRight:-10}}>
<IconButton icon="flag" label="Report a problem" onClick={()=>setReport(true)}/>
<IconButton icon="sticky-note" label="Your notes" onClick={()=>setSheet(true)}/></div></div>
<SlideProgress current={slide}/></header>
{slide===0&&<React.Fragment>
<div className="body scroll">
<SlideFrame title={leaf.title} style={{flex:1}}>
<div style={{height:172,borderRadius:'var(--radius-md)',overflow:'hidden'}}>
<image-slot id={'leaf'+leaf.n+'-summary'} shape="rounded" radius="12" placeholder="Optional illustration"></image-slot></div>
{leaf.summary.map((p,i)=><p key={i} className="zo-body" style={{margin:0,color:i?'var(--text-secondary)':undefined,textWrap:'pretty'}}>{p}</p>)}
</SlideFrame></div>
<div className="foot"><Button fullWidth size="lg" icon="chevron-right" iconPosition="right" onClick={next}>Continue</Button></div></React.Fragment>}
{slide===1&&<React.Fragment>
<div className="body scroll">
<SlideFrame style={{flex:1,gap:'var(--space-lg)',padding:'var(--space-lg)'}}>
<div style={{display:'flex',flexDirection:'column',gap:'var(--space-sm)'}}>
<span className="zo-caption" style={{color:'var(--text-secondary)'}}>The situation</span>
<p className="zo-small" style={{margin:0,color:'var(--text-secondary)',textWrap:'pretty'}}>{leaf.situation}</p></div>
<h2 style={{margin:0,fontFamily:'var(--font-display)',fontWeight:700,fontSize:'var(--text-h3-size)',lineHeight:'var(--text-h3-leading)',color:'var(--text-heading)',textWrap:'pretty'}}>{leaf.question}</h2>
<div style={{display:'flex',flexDirection:'column',gap:'var(--space-md)'}}>
{leaf.options.map((o,i)=><OptionButton key={i} index={i} onClick={()=>answer(i)} disabled={solved&&i!==leaf.correct}
state={solved?(i===leaf.correct?'correct':'default'):picked===i?'incorrect':'default'}>{o}</OptionButton>)}</div>
{!solved&&picked!==null&&<FeedbackNote kind="incorrect" style={{padding:'var(--space-md) var(--space-lg)'}}>{leaf.wrong}</FeedbackNote>}
{solved&&<FeedbackNote kind="correct" style={{padding:'var(--space-md) var(--space-lg)'}}>{leaf.right}</FeedbackNote>}
</SlideFrame></div>
<div className="foot">
{solved
?<Button fullWidth size="lg" icon="lock-open" onClick={next}>Unlock payoff</Button>
:<div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'var(--space-sm)',minHeight:56,color:'var(--text-secondary)'}}>
<Icon name="lock" size={18}/><span className="zo-caption">Answer the scenario to unlock the payoff</span></div>}
</div></React.Fragment>}
{slide===2&&<React.Fragment>
<div className="body scroll" style={{gap:'var(--space-lg)',paddingTop:'var(--space-sm)'}}>
<div style={{display:'flex',flexDirection:'column',gap:'var(--space-sm)'}}>
<span className="zo-caption" style={{color:'var(--primary)'}}>Payoff</span>
<h1 style={{margin:0,fontFamily:'var(--font-display)',fontWeight:700,fontSize:'var(--text-h2-size)',lineHeight:'var(--text-h2-leading)',color:'var(--text-heading)',textWrap:'pretty'}}>{leaf.payoffTitle}</h1></div>
<div style={{display:'flex',flexDirection:'column',gap:'var(--space-lg)'}}>
{leaf.payoff.map((p,i)=><p key={i} className="zo-payoff" style={{margin:0,textWrap:'pretty'}}>{p}</p>)}</div></div>
<div className="foot"><Button fullWidth size="lg" icon="chevron-right" iconPosition="right" onClick={next}>Next</Button></div></React.Fragment>}
{slide===3&&<React.Fragment>
<div className="body scroll">
<SlideFrame title={leaf.notesTitle} style={{flex:1,gap:'var(--space-md)'}}>
<div className={'zo-board'+(leaf.notes.length<2?' single':'')}>
{leaf.notes.map((t,i)=><StickyNote key={i} index={i+1}>{t}</StickyNote>)}</div>
<Diagram/>
</SlideFrame></div>
<div className="foot"><Button fullWidth size="lg" icon="chevron-right" iconPosition="right" onClick={next}>Next</Button></div></React.Fragment>}
{slide===4&&<React.Fragment>
<div className="body scroll">
<SlideFrame style={{flex:1,gap:'var(--space-xl)'}}>
<div style={{display:'flex',flexDirection:'column',gap:'var(--space-md)'}}>
<span className="zo-caption" style={{color:'var(--text-secondary)'}}>Remember this</span>
<p style={{margin:0,fontFamily:'var(--font-display)',fontWeight:700,fontSize:'var(--text-h1-size)',lineHeight:'var(--text-h1-leading)',color:'var(--text-heading)',textWrap:'pretty'}}>{leaf.takeaway}</p></div>
<div style={{height:1,background:'var(--border-hairline)'}}></div>
<div style={{display:'flex',flexDirection:'column',gap:'var(--space-sm)'}}>
<span className="zo-caption" style={{color:'var(--primary)'}}>Do this today</span>
<p className="zo-body" style={{margin:0,textWrap:'pretty'}}>{leaf.today}</p></div>
<div style={{marginTop:'auto',display:'flex',flexDirection:'column',gap:'var(--space-md)'}}>
<div style={{display:'flex',alignItems:'center',gap:'var(--space-sm)'}}><XpChip amount={40} animate/><Badge tone="neutral" icon="check">Leaf {leaf.n} complete</Badge></div>
<p className="zo-small" style={{margin:0,color:'var(--text-secondary)'}}>One more node on the graph. Next up: leaf {leaf.n+1}.</p></div>
</SlideFrame></div>
<div className="foot"><Button fullWidth size="lg" icon="check" onClick={()=>app.finishLeaf(leaf.n)}>Finish leaf</Button></div></React.Fragment>}
{report&&<div style={{position:'absolute',inset:0,background:'var(--surface-page)',opacity:0.6}} onClick={closeReport}></div>}
{report&&<div style={{position:'absolute',left:0,right:0,bottom:0,background:'var(--surface-card)',borderTop:'1px solid var(--border-hairline)',borderRadius:'var(--radius-lg) var(--radius-lg) 0 0',padding:'var(--space-md) var(--gutter) var(--space-xl)',display:'flex',flexDirection:'column',gap:'var(--space-md)'}}>
<div style={{width:40,height:4,borderRadius:999,background:'var(--border-hairline)',alignSelf:'center'}}></div>
{!reportSent?<React.Fragment>
<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'var(--space-md)'}}>
<div style={{display:'flex',flexDirection:'column',gap:2}}>
<span className="zo-h2">Report a problem</span>
<span className="zo-caption" style={{color:'var(--text-secondary)'}}>Leaf {leaf.n} · {leaf.title}</span></div>
<IconButton icon="x" label="Close" onClick={closeReport} style={{marginRight:-10}}/></div>
<textarea value={reportText} onChange={e=>setReportText(e.target.value)} placeholder="What's wrong with this leaf, in your own words?" rows={4} style={{width:'100%',boxSizing:'border-box',resize:'none',fontFamily:'var(--font-body)',fontSize:'var(--text-body-size)',color:'var(--text-body)',background:'var(--surface-input)',border:'1px solid var(--border-hairline)',borderRadius:'var(--radius-sm)',padding:'var(--space-md)'}}/>
<Button fullWidth size="lg" disabled={!reportText.trim()} onClick={()=>setReportSent(true)}>Send report</Button>
</React.Fragment>
:<React.Fragment>
<div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'var(--space-md)',padding:'var(--space-md) 0'}}>
<span style={{width:48,height:48,borderRadius:'50%',background:'var(--surface-raised)',border:'1px solid var(--border-hairline)',display:'grid',placeItems:'center'}}><Icon name="check" size={22} color="var(--primary)"/></span>
<div style={{display:'flex',flexDirection:'column',gap:4,textAlign:'center'}}>
<span className="zo-h2">Sent</span>
<span className="zo-small" style={{color:'var(--text-secondary)'}}>This goes to the fix queue. You don't need to do anything else.</span></div></div>
<Button fullWidth size="lg" onClick={closeReport}>Done</Button>
</React.Fragment>}
</div>}
{sheet&&<div style={{position:'absolute',inset:0,background:'var(--surface-page)',opacity:0.6}} onClick={()=>setSheet(false)}></div>}
{sheet&&<div style={{position:'absolute',left:0,right:0,bottom:0,background:'var(--surface-card)',borderTop:'1px solid var(--border-hairline)',borderRadius:'var(--radius-lg) var(--radius-lg) 0 0',padding:'var(--space-md) var(--gutter) var(--space-xl)',display:'flex',flexDirection:'column',gap:'var(--space-md)',maxHeight:620,overflowY:'auto'}}>
<div style={{width:40,height:4,borderRadius:999,background:'var(--border-hairline)',alignSelf:'center'}}></div>
<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'var(--space-md)'}}>
<div style={{display:'flex',flexDirection:'column',gap:2}}>
<span className="zo-h2">This leaf</span>
<span className="zo-caption" style={{color:'var(--text-secondary)'}}>{leaf.notes.length} notes kept</span></div>
<IconButton icon="x" label="Close notes" onClick={()=>setSheet(false)} style={{marginRight:-10}}/></div>
<div style={{display:'flex',flexDirection:'column',gap:'var(--space-sm)'}}>
{leaf.notes.map((t,i)=><StickyNote key={i} index={i+1} style={{padding:'var(--space-md) var(--space-lg)'}}>{t}</StickyNote>)}</div>
<div style={{height:1,background:'var(--border-hairline)'}}></div>
<Input label="Add your own" placeholder="What do you want to keep?" value={draft} onChange={setDraft}/>
<Button fullWidth size="lg" icon="check" disabled={!draft.trim()} onClick={()=>{app.saveNote({track:TRACKS.t1.title,leaf:'Leaf '+leaf.n+' · '+leaf.title,t:draft.trim(),mine:true});setDraft('');setSheet(false)}}>Save note</Button></div>}
</div>}
function Diagram(){return<svg viewBox="0 0 330 118" width="100%" height="118" role="img" aria-label="Diagram: the first number sets a range, and every later offer is judged inside it">
<line x1="44" y1="30" x2="164" y2="59" stroke="var(--primary)" strokeWidth="1.75"/>
<line x1="164" y1="59" x2="286" y2="30" stroke="var(--graph-edge)" strokeWidth="1.25"/>
<line x1="164" y1="59" x2="120" y2="100" stroke="var(--graph-edge)" strokeWidth="1.25"/>
<line x1="164" y1="59" x2="228" y2="98" stroke="var(--graph-edge)" strokeWidth="1.25"/>
<circle cx="44" cy="30" r="5" fill="var(--primary)"/>
<circle cx="164" cy="59" r="5" fill="none" stroke="var(--primary)" strokeWidth="1.5"/>
<circle cx="286" cy="30" r="2.2" fill="var(--graph-node-unreached)"/>
<circle cx="120" cy="100" r="2.2" fill="var(--graph-node-unreached)"/>
<circle cx="228" cy="98" r="2.2" fill="var(--graph-node-unreached)"/>
<text x="44" y="16" textAnchor="middle" fill="var(--primary)" style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:'12px',letterSpacing:'0.8px',textTransform:'uppercase'}}>First number</text>
<text x="196" y="76" fill="var(--text-secondary)" style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:'12px',letterSpacing:'0.8px',textTransform:'uppercase'}}>Later offers</text>
<text x="164" y="46" textAnchor="middle" fill="var(--text-body)" style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:'12px',letterSpacing:'0.8px',textTransform:'uppercase'}}>The range</text>
</svg>}
/* Session end. Same neural language as the roadmap, one session wide. */
const FRAG=[{x:26,y:86,state:'past'},{x:96,y:58,state:'today'},{x:168,y:78,state:'today'},{x:240,y:50,state:'today'},{x:300,y:74,state:'tomorrow'}];
function fragSpine(from,to){let d='M '+FRAG[from].x+' '+FRAG[from].y;
for(let i=from;i<to;i+=1){const p0=FRAG[i-1]||FRAG[i],p1=FRAG[i],p2=FRAG[i+1],p3=FRAG[i+2]||FRAG[i+1];
d+=' C '+(p1.x+(p2.x-p0.x)/6).toFixed(1)+' '+(p1.y+(p2.y-p0.y)/6).toFixed(1)+', '+(p2.x-(p3.x-p1.x)/6).toFixed(1)+' '+(p2.y-(p3.y-p1.y)/6).toFixed(1)+', '+p2.x+' '+p2.y}return d}
function Fragment2({nextN}){const rand=prng(5521),arbor=[];
FRAG.forEach((nd,i)=>{const reached=nd.state!=='tomorrow',color=reached?'var(--primary)':'var(--graph-edge)',op=reached?0.4:0.7;
for(let k=0;k<3;k+=1){const a=(rand()*2-1)*Math.PI,c1=curve(nd.x,nd.y,a,10+rand()*12,(rand()-0.5)*1.4);
arbor.push(<path key={'b'+i+k} d={c1.d} fill="none" stroke={color} strokeWidth="1" opacity={op}/>);
for(let j=0;j<2;j+=1){const c2=curve(c1.ex,c1.ey,a+(j?0.6:-0.55)+(rand()-0.5)*0.4,5+rand()*7,(rand()-0.5)*2);
arbor.push(<path key={'b'+i+k+j} d={c2.d} fill="none" stroke={color} strokeWidth="0.55" opacity={op*0.9}/>)}}});
return<svg viewBox="0 0 338 118" width="100%" height="118" role="img" aria-label="Leaves completed today, the next opens tomorrow">
<path d={fragSpine(3,4)} fill="none" stroke="var(--graph-edge)" strokeWidth="1.75"/>
<path d={fragSpine(0,3)} fill="none" stroke="var(--graph-edge-reached)" strokeWidth="1.75"/>
{arbor}
{FRAG.map((nd,i)=>{if(nd.state==='past')return<g key={i}><path d={blob(nd.x,nd.y,5.5,rand,0.14)} fill="none" stroke="var(--reward)" strokeWidth="1.25" opacity="0.6"/></g>;
if(nd.state==='today')return<g key={i}><path d={blob(nd.x,nd.y,8,rand,0.14)} fill="var(--surface-page)" stroke="var(--reward)" strokeWidth="1.75"/><path d={blob(nd.x,nd.y,3.4,rand,0.2)} fill="var(--reward)"/></g>;
return<g key={i}><path d={blob(nd.x,nd.y,11,rand,0.14)} fill="var(--surface-page)"/><path d={blob(nd.x,nd.y,11,rand,0.14)} fill="none" stroke="var(--border-hairline)" strokeWidth="1.25"/>
<text x={nd.x} y={nd.y+4.2} textAnchor="middle" fill="var(--text-secondary)" style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:'12px'}}>{nextN}</text></g>})}
<text x="240" y="24" textAnchor="middle" fill="var(--reward)" style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:'12px',letterSpacing:'0.8px',textTransform:'uppercase'}}>Today</text>
<text x="336" y="104" textAnchor="end" fill="var(--text-secondary)" style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:'12px',letterSpacing:'0.8px',textTransform:'uppercase'}}>Tomorrow</text>
</svg>}
function Stat({value,label}){return<div style={{flex:1,display:'flex',flexDirection:'column',gap:2}}>
<span style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:'var(--text-h2-size)',color:'var(--text-heading)'}}>{value}</span>
<span className="zo-caption" style={{color:'var(--text-secondary)'}}>{label}</span></div>}
/* Two frames, same shape: an ending, not a refusal. Copy differs by how the reader got here; tone does not. */
function SessionEnd({app,variant}){const total=NODES.length,nextN=Math.min(app.leavesDone+1,total),cap=variant==='cap';
const [shared,setShared]=React.useState(false),reason=app.endReason==='xp'?'xp':'time';
const title=!cap?'That\u2019s today, on your terms.':(reason==='xp'?'That\u2019s 500 XP for today.':'That\u2019s your fifteen minutes.');
const sub=!cap?(app.leavesToday+' leaves, '+app.xpToday+' XP. Pick back up tomorrow whenever you like.')
:(app.leavesToday+' leaves, '+app.xpToday+' XP today. The leaf you were on finished — you were not cut off mid-leaf.');
return<div className="screen" data-screen-label={cap?'Session end · cap reached':'Session end · reader stopped'}>
<div className="scroll" style={{display:'flex',flexDirection:'column',gap:'var(--space-xl)',padding:'var(--space-xl) var(--gutter) var(--space-lg)'}}>
<div style={{display:'flex',flexDirection:'column',gap:'var(--space-md)'}}>
<span className="zo-caption" style={{color:'var(--text-secondary)'}}>Session complete</span>
<h1 style={{margin:0,fontFamily:'var(--font-display)',fontWeight:700,fontSize:'var(--text-h1-size)',lineHeight:1.2,color:'var(--text-heading)',textWrap:'pretty'}}>{title}</h1>
<p className="zo-body" style={{margin:0,color:'var(--text-secondary)',textWrap:'pretty'}}>{sub}</p></div>
<Card style={{display:'flex',flexDirection:'column',gap:'var(--space-md)'}}>
<div style={{background:'var(--surface-page)',border:'1px solid var(--border-hairline)',borderRadius:'var(--radius-md)',padding:'var(--space-sm)'}}><Fragment2 nextN={nextN}/></div>
<div style={{display:'flex',alignItems:'center',gap:'var(--space-md)'}}>
<Stat value={app.leavesToday} label="Leaves today"/><Stat value={app.xpToday} label="XP earned"/>
{app.streak>0?<Stat value={app.streak} label="Day streak"/>:<Stat value={1} label="Day one"/>}</div></Card>
<div style={{display:'flex',flexDirection:'column',gap:'var(--space-md)'}}>
<div style={{display:'flex',alignItems:'center',gap:'var(--space-sm)'}}>
<Icon name="check" size={18} color="var(--reward)"/>
<span className="zo-body" style={{color:'var(--text-body)'}}>{app.leavesToday} leaves · {TRACKS.t1.title}</span></div>
<div style={{display:'flex',alignItems:'center',gap:'var(--space-sm)'}}>
<Icon name="sunrise" size={18} color="var(--text-secondary)"/>
<span className="zo-body" style={{color:'var(--text-secondary)'}}>Leaf {nextN} continues tomorrow</span></div>
<ProgressBar value={app.leavesDone/total} valueLabel={app.leavesDone+' of '+total} label="Track" height={6} style={{marginTop:'var(--space-xs)'}}/></div>
<div style={{marginTop:'auto',display:'flex',flexDirection:'column',gap:'var(--space-sm)'}}>
<Button fullWidth size="lg" icon={shared?'check':'share-2'} onClick={()=>setShared(true)}>{shared?'Shared':'Share today\u2019s progress'}</Button>
<Button fullWidth size="lg" variant="ghost" onClick={()=>app.setTab('journey')}>Back to Journey</Button></div>
</div>
<TabBar activeKey="journey" items={TAB_ITEMS} onSelect={app.setTab}/>
</div>}
function DoneScreen({app}){return<SessionEnd app={app} variant="voluntary"/>}
function CapScreen({app}){return<SessionEnd app={app} variant="cap"/>}
Object.assign(window,{LeafScreen,DoneScreen,CapScreen});
})();
