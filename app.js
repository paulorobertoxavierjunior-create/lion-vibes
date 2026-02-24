// Vibrações de Leão — app.js (raiz)
// Demo educacional: sem envio de áudio. Apenas métricas locais + metadados anonimizados copiáveis.
// Barras = INPUT do aluno (fala sobe; silêncio desce devagar). CRS fica oculto (só no relatório).

/* =========================
   Storage
========================= */
const STORE = {
  BEST: "vdl_best_score",
  LAST: "vdl_last_score",
  HISTORY: "vdl_history",
  TOKENS: "vdl_tokens_demo",
  PROFILE: "vdl_profile",
  TRY: "vdl_try",
  SESSION: "vdl_session"
};

function readJSON(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return fallback;
    return JSON.parse(raw);
  }catch{ return fallback; }
}
function writeJSON(key, val){
  localStorage.setItem(key, JSON.stringify(val));
}
function clamp01(x){ return Math.max(0, Math.min(1, x)); }
function now(){ return Date.now(); }

function genSessionId(){
  // simples, curto, sem PII
  return Math.random().toString(16).slice(2,10) + "-" + Math.random().toString(16).slice(2,6);
}

function getTokens(){
  return Number(localStorage.getItem(STORE.TOKENS) || "0");
}
function setTokens(v){
  localStorage.setItem(STORE.TOKENS, String(Math.max(0, Math.floor(v))));
  const el = document.getElementById("kTokens");
  if(el) el.textContent = String(getTokens());
}
function initTokens(){
  const t = Number(localStorage.getItem(STORE.TOKENS));
  if(Number.isFinite(t)) return t;
  localStorage.setItem(STORE.TOKENS, String(3)); // começa com 3
  return 3;
}
function getBest(){ return Number(localStorage.getItem(STORE.BEST) || "0"); }
function setBest(v){ localStorage.setItem(STORE.BEST, String(v)); }
function getLast(){ return Number(localStorage.getItem(STORE.LAST) || "0"); }
function setLast(v){ localStorage.setItem(STORE.LAST, String(v)); }

function pushHistory(entry){
  const h = readJSON(STORE.HISTORY, []);
  h.unshift(entry);
  writeJSON(STORE.HISTORY, h.slice(0, 40));
}

function resetAll(){
  Object.values(STORE).forEach(k => localStorage.removeItem(k));
  initTokens();
  setTokens(getTokens());
  setBest(0);
  setLast(0);
  writeJSON(STORE.HISTORY, []);
  writeJSON(STORE.PROFILE, {name:"", turma:""});
  localStorage.setItem(STORE.TRY, "1");
  localStorage.setItem(STORE.SESSION, genSessionId());
  hydrateHeader();
  showHome();
}

/* =========================
   Pools (bem básico)
========================= */
const ORAL_POOL = [
  "Diga seu nome e sua idade (se quiser).",
  "Com suas palavras: o que é um algoritmo?",
  "O que é uma variável? (pode explicar simples)",
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
  { q:"Qual é um exemplo de entrada (input) em um programa?", a:[
    "Um número digitado pelo usuário.",
    "A tela do monitor.",
    "A bateria do celular.",
    "O cabo USB."
  ], correct:0 },
  { q:"O que é uma variável?", a:[
    "Um espaço para guardar um valor (número, texto, etc.).",
    "Uma impressora.",
    "Um vírus.",
    "Um tipo de teclado."
  ], correct:0 },
  { q:"O que significa repetir em programação (loop)?", a:[
    "Fazer a mesma ação várias vezes.",
    "Desligar o computador.",
    "Salvar um arquivo.",
    "Conectar na internet."
  ], correct:0 },
  { q:"O que significa 'se... então...' (condicional)?", a:[
    "Tomar uma decisão baseada em uma condição.",
    "Aumentar o volume.",
    "Apertar um botão.",
    "Criar um arquivo."
  ], correct:0 },
  { q:"O que é um bit?", a:[
    "Representa informação como 0 ou 1.",
    "Uma foto impressa.",
    "Um carregador de celular.",
    "Um som do microfone."
  ], correct:0 }
];

