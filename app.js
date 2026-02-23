// Vibrações de Leão — compatível com index atual

const STORE = {
  BEST: "vdl_best",
  TOKENS: "vdl_tokens",
  TRY: "vdl_try"
};

function $(id){ return document.getElementById(id); }
function clamp01(x){ return Math.max(0, Math.min(1,x)); }
function now(){ return Date.now(); }

// =====================
// INIT
// =====================
document.addEventListener("DOMContentLoaded", ()=>{
  init();
});

function init(){
  if(!localStorage.getItem(STORE.TOKENS)){
    localStorage.setItem(STORE.TOKENS,"3");
  }
  if(!localStorage.getItem(STORE.BEST)){
    localStorage.setItem(STORE.BEST,"0");
  }
  if(!localStorage.getItem(STORE.TRY)){
    localStorage.setItem(STORE.TRY,"1");
  }

  $("kTokens").textContent = localStorage.getItem(STORE.TOKENS);
  $("kBest").textContent = localStorage.getItem(STORE.BEST)+"/10";
  $("kDate").textContent = new Date().toLocaleDateString();
  $("kTry").textContent = localStorage.getItem(STORE.TRY);

  buildBars();

  $("btnStart").onclick = startOral;
  $("btnMic").onclick = enableMic;
  $("btnRec").onclick = recordAnswer;
  $("btnSkip").onclick = nextQuestion;
  $("btnEndOral").onclick = endOral;
  $("btnGoWrite").onclick = startWritten;
  $("btnGrade").onclick = gradeTest;
  $("btnNewTry").onclick = newTry;
  $("btnBackOral").onclick = backToOral;
  $("btnGoCoord").onclick = ()=>show("coordArea");
  $("btnBackApp").onclick = ()=>show("oralArea");
  $("btnBuildReport").onclick = buildCoordReport;
  $("btnCopyReport").onclick = copyReport;
  $("btnDownloadReport").onclick = downloadReport;
  $("btnResetAll").onclick = resetAll;
}

// =====================
// TELA CONTROL
// =====================
function show(id){
  ["oralArea","writeArea","coordArea"].forEach(s=>{
    $(s).classList.add("hide");
  });
  if($(id)) $(id).classList.remove("hide");
}

// =====================
// ORAL
// =====================
const QUESTIONS = [
  "O que é algoritmo?",
  "O que é variável?",
  "Conte de 1 até 10.",
  "Explique o que é um passo a passo.",
  "Fale algo que você aprendeu hoje."
];

let qIndex = 0;
let micOn = false;
let audioCtx, analyser, dataArray, raf;
let hold = {foco:0,constancia:0,harmonia:0};
let goals = {g1:false,g2:false,g3:false};
const HOLD_SEC = 4;
const TARGET = 0.65;

function startOral(){
  show("oralArea");
  qIndex = 0;
  $("qText").textContent = QUESTIONS[qIndex];
  $("qPos").textContent = "1/5";
}

function nextQuestion(){
  qIndex++;
  if(qIndex>=QUESTIONS.length){
    $("btnGoWrite").classList.remove("disabled");
    alert("Fase oral concluída.");
    return;
  }
  $("qText").textContent = QUESTIONS[qIndex];
  $("qPos").textContent = (qIndex+1)+"/5";
}

function endOral(){
  $("btnGoWrite").classList.remove("disabled");
}

async function enableMic(){
  const stream = await navigator.mediaDevices.getUserMedia({audio:true});
  audioCtx = new AudioContext();
  analyser = audioCtx.createAnalyser();
  const src = audioCtx.createMediaStreamSource(stream);
  src.connect(analyser);
  dataArray = new Uint8Array(analyser.frequencyBinCount);
  micOn = true;
  $("micState").textContent="ligado";
  loopBars();
}

function recordAnswer(){
  if(!micOn) return alert("Ative o microfone primeiro");
  const start = now();
  let words=0;

  const interval = setInterval(()=>{
    const sec = (now()-start)/1000;
    $("kDur").textContent = sec.toFixed(1);
    words += Math.random()*2;
    $("kWords").textContent = Math.floor(words);
    $("kWpm").textContent = Math.floor(words*6);
  },500);

  setTimeout(()=>{
    clearInterval(interval);
    nextQuestion();
  },15000);
}

// =====================
// BARRAS
// =====================
const METRICS = ["presenca","impulso","fluxo","constancia","pausa","entonacao","foco","harmonia"];
let bars = {};

