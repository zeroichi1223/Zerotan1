// Koala Nihongo - Greetings 30 (EN -> JA choices)
// Router + Audio init + TTS + score history
const app = document.getElementById('app');
const tabs = ['home','quiz','history','settings'];
function setActive(t){ tabs.forEach(x=>{ const el=document.getElementById('t-'+x.slice(0,4)); if(el) el.classList.toggle('active', x===t); }); }

// Audio (WebAudio) - unlocked by user gesture
let audioCtx=null;
function ensureAudio(){
  if(!audioCtx){ audioCtx = new (window.AudioContext||window.webkitAudioContext)(); }
  if(audioCtx.state==='suspended'){ audioCtx.resume(); }
}
function beep(type='ok'){
  if(!audioCtx) return;
  const o=audioCtx.createOscillator(), g=audioCtx.createGain();
  o.type='sine';
  if(type==='ok'){ o.frequency.value=880; } else { o.frequency.value=220; }
  g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.2, audioCtx.currentTime+0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime+0.25);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime+0.26);
}

// TTS
let settings = JSON.parse(localStorage.getItem('koala_settings')||'{}');
settings.tts = settings.tts ?? true;
settings.rate = settings.rate ?? 1.0;
function saveSettings(){ localStorage.setItem('koala_settings', JSON.stringify(settings)); }
function speak(text, lang='en-US'){
  try{
    if(!settings.tts) return;
    const u = new SpeechSynthesisUtterance(text); u.lang=lang; u.rate=settings.rate; speechSynthesis.cancel(); speechSynthesis.speak(u);
  }catch(_){}
}

// Data
let DATA=[];
async function loadData(){
  if(DATA.length) return;
  const r = await fetch('./greetings.json'); DATA = await r.json();
}

// Router
function route(){
  const h=(location.hash||'#home').replace('#','');
  setActive(h);
  if(h==='home') return renderHome();
  if(h==='quiz') return renderQuiz();
  if(h==='history') return renderHistory();
  if(h==='settings') return renderSettings();
  renderHome();
}
window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', ()=>{ if(!location.hash) location.hash='#home'; route(); });
window.addEventListener('load', ()=>{ if(!location.hash) location.hash='#home'; route(); });

// Views
function renderHome(){
  app.innerHTML = `
    <section class="center">
      <div class="hero"><img src="assets/koala.png" alt="koala"></div>
      <div class="h1">コアラ日本語｜あいさつ30</div>
      <p class="p">英語→日本語の4択クイズ。音声＆効果音つきで楽しく学習！</p>
      <div class="actions">
        <a class="btn primary" href="#quiz">▶ クイズを始める</a>
        <a class="btn" href="#history">📊 成績を見る</a>
        <a class="btn" href="#settings">⚙️ 設定</a>
        <button class="btn" id="unlock">🔊 音を有効にする</button>
      </div>
      <p class="small">音が出ない時は「🔊 音を有効にする」をタップしてね。</p>
    </section>`;
  document.getElementById('unlock').addEventListener('click', ()=>{ ensureAudio(); beep('ok'); });
}

let order=[], qi=0, score=0, currentChoices=[];
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]] } return a; }
function sampleChoices(idx){
  const pool = DATA.map((d,i)=>({ja:d.ja,i})).filter(x=>x.i!==idx);
  shuffle(pool); const arr=[{ja:DATA[idx].ja,i:idx}, ...pool.slice(0,3)]; return shuffle(arr);
}

async function renderQuiz(){
  await loadData(); ensureAudio();
  order = shuffle(Array.from({length:DATA.length}, (_,i)=>i));
  qi=0; score=0; drawQ();
}

