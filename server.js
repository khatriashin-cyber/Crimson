// JARVIS backend: zero dependencies (Node 18+). The Gemini key lives only here.
const http=require('http'),fs=require('fs'),path=require('path');
try{fs.readFileSync(path.join(__dirname,'.env'),'utf8').split('\n').forEach(l=>{const m=l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})}catch{}
const KEY=process.env.GEMINI_API_KEY,MODEL=process.env.GEMINI_MODEL||'gemini-2.5-flash',PORT=process.env.PORT||3000;
const PUB=path.join(__dirname,'public');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const hits=new Map();
const limited=ip=>{const n=Date.now(),a=(hits.get(ip)||[]).filter(t=>n-t<6e4);a.push(n);hits.set(ip,a);return a.length>20};
const sys=(name,lang,now)=>`You are ${String(name).slice(0,30)||'JARVIS'}, a calm, intelligent personal AI assistant. Address the user respectfully (e.g. "sir") unless they say otherwise. Be short and accurate by default; expand only when asked. `+
`Language: ${lang==='hi-IN'?'reply in Hindi (Devanagari)':lang==='hinglish'?'reply in Hinglish (Hindi written in Roman letters mixed with English)':'reply in English, but mirror the user if they write in Hindi or Hinglish'}. `+
`Current date/time on the user's device: ${String(now).slice(0,80)}. You are a chat assistant only: you cannot access the phone, contacts, apps, calls or files, and you cannot set alarms or open links yourself. Never claim to have done anything you did not do. Plain text only, no markdown.`;
http.createServer(async(req,res)=>{
  const json=(c,o)=>{res.writeHead(c,{'Content-Type':'application/json'});res.end(JSON.stringify(o))};
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  if(req.method==='POST'&&req.url==='/api/chat'){
    if(limited(req.socket.remoteAddress))return json(429,{error:'Too many requests. Please wait a moment.'});
    if(!KEY)return json(500,{error:'Server is missing GEMINI_API_KEY. Add it to .env and restart.'});
    let b='';for await(const c of req){b+=c;if(b.length>1e5)return json(413,{error:'Request too large.'})}
    try{
      const{messages,name,lang,now}=JSON.parse(b);
      let c=(Array.isArray(messages)?messages:[]).slice(-20).map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:String(m.text).slice(0,4000)}]}));
      while(c.length&&c[0].role!=='user')c.shift();
      if(!c.length)return json(400,{error:'Empty message.'});
      const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':KEY},
        body:JSON.stringify({systemInstruction:{parts:[{text:sys(name,lang,now)}]},contents:c,generationConfig:{maxOutputTokens:700,temperature:0.7,thinkingConfig:{thinkingBudget:0}}})});
      const j=await r.json();
      if(!r.ok)return json(502,{error:'Gemini error: '+(j.error?.message||r.status)});
      const reply=(j.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('').trim();
      return json(200,{reply:reply||'I could not produce a response, sir. Please try again.'});
    }catch(e){return json(500,{error:'Request failed.'})}
  }
  if(req.method!=='GET')return json(405,{error:'Not allowed'});
  let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';
  const f=path.join(PUB,p);
  if(!f.startsWith(PUB)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end('Not found')}
  res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream','Cache-Control':p==='/sw.js'?'no-cache':'public,max-age=300'});
  fs.createReadStream(f).pipe(res);
}).listen(PORT,()=>console.log('JARVIS online → http://localhost:'+PORT+(KEY?'':'  (GEMINI_API_KEY not set)')));
