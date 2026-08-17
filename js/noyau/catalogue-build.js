/* Chargement a la demande du catalogue chiffre de builds (environ 2,4 Mo).

   BUILD_STATS garde toujours la meme identite : certains modules conservent
   une reference vers ses dictionnaires. Le script genere assigne d'abord un
   nouvel objet a window ; hydrateBuildStats recopie ensuite chaque dictionnaire
   dans la reference stable puis la remet sur window. */

import { BUILD_STATS } from "./constantes.js";

  const BUILD_STATS_SOURCE = "data/stats-build.js";
  const BUILD_STATS_MAPS = [
    "charactersBySlug",
    "weaponsByFile",
    "gearByFile",
    "engravedByFile",
    "gearSets",
    "statLabels"
  ];
  let buildStatsPromise = null;

  function buildStatsReady(){
    return Object.keys(BUILD_STATS.weaponsByFile || {}).length > 0;
  }

  function replaceBuildStatsMap(key, source){
    const target = BUILD_STATS[key] || (BUILD_STATS[key] = {});
    Object.keys(target).forEach(name => { delete target[name]; });
    Object.assign(target, source && source[key] || {});
  }

  function hydrateBuildStats(source){
    if(!source || typeof source !== "object"){
      throw new Error("BUILD_STATS_INVALID");
    }
    BUILD_STATS_MAPS.forEach(key => replaceBuildStatsMap(key, source));
    BUILD_STATS.version = Number(source.version) || 0;
    window.SEVEN_DS_BUILD_STATS = BUILD_STATS;
    if(!buildStatsReady()) throw new Error("BUILD_STATS_EMPTY");
    return BUILD_STATS;
  }

  async function cacheBuildStatsForOffline(){
    const container = typeof navigator !== "undefined"
      ? navigator.serviceWorker : null;
    if(!container || !container.ready || typeof MessageChannel === "undefined") return;
    const registration = await container.ready;
    const worker = container.controller || registration?.active;
    if(!worker) return;
    await new Promise(resolve => {
      const channel = new MessageChannel();
      const timeout = setTimeout(resolve, 10000);
      channel.port1.onmessage = () => {
        clearTimeout(timeout);
        resolve();
      };
      try{
        worker.postMessage({type:"CACHE_BUILD_STATS"}, [channel.port2]);
      }catch(error){
        clearTimeout(timeout);
        resolve();
      }
    });
  }

  function ensureBuildStats(){
    if(buildStatsReady()) return Promise.resolve(BUILD_STATS);
    if(buildStatsPromise) return buildStatsPromise;
    buildStatsPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = BUILD_STATS_SOURCE;
      script.async = true;
      script.dataset.buildStatsLoader = "true";
      script.onload = () => {
        try{
          const hydrated = hydrateBuildStats(window.SEVEN_DS_BUILD_STATS);
          cacheBuildStatsForOffline()
            .catch(()=>{})
            .then(()=>resolve(hydrated));
        }
        catch(error){ reject(error); }
      };
      script.onerror = () => reject(new Error("BUILD_STATS_LOAD_FAILED"));
      document.head.appendChild(script);
    }).catch(error => {
      buildStatsPromise = null;
      window.SEVEN_DS_BUILD_STATS = BUILD_STATS;
      throw error;
    });
    return buildStatsPromise;
  }

export {
  buildStatsReady,
  ensureBuildStats
};
