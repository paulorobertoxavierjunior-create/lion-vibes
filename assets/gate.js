(function(){
  const PASS = "12345"; // <<< troque se quiser (código demo)
  function requirePasscodeOrRedirect(nextUrl){
    const ok = localStorage.getItem(LION.store.KEYS.PASS_OK) === "1";
    if(ok){
      location.href = nextUrl;
      return;
    }
    const entered = prompt("Código de acesso (demo):");
    if((entered||"").trim() === PASS){
      localStorage.setItem(LION.store.KEYS.PASS_OK, "1");
      location.href = nextUrl;
    }else{
      alert("Código inválido.");
    }
  }

  window.LION = window.LION || {};
  window.LION.gate = { requirePasscodeOrRedirect };
})();