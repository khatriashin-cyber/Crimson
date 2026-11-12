const{useState,useEffect,useRef}=React,h=React.createElement;
const ld=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v??d}catch{return d}};
const sv=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
const uid=()=>Math.random().toString(36).slice(2,9);
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
const LANGS={'en-IN':'English','hi-IN':'हिन्दी (Hindi)','hinglish':'Hinglish'};
const newConv=()=>({id:uid(),title:'New conversation',msgs:[]});
const LABEL={idle:'STANDBY',listening:'LISTENING',thinking:'PROCESSING',speaking:'SPEAKING'};
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();window.__ip=e});

// Local actions: always need the user's confirmation before running.
function intent(t){
  let m=t.match(/remind me (?:in|after) (\d+)\s*(second|sec|minute|min|hour|hr)s?\s*(?:to|about)?\s*(.*)/i);
  if(m){const n=+m[1],u=m[2].toLowerCase(),ms=n*(u[0]==='s'?1e3:u[0]==='m'?6e4:36e5),what=m[3]||'your reminder';
    return{ask:`Set a reminder in ${n} ${m[2]}(s): "${what}"? It only fires while JARVIS is open.`,run:a=>{a.addRem(what,Date.now()+ms);return'Reminder set.'}}}
  m=t.match(/\b(?:open|kholo|khol do)\s+((?:https?:\/\/)?(?:[\w-]+\.)+[a-z]{2,}\S*)/i);
  if(m){const u=/^https?:\/\//i.test(m[1])?m[1]:'https://'+m[1];
    return{ask:`Open ${u} in a new tab?`,run:()=>{window.open(u,'_blank','noopener,noreferrer');return'Requested. If nothing opened, your browser blocked the pop-up.'}}}
}