function buildBars(){
  const list = $("barList");
  list.innerHTML="";
  METRICS.forEach(m=>{
    bars[m]=0;
    const row = document.createElement("div");
    row.className="barRow";
    row.innerHTML=`
      <div class="barLabel">${m}</div>
      <div class="track">
        <div class="fill" id="fill_${m}"></div>
        <div class="targetLine"></div>
      </div>
      <div class="val" id="val_${m}">0.00</div>
    `;
    list.appendChild(row);
  });
}

function loopBars(){
  if(!micOn) return;
  analyser.getByteFrequencyData(dataArray);
  const energy = dataArray.reduce((a,b)=>a+b,0)/dataArray.length/255;

  METRICS.forEach(m=>{
    const target = clamp01(energy + Math.random()*0.1);
    bars[m] += (target - bars[m])*(target>bars[m]?0.3:0.05);
    $("fill_"+m).style.width=(bars[m]*100)+"%";
    $("val_"+m).textContent=bars[m].toFixed(2);
  });

  checkGoals();
  raf=requestAnimationFrame(loopBars);
}

function checkGoals(){
  if(bars.foco> TARGET) hold.foco+=1/45; else hold.foco*=0.9;
  if(bars.constancia> TARGET) hold.constancia+=1/45; else hold.constancia*=0.9;
  if(bars.harmonia> TARGET) hold.harmonia+=1/45; else hold.harmonia*=0.9;

  if(!goals.g1 && hold.foco>HOLD_SEC){ goals.g1=true; $("m1Dot").classList.add("ok"); }
  if(!goals.g2 && hold.constancia>HOLD_SEC){ goals.g2=true; $("m2Dot").classList.add("ok"); }
  if(!goals.g3 && hold.harmonia>HOLD_SEC){ goals.g3=true; $("m3Dot").classList.add("ok"); }

  if(goals.g1 && goals.g2 && goals.g3){
    let t = Number(localStorage.getItem(STORE.TOKENS));
    localStorage.setItem(STORE.TOKENS,String(t+1));
    $("kTokens").textContent=t+1;
  }
}

// =====================
// ESCRITA
// =====================
const TEST = [
  {q:"Algoritmo é:",a:["Passo a passo","Computador","Teclado"],c:0},
  {q:"Bit é:",a:["0 ou 1","Cabo","Tela"],c:0},
  {q:"Variável é:",a:["Espaço para guardar valor","Mouse","Som"],c:0}
];

function startWritten(){
  show("writeArea");
  renderTest();
}

function renderTest(){
  const grid=$("writeGrid");
  grid.innerHTML="";
  TEST.forEach((item,i)=>{
    const div=document.createElement("div");
    div.className="questionBlock";
    div.innerHTML=`<h4>${item.q}</h4>`;
    item.a.forEach((opt,j)=>{
      div.innerHTML+=`
        <label class="opt">
          <input type="radio" name="q${i}" value="${j}"> ${opt}
        </label>`;
    });
    grid.appendChild(div);
  });
}

function gradeTest(){
  let score=0;
  TEST.forEach((item,i)=>{
    const checked=document.querySelector(`input[name="q${i}"]:checked`);
    if(checked && Number(checked.value)===item.c) score++;
  });
  const final=Math.round(score/TEST.length*10);
  $("writeStatus").textContent="Nota: "+final+"/10";

  let best=Number(localStorage.getItem(STORE.BEST));
  if(final>best){
    localStorage.setItem(STORE.BEST,String(final));
    $("kBest").textContent=final+"/10";
  }
}

// =====================
// COORDENAÇÃO
// =====================
function buildCoordReport(){
  const data={
    app:"vibracoes-de-leao",
    date:new Date().toISOString(),
    best:Number(localStorage.getItem(STORE.BEST)),
    tokens:Number(localStorage.getItem(STORE.TOKENS))
  };
  $("reportBox").value=JSON.stringify(data,null,2);
  $("btnCopyReport").classList.remove("disabled");
  $("btnDownloadReport").classList.remove("disabled");
}

function copyReport(){
  navigator.clipboard.writeText($("reportBox").value);
}

function downloadReport(){
  const blob=new Blob([$("reportBox").value],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="relatorio.json";
  a.click();
}

// =====================
// RESET
// =====================
function resetAll(){
  localStorage.clear();
  location.reload();
}

function backToOral(){
  show("oralArea");
}