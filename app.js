// Vibrações de Leão — app.js (raiz)
// Compatível com o index que você colou (IDs: btnStart, oralArea, writeArea, coordArea, barList, etc.)
// Demo educacional. Sem envio de áudio. Métricas locais + export anonimizado copiável/baixável.

const STORE = {
  BEST: "vdl_best_score",
  LAST: "vdl_last_score",
  HISTORY: "vdl_history",
  TOKENS: "vdl_tokens",
  PROFILE: "vdl_profile",
  TRY: "vdl_try",
  COORD_BONUS: "vdl_coord_bonus_given",
  SESSION: "vdl_session_id"
};

const CFG = {
  ORAL_Q_COUNT: 5,
  REC_SEC: 15,
  BAR_LINE: 0.65,       // linha visual (index usa 65%)
  GOAL_SEC: 4.0,        // metas fáceis: 4s
  TOKENS_START: 2,      // começa com 2 tokens
  TOKENS_MIN_WRITE: 1,  // custo da escrita
  // detecção de voz:
  VAD_RMS_THR: 0.028,   // limiar base (ajuste fino se precisar)
  VAD_HANG_MS: 250      // mantém "falando" um pouco após cair (evita flicker)
};

// -------------------- Utils --------------------
function clamp01(x){ return Math.max(0, Math.min(1, x)); }
function now(){ return Date.now(); }

function readJSON(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return fallback;
    return JSON.parse(raw);
  }catch{ return fallback; }
}
function writeJSON(key, val){ localStorage.setItem(key, JSON.stringify(val)); }

function getNum(key, def=0){
  const v = Number(localStorage.getItem(key));
  return Number.isFinite(v) ? v : def;
}
function setNum(key, v){ localStorage.setItem(key, String(v)); }

function sid(){
  let s = localStorage.getItem(STORE.SESSION);
  if(!s){
    s = Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
    localStorage.setItem(STORE.SESSION, s);
  }
  return s;
}

function setText(id, txt){
  const el = document.getElementById(id);
  if(el) el.textContent = txt;
}

function showOnly(which){
  const oral = document.getElementById("oralArea");
  const write = document.getElementById("writeArea");
  const coord = document.getElementById("coordArea");

  if(oral) oral.classList.add("hide");
  if(write) write.classList.add("hide");
  if(coord) coord.classList.add("hide");

  if(which === "oral" && oral) oral.classList.remove("hide");
  if(which === "write" && write) write.classList.remove("hide");
  if(which === "coord" && coord) coord.classList.remove("hide");
}

function profile(){
  return {
    name: (document.getElementById("inpName")?.value || "").trim(),
    turma: (document.getElementById("inpClass")?.value || "").trim()
  };
}

function saveProfile(){
  writeJSON(STORE.PROFILE, profile());
}

function loadProfile(){
  const p = readJSON(STORE.PROFILE, null);
  if(!p) return;
  const n = document.getElementById("inpName");
  const c = document.getElementById("inpClass");
  if(n && !n.value) n.value = p.name || "";
  if(c && !c.value) c.value = p.turma || "";
}

// -------------------- Tokens / Score --------------------
function getTokens(){
  const t = getNum(STORE.TOKENS, NaN);
  if(Number.isFinite(t)) return t;
  setNum(STORE.TOKENS, CFG.TOKENS_START);
  return CFG.TOKENS_START;
}
function setTokens(v){
  setNum(STORE.TOKENS, Math.max(0, Math.floor(v)));
  setText("kTokens", String(getTokens()));
}
function addToken(n=1){ setTokens(getTokens() + n); }

function getBest(){ return getNum(STORE.BEST, 0); }
function setBest(v){ setNum(STORE.BEST, v); setText("kBest", `${getBest()}/10`); }
function getLast(){ return getNum(STORE.LAST, 0); }
function setLast(v){ setNum(STORE.LAST, v); }

