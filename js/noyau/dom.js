/* Utilitaires DOM partagés par toutes les vues.
   Aucune dépendance applicative : ce module est la feuille de l'arbre, tout le
   reste s'appuie dessus. */

  /* ============================ Utilitaires ============================ */
  const $ = sel => document.querySelector(sel);
  const uid = () => (crypto.randomUUID ? crypto.randomUUID()
                    : "t"+Date.now().toString(36)+Math.random().toString(36).slice(2,8));
  const norm = s => (s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
  const initials = s => {
    const t = (s||"").trim();
    if(!t) return "?";
    const parts = t.split(/\s+/);
    return (parts.length>1 ? parts[0][0]+parts[1][0] : t.slice(0,2)).toUpperCase();
  };
  function numericKeyboardInputProps(props){
    return Object.assign({
      type:"number",
      inputmode:"numeric",
      pattern:"[0-9]*"
    }, props || {});
  }

  function el(tag, props, kids){
    const n = document.createElement(tag);
    if(props) for(const k in props){
      if(k==="class") n.className = props[k];
      else if(k==="text") n.textContent = props[k];
      else if(k==="html") n.innerHTML = props[k];
      else if(k.startsWith("on")) n.addEventListener(k.slice(2), props[k]);
      else if(k==="dataset") Object.assign(n.dataset, props[k]);
      else n.setAttribute(k, props[k]);
    }
    (kids||[]).forEach(c => c!=null && n.appendChild(typeof c==="string" ? document.createTextNode(c) : c));
    return n;
  }

export {
  $,
  uid,
  norm,
  initials,
  numericKeyboardInputProps,
  el
};
