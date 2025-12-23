/* app.js — Complete client-only dashboard
   Author: Mohammad Javad
   Notes: Rule engine loaded/assembled at runtime (decode), fingerprint lock, DevTools detection, PWA hooks
*/

/* ----------------- tiny helpers ----------------- */
const $ = id => document.getElementById(id);
const SP = 'gh_site_v1_';
const nowISO = () => new Date().toISOString();
const fmt = n => { try { return Number(n).toLocaleString('en-US'); } catch(e){ return n; } };
const parseN = s => { if(s==null) return NaN; const t = String(s).replace(/,/g,'').trim(); if(t==='') return NaN; const n = Number(t); return isFinite(n)? n : NaN; };

/* ----------------- feature flags ----------------- */
const FEATURES = {
  shop: true,
  full: true,
  pwa: true,
  chart: true,
  ruleEngine: true,
  timeline: true,
  explain: true,
  fingerprintLock: true,
  devtoolsProtect: true
};

/* ----------------- simple storage wrapper ----------------- */
const Store = {
  get(k){ try { return JSON.parse(localStorage.getItem(SP + k)); } catch(e) { return null; } },
  set(k,v){ try { localStorage.setItem(SP + k, JSON.stringify(v)); return true; } catch(e) { return false; } },
  rm(k){ localStorage.removeItem(SP + k); }
};

/* ----------------- UI: entry buttons ----------------- */
document.querySelectorAll('[data-mode]').forEach(btn => {
  btn.addEventListener('click', e => {
    const m = e.currentTarget.getAttribute('data-mode');
    if(!m) return;
    Store.set('mode', m);
    showApp(m);
  });
});

/* ----------------- show/hide app ----------------- */
const entryScreen = $('entryScreen');
const appRoot = $('appRoot');
$('backBtn').addEventListener('click', () => { Store.rm('mode'); location.reload(); });

function showApp(mode){
  entryScreen.classList.add('hidden');
  appRoot.classList.remove('hidden');
  appRoot.setAttribute('aria-hidden','false');
  const full = (mode === 'full');
  $('fullUI').style.display = full ? '' : 'none';
  $('rightCol').style.display = full ? '' : 'none';
  $('leftCol').style.width = full ? '' : '100%';
  initApp();
}

/* auto-enter if saved */
(function(){
  const mode = Store.get('mode');
  if(mode === 'shop' || mode === 'full'){ showApp(mode); }
})();

