// assets/app.js
(function(){
  const cv = document.getElementById("cv");
  const ctx = cv.getContext("2d");

  const pillTime = document.getElementById("pillTime");
  const pillToken = document.getElementById("pillToken");
  const pillMic = document.getElementById("pillMic");
  const pillScore = document.getElementById("pillScore");
  const pillGoal = document.getElementById("pillGoal");

  const btnStart = document.getElementById("btnStart");
  const btnPause = document.getElementById("btnPause");
  const btnStop = document.getElementById("btnStop");
  const btnSnapshot = document.getElementById("btnSnapshot");

  const elWho = document.getElementById("who");
  const elMode = document.getElementById("mode");

  const MAX_SEC = 5 * 60;
  const FPS = 30;
  const SMOOTH_DECAY = 0.985; // queda lenta
  const TARGET_ALPHA = 0.8;

  // 8 linhas: RMS + 7 bandas (aprox)
  const LINES = [
    { name:"RMS",   band:null },
    { name:"20–60Hz",  band:[20,60] },
    { name:"60–120Hz", band:[60,120] },
    { name:"120–250Hz",band:[120,250] },
    { name:"250–500Hz",band:[250,500] },
    { name:"500–1kHz", band:[500,1000] },
    { name:"1–2kHz",   band:[1000,2000] },
    { name:"2–4kHz",   band:[2000,4000] },
  ];

  // metas por modo (heurísticas)
  function getGoal(mode){
    if(mode==="presenca") return 62;
    if(mode==="foco") return 68;
    if(mode==="harmonia") return 65;
    return 65;
  }

  let audioCtx=null, analyser=null, stream=null, src=null;
  let running=false, paused=false;
  let t0=0, lastFrame=0;
  let earnedLock=false;

  const tokens = LV.getTokens();
  pillToken.textContent = `Tokens: ${tokens.tokens}`;

  // buffers para últimos 5min (amostragem por frame)
  const buf = LINES.map(()=>[]);
  const bufMax = MAX_SEC * FPS;

  // valores “com decay”
  const cur = new Array(LINES.length).fill(0);

  function fmtTime(ms){
    const s = Math.max(0, Math.floor(ms/1000));
    const mm = String(Math.floor(s/60)).padStart(2,"0");
    const ss = String(s%60).padStart(2,"0");
    return `${mm}:${ss}`;
  }

  function clamp01(x){ return Math.max(0, Math.min(1, x)); }
  function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }

  function resizeCanvas(){
    // mantém resolução boa
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth || 900;
    const h = Math.round(w * 0.46);
    cv.width = Math.floor(w * dpr);
    cv.height = Math.floor(h * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  function bandEnergy(freqData, sampleRate, fftSize, f1, f2){
    // freq bin width = sampleRate/fftSize
    const binHz = sampleRate / fftSize;
    const i1 = Math.floor(f1 / binHz);
    const i2 = Math.floor(f2 / binHz);
    let sum = 0;
    let n = 0;
    for(let i=i1; i<=i2 && i<freqData.length; i++){
      sum += freqData[i];
      n++;
    }
    return n ? (sum/n) : 0;
  }

  function draw(goalScore){
    const W = cv.clientWidth || 900;
    const H = Math.round(W * 0.46);

    ctx.clearRect(0,0,W,H);

    // fundo leve
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0,0,W,H);

    // grid horizontal
    ctx.strokeStyle = "#00000010";
    ctx.lineWidth = 1;
    for(let i=1;i<5;i++){
      const y = (H*i)/5;
      ctx.beginPath();
      ctx.moveTo(0,y);
      ctx.lineTo(W,y);
      ctx.stroke();
    }

    // meta (tracejado): transformamos score meta (0..100) em y
    const yGoal = H - (goalScore/100)*H;
    ctx.save();
    ctx.setLineDash([6,6]);
    ctx.strokeStyle = "#2a6f88";
    ctx.globalAlpha = TARGET_ALPHA;
    ctx.beginPath();
    ctx.moveTo(0, yGoal);
    ctx.lineTo(W, yGoal);
    ctx.stroke();
    ctx.restore();

    // linhas (8)
    // cada linha fica em “faixa” vertical própria (8 faixas)
    const laneH = H / LINES.length;
    for(let i=0;i<LINES.length;i++){
      const top = i*laneH;
      const mid = top + laneH/2;

      // rótulo
      ctx.fillStyle = "#2b4d5b";
      ctx.globalAlpha = 0.85;
      ctx.font = "12px system-ui";
      ctx.fillText(`${i}) ${LINES[i].name}`, 10, top+14);

      // baseline
      ctx.strokeStyle = "#00000012";
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(0, mid);
      ctx.lineTo(W, mid);
      ctx.stroke();

      // série: desenha apenas parte do buffer (últimos N pontos)
      const series = buf[i];
      const n = series.length;
      if(n < 2) continue;

      const maxPoints = Math.min(n, W); // 1px por ponto
      const start = n - maxPoints;

      ctx.strokeStyle = "#111111";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for(let k=0; k<maxPoints; k++){
        const x = (k/(maxPoints-1)) * (W-1);
        // valor (0..1) vira deslocamento vertical dentro da faixa
        const v = series[start+k];
        const y = top + (1 - v) * (laneH-18) + 18; // margem topo
        if(k===0) ctx.moveTo(x,y);
        else ctx.lineTo(x,y);
      }
      ctx.stroke();
    }

    // legenda geral no canto
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#2b4d5b";
    ctx.font = "12px system-ui";
    ctx.fillText("Meta (tracejado) • Quanto mais acima do tracejado, melhor o score", 10, H-10);
  }

  function computeScore(normVals, mode){
    // score simples: combina estabilidade (variância baixa) + presença (RMS moderado)
    // normVals: 8 valores 0..1 (após normalização)
    const rms = normVals[0];
    let bandSum = 0;
    for(let i=1;i<normVals.length;i++) bandSum += normVals[i];
    const bandAvg = bandSum / (normVals.length-1);

    // penaliza extremos: muito baixo ou muito alto
    const rmsIdeal = mode==="presenca" ? 0.35 : (mode==="foco" ? 0.45 : 0.40);
    const rmsPenalty = Math.abs(rms - rmsIdeal); // 0..~1
    const rmsScore = clamp01(1 - rmsPenalty*1.6);

    // equilíbrio de bandas: mais “liso” (harmonia)
    const spread = Math.max(...normVals.slice(1)) - Math.min(...normVals.slice(1));
    const harmony = clamp01(1 - spread*1.8);

    // pausa: usa banda baixa como proxy (quanto menos “agitação”, mais controle)
    const calm = clamp01(1 - bandAvg*0.9);

    let s = 0;
    if(mode==="presenca") s = 0.55*rmsScore + 0.30*calm + 0.15*harmony;
    else if(mode==="foco") s = 0.55*rmsScore + 0.25*harmony + 0.20*(1 - calm); // foco tolera energia
    else s = 0.40*rmsScore + 0.35*harmony + 0.25*calm;

    return Math.round(clamp(s*100, 0, 100));
  }

  function pushBuf(i, v){
    const a = buf[i];
    a.push(v);
    if(a.length > bufMax) a.splice(0, a.length - bufMax);
  }

  function snapshotReport(){
    // pega os últimos 5 min (ou menos) e salva em relatório
    const now = Date.now();
    const who = (elWho.value || "").trim() || "(anônimo)";
    const mode = elMode.value;
    const goal = getGoal(mode);

    // comprime série para 900px (amostragem)
    const W = 900;
    const outSeries = buf.map(series=>{
      const n = series.length;
      if(n<=W) return series.slice();
      const step = n / W;
      const xs = [];
      for(let i=0;i<W;i++){
        xs.push(series[Math.floor(i*step)]);
      }
      return xs;
    });

    // texto curto
    const t = LV.getTokens();
    const scoreNow = pillScore.textContent.replace("Score: ","");

    const text =
`LION VIBES — RELATÓRIO (DEMO)
Data/hora: ${new Date(now).toLocaleString()}
Pessoa: ${who}
Modo: ${mode}
Meta (score): ${goal}
Score no momento do snapshot: ${scoreNow}

Nota:
- Isto é feedback heurístico de ritmo/áudio (não é clínica, não é diagnóstico).
- Use como espelho de treino: pausa, constância, clareza e presença.`;

    const rep = {
      id: Math.random().toString(16).slice(2) + "-" + now.toString(16),
      at: now,
      who,
      mode,
      goal,
      series: outSeries, // 8xN
      text
    };

    const list = LV.loadReports();
    list.unshift(rep);
    LV.saveReports(list);

    alert("Relatório salvo. Abra em Relatórios.");
  }

  function setButtons(){
    btnPause.disabled = !running;
    btnStop.disabled = !running;
    btnSnapshot.disabled = !(running || paused);
  }

  async function startMic(){
    if(running) return;
    try{
      stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.15;

      src = audioCtx.createMediaStreamSource(stream);
      src.connect(analyser);

      running = true;
      paused = false;
      earnedLock = false;

      t0 = performance.now();
      lastFrame = 0;

      pillMic.textContent = "Mic: on";
      pillMic.classList.remove("warn");
      pillMic.classList.add("ok");

      btnStart.textContent = "Microfone ativo";
      btnStart.disabled = true;

      setButtons();
      requestAnimationFrame(loop);
    }catch(e){
      alert("Falhou o acesso ao microfone. Verifique permissões do navegador.");
      console.error(e);
    }
  }

  function pauseToggle(){
    if(!running && !paused) return;
    paused = !paused;
    if(paused){
      running = false;
      pillMic.textContent = "Mic: pausado";
      pillMic.classList.remove("ok");
      pillMic.classList.add("warn");
    }else{
      running = true;
      pillMic.textContent = "Mic: on";
      pillMic.classList.remove("warn");
      pillMic.classList.add("ok");
      requestAnimationFrame(loop);
    }
    btnPause.textContent = paused ? "Retomar" : "Pausar";
    setButtons();
  }

  function stopAll(){
    running = false;
    paused = false;

    if(stream){
      stream.getTracks().forEach(t=>t.stop());
      stream = null;
    }
    if(audioCtx){
      audioCtx.close();
      audioCtx = null;
    }
    analyser = null;
    src = null;

    pillMic.textContent = "Mic: off";
    pillMic.classList.remove("ok");
    pillMic.classList.add("warn");

    btnStart.disabled = false;
    btnStart.textContent = "Iniciar microfone";
    btnPause.textContent = "Pausar";

    setButtons();
  }

  function loop(ts){
    if(!running) return;

    const elapsed = ts - t0;
    pillTime.textContent = fmtTime(elapsed);

    // para “gravar” no máximo 5 min (mas você pode pausar/retomar)
    if(elapsed/1000 > MAX_SEC){
      // ainda deixa rodando visualmente, mas congela o buffer (fica no limite)
      // opção: encerrar automático — mas vou manter “manso”:
      // stopAll(); return;
    }

    // limita FPS
    if(ts - lastFrame < (1000/FPS)){
      requestAnimationFrame(loop);
      return;
    }
    lastFrame = ts;

    // captura espectro
    const freq = new Uint8Array(analyser.frequencyBinCount);
    const time = new Uint8Array(analyser.fftSize);
    analyser.getByteFrequencyData(freq);
    analyser.getByteTimeDomainData(time);

    // RMS em time domain
    let sumSq = 0;
    for(let i=0;i<time.length;i++){
      const v = (time[i]-128)/128;
      sumSq += v*v;
    }
    const rms = Math.sqrt(sumSq / time.length); // 0..1 aprox

    // band energies (0..255) -> normaliza 0..1
    const sr = audioCtx.sampleRate;
    const fftSize = analyser.fftSize;
    const vals = new Array(LINES.length).fill(0);

    vals[0] = clamp01(rms*2.2); // normalização heurística

    for(let i=1;i<LINES.length;i++){
      const [f1,f2] = LINES[i].band;
      const e = bandEnergy(freq, sr, fftSize, f1, f2);
      vals[i] = clamp01((e/255) * 1.6);
    }

    // aplica decay (queda lenta) e guarda no buffer
    for(let i=0;i<vals.length;i++){
      cur[i] = Math.max(vals[i], cur[i] * SMOOTH_DECAY);
      pushBuf(i, cur[i]);
    }

    // score e token
    const mode = elMode.value;
    const goal = getGoal(mode);
    const score = computeScore(cur, mode);

    pillScore.textContent = `Score: ${score}`;
    pillGoal.textContent = `Meta: ${goal}`;

    // ganha token se manter score acima da meta por “janela”
    // (aqui: se ficar acima por ~3s, trava e dá token 1x por sessão)
    if(score >= goal){
      if(!earnedLock){
        // conta frames acima
        LV._above = (LV._above || 0) + 1;
        if(LV._above >= (FPS*3)){
          const ok = LV.bumpToken();
          const t = LV.getTokens();
          pillToken.textContent = `Tokens: ${t.tokens}`;
          if(ok) alert("Token conquistado (demo). Você manteve a meta por alguns segundos.");
          earnedLock = true;
        }
      }
    }else{
      LV._above = 0;
    }

    draw(goal);

    requestAnimationFrame(loop);
  }

  btnStart.addEventListener("click", startMic);
  btnPause.addEventListener("click", pauseToggle);
  btnStop.addEventListener("click", ()=>{
    stopAll();
    alert("Sessão encerrada. Você pode salvar relatório (últimos 5 min) ou iniciar outra.");
  });
  btnSnapshot.addEventListener("click", snapshotReport);

  // inicial
  setButtons();
})();