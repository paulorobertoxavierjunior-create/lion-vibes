// assets/core.js
const LV = {
  get(key, fallback=null){
    try{
      const raw = localStorage.getItem(key);
      if(raw == null) return fallback;
      return JSON.parse(raw);
    }catch{ return fallback; }
  },
  set(key, val){
    localStorage.setItem(key, JSON.stringify(val));
  },
  del(key){
    localStorage.removeItem(key);
  },
  requireAuth(){
    const a = LV.get("lv_auth", null);
    if(!a?.ok) location.href = "index.html";
  },
  mountLogo(elId){
    const box = document.getElementById(elId);
    if(!box) return;
    const img = new Image();
    img.onload = ()=>{ box.innerHTML=""; box.appendChild(img); img.className="logoImg"; };
    img.onerror = ()=>{ box.textContent="LV"; box.classList.add("fallback"); };
    img.src = "logo.png";
  }
};
window.LV = LV;

// Relatórios
LV.REPORT_KEY = "lv_reports";
LV.MAX_REPORTS = 10;

LV.loadReports = function(){
  return LV.get(LV.REPORT_KEY, []);
};
LV.saveReports = function(arr){
  LV.set(LV.REPORT_KEY, arr.slice(0, LV.MAX_REPORTS));
};

// Tokens (gamificação)
LV.TOKEN_KEY = "lv_tokens";
LV.getTokens = function(){
  const t = LV.get(LV.TOKEN_KEY, null);
  if(t && typeof t.tokens === "number") return t;
  const init = { tokens: 3, updatedAt: Date.now(), earnedToday: 0, day: new Date().toDateString() };
  LV.set(LV.TOKEN_KEY, init);
  return init;
};
LV.setTokens = function(obj){
  LV.set(LV.TOKEN_KEY, obj);
};
LV.bumpToken = function(){
  const t = LV.getTokens();
  const today = new Date().toDateString();
  if(t.day !== today){
    t.day = today;
    t.earnedToday = 0;
  }
  if(t.earnedToday >= 3) return false; // limite diário no demo
  t.tokens += 1;
  t.earnedToday += 1;
  t.updatedAt = Date.now();
  LV.setTokens(t);
  return true;
};