function pickRandom(arr, n){
  const copy = arr.slice();
  for(let i=copy.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

/* =========================
   UI helpers
========================= */
function hideAllAreas(){
  ["oralArea","writeArea","coordArea"].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.classList.add("hide");
  });
}
function setMain(title, sub){
  const t = document.getElementById("mainTitle");
  const s = document.getElementById("mainSub");
  if(t) t.textContent = title;
  if(s) s.innerHTML = sub;
}
function showHome(){
  hideAllAreas();
  setMain("Bem-vindo 👋",
    `Entre com seu nome. Você pode refazer a prova quantas vezes quiser. O sistema guarda sua <b>maior nota</b>.
     <br><span class="small">Privacidade demo: tudo fica neste dispositivo (localStorage). Relatório para coordenação é <b>anonimizado</b>.</span>`
  );
  // nada mais precisa: áreas ficam ocultas
}
function showOral(){
  hideAllAreas();
  document.getElementById("oralArea")?.classList.remove("hide");
  setMain("Fase oral 🎙️",
    `Responda uma por vez. Quando você <b>fala</b>, suas barras sobem. Quando você <b>para</b>, elas descem devagar.
     <br><span class="small">Dica: fale com calma. Se não souber, diga "não sei" e avance.</span>`
  );
}
function showWrite(){
  hideAllAreas();
  document.getElementById("writeArea")?.classList.remove("hide");
  setMain("Fase escrita ✍️",
    `Marque as alternativas. Você pode refazer quantas vezes quiser. O sistema guarda a <b>maior nota</b>.`
  );
}
function showCoord(){
  hideAllAreas();
  document.getElementById("coordArea")?.classList.remove("hide");
  setMain("Coordenação 🧩",
    `Aqui sai um JSON <b>anonimizado</b> (sem nome, sem turma, sem áudio), para apoiar ações pedagógicas e psicopedagógicas.`
  );
}