/* ----------------- PWA manifest & SW registration ----------------- */
(async function setupPWA(){
  if(!FEATURES.pwa) return;
  try{
    const manifest = {
      name: "جواهری استقلال",
      short_name: "طلا",
      start_url: ".",
      display: "standalone",
      background_color: "#fff8e6",
      theme_color: "#f9d976",
      icons: [
        { src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='192' height='192'><rect width='100%' height='100%' fill='%23f9d976'/><text x='50%' y='55%' font-size='80' text-anchor='middle' fill='%23b8860b' font-family='Vazirmatn'>ط</text></svg>", sizes:"192x192", type:"image/svg+xml"}
      ]
    };
    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    let link = document.querySelector('link[rel="manifest"]');
    if(!link){ link = document.createElement('link'); link.rel = 'manifest'; document.head.appendChild(link); }
    link.href = url;

    if('serviceWorker' in navigator){
      try {
        await navigator.serviceWorker.register('/sw.js');
      } catch(e){
        // fallback: try blob SW (if no sw.js found)
        const swCode = `
          const CACHE = 'gh-cache-v1';
          self.addEventListener('install', e=>{ self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/','/index.html']).catch(()=>{}))); });
          self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
          self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r=>r || fetch(e.request).then(resp=>{ if(resp && resp.status===200){ caches.open(CACHE).then(c=>c.put(e.request, resp.clone())); } return resp; }).catch(()=> caches.match('/')) )));
        `;
        const blobSW = new Blob([swCode], { type: 'text/javascript' });
        const swUrl = URL.createObjectURL(blobSW);
        await navigator.serviceWorker.register(swUrl);
      }
    }
  }catch(e){}
})();

/* ----------------- connectivity & freshness UI ----------------- */
function updateNetwork(){
  $('netText').textContent = navigator.onLine ? 'وصل' : 'قطع';
  $('netText').className = navigator.onLine ? 'ok' : 'status-unknown';
}
window.addEventListener('online', updateNetwork);
window.addEventListener('offline', updateNetwork);
updateNetwork();

let lastFetch = null;
function updateFreshness(){
  if(!lastFetch){ $('freshText').textContent = 'ناموجود'; return; }
  const diff = Date.now() - new Date(lastFetch).getTime();
  const mins = Math.floor(diff / 60000);
  $('freshText').textContent = diff <= 5*60*1000 ? ('تازه (' + mins + ' دقیقه)') : ('قدیمی (' + mins + ' دقیقه)');
}

/* ----------------- history (local) ----------------- */
async function addHistory(entry){
  const a = Store.get('history') || [];
  a.unshift(entry);
  a.splice(500);
  Store.set('history', a);
  renderHistory();
}
async function getHistory(){ return Store.get('history') || []; }
function clearHistory(){ Store.set('history', []); renderHistory(); }

function renderHistory(){
  const list = Store.get('history') || [];
  const out = $('historyList');
  out.innerHTML = '';
  if(!list.length){ out.innerHTML = '<div class="small">تاریخی ثبت نشده</div>'; return; }
  list.slice(0,200).forEach(r=>{
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `<div class="small">${new Date(r.date).toLocaleString()}</div><div>۱۸: ${r.p18? fmt(r.p18) + ' تومان' : '—'}</div><div>۲۴: ${r.p24? fmt(r.p24) + ' تومان' : '—'}</div>`;
    out.appendChild(div);
  });
}

/* ----------------- timeline ----------------- */
function pushTimeline(type, payload){
  if(!FEATURES.timeline) return;
  const t = Store.get('timeline') || [];
  t.unshift({ id: Date.now(), type, payload, date: nowISO() });
  Store.set('timeline', t.slice(0,200));
  renderTimeline();
}
function renderTimeline(){
  if(!FEATURES.timeline) return;
  const t = Store.get('timeline') || [];
  const el = $('timeline');
  el.innerHTML = '';
  if(!t.length){ el.innerHTML = '<div class="small">تایم‌لاین خالی</div>'; return; }
  t.slice(0,80).forEach(it=>{
    const d = document.createElement('div');
    d.style.padding = '6px';
    d.style.borderBottom = '1px solid rgba(0,0,0,0.04)';
    d.innerHTML = `<div class="small">${new Date(it.date).toLocaleString()}</div><div style="font-weight:900">${it.type}</div>`;
    el.appendChild(d);
  });
}

/* ----------------- fetch prices (source: تابان گوهر) ----------------- */
async function fetchPrices(shouldSet=true){
  const url = 'https://tabangohar.com/GheymatKhan/prices_in_table.html?v=' + (new Date().toISOString().substring(0,16));
  try{
    const res = await fetch(url, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }});
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    let raw = parseFloat(json['c']);
    if(!isFinite(raw)) throw new Error('invalid');
    if(Math.abs(raw) < 100000) raw = raw * 1000;
    const p18 = Math.round(raw);
    const p24 = Math.round(p18 * (24/18));
    lastFetch = new Date();
    updateFreshness();
    if(shouldSet){
      $('shopPrice').textContent = fmt(p18) + ' تومان';
      $('price18').value = fmt(p18);
      $('price24').value = fmt(p24);
      await addHistory({ date: new Date().toISOString(), p18, p24, tags: [] });
      pushTimeline('fetch', { p18, p24 });
    }
    updateChart();
    computeMarketScore();
    return { p18, p24 };
  }catch(e){
    console.warn('fetch error', e);
    pushTimeline('fetch-fail', { error: String(e) });
    return null;
  }
}

/* attach fetch/save UI */
$('fetchBtn').addEventListener('click', ()=> fetchPrices(true));
$('saveBtn').addEventListener('click', async ()=>{
  const v = parseN($('shopPrice').textContent);
  if(isNaN(v)) return alert('قیمتی وجود ندارد');
  await addHistory({ date: new Date().toISOString(), p18: Math.round(v), p24: Math.round(v*(24/18)), tags: [] });
  notify('ذخیره شد');
});
$('clearHistory').addEventListener('click', ()=> { if(confirm('پاک شود؟')) { clearHistory(); notify('تاریخچه پاک شد'); } });