function App(){
  const[cfg,setCfg]=useState(()=>ld('j.cfg',{voice:true,lang:'en-IN',name:'JARVIS'}));
  const[convs,setConvs]=useState(()=>{const c=ld('j.convs',[]);return c.length?c:[newConv()]});
  const[cur,setCur]=useState(()=>ld('j.cur',null));
  const[rem,setRem]=useState(()=>ld('j.rem',[]));
  const[state,setState]=useState('idle'),[input,setInput]=useState(''),[panel,setPanel]=useState(null),[pending,setPending]=useState(null),[now,setNow]=useState(new Date()),[toast,setToast]=useState('');
  const endRef=useRef(),recRef=useRef();
  const conv=convs.find(c=>c.id===cur)||convs[0];
  useEffect(()=>sv('j.cfg',cfg),[cfg]);useEffect(()=>sv('j.convs',convs),[convs]);useEffect(()=>sv('j.cur',conv.id),[conv.id]);useEffect(()=>sv('j.rem',rem),[rem]);
  useEffect(()=>{const i=setInterval(()=>setNow(new Date()),1000);setTimeout(()=>document.getElementById('splash')?.classList.add('off'),900);return()=>clearInterval(i)},[]);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth'})},[conv.msgs.length]);
  useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),3500);return()=>clearTimeout(t)},[toast]);
  const add=(role,text)=>setConvs(cs=>cs.map(c=>c.id===conv.id?{...c,title:c.msgs.length||role!=='user'?c.title:text.slice(0,30),msgs:[...c.msgs,{role,text}]}:c));
  const speak=t=>{if(!cfg.voice||!window.speechSynthesis){setState('idle');return}
    speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t.replace(/[*_#`>]/g,''));u.lang=cfg.lang==='hi-IN'?'hi-IN':'en-IN';
    u.onstart=()=>setState('speaking');u.onend=u.onerror=()=>setState('idle');speechSynthesis.speak(u)};
  useEffect(()=>{const due=rem.filter(r=>r.at<=now.getTime());if(!due.length)return;
    setRem(rem.filter(r=>r.at>now.getTime()));
    due.forEach(r=>{const t='Reminder: '+r.what;add('assistant',t);speak(t);try{Notification.permission==='granted'&&new Notification('JARVIS',{body:t,icon:'/icon-192.png'})}catch{}})},[now]);
  const api={addRem:(what,at)=>{setRem(r=>[...r,{id:uid(),what,at}]);try{Notification.requestPermission()}catch{}}};

  async function send(text){
    text=(text||'').trim();if(!text||state==='thinking')return;
    setInput('');window.speechSynthesis?.cancel();add('user',text);
    const it=intent(text);if(it){setPending(it);add('assistant',it.ask);setState('idle');return}
    setState('thinking');
    try{
      const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[...conv.msgs,{role:'user',text}].slice(-20),name:cfg.name,lang:cfg.lang,now:new Date().toString()})});
      const j=await r.json();if(!r.ok)throw new Error(j.error||'Server error');
      add('assistant',j.reply);speak(j.reply);
    }catch(e){add('assistant',navigator.onLine?'⚠ '+e.message:'⚠ You appear to be offline. AI features need an internet connection.');setState('idle')}
  }
  const mic=()=>{
    if(!SR){setToast('Voice input is not supported in this browser. Please type instead.');return}
    if(state==='listening'){recRef.current?.stop();return}
    window.speechSynthesis?.cancel();
    const r=new SR();recRef.current=r;r.lang=cfg.lang==='hi-IN'?'hi-IN':'en-IN';r.interimResults=true;let fin='';
    r.onstart=()=>setState('listening');
    r.onresult=e=>{let s='';for(const x of e.results){s+=x[0].transcript;if(x.isFinal)fin=s}setInput(s)};
    r.onerror=e=>{setToast(e.error==='not-allowed'?'Microphone permission denied. Enable it in browser site settings.':'Voice error: '+e.error);setState('idle')};
    r.onend=()=>{setState(s=>s==='listening'?'idle':s);if(fin)send(fin)};
    try{r.start()}catch{}
  };
  const decide=ok=>{const p=pending;setPending(null);add('assistant',ok?p.run(api):'Cancelled.')};
  const fresh=()=>{const c=newConv();setConvs(cs=>[c,...cs]);setCur(c.id);setPanel(null)};
  const clearAll=()=>{if(!confirm('Delete all conversations?'))return;const c=newConv();setConvs([c]);setCur(c.id);setPanel(null)};
  const time=now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),date=now.toLocaleDateString([],{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const sheet=panel==='hist'?[h('h3',{key:'t'},'CONVERSATIONS'),h('button',{key:'n',className:'btn',onClick:fresh},'+ New conversation'),
      ...convs.map(c=>h('div',{key:c.id,className:'item'+(c.id===conv.id?' on':''),onClick:()=>{setCur(c.id);setPanel(null)}},c.title,h('br'),h('small',null,c.msgs.length+' messages'))),
      h('button',{key:'c',className:'btn red',onClick:()=>{setConvs(cs=>cs.map(c=>c.id===conv.id?{...c,msgs:[],title:'New conversation'}:c));setPanel(null)}},'Clear this chat')]
    :[h('h3',{key:'t'},'SETTINGS'),
      h('label',{key:'v',className:'row'},'Voice replies',h('input',{type:'checkbox',checked:cfg.voice,onChange:e=>{setCfg({...cfg,voice:e.target.checked});if(!e.target.checked)window.speechSynthesis?.cancel()}})),
      h('label',{key:'l',className:'row'},'Language',h('select',{value:cfg.lang,onChange:e=>setCfg({...cfg,lang:e.target.value})},Object.entries(LANGS).map(([k,v])=>h('option',{key:k,value:k},v)))),
      h('label',{key:'a',className:'row'},'Assistant name',h('input',{value:cfg.name,maxLength:20,onChange:e=>setCfg({...cfg,name:e.target.value||'JARVIS'})})),
      h('small',{key:'r'},rem.length?'Reminders: '+rem.map(r=>r.what+' ('+new Date(r.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+')').join(', '):'No active reminders. Try: "remind me in 10 minutes to call mom".'),
      window.__ip&&h('button',{key:'i',className:'btn',onClick:()=>window.__ip.prompt()},'Install app'),
      h('button',{key:'x',className:'btn red',onClick:clearAll},'Clear all conversation history'),
      h('small',{key:'s'},'Chats and settings are stored only on this device. AI replies need an internet connection; the app shell works offline. JARVIS cannot control your phone, only open links and set in-app reminders after you approve.')];
  return h('div',{className:'app'},
    h('header',null,h('button',{className:'ic','aria-label':'Conversations',onClick:()=>setPanel('hist')},'☰'),h('div',{className:'ttl'},cfg.name.toUpperCase()),h('button',{className:'ic','aria-label':'Settings',onClick:()=>setPanel('set')},'⚙')),
    h('div',{className:'hud'},h('b',null,time),date),
    h('div',{className:'core '+state},h('i'),h('i'),h('i'),h('em',null,LABEL[state])),
    h('main',{className:'msgs'},conv.msgs.length?conv.msgs.map((m,i)=>h('div',{key:i,className:'m '+m.role},m.text)):h('p',{className:'hint'},'At your service. Tap the mic or type.'),h('div',{ref:endRef})),
    pending&&h('div',{className:'ask'},h('button',{onClick:()=>decide(true)},'Allow'),h('button',{className:'no',onClick:()=>decide(false)},'Cancel')),
    h('footer',null,h('input',{value:input,placeholder:'Message '+cfg.name+'…',onChange:e=>setInput(e.target.value),onKeyDown:e=>e.key==='Enter'&&send(input)}),
      input.trim()&&h('button',{className:'send','aria-label':'Send',onClick:()=>send(input)},'➤'),
      h('button',{className:'mic '+state,'aria-label':'Microphone',onClick:mic},'🎙')),
    toast&&h('div',{className:'toast'},toast),
    panel&&h('div',{className:'sheet',onClick:e=>e.target===e.currentTarget&&setPanel(null)},h('div',{className:'box'},sheet)));
}
ReactDOM.createRoot(document.getElementById('root')).render(h(App));
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
