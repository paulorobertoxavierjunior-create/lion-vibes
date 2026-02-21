(function(){
  const KEYS = {
    PASS_OK: "lion_pass_ok",
    TOKENS: "lion_tokens",
    REPORTS: "lion_reports"
  };

  function readJSON(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      if(!raw) return fallback;
      return JSON.parse(raw);
    }catch{
      return fallback;
    }
  }
  function writeJSON(key, value){
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getTokens(){
    const t = readJSON(KEYS.TOKENS, null);
    if(t && typeof t.value === "number") return t;
    const init = { value: 0, updatedAt: Date.now() };
    writeJSON(KEYS.TOKENS, init);
    return init;
  }
  function setTokens(value){
    writeJSON(KEYS.TOKENS, { value: Number(value)||0, updatedAt: Date.now() });
  }

  function getReports(){
    return readJSON(KEYS.REPORTS, []);
  }
  function saveReports(list){
    writeJSON(KEYS.REPORTS, list);
  }

  window.LION = window.LION || {};
  window.LION.store = {
    KEYS,
    readJSON, writeJSON,
    getTokens, setTokens,
    getReports, saveReports
  };
})();