/* ----------------- chart (Chart.js lazy load) ----------------- */
let chartInstance = null;
async function updateChart(){
  if(!FEATURES.chart) return;
  const hist = await getHistory();
  if(!hist || !hist.length) return;
  const data = hist.slice(0,200).reverse();
  const labels = data.map(d => new Date(d.date).toLocaleString());
  const p18 = data.map(d => d.p18 || null);
  if(typeof Chart === 'undefined'){
    try{ await loadScript('https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'); } catch(e) { $('chartFallback').classList.remove('hidden'); return; }
  }
  $('chartFallback').classList.add('hidden');
  const ctx = $('priceChart').getContext('2d');
  if(chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: '۱۸', data: p18, borderWidth:2, tension:0.2 }] },
    options: { responsive: true }
  });
}
function loadScript(src){ return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = () => res(); s.onerror = () => rej(); document.head.appendChild(s); }); }

/* ----------------- market score ----------------- */
async function computeMarketScore(){
  if(!FEATURES.timeline && !FEATURES.ruleEngine) return;
  const hist = await getHistory();
  if(!hist.length){ $('marketScore').textContent = '—'; return; }
  const recent = hist.filter(h => Date.now() - new Date(h.date).getTime() <= 24*3600*1000).map(h => h.p18).filter(Boolean);
  let volScore = 7;
  if(recent.length > 1){
    const avg = recent.reduce((a,b)=>a+b,0)/recent.length;
    const sd = Math.sqrt(recent.reduce((a,b)=>a+Math.pow(b-avg,2),0)/recent.length);
    const pct = (sd/avg)*100;
    volScore = Math.max(0, Math.min(10, 10 - pct));
  }
  $('marketScore').textContent = (Math.round(volScore*10)/10) + ' / 10';
}

/* ----------------- bookmarks ----------------- */
function renderBookmarks(){
  const arr = Store.get('bm') || [];
  const el = $('bookmarks');
  el.innerHTML = '';
  if(!arr.length){ el.innerHTML = '<div class="small">ذخیره‌ای نیست</div>'; return; }
  arr.forEach((bm, i) => {
    const d = document.createElement('div');
    d.className = 'history-item';
    d.innerHTML = `<div style="display:flex;justify-content:space-between"><div>${bm.title}</div><div><button data-i="${i}" class="loadbm">بارگذاری</button></div></div><div class="small">${new Date(bm.date).toLocaleString()}</div>`;
    el.appendChild(d);
  });
  document.querySelectorAll('.loadbm').forEach(btn => btn.addEventListener('click', e => {
    const i = Number(e.target.dataset.i);
    const arr = Store.get('bm') || [];
    const bm = arr[i];
    if(!bm) return;
    $('price18').value = fmt(bm.p18);
    $('price24').value = fmt(bm.p24);
    notify('بوکمارک بارگذاری شد');
  }));
}
$('bookmarkBtn').addEventListener('click', ()=>{
  const p = parseN($('price18').value) || parseN($('shopPrice').textContent);
  if(isNaN(p)) return alert('قیمت معتبر نیست');
  const arr = Store.get('bm') || [];
  arr.unshift({ title: nowISO(), p18: Math.round(p), p24: Math.round(p*(24/18)), date: new Date().toISOString() });
  Store.set('bm', arr.slice(0,200));
  renderBookmarks();
  notify('بوکمارک ذخیره شد');
});

/* ----------------- explain toggle ----------------- */
$('explainToggle').addEventListener('click', ()=>{
  $('explainToggle').classList.toggle('active');
  const box = $('explainBox');
  if(!box) return;
  box.style.display = $('explainToggle').classList.contains('active') ? '' : 'none';
  if($('explainToggle').classList.contains('active')) box.textContent = 'فرمول‌ها: قیمت نهایی = وزن×قیمت + اجرت + سود + مالیات. Rule: gt/lt/pct_change.';
});

