/* Pile de modales : ouverture, piège à focus, restitution du focus à la
   fermeture, et verrouillage du défilement du document pendant l'ouverture.
   Ne dépend que du DOM. Le commentaire interne explique pourquoi iOS Safari
   exige de figer le corps de page plutôt qu'un simple overflow:hidden. */

  const ModalStack = (function(){
    const stack = [];
    let pendingRestore = null;
    const focusableSelector = [
      "button:not([disabled])",
      "[href]",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])"
    ].join(",");

    function focusables(overlay){
      return [...overlay.querySelectorAll(focusableSelector)]
        .filter(node => !node.hidden && node.getClientRects().length);
    }

    function isVisible(node){
      return !!node
        && node.isConnected
        && !node.hidden
        && typeof node.getClientRects === "function"
        && node.getClientRects().length > 0;
    }

    function focusTop(){
      const record = stack[stack.length - 1];
      if(!record) return;
      const target = focusables(record.overlay)[0];
      if(target) target.focus();
    }

    /* Verrouillage du document pendant qu'une modale est ouverte.
       Sur iOS Safari, un overlay `position:fixed` n'empêche PAS la page dessous
       de se déplacer au doigt : on pouvait faire glisser le site latéralement
       derrière la modale. `overflow:hidden` seul n'y suffit pas non plus sur ce
       navigateur. On fige donc le corps de page et on lui applique un décalage
       négatif égal à la position courante, ce qui supprime tout contenu à faire
       défiler — puis on restitue la position à la fermeture.
       Le verrou est posé à la PREMIÈRE ouverture et levé à la DERNIÈRE
       fermeture : le sélecteur d'équipement s'ouvre par-dessus d'autres
       modales. */
    let lockedScrollY = 0;
    function lockDocument(){
      if(stack.length !== 1) return;
      lockedScrollY = window.scrollY || 0;
      document.body.classList.add("modal-locked");
      document.body.style.top = (-lockedScrollY) + "px";
    }
    function unlockDocument(){
      if(stack.length) return;
      document.body.classList.remove("modal-locked");
      document.body.style.top = "";
      window.scrollTo(0, lockedScrollY);
    }

    function open(overlay, initialFocus, requestClose, restoreFocus){
      const existing = stack.find(record => record.overlay === overlay);
      if(existing) return;
      const active = document.activeElement;
      const meaningfulActive = isVisible(active)
        && active !== document.body
        && active !== document.documentElement;
      const trigger = isVisible(restoreFocus)
        ? restoreFocus
        : (meaningfulActive
          ? active
          : (isVisible(pendingRestore) ? pendingRestore : active));
      pendingRestore = null;
      overlay.classList.add("on");
      overlay.setAttribute("aria-hidden", "false");
      stack.push({ overlay, trigger, requestClose });
      lockDocument();
      setTimeout(() => {
        if(!stack.some(record => record.overlay === overlay)) return;
        const target = typeof initialFocus === "string"
          ? overlay.querySelector(initialFocus)
          : initialFocus;
        if(target && target.focus) target.focus();
        else focusTop();
      }, 0);
    }

    function close(overlay){
      const index = stack.findIndex(record => record.overlay === overlay);
      if(index < 0) return;
      const [record] = stack.splice(index, 1);
      overlay.classList.remove("on");
      overlay.setAttribute("aria-hidden", "true");
      /* Avant de rendre le focus : sinon focaliser un contrôle ferait défiler
         un document encore figé, et la position restituée serait fausse. */
      unlockDocument();
      pendingRestore = record.trigger;
      const restore = () => {
        const top = stack[stack.length - 1];
        if(top){
          if(isVisible(record.trigger) && top.overlay.contains(record.trigger)){
            record.trigger.focus();
          }else{
            focusTop();
          }
        }else if(isVisible(record.trigger)){
          record.trigger.focus();
        }
      };
      restore();
      /* Seconde passe : elle ne sert qu'à rattraper une restauration ratée (un
         déclencheur pas encore rendu au moment de la fermeture) ou à garder le
         focus captif dans une modale encore ouverte. Elle ne doit JAMAIS
         reprendre un focus valide déplacé entre-temps : sans cette garde, un
         membre qui bouge au clavier juste après la fermeture se voit ramené de
         force sur le déclencheur au tick suivant. */
      setTimeout(() => {
        const active = document.activeElement;
        const focusWasLost = !active
          || !active.isConnected
          || active === document.body
          || active === document.documentElement;
        const top = stack[stack.length - 1];
        if(focusWasLost || (top && !top.overlay.contains(active))) restore();
        if(pendingRestore === record.trigger) pendingRestore = null;
      }, 0);
      return record.trigger;
    }

    function setRestoreFocus(overlay, trigger){
      const record = stack.find(item => item.overlay === overlay);
      if(!record || !isVisible(trigger)) return false;
      record.trigger = trigger;
      return true;
    }

    document.addEventListener("keydown", event => {
      const record = stack[stack.length - 1];
      if(!record) return;
      if(event.key === "Escape"){
        event.preventDefault();
        if(record.requestClose) record.requestClose();
        else close(record.overlay);
        return;
      }
      if(event.key !== "Tab") return;
      const nodes = focusables(record.overlay);
      if(!nodes.length){
        event.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if(event.shiftKey && document.activeElement === first){
        event.preventDefault();
        last.focus();
      }else if(!event.shiftKey && document.activeElement === last){
        event.preventDefault();
        first.focus();
      }
    });

    return { open, close, focusTop, setRestoreFocus };
  })();

export { ModalStack };
