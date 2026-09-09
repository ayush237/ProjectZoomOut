/* The notes collection, reached from Profile and from inside a leaf. */
(()=>{
const {Button,Card,Icon,Input,StickyNote,TabBar,TopBar}=window.ZoomOutDesignSystem_442bf9;
function Note({index,t,mine}){return<div style={{display:'flex',flexDirection:'column',gap:'var(--space-xs)',alignItems:'center'}}>
<StickyNote index={index}>{t}</StickyNote>
{mine&&<span className="zo-caption" style={{color:'var(--text-secondary)'}}>Your note</span>}</div>}
function NotesScreen({app}){const [filter,setFilter]=React.useState('All notes');
const list=filter==='Yours'?app.notes.filter(n=>n.mine):filter==='All notes'?app.notes:app.notes.filter(n=>n.track===filter);
const groups=[];list.forEach(n=>{const g=groups[groups.length-1];if(g&&g.leaf===n.leaf)g.notes.push(n);else groups.push({track:n.track,leaf:n.leaf,notes:[n]})});
const tracks=[];app.notes.forEach(n=>{if(tracks.indexOf(n.track)<0)tracks.push(n.track)});
const leaves=[];app.notes.forEach(n=>{if(leaves.indexOf(n.leaf)<0)leaves.push(n.leaf)});
return<div className="screen" data-screen-label="Your notes">
<TopBar title="Your notes" subtitle={app.notes.length?app.notes.length+(app.notes.length===1?' note · ':' notes · ')+leaves.length+(leaves.length===1?' leaf':' leaves'):undefined} onBack={app.back}/>
{app.notes.length===0
?<div className="body" style={{justifyContent:'center',alignItems:'center',gap:'var(--space-lg)',textAlign:'center'}}>
<span style={{width:56,height:56,borderRadius:'var(--radius-md)',background:'var(--surface-raised)',border:'1px solid var(--border-hairline)',display:'grid',placeItems:'center'}}>
<Icon name="sticky-note" size={24} color="var(--text-secondary)"/></span>
<div style={{display:'flex',flexDirection:'column',gap:'var(--space-sm)',maxWidth:280}}>
<span className="zo-h2">Nothing kept yet</span>
<span className="zo-body" style={{color:'var(--text-secondary)',textWrap:'pretty'}}>The fourth slide of every leaf holds the things worth keeping. Anything you save there shows up here.</span></div>
<Button size="lg" icon="play" onClick={()=>app.startLeaf(app.leavesDone+1)}>Start a leaf · 3 min</Button></div>
:<div className="scroll" style={{display:'flex',flexDirection:'column',gap:'var(--space-md)',padding:'var(--space-lg) var(--gutter)'}}>
<Input placeholder="Search your notes"/>
<div style={{display:'flex',gap:'var(--space-sm)',overflowX:'auto',margin:'0 calc(var(--gutter) * -1)',padding:'0 var(--gutter)'}}>
{['All notes','Yours'].concat(tracks).map(f=><Chip key={f} label={f} selected={filter===f} onClick={()=>setFilter(f)}/>)}</div>
<div style={{display:'flex',flexDirection:'column',gap:'var(--space-lg)'}}>
{groups.map(g=><section key={g.leaf+g.notes[0].t} style={{display:'flex',flexDirection:'column',gap:'var(--space-sm)'}}>
<div style={{display:'flex',flexDirection:'column',gap:2}}>
<span className="zo-caption" style={{color:'var(--text-secondary)'}}>{g.track}</span>
<span className="zo-h3">{g.leaf}</span></div>
<div className={'zo-board'+(g.notes.length<2?' single':'')}>{g.notes.map((n,i)=><Note key={i} index={i+1} {...n}/>)}</div></section>)}
{groups.length===0&&<span className="zo-small" style={{color:'var(--text-secondary)'}}>No notes under this filter yet.</span>}</div>
</div>}
<TabBar activeKey="profile" items={TAB_ITEMS} onSelect={app.setTab}/>
</div>}
Object.assign(window,{NotesScreen});
})();