/* ----------------- notifications ----------------- */
function notify(msg){
  const a = $('alerts');
  if(!a) return;
  const n = document.createElement('div');
  n.textContent = msg;
  n.style.padding = '8px';
  n.style.background = '#fff8e6';
  n.style.marginBottom = '6px';
  a.prepend(n);
  setTimeout(()=> n.remove(), 5000);
  try{
    if(window.Notification && Notification.permission !== 'denied'){
      Notification.requestPermission().then(p => { if(p === 'granted') new Notification('اطلاع', { body: msg }); });
    }
  }catch(e){}
}

/* ----------------- DevTools detection & protection ----------------- */
let devOpen = false;
function detectDevTools(){
  try{
    const threshold = 160;
    let open = false;
    if(window.outerWidth - window.innerWidth > threshold || window.outerHeight - window.innerHeight > threshold) open = true;
    const start = performance.now();
    debugger;
    const took = performance.now() - start;
    if(took > 100) open = true;
    devOpen = open;
    if(devOpen && FEATURES.devtoolsProtect){
      $('devNotice').classList.remove('hidden');
      FEATURES.ruleEngine = false;
      document.querySelectorAll('#addRuleBtn,#evalRuleBtn').forEach(b => b.disabled = true);
    } else {
      $('devNotice').classList.add('hidden');
    }
  }catch(e){}
}
setInterval(detectDevTools, 2000);
document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState === 'visible') detectDevTools(); });

/* ----------------- fingerprint lock ----------------- */
async function computeFingerprint(){
  if(!FEATURES.fingerprintLock) return true;
  try{
    const data = navigator.userAgent + '|' + navigator.platform + '|' + Intl.DateTimeFormat().resolvedOptions().timeZone + '|' + screen.width + 'x' + screen.height;
    const enc = new TextEncoder().encode(data);
    const hash = await crypto.subtle.digest('SHA-256', enc);
    const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    const stored = Store.get('fp');
    if(!stored){ Store.set('fp', hex); return true; }
    return stored === hex;
  }catch(e){ return true; }
}

/* ----------------- Rule Engine: runtime assembly & eval -----------------
   We store parts (strings) and assemble them at runtime, then create function.
   This is the runtime-decode protection layer.
----------------------------------------------------------------------- */
const _ruleParts = [
  "function __exec(rules, ctx){ var out=[]; for(var i=0;i<rules.length;i++){ try{ var r=rules[i]; if(!r.active) continue; var e=r.expr; if(e.type==='gt'){ if(Number(ctx[e.key])>Number(e.value)) out.push(r); } else if(e.type==='lt'){ if(Number(ctx[e.key])<Number(e.value)) out.push(r); } else if(e.type==='pct_change'){ var hours=Number(e.hours)||1; var thr=Number(e.value)||0; var hist=ctx.history||[]; if(hist.length){ var cutoff=Date.now()-hours*3600*1000; var past=null; for(var k=0;k<hist.length;k++){ if(new Date(hist[k].date).getTime()<=cutoff){ past=hist[k]; break; } } if(!past) past = hist[hist.length-1]; if(past){ var prev = Number(past[e.key])||NaN; var cur = Number(ctx[e.key])||NaN; if(!isNaN(prev) && prev!==0){ var pct = ((cur-prev)/prev)*100; if(pct > thr) out.push(r); } } } } } catch(err){ console.warn('rule-err', err); } } return out; }",
  "function __explain(r){ try{ var e = r.expr; if(e.type==='gt') return e.key+' > '+e.value; if(e.type==='lt') return e.key+' < '+e.value; if(e.type==='pct_change') return e.key+' افزایش بیش از '+e.value+'% در '+e.hours+' ساعت'; return JSON.stringify(e);} catch(e){return '—'} }",
  "return { Exec: __exec, Explain: __explain };"
];

let RuleEngine = null;
function loadRuleEngine(){
  try{
    const src = _ruleParts.join('');
    const fn = new Function(src);
    RuleEngine = fn();
    window._RuleEngine = RuleEngine;
  }catch(e){
    console.warn('rule engine load error', e);
  }
}
if(FEATURES.ruleEngine) loadRuleEngine();