function pushHistory(entry){
  const h = readJSON(STORE.HISTORY, []);
  h.unshift(entry);
  writeJSON(STORE.HISTORY, h.slice(0, 30));
}

function resetAll(){
  Object.values(STORE).forEach(k => localStorage.removeItem(k));
  // reinicia
  sid();
  setTokens(CFG.TOKENS_START);
  setBest(0);
  setLast(0);
  setNum(STORE.TRY, 1);
  localStorage.removeItem(STORE.COORD_BONUS);
  // UI
  setText("kLevel", "Iniciante");
  setText("kDate", "--/--/----");
  setText("writeStatus", "");
  setText("oralStatus", "Dica: ambiente calmo ajuda.");
  showOnly(null);
}

// -------------------- Pools (BEM básicos) --------------------
const ORAL_POOL = [
  "Diga seu nome e sua idade.",
  "O que é um algoritmo (em uma frase simples)?",
  "O que é uma variável (em uma frase simples)?",
  "Conte de 10 até 1 devagar.",
  "Fale uma frase completa sobre um tema que você gosta."
];

const WRITTEN_POOL = [
  { q:"O que é um algoritmo?", a:[
    "Um passo a passo para resolver um problema.",
    "Um tipo de computador.",
    "Um aplicativo de celular.",
    "Uma peça de hardware."
  ], correct:0 },

  { q:"Qual destas opções é um exemplo de entrada (input) em um programa?", a:[
    "Um número digitado pelo usuário.",
    "A tela do monitor.",
    "A bateria do celular.",
    "O cabo USB."
  ], correct:0 },

  { q:"O que significa repetir (loop) em programação?", a:[
    "Fazer a mesma ação várias vezes.",
    "Desligar o computador.",
    "Salvar um arquivo.",
    "Conectar na internet."
  ], correct:0 },

  { q:"O que é uma variável?", a:[
    "Um espaço para guardar um valor (número, texto, etc.).",
    "Uma impressora.",
    "Um vírus.",
    "Um tipo de teclado."
  ], correct:0 },

  { q:"O que significa se... então... (condicional)?", a:[
    "Tomar uma decisão baseada em uma condição.",
    "Aumentar o volume.",
    "Apertar um botão.",
    "Criar um arquivo."
  ], correct:0 },

  { q:"Para que serve um bit?", a:[
    "Representar informação como 0 ou 1.",
    "Guardar fotos em papel.",
    "Carregar o celular.",
    "Fazer som no microfone."
  ], correct:0 },
];

