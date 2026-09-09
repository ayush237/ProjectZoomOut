/* Shared data, helpers and small parts for the clickable prototype. */
(()=>{
const TRACKS={
t1:{id:'t1',title:'The quiet arithmetic',author:'Marisol Vane',total:18},
t2:{id:'t2',title:'The cost of certainty',author:'Tobias Renner',total:16,done:3,meta:'Leaf 4 next'},
t3:{id:'t3',title:'Rooms that decide',author:'Idris Fennimore',total:14,done:1,meta:'Leaf 2 next'}};
const FINISHED=[{title:'Long odds',author:'Hana Vireo',done:12,total:12},{title:'Nothing is standard',author:'Petra Oyelaran',done:11,total:11}];
const NEW_TRACKS=[
{title:'Rooms that decide',author:'Idris Fennimore',done:1,total:14},
{title:'Nothing is standard',author:'Petra Oyelaran',done:0,total:11},
{title:'The cost of certainty',author:'Tobias Renner',done:3,total:16}];
const TOPICS=['Decisions','Money','Habits','Teams','Attention','Persuasion','Risk','Learning'];
const CAPS=[{min:5,leaves:'2 leaves'},{min:10,leaves:'3 leaves'},{min:15,leaves:'5 leaves'}];
const CHIPS=['All','Decisions','Money','Habits','Teams','Attention'];
/* The 18 leaves of track 1. Node geometry is fixed; state is derived from progress. */
const NODES=[
{n:1,x:167,y:212,lines:['First numbers'],title:'First numbers'},
{n:2,x:208,y:236,lines:['Opening moves'],title:'Opening moves'},
{n:3,x:234,y:264,lines:['Arbitrary','anchors'],title:'Arbitrary anchors'},
{n:4,x:213,y:296,lines:['Rounding down'],title:'Rounding down'},
{n:5,x:176,y:320,lines:['Two numbers'],title:'Two numbers'},
{n:6,x:153,y:350,lines:['Value first'],title:'Value first'},
{n:7,x:170,y:384,lines:['Naming yours'],title:'Naming yours'},
{n:8,x:181,y:424,lines:['When the range','is set'],title:'When the range is set'},
{n:9,x:228,y:458,lines:['Prep work'],title:'Prep work'},
{n:10,x:244,y:486,lines:['On paper'],title:'On paper'},
{n:11,x:227,y:514,lines:['Long pauses'],title:'Long pauses'},
{n:12,x:203,y:538,lines:['Second offers'],title:'Second offers'},
{n:13,x:168,y:562,lines:['Halfway offers'],title:'Halfway offers'},
{n:14,x:149,y:578,lines:['Deadlines'],title:'Deadlines'},
{n:15,x:172,y:600,lines:['Walking away'],title:'Walking away'},
{n:16,x:213,y:612,lines:['Reading a room'],title:'Reading a room'},
{n:17,x:230,y:634,lines:['Follow-up'],title:'Follow-up'},
{n:18,x:192,y:650,lines:['Your anchors'],title:'Your anchors'}];
const REVISIT=[2,5];
/* Two leaves are written out in full — the session ends before a third. */
const LEAVES={
8:{n:8,title:'The first number sets the range',
summary:['Whoever names a number first quietly draws the range everyone else argues inside. You judge each later figure against that first one — how far above it, how far below — instead of against what the thing is worth to you.','It holds even when you know the number was arbitrary, and even when you were the one who called it arbitrary.'],
situation:'A supplier opens at 40,000 for a job you valued at 22,000. You counter at 24,000 and settle at 31,000.',
question:'Why did you settle 9,000 above your own valuation?',
options:['Because you were outnegotiated on the day.','Because their opening figure became the reference point.','Because 31,000 was closer to the real market price.'],
correct:1,
wrong:'You did give ground — but ask what set the range you gave ground inside. Pick again, retries cost nothing.',
right:'The opening figure moved the whole range, so your own number began to look like the low end.',
payoffTitle:'Why the first number wins',
payoff:['An anchor works by giving you something to adjust from. Faced with 40,000, you stop asking what the job is worth and start asking how far down from 40,000 you can get. The question has quietly changed, and the new one has a much smaller answer.','Adjustment is also lazy. You move away from the anchor until the number stops feeling outrageous, then stop — which is almost always too early. Both sides feel they worked hard, because they did: they just worked inside a range one of them chose.','Knowing this does not switch it off. What helps is naming your own number before you hear theirs, in writing, with the reasoning attached. Then their opening is a data point about them rather than a starting line for you.'],
notesTitle:'Four things to keep',
notes:['Whoever speaks first draws the range.','You adjust from the anchor, not from value.','Adjustment stops early, at the first number that feels defensible.','Write your own number down before the conversation starts.'],
takeaway:'People told in advance to ignore an opening figure still settle close to it.',
today:'Pick one thing you are about to negotiate — a fee, a deadline, a salary — and write your number and your reason in one line before anyone else names theirs.'},
9:{n:9,title:'Ten minutes of prep',
summary:['A figure you wrote down before the conversation is the only one in the room that was not shaped by theirs. It does not have to be right. It has to exist, and it has to have a reason attached.','Without one you are not negotiating a price. You are estimating how far you can move from theirs.'],
situation:'A renewal call starts in ten minutes. You expect them to open high, and you have not written anything down.',
question:'What is worth doing with those ten minutes?',
options:['Guess the figure they will open with, so it does not land as a surprise.','Write your own figure and the one reason it is defensible.','Decide the lowest figure you would still sign, and hold it there.'],
correct:1,
wrong:'That still leaves you working from their figure, or from a floor. Look for the option that gives you a number of your own, made before the call.',
right:'A figure written first, with its reason, turns their opening into information rather than a starting line.',
payoffTitle:'Prep beats nerve',
payoff:['Ten minutes is enough, because the work is not research. It is committing to one number and one sentence about why. The sentence matters more than the number: it is what stops you drifting when they push.','A floor is not a substitute. Deciding what you would accept tells you when to walk, but it gives you nothing to argue for — and negotiations settle near what someone argued for, not near what someone would tolerate.','Write it where you can see it during the call. People who can see their own figure adjust less, and they stop earlier when the other side pushes, because there is something concrete to push back against.'],
notesTitle:'Three things to keep',
notes:['A number without a reason will not hold under pressure.','A floor tells you when to leave, not what to ask for.','Keep your figure in view for the whole conversation.'],
takeaway:'The side that wrote a number down first tends to argue about value; the other side argues about distance.',
today:'Before your next call, write one line: the figure, and the reason it is defensible. Keep it on screen.'}};
const SEED_NOTES=[
{track:'The quiet arithmetic',leaf:'Leaf 6 · Costs you have already paid',t:'Money already spent is not a reason to spend more.'},
{track:'Rooms that decide',leaf:'Leaf 3 · Who is actually deciding',t:'The person asking the questions is rarely the one signing.'},
{track:'Rooms that decide',leaf:'Leaf 3 · Who is actually deciding',t:'Find the quiet one. Ask them first next time.',mine:true}];
function prng(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}}
function curve(x,y,a,len,bend){const ex=x+Math.cos(a)*len,ey=y+Math.sin(a)*len,nx=-Math.sin(a),ny=Math.cos(a),o=len*bend;
return{ex,ey,d:'M '+x.toFixed(1)+' '+y.toFixed(1)+' C '+(x+Math.cos(a)*len*0.34+nx*o*0.3).toFixed(1)+' '+(y+Math.sin(a)*len*0.34+ny*o*0.3).toFixed(1)+', '+(x+Math.cos(a)*len*0.68+nx*o*0.46).toFixed(1)+' '+(y+Math.sin(a)*len*0.68+ny*o*0.46).toFixed(1)+', '+ex.toFixed(1)+' '+ey.toFixed(1)}}
function blob(cx,cy,r,rand,jitter){const n=9,p=[];for(let i=0;i<n;i+=1){const a=i/n*Math.PI*2+(rand()-0.5)*0.18,rr=r*(1-jitter+rand()*jitter*2);p.push({x:cx+Math.cos(a)*rr,y:cy+Math.sin(a)*rr})}
let d='M '+p[0].x.toFixed(1)+' '+p[0].y.toFixed(1);
for(let i=0;i<n;i+=1){const p0=p[(i-1+n)%n],p1=p[i],p2=p[(i+1)%n],p3=p[(i+2)%n];
d+=' C '+(p1.x+(p2.x-p0.x)/6).toFixed(1)+' '+(p1.y+(p2.y-p0.y)/6).toFixed(1)+', '+(p2.x-(p3.x-p1.x)/6).toFixed(1)+' '+(p2.y-(p3.y-p1.y)/6).toFixed(1)+', '+p2.x.toFixed(1)+' '+p2.y.toFixed(1)}
return d+' Z'}
function nodesFor(done,total){const n=7,d=Math.round(done/total*n);return Array.from({length:n}).map((_,i)=>({id:'n'+i,state:i<d?'done':i===d?'current':'locked'}))}
const {Card,Icon,ProgressBar,TrackGraph}=window.ZoomOutDesignSystem_442bf9;
function Chip({label,selected,onClick}){return<button type="button" onClick={onClick} style={{display:'inline-flex',alignItems:'center',height:36,padding:'0 var(--space-md)',borderRadius:'var(--radius-sm)',background:selected?'var(--surface-raised)':'var(--surface-card)',border:(selected?'var(--border-width-focus)':'var(--border-width-hairline)')+' solid '+(selected?'var(--primary)':'var(--border-hairline)'),color:selected?'var(--primary)':'var(--text-secondary)',fontFamily:'var(--font-display)',fontWeight:'var(--weight-semibold)',fontSize:'var(--text-caption-size)',letterSpacing:'var(--text-caption-tracking)',textTransform:'uppercase',whiteSpace:'nowrap',cursor:'pointer'}}>{label}</button>}
function Segment({label,selected,onClick}){return<button type="button" onClick={onClick} style={{flex:1,display:'inline-flex',alignItems:'center',justifyContent:'center',height:44,borderRadius:'var(--radius-sm)',background:selected?'var(--surface-raised)':'transparent',border:(selected?'var(--border-width-focus)':'var(--border-width-hairline)')+' solid '+(selected?'var(--primary)':'transparent'),color:selected?'var(--primary)':'var(--text-secondary)',fontFamily:'var(--font-display)',fontWeight:'var(--weight-semibold)',fontSize:'var(--text-caption-size)',letterSpacing:'var(--text-caption-tracking)',textTransform:'uppercase',whiteSpace:'nowrap',cursor:'pointer'}}>{label}</button>}
function TrackRow({title,author,done,total,meta,finished,onClick}){return<Card interactive padding="var(--space-sm)" radius="var(--radius-md)" onClick={onClick} style={{display:'flex',alignItems:'center',gap:'var(--space-md)',cursor:'pointer'}}>
<div aria-hidden="true" style={{flex:'0 0 100px',background:'var(--surface-page)',border:'1px solid var(--border-hairline)',borderRadius:'var(--radius-sm)',padding:4}}>
<TrackGraph nodes={nodesFor(done,total)} width={160} height={48} ambientDensity={8} showCurrentLabel={false}/></div>
<div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:4}}>
<span style={{fontFamily:'var(--font-display)',fontWeight:'var(--weight-bold)',fontSize:'var(--text-h3-size)',lineHeight:1.25,color:'var(--text-heading)',textWrap:'pretty'}}>{title}</span>
<span style={{fontFamily:'var(--font-body)',fontSize:'var(--text-small-size)',color:'var(--text-secondary)'}}>{author}</span>
{finished
?<span style={{display:'inline-flex',alignItems:'center',gap:'var(--space-xs)',color:'var(--reward)',fontFamily:'var(--font-display)',fontWeight:'var(--weight-semibold)',fontSize:'var(--text-caption-size)',letterSpacing:'var(--text-caption-tracking)',textTransform:'uppercase'}}><Icon name="check" size={14}/>{total} leaves complete</span>
:<div style={{display:'flex',flexDirection:'column',gap:4,marginTop:2}}>
<ProgressBar value={done/total} height={4}/>
<span className="zo-caption" style={{color:'var(--text-secondary)'}}>{meta} · {done} / {total}</span></div>}</div>
<Icon name="chevron-right" size={20} color="var(--text-secondary)"/></Card>}
function Stat({value,label}){return<div style={{flex:1,display:'flex',flexDirection:'column',gap:2}}>
<span style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:'var(--text-h2-size)',lineHeight:1.1,color:'var(--text-heading)'}}>{value}</span>
<span className="zo-caption" style={{color:'var(--text-secondary)'}}>{label}</span></div>}
function LinkRow({label,value,last,onClick}){return<div role="button" tabIndex="0" onClick={onClick} style={{display:'flex',alignItems:'center',gap:'var(--space-md)',minHeight:'var(--touch-target-min)',borderBottom:last?'none':'1px solid var(--border-hairline)',cursor:onClick?'pointer':'default'}}>
<span style={{flex:1,fontFamily:'var(--font-display)',fontWeight:'var(--weight-semibold)',fontSize:'var(--text-h3-size)',color:'var(--text-body)'}}>{label}</span>
{value&&<span style={{fontFamily:'var(--font-body)',fontSize:'var(--text-small-size)',color:'var(--text-secondary)'}}>{value}</span>}
<Icon name="chevron-right" size={20} color="var(--text-secondary)"/></div>}
const TAB_ITEMS=[{key:'explore',label:'Explore',icon:'compass'},{key:'library',label:'Library',icon:'book-open'},{key:'journey',label:'Journey',icon:'network'},{key:'profile',label:'Profile',icon:'user'}];
Object.assign(window,{TRACKS,FINISHED,NEW_TRACKS,TOPICS,CAPS,CHIPS,NODES,REVISIT,LEAVES,SEED_NOTES,prng,curve,blob,nodesFor,Chip,Segment,TrackRow,Stat,LinkRow,TAB_ITEMS});
})();