/* ----------------- rules UI ----------------- */
function renderRules(){
  const list = Store.get('rules') || [];
  const el = $('rulesUI');
  el.innerHTML = '';
  if(!list.length){ el.innerHTML = '<div class="small">قانونی تعریف نشده</div>'; return; }
  list.forEach(r=>{
    const d = document.createElement('div');
    d.className = 'history-item';
    d.innerHTML = `<div style="display:flex;justify-content:space-between"><div style="font-weight:900">${r.name}</div><div><button data-id="${r.id}" class="delRule">حذف</button></div></div><div class="small">${JSON.stringify(r.expr)}</div>`;
    el.appendChild(d);
  });
  document.querySelectorAll('.delRule').forEach(b => b.addEventListener('click', e => {
    const id = Number(e.target.dataset.id);
    let arr = Store.get('rules') || [];
    arr = arr.filter(x => x.id !== id);
    Store.set('rules', arr);
    renderRules();
  }));
}
$('addRuleBtn').addEventListener('click', ()=>{
  if(!FEATURES.ruleEngine) return alert('Rule Engine غیرفعال است');
  const name = prompt('نام قانون'); if(!name) return;
  const type = prompt('نوع: gt / lt / pct_change'); if(!type) return;
  const key = prompt('کلید: p18 یا p24'); if(!key) return;
  const expr = { type, key };
  if(type === 'gt' || type === 'lt') expr.value = Number(prompt('مقدار'));
  if(type === 'pct_change'){ expr.hours = Number(prompt('ساعت پنجره')) || 1; expr.value = Number(prompt('درصد')) || 0; }
  const list = Store.get('rules') || [];
  list.unshift({ id: Date.now(), name, expr, active: true });
  Store.set('rules', list);
  renderRules();
});
$('evalRuleBtn').addEventListener('click', async ()=>{
  if(!FEATURES.ruleEngine) return alert('غیرفعال');
  const p18 = parseN($('price18').value) || parseN($('shopPrice').textContent);
  const p24 = parseN($('price24').value) || Math.round(p18*(24/18));
  const hist = await getHistory();
  const rules = Store.get('rules') || [];
  let triggered = [];
  if(window._RuleEngine && typeof window._RuleEngine.Exec === 'function'){
    triggered = window._RuleEngine.Exec(rules, { p18, p24, history: hist });
  } else {
    for(const r of rules){ if(r.expr.type === 'gt' && (p18 > Number(r.expr.value))) triggered.push(r); }
  }
  $('alerts').innerHTML = '';
  if(triggered.length){
    triggered.forEach(t => {
      const el = document.createElement('div');
      el.className = 'history-item';
      el.textContent = 'قانون فعال: ' + t.name + ' — ' + (window._RuleEngine ? window._RuleEngine.Explain(t) : JSON.stringify(t.expr));
      $('alerts').appendChild(el);
      pushTimeline('rule-trigger', { name: t.name });
    });
  } else {
    $('alerts').innerHTML = '<div class="small">هشدار فعال وجود ندارد</div>';
  }
});

/* ----------------- Dev helpers: block simple view-source interactions (UX-level only) ----------------- */
document.addEventListener('keydown', e => {
  if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u'){ e.preventDefault(); alert('مشاهده سورس غیرفعال است'); }
  if((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'i'){ e.preventDefault(); alert('DevTools مسدود'); }
});

/* ----------------- initApp ----------------- */
async function initApp(){
  const okFP = await computeFingerprint();
  if(!okFP){
    FEATURES.ruleEngine = false;
    FEATURES.chart = false;
    $('devNotice').classList.remove('hidden');
    notify('قفل محلی فعال: برخی قابلیت‌ها غیرفعال شدند');
  }
  renderHistory();
  renderTimeline();
  renderBookmarks();
  renderRules();
  updateChart();
  computeMarketScore();
  if(navigator.onLine) fetchPrices(true);
  setInterval(()=>{ updateFreshness(); computeMarketScore(); }, 30*1000);
  setInterval(()=>{ if(navigator.onLine) fetchPrices(true); }, 5*60*1000);
  detectDevTools();
}

/* ----------------- expose small debug (limited) ----------------- */
window._GOLD = { Store, fetchPrices };

/* ----------------- finish ----------------- */