function hydrateHeader(){
  // data “da prova” pode ser hoje (demo)
  const d = new Date();
  const kDate = document.getElementById("kDate");
  if(kDate){
    const dd = String(d.getDate()).padStart(2,"0");
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const yy = d.getFullYear();
    kDate.textContent = `${dd}/${mm}/${yy}`;
  }
  const kBest = document.getElementById("kBest");
  const kTokens = document.getElementById("kTokens");
  if(kBest) kBest.textContent = `${getBest() || "--"}/10`;
  if(kTokens) kTokens.textContent = String(getTokens());

  // nível (demo): baseado na melhor nota
  const best = getBest();
  const lvl = best >= 8 ? "Avançando" : best >= 5 ? "Básico" : "Iniciante";
  const kLevel = document.getElementById("kLevel");
  if(kLevel) kLevel.textContent = lvl;

  // sessão
  let sess = localStorage.getItem(STORE.SESSION);
  if(!sess){
    sess = genSessionId();
    localStorage.setItem(STORE.SESSION, sess);
  }
  const kSess = document.getElementById("kSess");
  if(kSess) kSess.textContent = sess;

  // tentativa
  const t = Number(localStorage.getItem(STORE.TRY) || "1");
  const kTry = document.getElementById("kTry");
  if(kTry) kTry.textContent = String(t);
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

/* =========================
   Barras (8 métricas) — INPUT DO ALUNO
   Regra: falando => sobe rápido; silêncio => desce devagar.
   Metas: manter acima da linha por 4s (fácil).
========================= */
const METRICS = [
  { id:"presenca",  label:"presença"  },
  { id:"impulso",   label:"impulso"   },
  { id:"fluxo",     label:"fluxo"     },
  { id:"constancia",label:"constância"},
  { id:"pausa",     label:"pausa"     },
  { id:"entonacao", label:"entonação" },
  { id:"foco",      label:"foco"      },
  { id:"harmonia",  label:"harmonia"  }
];

let barsUI = {};
const bars = {
  presenca:0, impulso:0, fluxo:0, constancia:0, pausa:0, entonacao:0, foco:0, harmonia:0
};

// “memória” de fala para acumular e ficar fácil de subir
const accum = {
  talkEnergy: 0,        // energia acumulada da fala
  talkStability: 0,     // estabilidade (menos tremor)
  talkContinuity: 0,    // continuidade (menos pausas)
  calm: 0,              // “calma” (var baixa)
  lastRms: 0
};

// metas: 4s acima da linha (0.65)
const GOAL_TH = 0.65;
const GOAL_SEC = 4.0;

const goalHold = { foco:0, constancia:0, harmonia:0 };
let goalsDone = { g1:false, g2:false, g3:false };
let rewardOralGiven = false;

function buildBarsUI(){
  const root = document.getElementById("barList");
  if(!root) return;
  root.innerHTML = "";
  barsUI = {};

  METRICS.forEach(m=>{
    const row = document.createElement("div");
    row.className = "barRow";

    const lab = document.createElement("div");
    lab.className = "barLabel";
    lab.textContent = m.label;

    const track = document.createElement("div");
    track.className = "track";

    const fill = document.createElement("div");
    fill.className = "fill";

    const target = document.createElement("div");
    target.className = "targetLine";

    track.appendChild(fill);
    track.appendChild(target);

    const val = document.createElement("div");
    val.className = "val";
    val.textContent = "0.00";

    row.appendChild(lab);
    row.appendChild(track);
    row.appendChild(val);
    root.appendChild(row);

    barsUI[m.id] = { fill, val };
  });

  renderBars();
}

function renderBars(){
  for(const k in bars){
    const v = clamp01(bars[k]);
    const ui = barsUI[k];
    if(!ui) continue;
    ui.fill.style.width = `${(v*100).toFixed(1)}%`;
    ui.val.textContent = v.toFixed(2);
  }

  const m1 = document.getElementById("m1Dot");
  const m2 = document.getElementById("m2Dot");
  const m3 = document.getElementById("m3Dot");

  if(goalsDone.g1) m1?.classList.add("ok");
  if(goalsDone.g2) m2?.classList.add("ok");
  if(goalsDone.g3) m3?.classList.add("ok");

  if(goalsDone.g1 && goalsDone.g2 && goalsDone.g3 && !rewardOralGiven){
    setTokens(getTokens() + 1);
    rewardOralGiven = true;
    // aviso leve
    try{ alert("🔥 Metas completas! +1 token demo."); }catch{}
  }
}

function resetBarsAndGoals(){
  for(const k in bars) bars[k] = 0;
  accum.talkEnergy = 0;
  accum.talkStability = 0;
  accum.talkContinuity = 0;
  accum.calm = 0;
  accum.lastRms = 0;

  goalHold.foco = 0;
  goalHold.constancia = 0;
  goalHold.harmonia = 0;

  goalsDone = { g1:false, g2:false, g3:false };
  rewardOralGiven = false;

  document.getElementById("m1Dot")?.classList.remove("ok");
  document.getElementById("m2Dot")?.classList.remove("ok");
  document.getElementById("m3Dot")?.classList.remove("ok");

  renderBars();
}

/* =========================
   Microfone + detecção de fala (VAD leve)
   - Não transcreve.
   - Detecta "falando" via RMS e usa isso para subir barras.
========================= */
let audioCtx=null, analyser=null, stream=null, src=null;
let timeData=null;
let raf=null;
let micOn=false;

// janela de “gravação” = o aluno responde
const RECORD_SEC = 15;

// VAD (ajustável)
let vadNoiseFloor = 0.02;  // estimado na calibração
let vadThreshold = 0.045;  // vai recalcular após calibrar
let vadHangMs = 250;       // tolera pequenos buracos

let speaking = false;
let lastSpeechTs = 0;

// KPI da resposta atual
let answerStartTs = 0;
let talkMs = 0;
let totalMs = 0;

function rmsFromTimeDomain(buf){
  let sum=0;
  for(let i=0;i<buf.length;i++){
    const v = (buf[i]-128)/128;
    sum += v*v;
  }
  return Math.sqrt(sum/buf.length);
}

function approachValue(cur, target, up=0.35, down=0.06){
  const a = target > cur ? up : down;
  return clamp01(cur + (target-cur)*a);
}

function updateBarsFromAudio(dt){
  if(!micOn || !analyser) return;

  analyser.getByteTimeDomainData(timeData);
  const rms = clamp01(rmsFromTimeDomain(timeData) * 2.0); // ganho visual

  // VAD (fala)
  const isSpeechNow = rms > vadThreshold;
  const t = now();

  if(isSpeechNow){
    lastSpeechTs = t;
    speaking = true;
  }else{
    if(speaking && (t - lastSpeechTs) > vadHangMs){
      speaking = false;
    }
  }

  // acumula KPI da resposta (só enquanto “gravando”)
  if(answerStartTs > 0){
    totalMs += dt*1000;
    if(speaking) talkMs += dt*1000;
  }

  // estabilidade = pouca oscilação de rms
  const varProxy = clamp01(Math.abs(rms - accum.lastRms) * 6.0);
  accum.lastRms = rms;

  // energia acumulada sobe rápido ao falar; desce devagar no silêncio
  if(speaking){
    accum.talkEnergy = clamp01(accum.talkEnergy + dt*1.2 * rms);
    accum.talkContinuity = clamp01(accum.talkContinuity + dt*0.9);
  }else{
    accum.talkEnergy = clamp01(accum.talkEnergy - dt*0.18);
    accum.talkContinuity = clamp01(accum.talkContinuity - dt*0.22);
  }

  // calma: menos var = mais calma (quando falando)
  const calmNow = clamp01(1 - varProxy);
  if(speaking){
    accum.calm = clamp01(accum.calm + dt*0.55 * calmNow);
    accum.talkStability = clamp01(accum.talkStability + dt*0.65 * calmNow);
  }else{
    accum.calm = clamp01(accum.calm - dt*0.08);
    accum.talkStability = clamp01(accum.talkStability - dt*0.10);
  }

  // mapa de barras (todas “respondem” à fala)
  // objetivo: falando = sobe, e sobe suficiente em 4s para bater meta
  const energy = accum.talkEnergy;        // 0..1
  const cont   = accum.talkContinuity;    // 0..1
  const stab   = accum.talkStability;     // 0..1
  const calm   = accum.calm;              // 0..1

  const presT = clamp01(0.35 + 0.70*cont);            // presença = continuidade
  const impT  = clamp01(0.20 + 0.85*energy);          // impulso = energia
  const fluxoT= clamp01(0.25 + 0.70*cont);            // fluxo = continuidade
  const consT = clamp01(0.20 + 0.85*stab);            // constância = estabilidade
  const pausaT= clamp01(0.35 + 0.55*calm);            // pausa ok = calma
  const entT  = clamp01(0.20 + 0.40*(1-calm) + 0.35*energy); // entonação = var/energia (proxy)
  const focoT = clamp01(0.30 + 0.55*stab + 0.35*cont);       // foco = estabilidade+continuidade
  const harmT = clamp01((presT + consT + focoT + pausaT)/4); // harmonia = equilíbrio

  // sobe rápido; desce devagar (já pela memória + approach)
  bars.presenca   = approachValue(bars.presenca, presT);
  bars.impulso    = approachValue(bars.impulso, impT);
  bars.fluxo      = approachValue(bars.fluxo, fluxoT);
  bars.constancia = approachValue(bars.constancia, consT);
  bars.pausa      = approachValue(bars.pausa, pausaT);
  bars.entonacao  = approachValue(bars.entonacao, entT);
  bars.foco       = approachValue(bars.foco, focoT);
  bars.harmonia   = approachValue(bars.harmonia, harmT);

  // metas (conta tempo acima da linha)
  if(bars.foco >= GOAL_TH) goalHold.foco += dt; else goalHold.foco = Math.max(0, goalHold.foco - dt*0.4);
  if(bars.constancia >= GOAL_TH) goalHold.constancia += dt; else goalHold.constancia = Math.max(0, goalHold.constancia - dt*0.4);
  if(bars.harmonia >= GOAL_TH) goalHold.harmonia += dt; else goalHold.harmonia = Math.max(0, goalHold.harmonia - dt*0.4);

  if(!goalsDone.g1 && goalHold.foco >= GOAL_SEC) goalsDone.g1 = true;
  if(!goalsDone.g2 && goalHold.constancia >= GOAL_SEC) goalsDone.g2 = true;
  if(!goalsDone.g3 && goalHold.harmonia >= GOAL_SEC) goalsDone.g3 = true;

  renderBars();

  // KPI visível (sem transcrever)
  updateKPI();
}

async function micToggle(){
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
    analyser.smoothingTimeConstant = 0.65;

    src = audioCtx.createMediaStreamSource(stream);
    src.connect(analyser);
    timeData = new Uint8Array(analyser.fftSize);

    micOn = true;

    // calibra “chão de ruído” em 700ms
    await calibrateNoiseFloor();

    setMicUI(true);
    const loop = ()=>{
      raf = requestAnimationFrame(loop);
      // dt aproximado
      updateBarsFromAudio(1/60);
    };
    loop();
  }catch(e){
    try{ alert("Falha ao acessar microfone. Verifique permissões do navegador."); }catch{}
  }
}