function pickRandom(arr, n){
  const copy = arr.slice();
  for(let i=copy.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

// -------------------- 8 Barras (INPUT / progresso do aluno) --------------------
const METRICS = [
  { id:"presenca",  label:"Presença" },
  { id:"impulso",   label:"Impulso" },
  { id:"fluxo",     label:"Fluxo" },
  { id:"constancia",label:"Constância" },
  { id:"pausa",     label:"Pausa" },
  { id:"entonacao", label:"Entonação" },
  { id:"foco",      label:"Foco" },
  { id:"harmonia",  label:"Harmonia" }
];

const bar = {
  presenca:0, impulso:0, fluxo:0, constancia:0, pausa:0, entonacao:0, foco:0, harmonia:0
};

let barUI = {};
let goalHold = { foco:0, constancia:0, harmonia:0 };
let goalsDone = { g1:false, g2:false, g3:false };
let goalRewardGiven = false;

// acumuladores (o "segredo" fica oculto no relatório)
const oralAgg = {
  qAnswered:0,
  totalSpeakSec:0,
  totalSilentSec:0,
  avgRms:0,
  avgVar:0,
  avgPitchProxy:0,
  samples:0
};

function buildBarsUI(){
  const root = document.getElementById("barList");
  if(!root) return;

  root.innerHTML = "";
  barUI = {};

  METRICS.forEach(m=>{
    const row = document.createElement("div");
    row.className = "barRow";

    const lab = document.createElement("div");
    lab.className = "barLabel";
    lab.textContent = m.label.toLowerCase();

    const track = document.createElement("div");
    track.className = "track";

    const fill = document.createElement("div");
    fill.className = "fill";

    const line = document.createElement("div");
    line.className = "targetLine";

    track.appendChild(fill);
    track.appendChild(line);

    const val = document.createElement("div");
    val.className = "val mono";
    val.textContent = "0.00";

    row.appendChild(lab);
    row.appendChild(track);
    row.appendChild(val);
    root.appendChild(row);

    barUI[m.id] = { fill, val };
  });
}

function renderBars(){
  for(const k in bar){
    const v = clamp01(bar[k]);
    const ui = barUI[k];
    if(!ui) continue;
    ui.fill.style.width = `${(v*100).toFixed(1)}%`;
    ui.val.textContent = v.toFixed(2);
  }

  // metas simples (4s acima da linha) — contando só quando "falando"
  const m1 = document.getElementById("m1Dot");
  const m2 = document.getElementById("m2Dot");
  const m3 = document.getElementById("m3Dot");

  if(goalsDone.g1) m1?.classList.add("ok");
  if(goalsDone.g2) m2?.classList.add("ok");
  if(goalsDone.g3) m3?.classList.add("ok");

  if(goalsDone.g1 && goalsDone.g2 && goalsDone.g3 && !goalRewardGiven){
    addToken(1);
    goalRewardGiven = true;
    alert("🔥 Metas completas! +1 token demo.");
  }
}

// sobe rápido / desce devagar (acumulativo)
function smoothTo(key, target){
  const cur = bar[key];
  const up = 0.22;     // sobe rápido
  const down = 0.035;  // desce devagar
  const a = target > cur ? up : down;
  bar[key] = clamp01(cur + (target - cur) * a);
}

// -------------------- Microfone + CRS oculto (VAD / energia) --------------------
let audioCtx=null, analyser=null, stream=null, src=null;
let timeData=null, freqData=null;
let raf=null;

let micOn=false;
let speaking=false;
let lastSpeakAt=0;

let lastRms=0;

function rms(buf){
  let sum=0;
  for(let i=0;i<buf.length;i++){
    const v = (buf[i]-128)/128;
    sum += v*v;
  }
  return Math.sqrt(sum/buf.length);
}

function pitchProxy(freq, sampleRate){
  // pico entre ~90 e ~350Hz (proxy simples)
  const nyq = sampleRate/2;
  const from = Math.floor((90/nyq) * freq.length);
  const to   = Math.floor((350/nyq) * freq.length);
  let max=0;
  for(let i=from;i<=to;i++) max = Math.max(max, freq[i]||0);
  return (max/255);
}

function band(freq, fromHz, toHz, sampleRate){
  const nyq = sampleRate/2;
  const from = Math.floor((fromHz/nyq) * freq.length);
  const to   = Math.floor((toHz/nyq) * freq.length);
  let sum=0, n=0;
  for(let i=Math.max(0,from); i<=Math.min(freq.length-1,to); i++){
    sum += freq[i];
    n++;
  }
  return n ? (sum/n)/255 : 0;
}

function aggUpdate(rmsV, varV, ppV, dt, isSpeak){
  oralAgg.samples += 1;
  const n = oralAgg.samples;

  oralAgg.avgRms = (oralAgg.avgRms*(n-1) + rmsV)/n;
  oralAgg.avgVar = (oralAgg.avgVar*(n-1) + varV)/n;
  oralAgg.avgPitchProxy = (oralAgg.avgPitchProxy*(n-1) + ppV)/n;

  if(isSpeak) oralAgg.totalSpeakSec += dt;
  else oralAgg.totalSilentSec += dt;
}

async function toggleMic(){
  if(micOn){
    disableMic();
    return;
  }
  await enableMic();
}

async function enableMic(){
  try{
    stream = await navigator.mediaDevices.getUserMedia({ audio:true });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.7;

    src = audioCtx.createMediaStreamSource(stream);
    src.connect(analyser);

    timeData = new Uint8Array(analyser.fftSize);
    freqData = new Uint8Array(analyser.frequencyBinCount);

    micOn = true;
    setText("micState", "ligado ✅");
    const btn = document.getElementById("btnMic");
    if(btn) btn.textContent = "Desativar microfone";

    // libera gravação
    const rec = document.getElementById("btnRec");
    if(rec) rec.classList.remove("disabled");

    lastSpeakAt = 0;
    speaking = false;

    const loop = (t)=>{
      raf = requestAnimationFrame(loop);
      tickBars(1/30);
    };
    loop();
  }catch(e){
    alert("Falha ao acessar microfone. Verifique permissões do navegador.");
  }
}

function disableMic(){
  try{ if(raf) cancelAnimationFrame(raf); }catch{}
  raf = null;

  try{ src?.disconnect(); }catch{}
  try{ audioCtx?.close(); }catch{}
  try{ stream?.getTracks()?.forEach(t=>t.stop()); }catch{}

  micOn = false;
  speaking = false;
  setText("micState", "desligado");
  const btn = document.getElementById("btnMic");
  if(btn) btn.textContent = "Ativar microfone";
}

// -------------------- Motor das Barras (INPUT) --------------------
function tickBars(dt){
  if(!micOn || !analyser) return;

  analyser.getByteTimeDomainData(timeData);
  analyser.getByteFrequencyData(freqData);

  const r = rms(timeData);
  const rmsV = clamp01(r * 3.2);           // ganho visual
  const varV = clamp01(Math.abs(rmsV - lastRms) * 6.0);
  lastRms = rmsV;

  const pp = clamp01(pitchProxy(freqData, audioCtx.sampleRate));
  const low = band(freqData, 80, 240, audioCtx.sampleRate);
  const mid = band(freqData, 300, 1200, audioCtx.sampleRate);
  const high= band(freqData, 1200, 3500, audioCtx.sampleRate);

  // VAD (detecção de fala) com "hang" pra não piscar
  const isAbove = (r > CFG.VAD_RMS_THR);
  if(isAbove){
    speaking = true;
    lastSpeakAt = now();
  }else{
    if(speaking && (now() - lastSpeakAt) > CFG.VAD_HANG_MS){
      speaking = false;
    }
  }

  // === Lógica: barras sobem com FALA (input), e caem devagar no silêncio ===
  // "engajamento" acumulativo: fala aumenta, silêncio diminui lentamente
  const talkBoost = speaking ? 1.0 : 0.0;

  // targets (0..1) — desenhados pra criança "ver subir" quando fala
  const impulsoT    = clamp01( (rmsV*0.85 + low*0.15) * (0.70 + talkBoost*0.30) );
  const presencaT   = clamp01( talkBoost*0.65 + rmsV*0.35 );
  const fluxoT      = clamp01( talkBoost*075 + (1-varV)*0.25 );
  const constanciaT = clamp01( (1-varV)*0.70 + talkBoost*0.30 );
  const pausaT      = clamp01( 1 - Math.abs((talkBoost?0.20:0.55) - (1-rmsV))*1.3 ); // suave
  const entonT      = clamp01( pp*0.55 + (mid*0.25) + (high*0.20) );

  // Foco sobe com fala + estabilidade
  const focoT = clamp01( talkBoost*0.55 + (1-varV)*0.30 + mid*0.15 );

  // Harmonia é equilíbrio geral
  const harmT = clamp01( (presencaT + constanciaT + focoT + fluxoT)/4 );

  smoothTo("impulso", impulsoT);
  smoothTo("presenca", presencaT);
  smoothTo("fluxo", fluxoT);
  smoothTo("constancia", constanciaT);
  smoothTo("pausa", pausaT);
  smoothTo("entonacao", entonT);
  smoothTo("foco", focoT);
  smoothTo("harmonia", harmT);

  // metas: contam só quando speaking == true (senão não "rouba")
  if(speaking){
    if(bar.foco >= CFG.BAR_LINE) goalHold.foco += dt; else goalHold.foco = Math.max(0, goalHold.foco - dt*0.4);
    if(bar.constancia >= CFG.BAR_LINE) goalHold.constancia += dt; else goalHold.constancia = Math.max(0, goalHold.constancia - dt*0.4);
    if(bar.harmonia >= CFG.BAR_LINE) goalHold.harmonia += dt; else goalHold.harmonia = Math.max(0, goalHold.harmonia - dt*0.4);

    if(!goalsDone.g1 && goalHold.foco >= CFG.GOAL_SEC) goalsDone.g1 = true;
    if(!goalsDone.g2 && goalHold.constancia >= CFG.GOAL_SEC) goalsDone.g2 = true;
    if(!goalsDone.g3 && goalHold.harmonia >= CFG.GOAL_SEC) goalsDone.g3 = true;
  }

  // agrega CRS oculto (só pro relatório/meta anon)
  aggUpdate(rmsV, varV, pp, dt, speaking);

  renderBars();
}

// -------------------- Oral flow (1 a 1) --------------------
let oral = {
  list: [],
  idx: 0,
  startedAt: 0,
  clockInt: null,
  recLock: false,
  curRecStart: 0,
  curRecWords: 0,
  curRecDur: 0
};

function oralReset(){
  oral.list = pickRandom(ORAL_POOL, CFG.ORAL_Q_COUNT);
  oral.idx = 0;
  oral.startedAt = now();
  oral.recLock = false;

  // reset barras/metas
  for(const k in bar) bar[k]=0;
  goalHold = { foco:0, constancia:0, harmonia:0 };
  goalsDone = { g1:false, g2:false, g3:false };
  goalRewardGiven = false;

  // reset agregados
  oralAgg.qAnswered = 0;
  oralAgg.totalSpeakSec = 0;
  oralAgg.totalSilentSec = 0;
  oralAgg.avgRms = 0;
  oralAgg.avgVar = 0;
  oralAgg.avgPitchProxy = 0;
  oralAgg.samples = 0;

  // UI
  setText("oralClock", "00:00");
  setText("kWords", "0");
  setText("kDur", "0.0");
  setText("kWpm", "0");

  const goWrite = document.getElementById("btnGoWrite");
  if(goWrite) goWrite.classList.add("disabled");

  updateOralUI();

  if(oral.clockInt) clearInterval(oral.clockInt);
  oral.clockInt = setInterval(()=>{
    const sec = Math.floor((now()-oral.startedAt)/1000);
    const mm = String(Math.floor(sec/60)).padStart(2,"0");
    const ss = String(sec%60).padStart(2,"0");
    setText("oralClock", `${mm}:${ss}`);
  }, 250);
}

function updateOralUI(){
  setText("qPos", `${oral.idx+1}/${oral.list.length}`);
  setText("qText", oral.list[oral.idx] || "—");
}

function oralNext(){
  oralAgg.qAnswered += 1;
  oral.idx += 1;

  if(oral.idx >= oral.list.length){
    // fim oral: libera escrita
    const goWrite = document.getElementById("btnGoWrite");
    if(goWrite) goWrite.classList.remove("disabled");
    setText("oralStatus", "✅ Oral concluída! Você pode ir para a fase escrita.");
    return;
  }
  updateOralUI();
  setText("oralStatus", "Dica: responda com calma. Se não souber, diga “não sei” e avance.");
}

function oralSkip(){
  setText("oralStatus", "Ok — pulou. Bora pra próxima.");
  oralNext();
}

function oralEnd(){
  const goWrite = document.getElementById("btnGoWrite");
  if(goWrite) goWrite.classList.remove("disabled");
  setText("oralStatus", "Oral encerrada. Você pode seguir para a fase escrita.");
}

// grava “janela” de 15s, mas as barras sobem durante a fala (não depende de texto)
function oralRecordWindow(){
  if(!micOn){
    alert("Ative o microfone primeiro.");
    return;
  }
  if(oral.recLock) return;

  oral.recLock = true;
  oral.curRecStart = now();

  setText("oralStatus", `Gravando janela de ${CFG.REC_SEC}s… fale normalmente.`);

  const btn = document.getElementById("btnRec");
  if(btn) btn.classList.add("disabled");

  const t = setInterval(()=>{
    const elapsed = (now()-oral.curRecStart)/1000;
    oral.curRecDur = elapsed;

    // “palavras” estimadas: duração falando * taxa simples (pra não contar ruído como palavra)
    // taxa base: 2.1 palavras/s (126 wpm). Ajusta no futuro por idade.
    const estWords = Math.max(0, Math.round(oralAgg.totalSpeakSec * 2.1));
    const wpm = elapsed > 0 ? Math.round((estWords/elapsed)*60) : 0;

    setText("kWords", String(estWords));
    setText("kDur", elapsed.toFixed(1));
    setText("kWpm", String(wpm));

    if(elapsed >= CFG.REC_SEC){
      clearInterval(t);
      oral.recLock = false;
      if(btn) btn.classList.remove("disabled");
      setText("oralStatus", "✅ Janela concluída. Próxima pergunta.");
      oralNext();
    }
  }, 120);
}

// -------------------- Escrita (vale 10) --------------------
let written = {
  items: [],
  answers: {},
  tryN: 1
};

function startWrite(){
  // custo: 1 token, MAS se estiver travado, libera 1 token automático (pra não bloquear demo)
  let t = getTokens();
  if(t < CFG.TOKENS_MIN_WRITE){
    addToken(1);
    t = getTokens();
  }
  setTokens(t - CFG.TOKENS_MIN_WRITE);

  written.items = pickRandom(WRITTEN_POOL, 5);
  written.answers = {};
  written.tryN = getNum(STORE.TRY, 1);
  setText("kTry", String(written.tryN));

  renderWrite();
  showOnly("write");

  setText("writeStatus", "Marque as alternativas e depois clique em Corrigir e ver nota.");
}

function renderWrite(){
  const grid = document.getElementById("writeGrid");
  if(!grid) return;
  grid.innerHTML = "";

  written.items.forEach((it, qi)=>{
    const block = document.createElement("div");
    block.className = "questionBlock";

    const h = document.createElement("h4");
    h.textContent = `Questão ${qi+1}: ${it.q}`;
    block.appendChild(h);

    it.a.forEach((txt, ai)=>{
      const lab = document.createElement("label");
      lab.className = "opt";

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = `q_${qi}`;
      radio.value = String(ai);

      radio.addEventListener("change", ()=>{
        written.answers[qi] = ai;
      });

      lab.appendChild(radio);
      lab.appendChild(document.createTextNode(` ${String.fromCharCode(65+ai)}) ${txt}`));
      block.appendChild(lab);
    });

    grid.appendChild(block);
  });
}

function gradeWrite(){
  // valida: todas respondidas
  for(let i=0;i<written.items.length;i++){
    if(!(i in written.answers)){
      alert("Na fase escrita você precisa marcar para avançar: responda todas as questões.");
      return;
    }
  }

  let correct=0;
  written.items.forEach((it, i)=>{
    if(written.answers[i] === it.correct) correct++;
  });

  const score10 = Math.round((correct / written.items.length) * 10);
  setLast(score10);

  const best = Math.max(getBest(), score10);
  setBest(best);

  pushHistory({
    ts: now(),
    score10,
    best,
    oralAgg: { ...oralAgg },
    tokensLeft: getTokens()
  });

  setText("writeStatus", `✅ Nota: ${score10}/10 • Melhor: ${best}/10 • Você pode tentar de novo.`);

  // Encerramento/agradecimento (logo no centro grande, sem mudar HTML)
  showCongrats(score10, best);
}

function newTry(){
  const n = getNum(STORE.TRY, 1) + 1;
  setNum(STORE.TRY, n);
  startWrite();
}

function showCongrats(score10, best){
  // overlay simples (não polui HTML)
  const old = document.getElementById("vdlOverlay");
  if(old) old.remove();

  const ov = document.createElement("div");
  ov.id = "vdlOverlay";
  ov.style.position="fixed";
  ov.style.inset="0";
  ov.style.background="rgba(10,42,47,.45)";
  ov.style.display="flex";
  ov.style.alignItems="center";
  ov.style.justifyContent="center";
  ov.style.padding="18px";
  ov.style.zIndex="9999";

  const card = document.createElement("div");
  card.style.maxWidth="560px";
  card.style.width="100%";
  card.style.background="#ffffff";
  card.style.borderRadius="18px";
  card.style.boxShadow="0 14px 40px rgba(0,0,0,.18)";
  card.style.padding="16px";
  card.style.textAlign="center";

  const h = document.createElement("div");
  h.style.fontWeight="900";
  h.style.fontSize="20px";
  h.textContent = "Obrigado pela sua presença e pelo seu esmero 🙏✨";

  const p = document.createElement("div");
  p.style.marginTop="8px";
  p.style.color="#4a6b70";
  p.innerHTML = `Sua nota agora foi <b>${score10}/10</b>. Sua maior nota é <b>${best}/10</b>.`;

  const img = document.getElementById("logoImg")?.cloneNode(true);
  if(img){
    img.style.width="120px";
    img.style.height="120px";
    img.style.objectFit="cover";
    img.style.borderRadius="24px";
    img.style.margin="14px auto 6px";
    img.style.display="block";
  }

  const btn = document.createElement("button");
  btn.className="primary";
  btn.textContent="Fechar";
  btn.style.marginTop="10px";
  btn.onclick = ()=> ov.remove();

  card.appendChild(h);
  card.appendChild(p);
  if(img) card.appendChild(img);
  card.appendChild(btn);
  ov.appendChild(card);
  document.body.appendChild(ov);
}

// -------------------- Coordenação (anonimizado + token bônus) --------------------
function buildCoordJSON(){
  const h = readJSON(STORE.HISTORY, []);
  const last = h[0] || null;

  const payload = {
    app: "vibracoes-de-leao",
    version: "edu-demo-2",
    sessionId: sid(),
    generatedAt: new Date().toISOString(),

    // sem PII:
    lastScore: getLast(),
    bestScore: getBest(),

    oralMetrics: {
      questionsAnswered: oralAgg.qAnswered,
      totalSpeakSec: Number(oralAgg.totalSpeakSec.toFixed(2)),
      totalSilentSec: Number(oralAgg.totalSilentSec.toFixed(2)),
      avgRms: Number(oralAgg.avgRms.toFixed(4)),
      avgVar: Number(oralAgg.avgVar.toFixed(4)),
      avgPitchProxy: Number(oralAgg.avgPitchProxy.toFixed(4)),
      samples: oralAgg.samples
    },

    tokensLeft: getTokens(),
    lastAttemptAt: last?.ts ? new Date(last.ts).toISOString() : null,

    note: "Anonimizado. Sem nome/turma/áudio. Uso pedagógico/coletivo."
  };

  return payload;
}

function giveCoordBonusOnce(){
  const given = localStorage.getItem(STORE.COORD_BONUS);
  if(given === "1") return;
  localStorage.setItem(STORE.COORD_BONUS, "1");
  addToken(1);
  alert("✅ Envio/Export para coordenação: +1 token bônus (demo).");
}

function downloadJSON(filename, obj){
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type:"application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0);
}

// -------------------- Bindings --------------------
document.addEventListener("DOMContentLoaded", ()=>{
  // topo
  sid();
  setText("kBest", `${getBest()||"--"}/10`);
  setText("kTokens", String(getTokens()));
  setText("kLevel", "Iniciante");

  buildBarsUI();
  renderBars();
  loadProfile();
  setText("kSess", sid());

  // BOTÕES PRINCIPAIS
  document.getElementById("btnStart")?.addEventListener("click", ()=>{
    saveProfile();
    showOnly("oral");
    oralReset();
  });

  document.getElementById("btnResetAll")?.addEventListener("click", ()=>{
    if(confirm("Zerar tudo (notas, histórico, tokens, sessão)?")){
      resetAll();
      location.reload();
    }
  });

  document.getElementById("btnGoCoord")?.addEventListener("click", ()=>{
    saveProfile();
    showOnly("coord");
    setText("kSess", sid());
  });

  // ORAL
  document.getElementById("btnMic")?.addEventListener("click", toggleMic);
  document.getElementById("btnRec")?.addEventListener("click", ()=>{
    if(document.getElementById("btnRec")?.classList.contains("disabled")) return;
    oralRecordWindow();
  });
  document.getElementById("btnSkip")?.addEventListener("click", oralSkip);
  document.getElementById("btnEndOral")?.addEventListener("click", oralEnd);

  document.getElementById("btnGoWrite")?.addEventListener("click", ()=>{
    const btn = document.getElementById("btnGoWrite");
    if(btn?.classList.contains("disabled")) return;
    // encerra mic pra leveza
    if(micOn) disableMic();
    if(oral.clockInt) clearInterval(oral.clockInt);
    startWrite();
  });

  document.getElementById("btnRestartOral")?.addEventListener("click", ()=>{
    if(confirm("Recomeçar fase oral?")){
      if(micOn) disableMic();
      oralReset();
    }
  });

  // ESCRITA
  document.getElementById("btnGrade")?.addEventListener("click", gradeWrite);
  document.getElementById("btnNewTry")?.addEventListener("click", ()=>{
    if(confirm("Nova tentativa (mudar perguntas)?")){
      newTry();
    }
  });
  document.getElementById("btnBackOral")?.addEventListener("click", ()=>{
    showOnly("oral");
    oralReset();
  });

  // COORDENAÇÃO
  document.getElementById("btnBuildReport")?.addEventListener("click", ()=>{
    const obj = buildCoordJSON();
    const box = document.getElementById("reportBox");
    if(box) box.value = JSON.stringify(obj, null, 2);

    document.getElementById("btnDownloadReport")?.classList.remove("disabled");
    document.getElementById("btnCopyReport")?.classList.remove("disabled");

    setText("kTokens", String(getTokens()));
  });

  document.getElementById("btnDownloadReport")?.addEventListener("click", ()=>{
    const obj = buildCoordJSON();
    downloadJSON(`vdl_coord_${sid()}.json`, obj);
    giveCoordBonusOnce();
    setText("kTokens", String(getTokens()));
  });

  document.getElementById("btnCopyReport")?.addEventListener("click", async ()=>{
    const box = document.getElementById("reportBox");
    const txt = box?.value || JSON.stringify(buildCoordJSON(), null, 2);
    try{
      await navigator.clipboard.writeText(txt);
      alert("JSON copiado.");
    }catch{
      alert(txt);
    }
    giveCoordBonusOnce();
    setText("kTokens", String(getTokens()));
  });

  document.getElementById("btnBackApp")?.addEventListener("click", ()=>{
    showOnly("oral");
    oralReset();
  });

  // estado inicial: nada aberto
  showOnly(null);
});