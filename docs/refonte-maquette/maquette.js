"use strict";

(() => {
  const header = document.querySelector("#appHeader");
  if(header){
    header.innerHTML = `
      <a class="brand" href="#home" aria-label="NOVA, accueil">
        <span class="brand-mark" aria-hidden="true">7</span>
        <span>Confrérie 7DS</span>
      </a>
      <span class="prototype-label">Maquette de refonte</span>`;
  }
})();