async function calibrateNoiseFloor(){
  // mede RMS médio de ruído ambiente por ~700ms
  const t0 = now();
  let sum = 0, n = 0;

  return new Promise((resolve)=>{
    const iv = setInterval(()=>{
      if(!analyser) return;
      analyser.getByteTimeDomainData(timeData);
      const rms = clamp01(rmsFromTimeDomain(timeData) * 2.0);
      sum += rms; n++;
      if(now() - t0 > 700){
        clearInterval(iv);
        vadNoiseFloor = n ? sum/n : 0.02;
        // threshold = ruído + margem
        vadThreshold = Math.max(0.035, vadNoiseFloor + 0.020);
        resolve();
      }
    }, 50);
  });
}

function disableMic(){
  try{ if(raf) cancelAnimationFrame(raf); }catch{}
  raf = null;

  try{ src?.disconnect(); }catch{}
  try{ audioCtx?.close(); }catch{}
  try{ stream?.getTracks()?.forEach(t=>t.stop()); }catch{}

  micOn = false;
  speaking = false;
  setMicUI(false);
}

function setMicUI(on){
  const micStateEl = document.getElementById("micState");
  const btnMic = document.getElementById("btnMic");
  const btnRec = document.getElementById("btnRec");

  if(micStateEl) micStateEl.textContent = on ? "ligado ✅" : "desligado";
  if(btnMic) btnMic.textContent = on ? "Desativar microfone" : "Ativar microfone";
  if(btnRec) btnRec.disabled = !on;
}

