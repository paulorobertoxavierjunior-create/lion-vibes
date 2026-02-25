/* Vibrações de Leão — app.js (raiz)
   - Páginas: index/oral/prova/relatorio/coordenacao/config
   - Barras = INPUT (palavras + tempo + fluidez)
   - Microfone: toggle (SpeechRecognition para contar palavras do que foi dito)
   - Relatórios: aluno + coordenação (anonimizado)
*/

const STORE = {
  PROFILE: "vdl_profile",
  TOKENS: "vdl_tokens",
  BEST: "vdl_best",
  LAST: "vdl_last",
  TRY: "vdl_try",
  ORAL: "vdl_oral_last",
  HISTORY: "vdl_history",
  COORD_SENT: "vdl_coord_sent_bonus",
  CONFIG: "vdl_config",
  SESSION: "vdl_session_id"
};

const DEFAULT_CONFIG = {
  maxOralSec: 20,      // tempo máximo por resposta oral
  goalSec: 4,          // meta de permanência acima da linha
  targetLine: 0.65,    // linha-alvo (0..1)
  talkGain: 1.8        // ganho (quanto falar sobe as barras)
};

function readJSON(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return fallback;
    return JSON.parse(raw);
  }catch{ return fallback; }
}
function writeJSON(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
function now(){ return Date.now(); }
function clamp01(x){ return Math.max(0, Math.min(1, x)); }
function fmtTime(sec){
  sec = Math.max(0, Math.floor(sec));
  const m = String(Math.floor(sec/60)).padStart(2,"0");
  const s = String(sec%60).padStart(2,"0");
  return `${m}:${s}`;
}
function uid(){
  // id leve pra sessão (não é PII)
  return "S" + Math.random().toString(16).slice(2,8).toUpperCase() + "-" + Date.now().toString(36).toUpperCase();
}

function getCfg(){
  const c = readJSON(STORE.CONFIG, null);
  return { ...DEFAULT_CONFIG, ...(c || {}) };
}
function setCfg(c){ writeJSON(STORE.CONFIG, c); }

function initSession(){
  let s = localStorage.getItem(STORE.SESSION);
  if(!s){ s = uid(); localStorage.setItem(STORE.SESSION, s); }
  return s;
}

function getTokens(){
  const t = Number(localStorage.getItem(STORE.TOKENS) || "0");
  return Number.isFinite(t) ? t : 0;
}
function setTokens(v){
  localStorage.setItem(STORE.TOKENS, String(Math.max(0, Math.floor(v))));
}
function ensureTokens(){
  // começa com 2 tokens (pra não travar criança)
  const t = Number(localStorage.getItem(STORE.TOKENS));
  if(Number.isFinite(t)) return;
  setTokens(2);
}

function getBest(){ return Number(localStorage.getItem(STORE.BEST) || "0"); }
function setBest(v){ localStorage.setItem(STORE.BEST, String(Math.max(0, Math.floor(v)))); }
function getLast(){ return Number(localStorage.getItem(STORE.LAST) || "0"); }
function setLast(v){ localStorage.setItem(STORE.LAST, String(Math.max(0, Math.floor(v)))); }

function getTry(){ return Number(localStorage.getItem(STORE.TRY) || "1"); }
function setTry(v){ localStorage.setItem(STORE.TRY, String(Math.max(1, Math.floor(v)))); }

function setProfile(name, turma){
  writeJSON(STORE.PROFILE, { name: (name||"").trim(), turma: (turma||"").trim() });
}
function getProfile(){
  return readJSON(STORE.PROFILE, { name:"", turma:"" });
}

function pushHistory(entry){
  const h = readJSON(STORE.HISTORY, []);
  h.unshift(entry);
  writeJSON(STORE.HISTORY, h.slice(0, 30));
}

function resetAll(){
  Object.values(STORE).forEach(k => localStorage.removeItem(k));
  ensureTokens();
  initSession();
}

function $(id){ return document.getElementById(id); }

function setText(id, txt){
  const el = $(id);
  if(el) el.textContent = txt;
}

function updateTopPills(){
  setText("kBest", `${getBest() || "--"}/10`);
  setText("kLast", `${getLast() || "--"}/10`);
  setText("kTokens", `${getTokens()}`);
  setText("kTry", `${getTry()}`);
  setText("kSess", localStorage.getItem(STORE.SESSION) || "—");
  setText("kGen", new Date().toLocaleString());
  setText("kDate", new Date().toLocaleDateString());
}

// ------------------------------
// Barras (8 métricas) — INPUT
// ------------------------------
const METRICS = [
  { id:"presenca",  name:"Presença"   },
  { id:"impulso",   name:"Impulso"    },
  { id:"fluxo",     name:"Fluxo"      },
  { id:"constancia",name:"Constância" },
  { id:"pausa",     name:"Pausa"      },
  { id:"entonacao", name:"Entonação"  },
  { id:"foco",      name:"Foco"       },
  { id:"harmonia",  name:"Harmonia"   }
];

let barsUI = null;
const barState = Object.fromEntries(METRICS.map(m => [m.id, 0]));
const barHold = { foco:0, constancia:0, harmonia:0 };
let goalsDone = { g1:false, g2:false, g3:false };
let rewardGiven = false;

function buildBars(){
  const root = $("barList");
  if(!root) return;
  root.innerHTML = "";
  barsUI = {};
  const cfg = getCfg();

  METRICS.forEach(m=>{
    const row = document.createElement("div");
    row.className = "barRow";

    const label = document.createElement("div");
    label.className = "barLabel";
    label.textContent = m.name;

    const track = document.createElement("div");
    track.className = "track";

    const fill = document.createElement("div");
    fill.className = "fill";

    const target = document.createElement("div");
    target.className = "targetLine";
    target.style.left = `${Math.round(cfg.targetLine*100)}%`;

    track.appendChild(fill);
    track.appendChild(target);

    const val = document.createElement("div");
    val.className = "val";
    val.textContent = "0.00";

    row.appendChild(label);
    row.appendChild(track);
    row.appendChild(val);
    root.appendChild(row);

    barsUI[m.id] = { fill, val };
  });

  renderBars();
}

function renderBars(){
  if(!barsUI) return;
  for(const k in barState){
    const v = clamp01(barState[k]);
    barsUI[k].fill.style.width = `${(v*100).toFixed(1)}%`;
    barsUI[k].val.textContent = v.toFixed(2);
  }

  // metas visuais
  if(goalsDone.g1) $("m1Dot")?.classList.add("ok");
  if(goalsDone.g2) $("m2Dot")?.classList.add("ok");
  if(goalsDone.g3) $("m3Dot")?.classList.add("ok");

  // recompensa: +1 token uma única vez por sessão oral
  if(goalsDone.g1 && goalsDone.g2 && goalsDone.g3 && !rewardGiven){
    setTokens(getTokens() + 1);
    rewardGiven = true;
    updateTopPills();
    // não grita demais: só um aviso simples
    try{ alert("Metas completas! Você ganhou +1 token."); }catch{}
  }
}

// sobe rápido e desce devagar
function approach(key, target, up=0.40, down=0.06){
  const cur = barState[key];
  const a = (target > cur) ? up : down;
  barState[key] = clamp01(cur + (target - cur) * a);
}

// “pulsos de fala” alimentam as barras
function feedBars(talkPower, continuity, calmness){
  // talkPower: 0..1 (fala/energia)
  // continuity: 0..1 (fala contínua)
  // calmness: 0..1 (menos tranco)
  const cfg = getCfg();
  const p = clamp01(talkPower * cfg.talkGain);

  // mapeamento pedagógico (INPUT)
  const pres = clamp01(0.55*continuity + 0.45*calmness);
  const imp  = clamp01(p);
  const flu  = clamp01(0.70*continuity + 0.30*p);
  const con  = clamp01(calmness);
  const pau  = clamp01(0.50*calmness + 0.50*(1 - Math.abs(continuity-0.65)));
  const ent  = clamp01(0.45*p + 0.55*(1 - calmness)); // variação aparece quando fala “picotado”
  const foco = clamp01(0.55*pres + 0.45*con);
  const har  = clamp01((pres + con + foco + flu)/4);

  approach("presenca", pres);
  approach("impulso", imp);
  approach("fluxo", flu);
  approach("constancia", con);
  approach("pausa", pau);
  approach("entonacao", ent);
  approach("foco", foco);
  approach("harmonia", har);

  updateGoals();
  renderBars();
}

function decayBars(){
  // quando não fala, desce devagar (não humilha a criança)
  for(const k in barState){
    approach(k, 0, 0.12, 0.03);
  }
  updateGoals();
  renderBars();
}

function updateGoals(){
  const cfg = getCfg();
  const TH = cfg.targetLine;
  const need = cfg.goalSec;
  const dt = 1/20; // estimativa (50ms)

  // sobe “crédito” acima da linha; cai um pouco quando abaixo
  if(barState.foco >= TH) barHold.foco += dt; else barHold.foco = Math.max(0, barHold.foco - dt*0.6);
  if(barState.constancia >= TH) barHold.constancia += dt; else barHold.constancia = Math.max(0, barHold.constancia - dt*0.6);
  if(barState.harmonia >= TH) barHold.harmonia += dt; else barHold.harmonia = Math.max(0, barHold.harmonia - dt*0.6);

  if(!goalsDone.g1 && barHold.foco >= need) goalsDone.g1 = true;
  if(!goalsDone.g2 && barHold.constancia >= need) goalsDone.g2 = true;
  if(!goalsDone.g3 && barHold.harmonia >= need) goalsDone.g3 = true;
}

// ------------------------------
// Fase oral — SpeechRecognition (palavras do que foi dito)
// ------------------------------
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const ORAL_QUESTIONS = [
  "Conte de 1 até 10, sem pressa.",
  "Fale seu nome e uma coisa que você gosta.",
  "Conte o que você fez hoje (pode ser bem simples)."
];

let oralIdx = 0;
let oralTimer = null;
let oralStartedAt = 0;

let micEnabled = false;
let isRecording = false;
let rec = null;
let recTick = null;

let windowStart = 0;
let windowLastWords = 0;
let windowWords = 0;
let windowText = "";
let lastInterimAt = 0;

const oralAgg = {
  totalWindows:0,
  totalWords:0,
  totalSec:0,
  avgWpm:0,
  avgContinuity:0,
  avgCalmness:0
};

function resetOralAgg(){
  oralAgg.totalWindows=0;
  oralAgg.totalWords=0;
  oralAgg.totalSec=0;
  oralAgg.avgWpm=0;
  oralAgg.avgContinuity=0;
  oralAgg.avgCalmness=0;
}

function saveOralAgg(){
  writeJSON(STORE.ORAL, {
    at: now(),
    ...oralAgg
  });
}

function wordCountFromText(t){
  const cleaned = (t||"")
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if(!cleaned) return 0;
  return cleaned.split(" ").filter(Boolean).length;
}

function oralSetQuestion(){
  setText("qPos", `${oralIdx+1}/${ORAL_QUESTIONS.length}`);
  setText("qText", ORAL_QUESTIONS[oralIdx] || "—");
  setText("oralStatus", "Fale com calma. Se não souber, diga “não sei” e avance.");
}

function startOralClock(){
  oralStartedAt = now();
  if(oralTimer) clearInterval(oralTimer);
  oralTimer = setInterval(()=>{
    const sec = (now()-oralStartedAt)/1000;
    setText("oralClock", fmtTime(sec));
  }, 250);
}

function stopOralClock(){
  if(oralTimer) clearInterval(oralTimer);
  oralTimer = null;
}

function setMicLabel(){
  setText("kMic", micEnabled ? "ligado" : "desligado");
  setText("micState", micEnabled ? "ligado" : "desligado");
  const btn = $("btnMicToggle");
  if(btn) btn.textContent = micEnabled ? "Desligar microfone" : "Ligar microfone";
}

async function toggleMic(){
  if(!SpeechRecognition){
    alert("Este navegador não tem reconhecimento de fala. Use Chrome no Android/PC.");
    return;
  }

  if(micEnabled){
    // desligar
    try{ stopRecording(true); }catch{}
    micEnabled = false;
    setMicLabel();
    $("btnRec")?.classList.add("disabled");
    $("btnStop")?.classList.add("disabled");
    updateTopPills();
    return;
  }

  micEnabled = true;
  setMicLabel();
  $("btnRec")?.classList.remove("disabled");
  updateTopPills();
}

function makeRecognizer(){
  const r = new SpeechRecognition();
  r.lang = "pt-BR";
  r.interimResults = true;
  r.continuous = true;
  return r;
}

function startRecording(){
  if(!micEnabled){
    alert("Ligue o microfone primeiro.");
    return;
  }
  if(isRecording) return;

  // reset janela
  windowStart = now();
  windowWords = 0;
  windowLastWords = 0;
  windowText = "";
  lastInterimAt = now();

  isRecording = true;
  setText("recState", "gravando…");
  $("btnRec")?.classList.add("disabled");
  $("btnStop")?.classList.remove("disabled");
  setText("oralStatus", "Fale. As barras sobem conforme você fala.");

  // cria recognizer
  rec = makeRecognizer();

  rec.onresult = (evt)=>{
    let interim = "";
    let finalText = "";
    for(let i=evt.resultIndex; i<evt.results.length; i++){
      const res = evt.results[i];
      const txt = res[0].transcript || "";
      if(res.isFinal) finalText += txt + " ";
      else interim += txt + " ";
    }

    // junta o final; interim serve pra detectar atividade
    if(finalText){
      windowText += finalText;
      lastInterimAt = now();
    }else if(interim){
      lastInterimAt = now();
    }

    const wc = wordCountFromText(windowText + " " + interim);
    windowWords = wc;
  };

  rec.onerror = (e)=>{
    // erros comuns: no-speech, aborted, not-allowed
    setText("recState", "erro");
    setText("oralStatus", "Se não captou, tente de novo e fale perto do celular.");
  };

  rec.onend = ()=>{
    // se estiver gravando, tenta manter contínuo (chrome às vezes encerra sozinho)
    if(isRecording){
      try{ rec.start(); }catch{}
    }
  };

  try{ rec.start(); }catch{}

  // loop 20Hz: alimenta barras por palavras/tempo e “fluidez”
  const cfg = getCfg();
  recTick = setInterval(()=>{
    const elapsed = (now()-windowStart)/1000;
    const words = windowWords;

    // KPIs
    setText("kWords", String(words));
    setText("kDur", elapsed.toFixed(1));
    const wpm = elapsed > 0.5 ? Math.round((words/elapsed)*60) : 0;
    setText("kWpm", String(wpm));

    // “fala detectada” por crescimento de palavras
    const delta = Math.max(0, words - windowLastWords);
    windowLastWords = words;

    // talkPower sobe com delta de palavras e com wpm (até um teto)
    const talkPower = clamp01((delta/2) + (wpm/140));
    // continuity: se está recebendo resultados recentes (sem pausas longas)
    const gap = (now() - lastInterimAt)/1000;
    const continuity = clamp01(1 - (gap/1.8)); // se >1.8s sem sinal, cai
    // calmness: não “tranca”: wpm moderado dá melhor nota
    const calmness = clamp01(1 - Math.abs((wpm - 105)/105)); // pico por volta de 105wpm

    if(delta > 0 || continuity > 0.35){
      feedBars(talkPower, continuity, calmness);
    }else{
      decayBars();
    }

    // auto-stop por tempo máximo
    if(elapsed >= cfg.maxOralSec){
      stopRecording(false);
    }
  }, 50);
}

function stopRecording(userStop){
  if(!isRecording) return;
  isRecording = false;

  try{ clearInterval(recTick); }catch{}
  recTick = null;

  try{ rec?.stop(); }catch{}
  rec = null;

  setText("recState", "parado");
  $("btnRec")?.classList.remove("disabled");
  $("btnStop")?.classList.add("disabled");

  // agregados da janela
  const elapsed = (now()-windowStart)/1000;
  const wpm = elapsed > 0.5 ? (windowWords/elapsed)*60 : 0;

  // continuidade/calmness aproximados a partir do estado final das barras
  const continuity = barState.fluxo;
  const calmness = barState.constancia;

  // atualiza agregados
  const n = oralAgg.totalWindows + 1;
  oralAgg.avgWpm = (oralAgg.avgWpm*oralAgg.totalWindows + wpm)/n;
  oralAgg.avgContinuity = (oralAgg.avgContinuity*oralAgg.totalWindows + continuity)/n;
  oralAgg.avgCalmness = (oralAgg.avgCalmness*oralAgg.totalWindows + calmness)/n;
  oralAgg.totalWindows = n;
  oralAgg.totalWords += windowWords;
  oralAgg.totalSec += elapsed;

  saveOralAgg();

  // avança pergunta
  if(!userStop){
    nextOralQuestion();
  }else{
    setText("oralStatus", "Você parou. Se quiser, grave de novo.");
  }
}

function nextOralQuestion(){
  // salva um pedacinho leve (sem áudio)
  const entry = readJSON(STORE.ORAL, {});
  writeJSON(STORE.ORAL, entry);

  if(oralIdx < ORAL_QUESTIONS.length - 1){
    oralIdx++;
    windowWords = 0; windowLastWords = 0; windowText = "";
    oralSetQuestion();
    setText("kWords", "0"); setText("kDur", "0.0"); setText("kWpm", "0");
    setText("oralStatus", "Próxima pergunta. Quando estiver pronto, grave.");
    return;
  }

  // fim oral
  setText("oralStatus", "Fase oral concluída. Agora você pode ir para a prova.");
  $("btnGoProva")?.classList.remove("disabled");
  try{ alert("Fase oral concluída! A prova escrita foi liberada."); }catch{}
}

function restartOral(){
  oralIdx = 0;
  resetOralAgg();

  // reset metas
  for(const k in barState) barState[k] = 0;
  barHold.foco = barHold.constancia = barHold.harmonia = 0;
  goalsDone = { g1:false, g2:false, g3:false };
  rewardGiven = false;

  $("m1Dot")?.classList.remove("ok");
  $("m2Dot")?.classList.remove("ok");
  $("m3Dot")?.classList.remove("ok");

  oralSetQuestion();
  setText("kWords","0"); setText("kDur","0.0"); setText("kWpm","0");
  $("btnGoProva")?.classList.add("disabled");
  renderBars();
}

// ------------------------------
// Prova escrita — bem básica, progressiva
// ------------------------------
const WRITTEN_POOL = [
  {
    q: "O que é um algoritmo?",
    a: [
      "Um passo a passo para resolver um problema.",
      "Um tipo de celular.",
      "Um jogo de futebol.",
      "Uma peça de roupa."
    ],
    correct: 0
  },
  {
    q: "O que é 'entrada' em um programa?",
    a: [
      "O que o usuário digita ou fala para o programa.",
      "A cor do computador.",
      "O volume do som.",
      "O cabo carregador."
    ],
    correct: 0
  },
  {
    q: "O que é uma variável?",
    a: [
      "Um lugar para guardar um valor (número, texto).",
      "Um botão do teclado.",
      "Um tipo de fone.",
      "Um desenho."
    ],
    correct: 0
  },
  {
    q: "Para que serve 'se... então...'?",
    a: [
      "Para tomar uma decisão quando algo acontece.",
      "Para aumentar a tela.",
      "Para desligar a internet.",
      "Para carregar o celular."
    ],
    correct: 0
  },
  {
    q: "O que é um 'loop' (repetição)?",
    a: [
      "Fazer a mesma ação mais de uma vez.",
      "Trocar de celular.",
      "Abaixar o brilho.",
      "Abrir o WhatsApp."
    ],
    correct: 0
  },
  {
    q: "O que é um bit?",
    a: [
      "Um pedaço de informação que pode ser 0 ou 1.",
      "Um tipo de caneta.",
      "Um aplicativo de música.",
      "Uma nota de prova."
    ],
    correct: 0
  }
];

function pickRandom(arr, n){
  const copy = arr.slice();
  for(let i=copy.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

let provaItems = [];
let provaAnswers = {}; // idx->choice

function renderProva(){
  const grid = $("writeGrid");
  if(!grid) return;

  provaItems = pickRandom(WRITTEN_POOL, 5);
  provaAnswers = {};

  grid.innerHTML = "";
  provaItems.forEach((item, idx)=>{
    const block = document.createElement("div");
    block.className = "questionBlock";

    const h = document.createElement("h4");
    h.textContent = `Questão ${idx+1}`;
    const p = document.createElement("div");
    p.className = "qText";
    p.textContent = item.q;

    block.appendChild(h);
    block.appendChild(p);

    item.a.forEach((txt, i)=>{
      const lab = document.createElement("label");
      lab.className = "opt";

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "q" + idx;
      radio.value = String(i);

      radio.addEventListener("change", ()=>{
        provaAnswers[idx] = i;
      });

      const body = document.createElement("div");
      body.innerHTML = `<div style="font-weight:900">${String.fromCharCode(65+i)})</div><div class="muted">${txt}</div>`;

      lab.appendChild(radio);
      lab.appendChild(body);

      block.appendChild(lab);
    });

    grid.appendChild(block);
  });

  setText("provaStatus", "Marque as alternativas e clique em Corrigir.");
}

function gradeProva(){
  const total = provaItems.length;
  let answered = 0;
  let correct = 0;

  for(let i=0;i<total;i++){
    if(provaAnswers.hasOwnProperty(i)){
      answered++;
      if(provaAnswers[i] === provaItems[i].correct) correct++;
    }
  }

  if(answered < total){
    alert("Marque todas as questões para corrigir.");
    return;
  }

  const score10 = Math.round((correct/total)*10);
  setLast(score10);

  const best = Math.max(getBest(), score10);
  setBest(best);

  pushHistory({
    at: now(),
    last: score10,
    best: best,
    correct,
    total,
    oral: readJSON(STORE.ORAL, null),
    tokens: getTokens()
  });

  setText("kLast", `${score10}/10`);
  setText("kBest", `${best}/10`);

  setText("provaStatus", `Você tirou ${score10}/10. Refaça para melhorar sua maior nota.`);
  try{ alert(`Nota: ${score10}/10`); }catch{}

  updateTopPills();
}

function newTry(){
  setTry(getTry()+1);
  updateTopPills();
  renderProva();
}


// ------------------------------
// Relatório do aluno
// ------------------------------
function buildAlunoReport(){
  const prof = getProfile();
  const oral = readJSON(STORE.ORAL, null);

  const best = getBest();
  const last = getLast();
  const sess = localStorage.getItem(STORE.SESSION);

  const text =
`VIBRAÇÕES DE LEÃO — RELATÓRIO

Data/Hora: ${new Date().toLocaleString()}
Sessão: ${sess}

Aluno:
- Nome: ${prof.name || "(não informado)"}
- Turma: ${prof.turma || "(não informado)"}

Prova:
- Última nota: ${last}/10
- Melhor nota: ${best}/10
- Tentativa: ${getTry()}

Fase oral (resumo de fala):
- Janelas gravadas: ${oral?.totalWindows ?? 0}
- Total de palavras: ${oral?.totalWords ?? 0}
- Tempo total falado (s): ${Number(oral?.totalSec ?? 0).toFixed(1)}
- Ritmo médio (pal/min): ${Number(oral?.avgWpm ?? 0).toFixed(0)}
- Fluidez média: ${Number(oral?.avgContinuity ?? 0).toFixed(2)}
- Constância média: ${Number(oral?.avgCalmness ?? 0).toFixed(2)}

Leitura sugerida:
- Se o ritmo estiver baixo, fale mais perto do microfone e complete frases curtas.
- Se a fluidez estiver baixa, tente falar sem parar por alguns segundos.
- Se a constância estiver baixa, respire e responda com calma.

Fechamento:
Obrigado pela presença e pelo esmero.
`;

  return text;
}

// ------------------------------
// Relatório coordenação (anonimizado) + baixar/copy + bônus token
// ------------------------------
function buildCoordJSON(){
  const h = readJSON(STORE.HISTORY, []);
  const lastH = h[0] || null;
  const oral = readJSON(STORE.ORAL, null);

  return {
    app: "vibracoes-de-leao",
    generatedAt: new Date().toISOString(),
    session: localStorage.getItem(STORE.SESSION),
    prova: {
      last: getLast(),
      best: getBest(),
      tentativa: getTry(),
      lastCorrect: lastH?.correct ?? null,
      lastTotal: lastH?.total ?? null
    },
    oral: oral ? {
      totalWindows: oral.totalWindows,
      totalWords: oral.totalWords,
      totalSec: Number(oral.totalSec.toFixed(1)),
      avgWpm: Number(oral.avgWpm.toFixed(0)),
      avgContinuity: Number(oral.avgContinuity.toFixed(2)),
      avgCalmness: Number(oral.avgCalmness.toFixed(2))
    } : null,
    // sem nome, sem turma, sem áudio
    notes: "Relatório anonimizável para ações pedagógicas coletivas."
  };
}

function downloadText(filename, content){
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1200);
}

async function copyToClipboard(text){
  try{
    await navigator.clipboard.writeText(text);
    return true;
  }catch{
    return false;
  }
}

// ------------------------------
// Inicializadores por página
// ------------------------------
function initHome(){
  buildBars();
  updateTopPills();

  // restaura profile
  const prof = getProfile();
  const name = $("inpName");
  const turma = $("inpClass");
  if(name && !name.value) name.value = prof.name || "";
  if(turma && !turma.value) turma.value = prof.turma || "";

  $("btnGoOral")?.addEventListener("click", ()=>{
    setProfile(name?.value || "", turma?.value || "");
    window.location.href = "./oral.html";
  });

  $("btnResetAll")?.addEventListener("click", ()=>{
    if(confirm("Zerar notas, tokens e históricos neste dispositivo?")){
      resetAll();
      updateTopPills();
      buildBars();
      alert("Tudo zerado.");
    }
  });
}

function initOral(){
  buildBars();
  updateTopPills();
  initSession();

  // perfil já salvo no home; se vier direto, mantém
  startOralClock();
  restartOral();
  oralSetQuestion();
  setMicLabel();

  // botões
  $("btnMicToggle")?.addEventListener("click", async ()=>{
    await toggleMic();
    setMicLabel();
    updateTopPills();
    if(micEnabled){
      $("btnRec")?.classList.remove("disabled");
    }else{
      $("btnRec")?.classList.add("disabled");
    }
  });

  $("btnRec")?.addEventListener("click", ()=>{
    if($("btnRec")?.classList.contains("disabled")) return;
    startRecording();
  });

  $("btnStop")?.addEventListener("click", ()=>{
    stopRecording(true);
  });

  $("btnSkip")?.addEventListener("click", ()=>{
    // pular sem gravar: pequenas quedas, mas segue
    decayBars();
    nextOralQuestion();
  });

  $("btnRestartOral")?.addEventListener("click", ()=>{
    if(confirm("Recomeçar fase oral?")){
      stopRecording(true);
      restartOral();
    }
  });

  $("btnGoProva")?.addEventListener("click", ()=>{
    if($("btnGoProva")?.classList.contains("disabled")){
      alert("Conclua a fase oral (3 perguntas) para liberar.");
      return;
    }
    window.location.href = "./prova.html";
  });

  // loop de decaimento suave quando parado
  setInterval(()=>{
    if(!isRecording) decayBars();
  }, 120);

  // dica: se microfone ficar ligado, manter; se quiser desligar, usuário desliga
}

function initProva(){
  updateTopPills();
  initSession();

  // custo de token para iniciar prova (se quiser “modo escola”: sempre deixa)
  // aqui: se tokens 0, ainda deixa fazer a prova (não trava escola).
  // mas tokens continuam existindo como motivação.
  renderProva();

  $("btnCorrigir")?.addEventListener("click", gradeProva);
  $("btnNova")?.addEventListener("click", newTry);
}

function initRelatorio(){
  updateTopPills();
  initSession();

  const box = $("relBox");
  const btnGerar = $("btnGerarRel");
  const btnCopiar = $("btnCopiarRel");

  btnGerar?.addEventListener("click", ()=>{
    const txt = buildAlunoReport();
    if(box) box.value = txt;
    btnCopiar?.classList.remove("disabled");
    updateTopPills();
  });

  btnCopiar?.addEventListener("click", async ()=>{
    if(btnCopiar.classList.contains("disabled")) return;
    const ok = await copyToClipboard(box?.value || "");
    if(ok) alert("Relatório copiado.");
    else alert("Não foi possível copiar. Selecione o texto e copie manualmente.");
  });

  $("btnLimparNotas")?.addEventListener("click", ()=>{
    if(confirm("Limpar notas e histórico (mantém perfil e config)?")){
      localStorage.removeItem(STORE.BEST);
      localStorage.removeItem(STORE.LAST);
      localStorage.removeItem(STORE.HISTORY);
      setTry(1);
      updateTopPills();
      if(box) box.value = "";
      btnCopiar?.classList.add("disabled");
      alert("Notas limpas.");
    }
  });
}

function initCoord(){
  updateTopPills();
  const sess = initSession();
  setText("kSess", sess);

  const box = $("coordBox");
  const btnGerar = $("btnGerarCoord");
  const btnCopiar = $("btnCopiarCoord");
  const btnBaixar = $("btnBaixarCoord");
  const btnBonus = $("btnEnviarToken");

  btnGerar?.addEventListener("click", ()=>{
    const obj = buildCoordJSON();
    const txt = JSON.stringify(obj, null, 2);
    if(box) box.value = txt;

    btnCopiar?.classList.remove("disabled");
    btnBaixar?.classList.remove("disabled");
    btnBonus?.classList.remove("disabled");

    updateTopPills();
  });

  btnCopiar?.addEventListener("click", async ()=>{
    if(btnCopiar.classList.contains("disabled")) return;
    const ok = await copyToClipboard(box?.value || "");
    if(ok) alert("JSON copiado.");
    else alert("Não foi possível copiar. Selecione o texto e copie manualmente.");
  });

  btnBaixar?.addEventListener("click", ()=>{
    if(btnBaixar.classList.contains("disabled")) return;
    const content = box?.value || "";
    if(!content.trim()){
      alert("Gere o relatório primeiro.");
      return;
    }
    downloadText(`coordenacao-${sess}.json`, content);
  });

  btnBonus?.addEventListener("click", ()=>{
    if(btnBonus.classList.contains("disabled")) return;

    // bônus de 1 token uma vez por sessão
    const key = STORE.COORD_SENT + ":" + sess;
    if(localStorage.getItem(key)){
      alert("Bônus já aplicado nesta sessão.");
      return;
    }
    if(confirm("Confirmar participação com a coordenação? (ganha +1 token)")){
      localStorage.setItem(key, "1");
      setTokens(getTokens() + 1);
      updateTopPills();
      alert("Obrigado. +1 token.");
    }
  });
}

function initConfig(){
  updateTopPills();
  initSession();

  const cfg = getCfg();
  const maxSec = $("cfgMaxSec");
  const goalSec = $("cfgGoalSec");
  const target = $("cfgTarget");
  const gain = $("cfgGain");

  if(maxSec) maxSec.value = String(cfg.maxOralSec);
  if(goalSec) goalSec.value = String(cfg.goalSec);
  if(target) target.value = String(cfg.targetLine);
  if(gain) gain.value = String(cfg.talkGain);

  $("btnSaveCfg")?.addEventListener("click", ()=>{
    const next = {
      maxOralSec: Number(maxSec?.value || DEFAULT_CONFIG.maxOralSec),
      goalSec: Number(goalSec?.value || DEFAULT_CONFIG.goalSec),
      targetLine: Number(target?.value || DEFAULT_CONFIG.targetLine),
      talkGain: Number(gain?.value || DEFAULT_CONFIG.talkGain)
    };

    // limites
    next.maxOralSec = Math.max(8, Math.min(45, next.maxOralSec));
    next.goalSec = Math.max(2, Math.min(10, next.goalSec));
    next.targetLine = Math.max(0.40, Math.min(0.90, next.targetLine));
    next.talkGain = Math.max(1, Math.min(3, next.talkGain));

    setCfg(next);
    alert("Configurações salvas.");
  });

  $("btnResetCfg")?.addEventListener("click", ()=>{
    if(confirm("Restaurar padrão?")){
      setCfg(DEFAULT_CONFIG);
      alert("Padrão restaurado.");
      window.location.reload();
    }
  });
}

// ------------------------------
// Boot
// ------------------------------
document.addEventListener("DOMContentLoaded", ()=>{
  ensureTokens();
  initSession();
  updateTopPills();
  buildBars();

  // home: salvar profile se existir input
  if(document.body.dataset.page === "home"){
    initHome();
    return;
  }

  // oral: precisa de profile? se veio direto, ok
  if(document.body.dataset.page === "oral"){
    initOral();
    return;
  }

  if(document.body.dataset.page === "prova"){
    initProva();
    return;
  }

  if(document.body.dataset.page === "relatorio"){
    initRelatorio();
    return;
  }

  if(document.body.dataset.page === "coord"){
    initCoord();
    return;
  }

  if(document.body.dataset.page === "config"){
    initConfig();
    return;
  }
});