function drawQ(){
  const d = DATA[order[qi]];
  app.innerHTML = `
    <section class="row">
      <div class="badge">進捗 <b>${qi+1}/${DATA.length}</b></div>
      <div class="badge">正解 <b id="sc">${score}</b></div>
      <div class="kit">
        <label class="badge">音声 <input type="checkbox" id="tts"${settings.tts?' checked':''}></label>
        <label class="badge">速度 <input id="rate" type="range" min="0.8" max="1.3" step="0.05" value="${settings.rate}"></label>
        <button class="btn" id="enSpeak">🔊 EN</button>
      </div>
    </section>
    <section class="card">
      <div class="prompt">${d.en}</div>
    </section>
    <section class="grid">
      <button class="choice" id="c0"></button>
      <button class="choice" id="c1"></button>
      <button class="choice" id="c2"></button>
      <button class="choice" id="c3"></button>
    </section>
    <div class="actions"><a class="btn" id="next">次へ ▶</a></div>
  `;
  currentChoices = sampleChoices(order[qi]);
  for(let k=0;k<4;k++){ const b=document.getElementById('c'+k); b.textContent=currentChoices[k].ja; b.onclick=()=>choose(k); }
  document.getElementById('enSpeak').onclick = ()=>speak(d.en,'en-US');
  document.getElementById('next').onclick = nextQ;
  document.getElementById('tts').onchange = (e)=>{ settings.tts=e.target.checked; saveSettings(); };
  document.getElementById('rate').oninput = (e)=>{ settings.rate=Number(e.target.value); saveSettings(); };
}

function choose(k){
  const idxCorrect = order[qi];
  const ok = currentChoices[k].i===idxCorrect;
  if(ok){ score++; document.getElementById('c'+k).classList.add('correct'); beep('ok'); speak(DATA[idxCorrect].ja,'ja-JP'); }
  else { document.getElementById('c'+k).classList.add('wrong'); beep('ng'); const gg=currentChoices.findIndex(c=>c.i===idxCorrect); if(gg>=0) document.getElementById('c'+gg).classList.add('correct'); }
  for(let t=0;t<4;t++){ document.getElementById('c'+t).disabled=true; }
  document.getElementById('sc').textContent = String(score);
}

function nextQ(){
  if(qi<DATA.length-1){ qi++; drawQ(); }
  else{ saveHistory(); renderHistory(); }
}

function saveHistory(){
  const arr = JSON.parse(localStorage.getItem('koala_hist')||'[]');
  const item = { when: new Date().toISOString(), total: DATA.length, correct: score, acc: Math.round(100*score/DATA.length) };
  arr.unshift(item); localStorage.setItem('koala_hist', JSON.stringify(arr));
}

function renderHistory(){
  const arr = JSON.parse(localStorage.getItem('koala_hist')||'[]');
  const rows = arr.map(r=>`<tr><td>${new Date(r.when).toLocaleString()}</td><td>${r.correct}/${r.total}</td><td>${r.acc}%</td></tr>`).join('') || `<tr><td colspan="3" class="small">まだ記録がありません。</td></tr>`;
  app.innerHTML = `
    <section class="center">
      <div class="h1">成績</div>
      <table class="table">
        <thead><tr><th>日付</th><th>スコア</th><th>正答率</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="actions">
        <a class="btn primary" href="#quiz">もう一回</a>
        <button class="btn" id="clear">履歴クリア</button>
      </div>
    </section>`;
  const clear = document.getElementById('clear'); if(clear) clear.onclick=()=>{ if(confirm('履歴を削除しますか？')){ localStorage.removeItem('koala_hist'); renderHistory(); } };
}

function renderSettings(){
  app.innerHTML = `
    <section class="center">
      <div class="h1">設定</div>
      <div class="actions">
        <label class="badge">読み上げ <input type="checkbox" id="tts"${settings.tts?' checked':''}></label>
        <label class="badge">速度 <input id="rate" type="range" min="0.8" max="1.3" step="0.05" value="${settings.rate}"></label>
        <button class="btn" id="unlock">🔊 音を有効にする</button>
      </div>
      <p class="small">アイコン画像は <code>assets/koala.png</code> を入れ替えると反映されます。</p>
    </section>`;
  document.getElementById('tts').onchange=(e)=>{ settings.tts=e.target.checked; saveSettings(); };
  document.getElementById('rate').oninput=(e)=>{ settings.rate=Number(e.target.value); saveSettings(); };
  document.getElementById('unlock').onclick=()=>{ ensureAudio(); beep('ok'); };
}