/* =========================
   KPI (palavras estimadas / duração / ritmo)
   - sem transcrição (não conta ruído como palavra)
========================= */
function updateKPI(){
  const kWords = document.getElementById("kWords");
  const kDur   = document.getElementById("kDur");
  const kWpm   = document.getElementById("kWpm");

  const durS = totalMs/1000;
  const talkS = talkMs/1000;

  // palavras estimadas: assume ~2.2 palavras por segundo de fala calma
  const wordsEst = Math.max(0, Math.round(talkS * 2.2));

  // wpm estimado: (palavras / min de fala) — se não falou, 0
  const wpm = talkS > 0.2 ? Math.round((wordsEst / talkS) * 60) : 0;

  if(kWords) kWords.textContent = String(wordsEst);
  if(kDur) kDur.textContent = durS.toFixed(1);
  if(kWpm) kWpm.textContent = String(wpm);
}


/* =========================
   Fase Oral
========================= */
let oralQuestions = [];
let oralIdx = 0;
const ORAL_N = 5;

let oralStartedAt = 0;
let oralClockInt = null;

function startFlow(){
  saveProfile();
  hydrateHeader();
  startOral();
}

function startOral(){
  oralQuestions = pickRandom(ORAL_POOL, ORAL_N);
  oralIdx = 0;

  resetBarsAndGoals();
  clearAnswerWindow();

  // botão escrita travado até finalizar oral
  disableGoWrite(true);

  oralStartedAt = now();
  if(oralClockInt) clearInterval(oralClockInt);
  oralClockInt = setInterval(()=>{
    const sec = Math.floor((now()-oralStartedAt)/1000);
    const mm = String(Math.floor(sec/60)).padStart(2,"0");
    const ss = String(sec%60).padStart(2,"0");
    document.getElementById("oralClock").textContent = `${mm}:${ss}`;
  }, 250);

  updateOralUI();
  showOral();

  // se mic estava ligado, mantém (mas resetando métricas)
  // a pessoa escolhe ligar quando quiser
}

