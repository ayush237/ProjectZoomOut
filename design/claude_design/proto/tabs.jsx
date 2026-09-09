/* The four tabs. Every row that leads somewhere is wired. */
(()=>{
const {Button,Card,Icon,IconButton,Input,ProgressBar,StreakBadge,XpChip,Switch,TabBar,TrackCard}=window.ZoomOutDesignSystem_442bf9;
function Shell({label,tab,app,children}){return<div className="screen" data-screen-label={label}>
{children}
<TabBar activeKey={tab} items={TAB_ITEMS} onSelect={app.setTab}/></div>}
function ExploreScreen({app}){const t1=TRACKS.t1,done=app.leavesDone;const [chip,setChip]=React.useState('Decisions');
return<Shell label="Explore" tab="explore" app={app}>
<header style={{padding:'var(--space-xl) var(--gutter) var(--space-md)',display:'flex',flexDirection:'column',gap:'var(--space-lg)'}}>
<div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',gap:'var(--space-md)'}}>
<h1 style={{margin:0,fontFamily:'var(--font-display)',fontWeight:700,fontSize:'var(--text-h1-size)',lineHeight:1.2,color:'var(--text-heading)'}}>Explore</h1>
<span className="zo-caption" style={{color:'var(--text-secondary)',paddingBottom:4}}>{app.minsLeft} min left today</span></div>
<Input placeholder="Search tracks and ideas"/>
<div style={{display:'flex',gap:'var(--space-sm)',overflowX:'auto',margin:'0 calc(var(--gutter) * -1)',padding:'0 var(--gutter)'}}>
{CHIPS.map(c=><Chip key={c} label={c} selected={chip===c} onClick={()=>setChip(c)}/>)}</div>
</header>
<div className="scroll" style={{display:'flex',flexDirection:'column',gap:'var(--space-lg)',padding:'var(--space-md) var(--gutter) var(--space-lg)'}}>
<section style={{display:'flex',flexDirection:'column',gap:'var(--space-md)'}}>
<div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between'}}>
<span className="zo-caption" style={{color:'var(--text-secondary)'}}>Pick up where you stopped</span>
<span className="zo-caption" style={{color:'var(--primary)'}}>{done} of {t1.total}</span></div>
<div onClick={()=>app.go('track')} style={{cursor:'pointer'}}>
<TrackCard title={t1.title} author={t1.author} leavesDone={done} leavesTotal={t1.total}/></div>
</section>
<section style={{display:'flex',flexDirection:'column',gap:'var(--space-md)'}}>
<span className="zo-caption" style={{color:'var(--text-secondary)'}}>New this week</span>
<div style={{display:'flex',flexDirection:'column',gap:'var(--space-sm)'}}>
{NEW_TRACKS.map(t=><TrackRow key={t.title} {...t} meta={t.done?'Leaf '+(t.done+1)+' next':t.total+' leaves'} onClick={()=>app.go('track')}/>)}</div>
</section></div>
</Shell>}
function LibraryScreen({app}){const [seg,setSeg]=React.useState('In progress');const active=[{...TRACKS.t1,done:app.leavesDone,meta:'Leaf '+(app.leavesDone+1)+' next'},TRACKS.t2,TRACKS.t3];
return<Shell label="Library" tab="library" app={app}>
<header style={{padding:'var(--space-xl) var(--gutter) var(--space-md)',display:'flex',flexDirection:'column',gap:'var(--space-lg)'}}>
<div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',gap:'var(--space-md)'}}>
<h1 style={{margin:0,fontFamily:'var(--font-display)',fontWeight:700,fontSize:'var(--text-h1-size)',lineHeight:1.2,color:'var(--text-heading)'}}>Library</h1>
<span className="zo-caption" style={{color:'var(--text-secondary)',paddingBottom:4}}>{active.length + FINISHED.length} tracks</span></div>
<div style={{display:'flex',gap:'var(--space-xs)',background:'var(--surface-card)',border:'1px solid var(--border-hairline)',borderRadius:'var(--radius-md)',padding:4}}>
{['In progress','Saved','Finished'].map(t=><Segment key={t} label={t} selected={seg===t} onClick={()=>setSeg(t)}/>)}</div>
</header>
<div className="scroll" style={{display:'flex',flexDirection:'column',gap:'var(--space-lg)',padding:'var(--space-md) var(--gutter) var(--space-lg)'}}>
{seg==='In progress'&&<div style={{display:'flex',flexDirection:'column',gap:'var(--space-sm)'}}>
{active.map(t=><TrackRow key={t.title} {...t} onClick={()=>app.go('track')}/>)}</div>}
{seg==='Saved'&&(app.saved
?<div style={{display:'flex',flexDirection:'column',gap:'var(--space-sm)'}}>
<TrackRow {...TRACKS.t1} done={app.leavesDone} meta={'Leaf '+(app.leavesDone+1)+' next'} onClick={()=>app.go('track')}/></div>
:<div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'var(--space-md)',padding:'var(--space-xl) 0',textAlign:'center'}}>
<Icon name="bookmark" size={24} color="var(--text-secondary)"/>
<span className="zo-h3">Nothing saved yet</span>
<span className="zo-small" style={{color:'var(--text-secondary)',maxWidth:260,textWrap:'pretty'}}>Save a track from its roadmap and it waits for you here.</span></div>)}
{seg==='Finished'&&<div style={{display:'flex',flexDirection:'column',gap:'var(--space-sm)'}}>
{FINISHED.map(t=><TrackRow key={t.title} {...t} finished/>)}</div>}
</div></Shell>}
function Day({d,state}){const done=state==='done',today=state==='today';
return<div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:'var(--space-sm)'}}>
<span className="zo-caption" style={{color:today?'var(--primary)':'var(--text-secondary)'}}>{d}</span>
<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
{today&&<circle cx="13" cy="13" r="12" fill="none" stroke="var(--primary)" strokeWidth="1.75"/>}
{done&&<circle cx="13" cy="13" r="9" fill="none" stroke="var(--reward)" strokeWidth="1.5"/>}
{done&&<circle cx="13" cy="13" r="3.5" fill="var(--reward)"/>}
{today&&<circle cx="13" cy="13" r="4.5" fill="var(--primary)"/>}
{!done&&!today&&<circle cx="13" cy="13" r="9" fill="none" stroke="var(--border-hairline)" strokeWidth="1.25"/>}
</svg></div>}
function NextRow({track,leaf,title,first,onClick}){return<Card interactive padding="var(--space-md)" radius="var(--radius-md)" onClick={onClick} style={{display:'flex',alignItems:'center',gap:'var(--space-md)',cursor:'pointer'}}>
<div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:2}}>
<span className="zo-caption" style={{color:first?'var(--primary)':'var(--text-secondary)'}}>{leaf} · 3 min</span>
<span style={{fontFamily:'var(--font-display)',fontWeight:'var(--weight-bold)',fontSize:'var(--text-h3-size)',lineHeight:1.25,color:'var(--text-heading)',textWrap:'pretty'}}>{title}</span>
<span style={{fontFamily:'var(--font-body)',fontSize:'var(--text-small-size)',color:'var(--text-secondary)'}}>{track}</span></div>
<IconButton icon="play" label={'Start '+leaf} variant="secondary"/></Card>}
function JourneyScreen({app}){const next=NODES[Math.min(app.leavesDone,NODES.length-1)];
const week=['M','T','W','T','F','S','S'].map((d,i)=>({d,state:i===4?'today':i<4&&4-i<=app.streak-1?'done':'ahead'}));
const rows=[{track:TRACKS.t1.title,leaf:'Leaf '+next.n,title:next.title,onClick:()=>app.startLeaf(next.n)},
{track:TRACKS.t2.title,leaf:'Leaf 4',title:'Confidence is not accuracy',onClick:()=>app.go('track')},
{track:TRACKS.t3.title,leaf:'Leaf 2',title:'Who speaks first',onClick:()=>app.go('track')}];
return<Shell label="Journey" tab="journey" app={app}>
<header style={{padding:'var(--space-xl) var(--gutter) var(--space-md)',display:'flex',alignItems:'flex-end',justifyContent:'space-between',gap:'var(--space-md)'}}>
<h1 style={{margin:0,fontFamily:'var(--font-display)',fontWeight:700,fontSize:'var(--text-h1-size)',lineHeight:1.2,color:'var(--text-heading)'}}>Journey</h1>
{app.streak>0&&<StreakBadge days={app.streak}/>}</header>
<div className="scroll" style={{display:'flex',flexDirection:'column',gap:'var(--space-lg)',padding:'var(--space-sm) var(--gutter) var(--space-lg)'}}>
<Card style={{display:'flex',flexDirection:'column',gap:'var(--space-lg)'}}>
<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'var(--space-md)'}}>
<span className="zo-caption" style={{color:'var(--text-secondary)'}}>Today</span>
<XpChip amount={app.xpToday}/></div>
<div style={{display:'flex',gap:'var(--space-xs)'}}>{week.map((w,i)=><Day key={i} {...w}/>)}</div>
<ProgressBar value={(app.capMin-app.minsLeft)/app.capMin} valueLabel={app.minsLeft>0?app.minsLeft+' min left today':'Cap reached'} label="Session" height={6}/>
</Card>
<section style={{display:'flex',flexDirection:'column',gap:'var(--space-md)'}}>
<div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between'}}>
<span className="zo-caption" style={{color:'var(--text-secondary)'}}>Next leaves</span>
<span className="zo-caption" style={{color:'var(--text-secondary)'}}>3 tracks</span></div>
<div style={{display:'flex',flexDirection:'column',gap:'var(--space-sm)'}}>
{rows.map((n,i)=><NextRow key={n.title} {...n} first={i===0}/>)}</div>
</section>
<div style={{marginTop:'auto',display:'flex',flexDirection:'column',gap:'var(--space-sm)'}}>
{app.minsLeft>0
?<Button fullWidth size="lg" icon="play" onClick={()=>app.startLeaf(next.n)}>Continue leaf {next.n}</Button>
:<Button fullWidth size="lg" variant="secondary" icon="check" onClick={()=>app.go('done-cap')}>See today's session</Button>}
{app.minsLeft>0&&app.leavesToday>0&&<button type="button" onClick={app.endSession} style={{minHeight:44,background:'none',border:0,color:'var(--text-secondary)',fontFamily:'var(--font-display)',fontWeight:600,fontSize:'var(--text-small-size)',cursor:'pointer'}}>Done for today</button>}
<span className="zo-caption" style={{color:'var(--text-secondary)',textAlign:'center'}}>{app.leavesToday} leaves today · {app.leavesDone} of {NODES.length} on this track</span></div>
</div></Shell>}
function ProfileScreen({app}){return<Shell label="Profile" tab="profile" app={app}>
<header style={{padding:'var(--space-xl) var(--gutter) var(--space-md)',display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'var(--space-md)'}}>
<div style={{display:'flex',flexDirection:'column',gap:'var(--space-xs)'}}>
<h1 style={{margin:0,fontFamily:'var(--font-display)',fontWeight:700,fontSize:'var(--text-h1-size)',lineHeight:1.2,color:'var(--text-heading)'}}>Ada Okonjo</h1>
<span className="zo-caption" style={{color:'var(--text-secondary)'}}>Reading since {app.since}</span></div>
<IconButton icon="settings" label="Settings" style={{marginRight:-10}}/></header>
<div className="scroll" style={{display:'flex',flexDirection:'column',gap:'var(--space-lg)',padding:'var(--space-sm) var(--gutter) var(--space-lg)'}}>
<Card style={{display:'flex',flexDirection:'column',gap:'var(--space-lg)'}}>
<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'var(--space-md)'}}>
{app.streak>0?<StreakBadge days={app.streak}/>:<span className="zo-caption" style={{color:'var(--text-secondary)'}}>No streak yet</span>}<XpChip amount={app.lifetimeXp} label="XP"/></div>
<div style={{display:'flex',gap:'var(--space-md)'}}>
<Stat value={app.lifetime} label="Leaves"/><Stat value={app.lifetime>=100?2:0} label="Tracks done"/><Stat value={app.leavesDone>0?(app.lifetime>=100?5:1):0} label="In progress"/></div>
<ProgressBar value={4/5} valueLabel="4 of 5 days" label="This week" height={6}/>
</Card>
<section style={{display:'flex',flexDirection:'column',gap:'var(--space-md)'}}>
<span className="zo-caption" style={{color:'var(--text-secondary)'}}>Your notes</span>
<Card padding="var(--space-lg)" style={{display:'flex',flexDirection:'column'}}>
<LinkRow label="Sticky notes" value={app.notes.length+' kept'} last onClick={()=>app.go('notes')}/></Card></section>
<section style={{display:'flex',flexDirection:'column',gap:'var(--space-md)'}}>
<span className="zo-caption" style={{color:'var(--text-secondary)'}}>Session</span>
<Card padding="var(--space-lg)" style={{display:'flex',flexDirection:'column'}}>
<LinkRow label="Daily cap" value={app.capMin+' min'}/>
<LinkRow label="Leaves per session" value="5"/>
<div style={{borderBottom:'1px solid var(--border-hairline)'}}><Switch checked={app.remind} onChange={app.setRemind} label="Reminders" description="One nudge, at 8 pm"/></div>
<Switch checked={false} label="Sound" description="Off during lessons"/>
</Card></section>
<section style={{display:'flex',flexDirection:'column',gap:'var(--space-md)'}}>
<span className="zo-caption" style={{color:'var(--text-secondary)'}}>App</span>
<Card padding="var(--space-lg)" style={{display:'flex',flexDirection:'column'}}>
<LinkRow label="Appearance" value="System"/>
<LinkRow label="Text size" value="Default"/>
<LinkRow label="Restart the prototype" last onClick={app.reset}/></Card></section>
</div></Shell>}
Object.assign(window,{ExploreScreen,LibraryScreen,JourneyScreen,ProfileScreen});
})();
