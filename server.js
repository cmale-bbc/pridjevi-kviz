const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'pridjevi2026';
const adminSessions = new Set();
const questions = [
  { q: 'Koja je glavna uloga pridjeva?', o: ['Zamjenjuju glagole', 'Opisuju ili pobliže određuju imenicu', 'Označuju radnju', 'Povezuju rečenice'], a: 1, why: 'Pridjevi pobliže određuju imenice.' },
  { q: 'Na koje pitanje odgovara opisni pridjev?', o: ['Čiji?', 'Od čega?', 'Kakav?', 'Koliko?'], a: 2, why: 'Opisni pridjevi odgovaraju na pitanje kakav?' },
  { q: 'Koji je od navedenih pridjeva posvojni?', o: ['Plav', 'Drven', 'Ivanov', 'Hladan'], a: 2, why: 'Ivanov označava kome nešto pripada.' },
  { q: 'Koji je od navedenih pridjeva gradivni?', o: ['Veseo', 'Sestrin', 'Brz', 'Staklen'], a: 3, why: 'Staklen označava od čega je nešto.' },
  { q: 'Kako se pravilno piše?', o: ['hrvatski jezik', 'Hrvatski jezik', 'Hrvatski Jezik', 'hrvatski Jezik'], a: 0, why: 'Pridjevi na -ski pišu se malim početnim slovom.' },
  { q: 'Koji se pridjev piše velikim početnim slovom?', o: ['splitski', 'školski', 'Markov', 'dalmatinski'], a: 2, why: 'Posvojni pridjevi na -ov/-ev/-in od vlastitih imena pišu se velikim slovom.' },
  { q: 'Koji je oblik određenog pridjeva?', o: ['visok čovjek', 'visoki čovjek', 'čovjek visok', 'visoko čovjek'], a: 1, why: 'Određeni oblik odgovara na pitanje koji? – visoki čovjek.' },
  { q: 'Koji je komparativ pridjeva brz?', o: ['najbrži', 'brziji', 'brži', 'brzest'], a: 2, why: 'Brz – brži – najbrži.' },
  { q: 'Koji je superlativ pridjeva lijep?', o: ['ljepši', 'najljepši', 'najlijepši', 'ljepiji'], a: 1, why: 'Superlativ se tvori dodavanjem naj- na komparativ.' },
  { q: 'Koji je pravilan oblik komparacije pridjeva dobar?', o: ['dobriji', 'dobariji', 'bolji', 'najbolji'], a: 2, why: 'Dobar – bolji – najbolji.' },
  { q: 'Kako je pravilno?', o: ['naj jači', 'najjači', 'naj-jači', 'najjaćiji'], a: 1, why: 'Naj- se piše sastavljeno s komparativom.' },
  { q: 'U rečenici „Moj bicikl je nov.” pridjev nov je...', o: ['sročni atribut', 'priložna oznaka', 'dio imenskog predikata', 'subjekt'], a: 2, why: 'Uz glagol biti pridjev može biti dio imenskog predikata.' }
];
let game = { pin: newPin(), phase: 'waiting', questionIndex: 0, seconds: 20, timeLeft: 20, teams: {}, revealed: false, endsAt: null };
let timer = null;
function newPin(){ return String(Math.floor(100000 + Math.random()*900000)); }
function json(res, code, data){ res.writeHead(code, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(data)); }
function body(req){ return new Promise((resolve,reject)=>{let s='';req.on('data',c=>s+=c);req.on('end',()=>{try{resolve(s?JSON.parse(s):{});}catch(e){reject(e);}});}); }
function isHost(req){ const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,''); return adminSessions.has(token); }
function publicState(){
  const q=questions[game.questionIndex];
  return { pin:game.pin, phase:game.phase, questionIndex:game.questionIndex, total:questions.length, question:game.phase==='waiting'||game.phase==='finished'?null:{q:q.q,o:q.o}, timeLeft:game.timeLeft, revealed:game.revealed, correctAnswer:game.revealed?q.a:null, explanation:game.revealed?q.why:null,
    leaderboard:game.revealed||game.phase==='finished'?Object.values(game.teams).map(t=>({name:t.name,score:t.score})).sort((a,b)=>b.score-a.score):[] };
}
function hostState(){ return {...publicState(), teams:Object.values(game.teams).map(t=>({name:t.name,score:t.score,answered:t.answered,correct:t.correct,answer:t.answer})).sort((a,b)=>b.score-a.score)}; }
function stopTimer(){ if(timer){clearInterval(timer);timer=null;} }
function startTimer(){ stopTimer(); game.endsAt=Date.now()+game.seconds*1000; game.timeLeft=game.seconds; timer=setInterval(()=>{game.timeLeft=Math.max(0,Math.ceil((game.endsAt-Date.now())/1000)); if(game.timeLeft<=0){stopTimer();game.phase='timeup';}},200); }
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(req.method==='GET' && url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(fs.readFileSync(path.join(__dirname,'index.html')));}
  if(req.method==='GET' && url.pathname==='/host'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(fs.readFileSync(path.join(__dirname,'host.html')));}
  if(req.method==='GET' && url.pathname==='/api/state') return json(res,200,publicState());
  if(req.method==='POST' && url.pathname==='/api/login') { const b=await body(req); if(b.password!==ADMIN_PASSWORD)return json(res,401,{error:'Pogrešna lozinka.'}); const token=crypto.randomBytes(24).toString('hex');adminSessions.add(token);return json(res,200,{token}); }
  if(req.url.startsWith('/api/host/') && !isHost(req)) return json(res,401,{error:'Nemaš ovlasti voditelja.'});
  if(req.method==='GET' && url.pathname==='/api/host/state') return json(res,200,hostState());
  if(req.method==='POST' && url.pathname==='/api/join') { const b=await body(req); if(b.pin!==game.pin)return json(res,400,{error:'Pogrešan PIN.'}); const name=String(b.name||'').trim().slice(0,24);if(name.length<2)return json(res,400,{error:'Naziv tima mora imati barem 2 znaka.'});const key=name.toLocaleLowerCase('hr');if(!game.teams[key])game.teams[key]={name,score:0,answered:false,correct:null,answer:null};return json(res,200,{ok:true,name:game.teams[key].name}); }
  if(req.method==='POST' && url.pathname==='/api/answer') { const b=await body(req); const key=String(b.name||'').trim().toLocaleLowerCase('hr');const t=game.teams[key];if(!t)return json(res,404,{error:'Tim nije pronađen. Ponovno se pridružite.'});if(game.phase!=='question')return json(res,400,{error:'Odgovaranje je zatvoreno.'});if(t.answered)return json(res,400,{error:'Već ste predali odgovor.'});const answer=Number(b.answer);if(!Number.isInteger(answer)||answer<0||answer>3)return json(res,400,{error:'Neispravan odgovor.'});t.answered=true;t.answer=answer;t.correct=answer===questions[game.questionIndex].a;if(t.correct)t.score+=1000+Math.max(0,game.timeLeft)*20;return json(res,200,{ok:true,correct:t.correct}); }
  if(req.method==='POST' && url.pathname.startsWith('/api/host/')) { const b=await body(req); const action=url.pathname.split('/').pop();
    if(action==='start'){stopTimer();game={pin:newPin(),phase:'question',questionIndex:0,seconds:[15,20,30].includes(Number(b.seconds))?Number(b.seconds):20,timeLeft:20,teams:{},revealed:false,endsAt:null};startTimer();return json(res,200,hostState());}
    if(action==='reveal'){stopTimer();game.revealed=true;game.phase='reveal';return json(res,200,hostState());}
    if(action==='next'){stopTimer();if(game.questionIndex>=questions.length-1){game.phase='finished';game.revealed=true;return json(res,200,hostState());}game.questionIndex++;for(const t of Object.values(game.teams)){t.answered=false;t.correct=null;t.answer=null;}game.revealed=false;game.phase='question';startTimer();return json(res,200,hostState());}
    if(action==='reset'){stopTimer();game={pin:newPin(),phase:'waiting',questionIndex:0,seconds:20,timeLeft:20,teams:{},revealed:false,endsAt:null};return json(res,200,hostState());}
  }
  json(res,404,{error:'Not Found'});
});
server.listen(PORT,()=>console.log(`Pridjevi Arena sluša na portu ${PORT}`));