function updateOralUI(){
  const qPos = document.getElementById("qPos");
  const qText = document.getElementById("qText");
  if(qPos) qPos.textContent = `${oralIdx+1}/${oralQuestions.length}`;
  if(qText) qText.textContent = oralQuestions[oralIdx] || "—";

  const status = document.getElementById("oralStatus");
  if(status){
    status.textContent = "Dica: fale com calma. Se não souber, diga “não sei” e avance.";
  }
}

function clearAnswerWindow(){
  answerStartTs = 0;
  talkMs = 0;
  totalMs = 0;
  updateKPI();
}

function disableGoWrite(disabled){
  const btn = document.getElementById("btnGoWrite");
  if(!btn) return;
  if(disabled){
    btn.classList.add("disabled");
  }else{
    btn.classList.remove("disabled");
  }
}

function nextOral(){
  oralIdx++;
  clearAnswerWindow();

  if(oralIdx >= oralQuestions.length){
    // finaliza oral
    finishOral();
    return;
  }
  updateOralUI();
}

function skipOral(){
  nextOral();
}

function finishOral(){
  // libera escrita
  disableGoWrite(false);

  const status = document.getElementById("oralStatus");
  if(status){
    status.textContent = "✅ Oral concluída! Agora pode ir para a fase escrita.";
  }
}

function endOral(){
  // encerra antes do fim, mas libera escrita igual (para não travar demo)
  disableGoWrite(false);
  const status = document.getElementById("oralStatus");
  if(status){
    status.textContent = "Oral encerrada. Você pode seguir para a fase escrita.";
  }
}

function recordAnswerWindow(){
  if(!micOn){
    try{ alert("Ative o microfone primeiro."); }catch{}
    return;
  }

  // inicia janela da resposta
  clearAnswerWindow();
  answerStartTs = now();

  const btnRec = document.getElementById("btnRec");
  if(btnRec) btnRec.disabled = true;

  const status = document.getElementById("oralStatus");
  if(status) status.textContent = `Gravando janela de resposta (${RECORD_SEC}s)… fale normalmente.`;

  const t0 = now();
  const iv = setInterval(()=>{
    const elapsed = (now()-t0)/1000;
    if(elapsed >= RECORD_SEC){
      clearInterval(iv);

      // encerra janela
      answerStartTs = 0;

      if(status){
        status.textContent = "Resposta registrada (métricas locais). Próxima pergunta!";
      }
      if(btnRec) btnRec.disabled = false;

      nextOral();
    }
  }, 120);
}

/* =========================
   Fase Escrita (vale 10)
========================= */
let written = {
  items: [],
  answers: {},  // idx -> option
  tryN: 1
};

function startWritten(){
  // regra demo: precisa de 1 token
  const tokens = getTokens();
  if(tokens <= 0){
    try{ alert("Sem tokens demo. Faça as metas na fase oral para ganhar +1 token."); }catch{}
    showOral();
    return;
  }
  setTokens(tokens - 1);

  // tentativa ++
  let t = Number(localStorage.getItem(STORE.TRY) || "1");
  t = Math.max(1, t);
  localStorage.setItem(STORE.TRY, String(t));
  document.getElementById("kTry").textContent = String(t);

  written.tryN = t;
  written.items = pickRandom(WRITTEN_POOL, 5);
  written.answers = {};

  renderWritten();
  showWrite();
}

