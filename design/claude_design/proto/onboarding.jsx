/* First run: five steps, ending inside the first leaf. */
(()=>{
const {Button,Card,Icon,IconButton,Input,ProgressBar,SlideProgress,Switch,TrackCard}=window.ZoomOutDesignSystem_442bf9;
function Web(){const r=prng(4711),W=350,H=210,pts=[];
for(let i=0;i<22;i+=1)pts.push({x:12+r()*(W-24),y:12+r()*(H-24),rad:1.1+r()*1.5});
const spine=[{x:34,y:168},{x:104,y:120},{x:178,y:146},{x:250,y:88},{x:316,y:52}];
return<svg viewBox={'0 0 '+W+' '+H} width="100%" height={H} role="img" aria-label="The knowledge graph: fine edges between precise nodes">
{pts.map((p,i)=><line key={'e'+i} x1={p.x.toFixed(1)} y1={p.y.toFixed(1)} x2={spine[i%spine.length].x} y2={spine[i%spine.length].y} stroke="var(--graph-edge)" strokeWidth="1" opacity="0.5"/>)}
{pts.map((p,i)=><circle key={'n'+i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r={p.rad.toFixed(1)} fill="var(--graph-node-unreached)"/>)}
{spine.slice(1).map((p,i)=><line key={'s'+i} x1={spine[i].x} y1={spine[i].y} x2={p.x} y2={p.y} stroke="var(--primary)" strokeWidth="1.75"/>)}
{spine.map((p,i)=><circle key={'sn'+i} cx={p.x} cy={p.y} r={i===spine.length-1?5:4.5} fill={i===spine.length-1?'var(--surface-page)':'var(--primary)'} stroke="var(--primary)" strokeWidth={i===spine.length-1?2:0}/>)}
</svg>}
function StepHeader({step,onBack,onSkip}){return<header style={{padding:'8px var(--gutter) 0',display:'flex',flexDirection:'column',gap:'var(--space-md)'}}>
<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'var(--space-sm)',minHeight:44}}>
<IconButton icon="chevron-left" label="Back" onClick={onBack} style={{marginLeft:-10}}/>
<span className="zo-caption" style={{color:'var(--text-secondary)'}}>Step {step} of 4</span>
{onSkip?<button type="button" className="zo-caption" style={{minHeight:44,padding:'0 10px',marginRight:-10,background:'none',border:0,color:'var(--text-secondary)',cursor:'pointer'}} onClick={onSkip}>Skip</button>:<span style={{width:44}}/>}</div>
<ProgressBar value={step/4} height={4}/></header>}
function Heading({title,sub}){return<div style={{display:'flex',flexDirection:'column',gap:'var(--space-sm)'}}>
<h1 style={{margin:0,fontFamily:'var(--font-display)',fontWeight:700,fontSize:'var(--text-h1-size)',lineHeight:'var(--text-h1-leading)',color:'var(--text-heading)',textWrap:'pretty'}}>{title}</h1>
{sub&&<span className="zo-small" style={{color:'var(--text-secondary)',textWrap:'pretty'}}>{sub}</span>}</div>}
function OnboardingScreen({app}){const step=app.obStep,set=app.setObStep;
const [topics,setTopics]=React.useState(app.topics),[cap,setCap]=React.useState(app.capMin),[remind,setRemind]=React.useState(true);
const toggle=t=>setTopics(p=>p.indexOf(t)>=0?p.filter(x=>x!==t):p.concat(t));
const HOW=[
{icon:'book-open',title:'A leaf is five slides',body:'Summary, scenario, payoff, sticky notes, takeaway. About three minutes.'},
{icon:'lock',title:'The payoff stays locked',body:'You answer the scenario first. Getting it wrong is fine — you can try again.'},
{icon:'network',title:'Each leaf adds a node',body:'The track graph fills in as you go, so you can see how far into the book you are.'}];
if(step===0)return<div className="screen" data-screen-label="Welcome">
<div className="body" style={{justifyContent:'center',gap:'var(--space-xl)'}}>
<Web/>
<div style={{display:'flex',flexDirection:'column',gap:'var(--space-md)'}}>
<span style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:'var(--text-display-size)',lineHeight:'var(--text-display-leading)',color:'var(--text-heading)'}}>ZoomOut</span>
<p className="zo-body" style={{margin:0,textWrap:'pretty'}}>One non-fiction book, broken into three-minute lessons. You answer a question on each one, and the idea stays.</p></div></div>
<div className="foot">
<Button fullWidth size="lg" onClick={()=>set(1)}>Get started</Button>
<Button fullWidth size="lg" variant="ghost" onClick={()=>app.finishOnboarding({topics,cap,remind})}>I already have an account</Button></div>
</div>;
if(step===1)return<div className="screen" data-screen-label="How it works">
<StepHeader step={1} onBack={()=>set(0)}/>
<div className="body scroll">
<Heading title="How a lesson works"/>
<Card style={{display:'flex',flexDirection:'column',gap:'var(--space-sm)'}}>
<span className="zo-caption" style={{color:'var(--text-secondary)'}}>One leaf · 5 slides</span>
<SlideProgress current={2}/></Card>
<div style={{display:'flex',flexDirection:'column',gap:'var(--space-lg)'}}>
{HOW.map(r=><div key={r.title} style={{display:'flex',gap:'var(--space-md)',alignItems:'flex-start'}}>
<span style={{flex:'0 0 40px',height:40,borderRadius:'var(--radius-sm)',background:'var(--surface-raised)',border:'1px solid var(--border-hairline)',display:'grid',placeItems:'center'}}>
<Icon name={r.icon} size={20} color="var(--primary)"/></span>
<div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:2}}>
<span className="zo-h3">{r.title}</span>
<span className="zo-small" style={{color:'var(--text-secondary)',textWrap:'pretty'}}>{r.body}</span></div></div>)}</div></div>
<div className="foot"><Button fullWidth size="lg" icon="chevron-right" iconPosition="right" onClick={()=>set(2)}>Next</Button></div>
</div>;
if(step===2)return<div className="screen" data-screen-label="Topics">
<StepHeader step={2} onBack={()=>set(1)} onSkip={()=>set(3)}/>
<div className="body scroll">
<Heading title="What do you want to think about?" sub="Pick two or more. You can change this later."/>
<div style={{display:'flex',flexWrap:'wrap',gap:'var(--space-sm)'}}>
{TOPICS.map(t=>{const on=topics.indexOf(t)>=0;return<button key={t} type="button" onClick={()=>toggle(t)} aria-pressed={on} style={{display:'inline-flex',alignItems:'center',gap:'var(--space-xs)',minHeight:44,padding:'0 var(--space-md)',borderRadius:'var(--radius-full)',background:on?'var(--surface-raised)':'var(--surface-card)',border:(on?'var(--border-width-focus)':'var(--border-width-hairline)')+' solid '+(on?'var(--primary)':'var(--border-hairline)'),color:on?'var(--primary)':'var(--text-body)',fontFamily:'var(--font-display)',fontWeight:'var(--weight-semibold)',fontSize:'var(--text-h3-size)',cursor:'pointer',transition:'background var(--duration-tap) var(--ease-snappy), border-color var(--duration-tap) var(--ease-snappy)'}}>
{on&&<Icon name="check" size={16}/>}{t}</button>})}</div>
<Input label="Something else" placeholder="Name an idea or a book"/></div>
<div className="foot">
<Button fullWidth size="lg" icon="chevron-right" iconPosition="right" disabled={topics.length<2} onClick={()=>set(3)}>Next</Button>
<span className="zo-caption" style={{color:'var(--text-secondary)',textAlign:'center'}}>{topics.length<2?'Pick '+(2-topics.length)+' more':topics.length+' picked'}</span></div>
</div>;
if(step===3)return<div className="screen" data-screen-label="Daily cap">
<StepHeader step={3} onBack={()=>set(2)}/>
<div className="body scroll">
<Heading title="How long do you want each day?" sub="Sessions stop at your cap. Fifteen minutes is the longest a session gets."/>
<div style={{display:'flex',flexDirection:'column',gap:'var(--space-sm)'}}>
{CAPS.map(c=>{const on=cap===c.min;return<Card key={c.min} interactive elevation={on?'raised':'card'} onClick={()=>setCap(c.min)} style={{display:'flex',alignItems:'center',gap:'var(--space-md)',minHeight:64,border:(on?'var(--border-width-focus)':'var(--border-width-hairline)')+' solid '+(on?'var(--primary)':'var(--border-hairline)'),cursor:'pointer'}}>
<span style={{flex:'0 0 auto',width:24,display:'grid',placeItems:'center'}}>{on&&<Icon name="check" size={20} color="var(--primary)"/>}</span>
<span style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:2}}>
<span style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:'var(--text-h2-size)',color:on?'var(--primary)':'var(--text-heading)'}}>{c.min} min</span>
<span className="zo-small" style={{color:'var(--text-secondary)'}}>{c.leaves} a day</span></span></Card>})}</div>
<Card style={{display:'flex',flexDirection:'column'}}>
<Switch checked={remind} onChange={setRemind} label="Reminders" description="One nudge, at 8 pm"/></Card></div>
<div className="foot"><Button fullWidth size="lg" icon="chevron-right" iconPosition="right" onClick={()=>set(4)}>Next</Button></div>
</div>;
return<div className="screen" data-screen-label="First track">
<StepHeader step={4} onBack={()=>set(3)}/>
<div className="body scroll">
<Heading title="Start with this one" sub={'Picked from '+topics.slice(0,2).join(' and ').toLowerCase()+'. Eighteen leaves, three minutes each.'}/>
<TrackCard title={TRACKS.t1.title} author={TRACKS.t1.author} leavesDone={0} leavesTotal={TRACKS.t1.total}/>
<div style={{display:'flex',flexDirection:'column',gap:'var(--space-sm)'}}>
<span className="zo-caption" style={{color:'var(--text-secondary)'}}>First leaf</span>
<Card style={{display:'flex',alignItems:'center',gap:'var(--space-md)'}}>
<span style={{flex:'0 0 40px',height:40,borderRadius:'var(--radius-sm)',background:'var(--surface-raised)',border:'1px solid var(--border-hairline)',display:'grid',placeItems:'center'}}>
<Icon name="play" size={20} color="var(--primary)"/></span>
<span style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:2}}>
<span className="zo-h3">{NODES[0].title}</span>
<span className="zo-caption" style={{color:'var(--text-secondary)'}}>Leaf 1 · 3 min</span></span></Card></div></div>
<div className="foot">
<Button fullWidth size="lg" icon="play" onClick={()=>app.finishOnboarding({topics,cap,remind},'leaf')}>Start first leaf · 3 min</Button>
<Button fullWidth size="lg" variant="ghost" onClick={()=>app.finishOnboarding({topics,cap,remind})}>Choose a different track</Button></div>
</div>}
Object.assign(window,{OnboardingScreen});
})();
