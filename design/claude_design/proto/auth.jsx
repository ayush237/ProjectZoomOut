/* Screen 9: account. Email and password only — no social sign-in, no guest mode. */
(()=>{
const {Button,Input,Icon}=window.ZoomOutDesignSystem_442bf9;
const validEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
function Mark(){const pts=[{x:6,y:20},{x:34,y:8},{x:64,y:22},{x:94,y:10},{x:122,y:18}];
return<svg viewBox="0 0 128 30" width="128" height="30" role="img" aria-label="ZoomOut">
{pts.slice(1).map((p,i)=><line key={i} x1={pts[i].x} y1={pts[i].y} x2={p.x} y2={p.y} stroke="var(--graph-edge)" strokeWidth="1.25"/>)}
{pts.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={i===pts.length-1?4:3} fill={i===pts.length-1?'var(--surface-page)':'var(--graph-node-unreached)'} stroke={i===pts.length-1?'var(--primary)':'none'} strokeWidth={i===pts.length-1?1.75:0}/>)}
</svg>}
function Header(){return<div style={{display:'flex',flexDirection:'column',gap:'var(--space-md)',alignItems:'flex-start'}}>
<Mark/>
<span style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:'var(--text-h2-size)',color:'var(--text-heading)'}}>ZoomOut</span></div>}
function Foot({prompt,linkLabel,onLink}){return<div style={{display:'flex',justifyContent:'center',gap:'var(--space-xs)',minHeight:44,alignItems:'center'}}>
<span className="zo-small" style={{color:'var(--text-secondary)'}}>{prompt}</span>
<button type="button" onClick={onLink} className="zo-small" style={{background:'none',border:0,padding:0,color:'var(--text-link)',fontWeight:600,cursor:'pointer'}}>{linkLabel}</button></div>}

function SignInScreen({app}){
const [email,setEmail]=React.useState('name@gmial');
const [emailTouched,setEmailTouched]=React.useState(true);
const [password,setPassword]=React.useState('');
const [passwordTouched,setPasswordTouched]=React.useState(false);
const emailError=emailTouched&&email&&!validEmail(email)?'Enter a valid email address':undefined;
const canSubmit=validEmail(email)&&password.length>0;
return<div className="screen" data-screen-label="Sign in">
<div className="body" style={{paddingTop:'var(--space-xl)'}}>
<Header/>
<h1 style={{margin:0,fontFamily:'var(--font-display)',fontWeight:700,fontSize:'var(--text-h1-size)',lineHeight:'var(--text-h1-leading)',color:'var(--text-heading)'}}>Sign in</h1>
<div style={{display:'flex',flexDirection:'column',gap:'var(--space-md)'}}>
<Input label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} onBlur={()=>setEmailTouched(true)} error={emailError} placeholder="you@email.com"/>
<div style={{display:'flex',flexDirection:'column',gap:'var(--space-xs)'}}>
<Input label="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} onBlur={()=>setPasswordTouched(true)} placeholder="Enter your password"/>
<div style={{display:'flex',justifyContent:'flex-end'}}>
<button type="button" className="zo-small" style={{minHeight:44,padding:'0 2px',background:'none',border:0,color:'var(--text-link)',cursor:'pointer'}} onClick={()=>{}}>Forgot password?</button></div></div></div></div>
<div className="foot">
<Button fullWidth size="lg" disabled={!canSubmit} onClick={()=>app.finishOnboarding({topics:app.topics,cap:app.capMin,remind:app.remind})}>Sign in</Button>
<Foot prompt="New to ZoomOut?" linkLabel="Create account" onLink={()=>app.go('signup')}/>
</div></div>}

function SignUpScreen({app}){
const [email,setEmail]=React.useState('');
const [emailTouched,setEmailTouched]=React.useState(false);
const [password,setPassword]=React.useState('pass12');
const [passwordTouched,setPasswordTouched]=React.useState(true);
const emailError=emailTouched&&email&&!validEmail(email)?'Enter a valid email address':undefined;
const passwordError=passwordTouched&&password&&password.length<8?'Use 8 characters or more':undefined;
const canSubmit=validEmail(email)&&password.length>=8;
return<div className="screen" data-screen-label="Sign up">
<div className="body" style={{paddingTop:'var(--space-xl)'}}>
<Header/>
<h1 style={{margin:0,fontFamily:'var(--font-display)',fontWeight:700,fontSize:'var(--text-h1-size)',lineHeight:'var(--text-h1-leading)',color:'var(--text-heading)'}}>Create account</h1>
<div style={{display:'flex',flexDirection:'column',gap:'var(--space-md)'}}>
<Input label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} onBlur={()=>setEmailTouched(true)} error={emailError} placeholder="you@email.com"/>
<Input label="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} onBlur={()=>setPasswordTouched(true)} error={passwordError} helper={passwordError?undefined:'8 characters or more'} placeholder="Create a password"/>
</div></div>
<div className="foot">
<Button fullWidth size="lg" disabled={!canSubmit} onClick={()=>{app.go('onboarding');app.setObStep(0)}}>Continue</Button>
<Foot prompt="Already have an account?" linkLabel="Sign in" onLink={()=>app.go('signin')}/>
</div></div>}

Object.assign(window,{SignInScreen,SignUpScreen});
})();