function renderWritten(){
  const grid = document.getElementById("writeGrid");
  if(!grid) return;
  grid.innerHTML = "";

  written.items.forEach((it, idx)=>{
    const block = document.createElement("div");
    block.className = "questionBlock";

    const h = document.createElement("h4");
    h.textContent = `Questão ${idx+1}/5`;
    block.appendChild(h);

    const p = document.createElement("div");
    p.style.fontWeight = "900";
    p.style.marginBottom = "8px";
    p.textContent = it.q;
    block.appendChild(p);

    it.a.forEach((opt, i)=>{
      const lab = document.createElement("label");
      lab.className = "opt";

      const r = document.createElement("input");
      r.type = "radio";
      r.name = `q_${idx}`;
      r.value = String(i);
      r.checked = (written.answers[idx] === i);

      r.addEventListener("change", ()=>{
        written.answers[idx] = i;
        updateWriteStatus();
      });

      lab.appendChild(r);
      lab.appendChild(document.createTextNode(` ${String.fromCharCode(65+i)}) ${opt}`));
      block.appendChild(lab);
    });

    grid.appendChild(block);
  });

  updateWriteStatus();
}

function updateWriteStatus(){
  const st = document.getElementById("writeStatus");
  if(!st) return;
  const answered = Object.keys(written.answers).length;
  st.textContent = `Respondidas: ${answered}/5`;
}

function gradeWritten(){
  // exige marcar todas
  if(Object.keys(written.answers).length < written.items.length){
    try{ alert("Marque todas as questões antes de corrigir."); }catch{}
    return;
  }

  let correct = 0;
  written.items.forEach((it, idx)=>{
    if(written.answers[idx] === it.correct) correct++;
  });

  const score10 = Math.round((correct / written.items.length) * 10);
  setLast(score10);

  const best = Math.max(getBest(), score10);
  setBest(best);

  // nível
  hydrateHeader();

  // guarda histórico (sem PII)
  pushHistory({
    ts: now(),
    tryN: written.tryN,
    score10,
    best,
    oralBars: { ...bars },
    goalsDone: { ...goalsDone },
    tokensLeft: getTokens()
  });

  try{
    alert(`✅ Nota: ${score10}/10\nAcertos: ${correct}/5\nMelhor nota: ${best}/10`);
  }catch{}

  // volta para home (ou fica)
  showHome();
  hydrateHeader();
}

function newTry(){
  // aumenta tentativa e gera prova diferente
  let t = Number(localStorage.getItem(STORE.TRY) || "1");
  t++;
  localStorage.setItem(STORE.TRY, String(t));
  document.getElementById("kTry").textContent = String(t);

  written.tryN = t;
  written.items = pickRandom(WRITTEN_POOL, 5);
  written.answers = {};
  renderWritten();
}

function backToOral(){
  showOral();
}

/* =========================
   Coordenação (anonimizado) + bônus de token
========================= */
let lastCoordJson = null;
let coordBonusGiven = false;

function anonymizedCoordPayload(){
  const h = readJSON(STORE.HISTORY, []);
  const latest = h[0] || null;

  // “métricas ocultas”: usa barras + metas + sessão
  return {
    app: "vibracoes-de-leao",
    version: "demo-edu-2",
    sessionId: localStorage.getItem(STORE.SESSION) || null,
    generatedAt: new Date().toISOString(),
    scores: {
      last: getLast(),
      best: getBest()
    },
    oral: {
      goals: { ...goalsDone },
      barsSnapshot: Object.fromEntries(Object.entries(bars).map(([k,v])=>[k, Number(v.toFixed(3))])),
      vad: {
        noiseFloor: Number(vadNoiseFloor.toFixed(4)),
        threshold: Number(vadThreshold.toFixed(4)),
        hangMs: vadHangMs
      }
    },
    usage: {
      tokensLeft: getTokens(),
      lastAttemptAt: latest?.ts ? new Date(latest.ts).toISOString() : null
    },
    privacy: {
      containsPII: false,
      containsAudio: false,
      note: "Dados anonimizados. Sem nome/turma/áudio. Uso apenas pedagógico."
    }
  };
}

