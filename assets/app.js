/* Lion Vibes — Prova Vale 10 (Demo)
   - Static (GitHub Pages)
   - Sem backend
   - Armazena tentativas no localStorage
   - Repetição ilimitada, guarda maior nota
*/

(function () {
  const LS_KEY = "lionvibes_quiz_attempts_v1";
  const LS_CFG = "lionvibes_quiz_cfg_v1";

  // ========= QUESTÕES (programação básica) =========
  // Nota total = 10 (distribuída igualmente)
  const QUESTIONS = [
    {
      id: "q1",
      type: "mcq",
      title: "Variáveis",
      prompt: "Qual opção é uma declaração válida de variável em JavaScript?",
      options: [
        { k: "a", t: "var = idade 10;" },
        { k: "b", t: "let idade = 10;" },
        { k: "c", t: "idade := 10" },
        { k: "d", t: "set idade 10" },
      ],
      answer: "b",
      why: "Em JavaScript, você pode declarar com let/const/var. Ex.: let idade = 10;"
    },
    {
      id: "q2",
      type: "mcq",
      title: "Condição (if)",
      prompt: "Qual trecho imprime 'OK' apenas quando x é maior que 5?",
      options: [
        { k: "a", t: "if (x = 5) console.log('OK')" },
        { k: "b", t: "if (x > 5) console.log('OK')" },
        { k: "c", t: "if (x < 5) console.log('OK')" },
        { k: "d", t: "if (x => 5) console.log('OK')" },
      ],
      answer: "b",
      why: "O operador correto para 'maior que' é >. E cuidado: '=' é atribuição, não comparação."
    },
    {
      id: "q3",
      type: "short",
      title: "Função",
      prompt: "Complete: uma função que soma a e b e retorna o resultado. Escreva só a linha do retorno.",
      placeholder: "Ex: return a + b;",
      answer: (txt) => normalize(txt) === "return a + b;",
      sample: "return a + b;",
      why: "Uma função soma e retorna com: return a + b;"
    },
    {
      id: "q4",
      type: "mcq",
      title: "Laço (for)",
      prompt: "Quantas vezes o console.log roda neste código?\nfor (let i=0; i<3; i++) { console.log(i); }",
      options: [
        { k: "a", t: "1 vez" },
        { k: "b", t: "2 vezes" },
        { k: "c", t: "3 vezes" },
        { k: "d", t: "4 vezes" },
      ],
      answer: "c",
      why: "i assume valores 0,1,2. Então roda 3 vezes."
    },
    {
      id: "q5",
      type: "short",
      title: "String",
      prompt: "Como você escreve em JS uma string com o texto: Olá, mundo ? (use aspas).",
      placeholder: "Ex: \"Olá, mundo\"",
      answer: (txt) => {
        const n = normalize(txt);
        return n === "\"olá, mundo\"" || n === "'olá, mundo'";
      },
      sample: "\"Olá, mundo\"",
      why: "Strings em JS podem usar aspas simples ou duplas."
    }
  ];

  // ========= ELEMENTOS =========
  const $ = (id) => document.getElementById(id);

  const elSetup = $("setup");
  const elQuiz = $("quiz");
  const elResults = $("results");
  const elReports = $("reports");

  const pillDate = $("pillDate");
  const pillBest = $("pillBest");
  const pillAttempts = $("pillAttempts");

  const studentName = $("studentName");
  const turma = $("turma");
  const examTitle = $("examTitle");
  const examDate = $("examDate");
  const mode = $("mode");

  const btnStart = $("btnStart");
  const btnGoReports = $("btnGoReports");

  const timerEl = $("timer");
  const progressEl = $("progress");
  const host = $("questionHost");
  const btnPrev = $("btnPrev");
  const btnNext = $("btnNext");
  const btnQuit = $("btnQuit");

  const resultMeta = $("resultMeta");
  const kScore = $("kScore");
  const kBest = $("kBest");
  const feedback = $("feedback");
  const btnRetry = $("btnRetry");
  const btnBackHome = $("btnBackHome");
  const btnReview = $("btnReview");
  const reviewBox = $("reviewBox");

  const reportHost = $("reportHost");
  const btnBackFromReports = $("btnBackFromReports");
  const btnClearAll = $("btnClearAll");

  // ========= ESTADO =========
  let idx = 0;
  let answers = {};
  let startedAt = 0;
  let timerInt = null;

  // ========= BOOT =========
  loadCfg();
  updatePills();

  btnStart.addEventListener("click", startQuiz);
  btnGoReports.addEventListener("click", () => show("reports"));

  btnPrev.addEventListener("click", () => go(-1));
  btnNext.addEventListener("click", () => go(+1));
  btnQuit.addEventListener("click", quitAndSave);

  btnRetry.addEventListener("click", () => {
    // refaz mantendo cadastro
    show("setup");
  });

  btnBackHome.addEventListener("click", () => show("setup"));

  btnReview.addEventListener("click", () => {
    reviewBox.style.display = (reviewBox.style.display === "none") ? "block" : "none";
  });

  btnBackFromReports.addEventListener("click", () => show("setup"));
  btnClearAll.addEventListener("click", () => {
    if (!confirm("Apagar TODO o histórico deste dispositivo?")) return;
    localStorage.removeItem(LS_KEY);
    updatePills();
    renderReports();
    alert("Histórico apagado.");
  });

  examDate.addEventListener("change", saveCfg);
  examTitle.addEventListener("input", saveCfg);
  mode.addEventListener("change", saveCfg);

  // ========= FUNÇÕES =========
  function show(which) {
    elSetup.style.display = "none";
    elQuiz.style.display = "none";
    elResults.style.display = "none";
    elReports.style.display = "none";

    if (which === "setup") elSetup.style.display = "block";
    if (which === "quiz") elQuiz.style.display = "block";
    if (which === "results") elResults.style.display = "block";
    if (which === "reports") {
      elReports.style.display = "block";
      renderReports();
    }

    updatePills();
  }

  function startQuiz() {
    // validações leves (sem travar)
    if (!examTitle.value.trim()) examTitle.value = "Prova de Programação (Demo)";
    if (!examDate.value) {
      // se não setou, usa hoje
      const d = new Date();
      examDate.value = toISODate(d);
    }

    saveCfg();

    idx = 0;
    answers = {};
    startedAt = Date.now();

    startTimer();
    renderQuestion();
    show("quiz");
  }

  function startTimer() {
    stopTimer();
    timerTick();
    timerInt = setInterval(timerTick, 1000);
  }

  function stopTimer() {
    if (timerInt) clearInterval(timerInt);
    timerInt = null;
  }

  function timerTick() {
    if (!startedAt) {
      timerEl.textContent = "00:00";
      return;
    }
    const s = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    timerEl.textContent = `${mm}:${ss}`;
  }

  function go(delta) {
    // salva o que está na tela antes de mudar
    collectCurrentAnswer();

    idx = Math.min(QUESTIONS.length - 1, Math.max(0, idx + delta));
    renderQuestion();
  }

  function renderQuestion() {
    const q = QUESTIONS[idx];
    progressEl.textContent = `${idx + 1}/${QUESTIONS.length}`;

    btnPrev.disabled = idx === 0;
    btnNext.textContent = (idx === QUESTIONS.length - 1) ? "Finalizar" : "Próxima";

    if (idx === QUESTIONS.length - 1) {
      btnNext.onclick = finishQuiz;
    } else {
      btnNext.onclick = () => go(+1);
    }

    const saved = answers[q.id];

    let html = `
      <div class="qBox">
        <div class="qTitle">${idx + 1}) ${escapeHtml(q.title)}</div>
        <div class="muted" style="white-space:pre-line">${escapeHtml(q.prompt)}</div>
    `;

    if (q.type === "mcq") {
      html += `<div style="margin-top:10px;">`;
      q.options.forEach(opt => {
        const checked = (saved === opt.k) ? "checked" : "";
        html += `
          <label class="opt">
            <input type="radio" name="opt" value="${opt.k}" ${checked} />
            <div>${escapeHtml(opt.t)}</div>
          </label>
        `;
      });
      html += `</div>`;
    }

    if (q.type === "short") {
      const val = (typeof saved === "string") ? saved : "";
      html += `
        <div style="margin-top:10px;">
          <div class="small muted">Resposta (curta):</div>
          <textarea id="shortAnswer" rows="3" class="mono" placeholder="${escapeHtml(q.placeholder || "")}">${escapeHtml(val)}</textarea>
          <div class="small muted" style="margin-top:6px;">
            Exemplo esperado: <span class="mono">${escapeHtml(q.sample || "")}</span>
          </div>
        </div>
      `;
    }

    html += `</div>`;
    host.innerHTML = html;
  }

  function collectCurrentAnswer() {
    const q = QUESTIONS[idx];
    if (!q) return;

    if (q.type === "mcq") {
      const checked = host.querySelector("input[name='opt']:checked");
      answers[q.id] = checked ? checked.value : null;
    }

    if (q.type === "short") {
      const ta = $("shortAnswer");
      answers[q.id] = ta ? ta.value : "";
    }
  }

  function finishQuiz() {
    collectCurrentAnswer();
    stopTimer();

    const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
    const score = computeScore(answers);

    const attempt = {
      ts: Date.now(),
      student: studentName.value.trim() || "Aluno",
      turma: turma.value.trim() || "",
      examTitle: examTitle.value.trim(),
      examDate: examDate.value,
      mode: mode.value,
      elapsedSec,
      score,          // 0..10
      answers
    };

    saveAttempt(attempt);
    renderResults(attempt);

    show("results");
  }

  function quitAndSave() {
    if (!confirm("Encerrar agora e salvar como tentativa?")) return;
    finishQuiz();
  }

  function computeScore(ans) {
    const per = 10 / QUESTIONS.length;
    let ok = 0;

    for (const q of QUESTIONS) {
      const a = ans[q.id];

      if (q.type === "mcq") {
        if (a && a === q.answer) ok++;
      }

      if (q.type === "short") {
        if (typeof q.answer === "function") {
          if (q.answer(a || "")) ok++;
        } else {
          if (normalize(a || "") === normalize(q.answer || "")) ok++;
        }
      }
    }

    // arredonda em 0.5 pra ficar “bonito”
    const raw = ok * per;
    return Math.round(raw * 2) / 2;
  }

  function renderResults(attempt) {
    const best = getBestScore();
    const d = new Date(attempt.ts);

    resultMeta.textContent =
      `${attempt.student}${attempt.turma ? " • " + attempt.turma : ""} • ` +
      `${attempt.examTitle} • ${formatDate(d)} • tempo ${fmtTime(attempt.elapsedSec)}`;

    kScore.textContent = `Nota: ${attempt.score.toFixed(1)}/10`;
    kBest.textContent = `Melhor: ${best.toFixed(1)}/10`;

    // feedback/incentivo
    const missing = Math.max(0, 10 - attempt.score);
    if (attempt.score >= 10) {
      feedback.innerHTML =
        `✅ <b>Perfeito.</b> Você fechou <b>10/10</b>.<br/>
         Agora você pode manter constância: faça novamente amanhã só pra confirmar o domínio.`;
    } else {
      // aponta 2 tópicos que errou
      const wrong = listWrongTopics(attempt.answers).slice(0, 2);
      const tips = wrong.length
        ? `Pontos pra estudar agora: <b>${wrong.map(escapeHtml).join("</b>, <b>")}</b>.`
        : `Escolha 1 tema que você sentiu dificuldade e revise por 10 minutos.`;

      feedback.innerHTML =
        `🧠 <b>Incentivo:</b> faltou <b>${missing.toFixed(1)}</b> ponto(s) pra fechar 10.<br/>
         ${tips}<br/>
         Depois: refaz a prova. O sistema vai guardar sua <b>maior nota</b>.`;
    }

    // revisão detalhada
    renderReview(attempt);
  }

  function renderReview(attempt) {
    reviewBox.style.display = "none";

    let html = `<div class="qBox"><div class="qTitle">Revisão</div>`;
    html += `<div class="muted small">Mostra sua resposta + o esperado (para aprender na repetição).</div><div class="hr"></div>`;

    QUESTIONS.forEach((q, i) => {
      const userA = attempt.answers[q.id];
      const ok = isCorrect(q, userA);

      html += `
        <div style="margin-bottom:12px;">
          <div style="font-weight:900;">
            ${i + 1}) ${escapeHtml(q.title)} — ${ok ? "✅" : "❌"}
          </div>
          <div class="small muted" style="white-space:pre-line">${escapeHtml(q.prompt)}</div>
      `;

      if (q.type === "mcq") {
        const userText = q.options.find(o => o.k === userA)?.t || "(sem resposta)";
        const rightText = q.options.find(o => o.k === q.answer)?.t || "";
        html += `
          <div class="small"><b>Sua resposta:</b> ${escapeHtml(userText)}</div>
          <div class="small"><b>Correta:</b> ${escapeHtml(rightText)}</div>
        `;
      } else {
        html += `
          <div class="small"><b>Sua resposta:</b> <span class="mono">${escapeHtml(userA || "(vazio)")}</span></div>
          <div class="small"><b>Exemplo esperado:</b> <span class="mono">${escapeHtml(q.sample || "")}</span></div>
        `;
      }

      html += `<div class="small muted">${escapeHtml(q.why || "")}</div>`;
      html += `</div>`;
    });

    html += `</div>`;
    reviewBox.innerHTML = html;
  }

  function isCorrect(q, userA) {
    if (q.type === "mcq") return userA === q.answer;
    if (q.type === "short") {
      if (typeof q.answer === "function") return q.answer(userA || "");
      return normalize(userA || "") === normalize(q.answer || "");
    }
    return false;
  }

  function listWrongTopics(ans) {
    const topics = [];
    for (const q of QUESTIONS) {
      const a = ans[q.id];
      if (!isCorrect(q, a)) topics.push(q.title);
    }
    return topics;
  }

  // ========= STORAGE =========
  function readAttempts() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveAttempt(attempt) {
    const arr = readAttempts();
    arr.push(attempt);

    // mantém no máximo 40 tentativas (demo)
    while (arr.length > 40) arr.shift();

    localStorage.setItem(LS_KEY, JSON.stringify(arr));
    updatePills();
  }

  function getBestScore() {
    const arr = readAttempts();
    if (!arr.length) return 0;
    return arr.reduce((m, a) => Math.max(m, Number(a.score || 0)), 0);
  }

  function updatePills() {
    const cfg = readCfg();
    const best = getBestScore();
    const arr = readAttempts();

    pillDate.textContent = `📅 Prova: ${cfg.examDate ? prettyISO(cfg.examDate) : "--/--/----"}`;
    pillBest.textContent = `🏆 Melhor nota: ${best.toFixed(1)}/10`;
    pillAttempts.textContent = `🔁 Tentativas: ${arr.length}`;

    // opcional: preencher placeholders iniciais
    if (!examTitle.value && cfg.examTitle) examTitle.value = cfg.examTitle;
    if (!examDate.value && cfg.examDate) examDate.value = cfg.examDate;
    if (mode.value !== cfg.mode) mode.value = cfg.mode || "treino";
  }

  function renderReports() {
    const arr = readAttempts().slice().reverse();

    if (!arr.length) {
      reportHost.innerHTML = `<div class="note">Sem histórico ainda. Faça a prova uma vez pra gerar o primeiro resultado.</div>`;
      return;
    }

    const best = getBestScore();

    let html = `<div class="qBox">
      <div class="qTitle">Resumo</div>
      <div class="small muted">Melhor nota registrada: <b>${best.toFixed(1)}/10</b></div>
      <div class="small muted">Clique numa tentativa para ver detalhes (por enquanto, é resumo).</div>
    </div>`;

    html += `<div class="qBox" style="margin-top:12px;">
      <div class="qTitle">Tentativas (mais recente primeiro)</div>
    `;

    arr.forEach((a, i) => {
      const d = new Date(a.ts);
      const line =
        `<div style="padding:10px; border-radius:14px; border:1px solid rgba(0,0,0,0.08); margin-top:10px; background: rgba(255,255,255,0.88);">
          <div style="font-weight:900;">
            ${escapeHtml(a.student || "Aluno")} — nota ${Number(a.score).toFixed(1)}/10
          </div>
          <div class="small muted">
            ${escapeHtml(a.examTitle || "")} • ${prettyISO(a.examDate || "")} • ${formatDate(d)} • tempo ${fmtTime(a.elapsedSec || 0)} • modo ${escapeHtml(a.mode || "")}
          </div>
        </div>`;
      html += line;
    });

    html += `</div>`;
    reportHost.innerHTML = html;
  }

  // ========= CFG =========
  function readCfg() {
    try {
      const raw = localStorage.getItem(LS_CFG);
      return raw ? JSON.parse(raw) : { examTitle: "", examDate: "", mode: "treino" };
    } catch {
      return { examTitle: "", examDate: "", mode: "treino" };
    }
  }

  function saveCfg() {
    const cfg = {
      examTitle: examTitle.value || "",
      examDate: examDate.value || "",
      mode: mode.value || "treino"
    };
    localStorage.setItem(LS_CFG, JSON.stringify(cfg));
    updatePills();
  }

  function loadCfg() {
    const cfg = readCfg();
    if (cfg.examTitle) examTitle.value = cfg.examTitle;
    if (cfg.examDate) examDate.value = cfg.examDate;
    if (cfg.mode) mode.value = cfg.mode;
  }

  // ========= UTIL =========
  function normalize(s) {
    return String(s || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function fmtTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  function formatDate(d) {
    try {
      return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    } catch {
      return String(d);
    }
  }

  function toISODate(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function prettyISO(iso) {
    if (!iso) return "--/--/----";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }

  // inicia no setup
  show("setup");
})();