function buildCoordReport(){
  lastCoordJson = anonymizedCoordPayload();
  const box = document.getElementById("reportBox");
  if(box) box.value = JSON.stringify(lastCoordJson, null, 2);

  // habilita botões
  document.getElementById("btnCopyReport")?.classList.remove("disabled");
  document.getElementById("btnDownloadReport")?.classList.remove("disabled");

  // bônus de token (1x por sessão)
  if(!coordBonusGiven){
    setTokens(getTokens() + 1);
    coordBonusGiven = true;
    try{ alert("📌 Relatório de coordenação gerado. +1 token bônus (demo)."); }catch{}
  }
}

async function copyCoordReport(){
  if(!lastCoordJson) return;
  const text = JSON.stringify(lastCoordJson, null, 2);
  try{
    await navigator.clipboard.writeText(text);
    alert("JSON copiado.");
  }catch{
    alert(text);
  }
}

function downloadCoordReport(){
  if(!lastCoordJson) return;
  const blob = new Blob([JSON.stringify(lastCoordJson, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vibracoes_coord_${localStorage.getItem(STORE.SESSION) || "sessao"}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 800);
}

/* =========================
   Bindings
========================= */
document.addEventListener("DOMContentLoaded", ()=>{
  // init
  initTokens();
  setTokens(getTokens());

  // restore profile
  const prof = readJSON(STORE.PROFILE, null);
  if(prof){
    const n = document.getElementById("inpName");
    const c = document.getElementById("inpClass");
    if(n && !n.value) n.value = prof.name || "";
    if(c && !c.value) c.value = prof.turma || "";
  }

  // ensure session
  if(!localStorage.getItem(STORE.SESSION)){
    localStorage.setItem(STORE.SESSION, genSessionId());
  }

  hydrateHeader();
  buildBarsUI();
  showHome();

  // Buttons home
  document.getElementById("btnStart")?.addEventListener("click", startFlow);
  document.getElementById("btnResetAll")?.addEventListener("click", ()=>{
    if(confirm("Zerar tudo (dados locais, notas, tokens)?")) resetAll();
  });
  document.getElementById("btnGoCoord")?.addEventListener("click", ()=>{
    saveProfile();
    showCoord();
  });

  // Oral controls
  document.getElementById("btnMic")?.addEventListener("click", micToggle);
  document.getElementById("btnRec")?.addEventListener("click", recordAnswerWindow);
  document.getElementById("btnSkip")?.addEventListener("click", skipOral);
  document.getElementById("btnEndOral")?.addEventListener("click", endOral);
  document.getElementById("btnRestartOral")?.addEventListener("click", ()=>{
    if(confirm("Recomeçar fase oral?")) startOral();
  });
  document.getElementById("btnGoWrite")?.addEventListener("click", ()=>{
    // só vai se liberado
    const btn = document.getElementById("btnGoWrite");
    if(btn?.classList.contains("disabled")) return;

    // opcional: desliga mic para economizar e evitar confusão
    if(micOn) disableMic();
    if(oralClockInt) clearInterval(oralClockInt);

    // incrementa tentativa antes de iniciar prova escrita
    let t = Number(localStorage.getItem(STORE.TRY) || "1");
    localStorage.setItem(STORE.TRY, String(t));
    document.getElementById("kTry").textContent = String(t);

    startWritten();
  });

  // Written controls
  document.getElementById("btnGrade")?.addEventListener("click", gradeWritten);
  document.getElementById("btnNewTry")?.addEventListener("click", ()=>{
    if(confirm("Nova tentativa com perguntas diferentes?")) newTry();
  });
  document.getElementById("btnBackOral")?.addEventListener("click", backToOral);

  // Coord controls
  document.getElementById("btnBuildReport")?.addEventListener("click", buildCoordReport);
  document.getElementById("btnCopyReport")?.addEventListener("click", copyCoordReport);
  document.getElementById("btnDownloadReport")?.addEventListener("click", downloadCoordReport);
  document.getElementById("btnBackApp")?.addEventListener("click", ()=>{
    showHome();
    hydrateHeader();
  });

  // quando o usuário edita nome/turma, salva
  document.getElementById("inpName")?.addEventListener("input", saveProfile);
  document.getElementById("inpClass")?.addEventListener("input", saveProfile);
});