/* Logique pure de l'entraînement du boss de confrérie.

   Ni DOM, ni Supabase, ni stockage : tout vient en argument. Les scores sont
   des CHAINES du début à la fin et se comparent en BigInt — un score de boss
   dépasse vite 2^53, et un Number le tronquerait sans rien dire.

   Le score est celui du GROUPE : le jeu ne donne pas les dégâts par membre.
   La comparaison d'équipes le rappelle à l'écran ; ici, elle ne fait que
   regrouper les runs d'un membre par la composition qu'il a jouée. */

  const ENTRAINEMENT_MAX_PARTICIPANTS = 5;
  const ENTRAINEMENT_NOTE_MAX = 1000;

  function dateParisEntrainement(now){
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone:"Europe/Paris", year:"numeric", month:"2-digit", day:"2-digit"
    }).formatToParts(now || new Date());
    const partie = type => (parts.find(p => p.type === type) || {}).value;
    return partie("year") + "-" + partie("month") + "-" + partie("day");
  }

  function scoreEntrainementBigInt(valeur){
    try{ return BigInt(String(valeur)); }catch(erreur){ return null; }
  }

  function validerSaisieEntrainement(saisie){
    const s = saisie || {};
    const participants = Array.isArray(s.participants) ? s.participants.slice() : [];
    const echec = erreur => ({ ok:false, erreur });
    if(!participants.length) return echec("PARTICIPANTS_VIDES");
    if(participants.length > ENTRAINEMENT_MAX_PARTICIPANTS) return echec("TROP_DE_PARTICIPANTS");
    if(new Set(participants).size !== participants.length) return echec("PARTICIPANT_EN_DOUBLE");
    if(!participants.includes(s.auteurId)) return echec("AUTEUR_ABSENT");
    const scoreBrut = String(s.score == null ? "" : s.score);
    /* Un point ou une virgule n'est JAMAIS un separateur de milliers ici : le
       jeu n'affiche pas de decimales de score. Les retirer comme un espace
       ferait passer "12.5" pour "125", en silence. */
    if(/[.,]/.test(scoreBrut)) return echec("SCORE_INVALIDE");
    const score = scoreBrut.replace(/\s/g, "");
    if(!/^[0-9]+$/.test(score) || BigInt(score) <= 0n) return echec("SCORE_INVALIDE");
    const note = String(s.note || "").trim();
    if(note.length > ENTRAINEMENT_NOTE_MAX) return echec("NOTE_TROP_LONGUE");
    const playedOn = String(s.playedOn || "");
    if(!/^\d{4}-\d{2}-\d{2}$/.test(playedOn)) return echec("DATE_INVALIDE");
    if(playedOn > String(s.aujourdhui || "")) return echec("DATE_FUTURE");
    return { ok:true, valeur:{
      participants, score:BigInt(score).toString(), note, playedOn
    } };
  }

  function herosDuSnapshotEntrainement(snapshot){
    const heroes = snapshot && snapshot.data && Array.isArray(snapshot.data.heroes)
      ? snapshot.data.heroes : [];
    return heroes.map(h => h && h.char).filter(Boolean).sort();
  }

  function cleCompositionEntrainement(snapshot){
    const heros = herosDuSnapshotEntrainement(snapshot);
    return heros.length ? heros.join("|") : null;
  }

  function comparerDatesEntrainement(a, b){
    return String(a.playedOn).localeCompare(String(b.playedOn))
      || String(a.createdAt).localeCompare(String(b.createdAt));
  }

  function trierRunsEntrainement(runs){
    return (runs || []).slice().sort((a, b) => comparerDatesEntrainement(b, a));
  }

  function serieProgressionEntrainement(runs, membreId){
    return (runs || [])
      .filter(run => !membreId || (run.participants || []).includes(membreId))
      .filter(run => scoreEntrainementBigInt(run.score) !== null)
      .slice()
      .sort(comparerDatesEntrainement)
      .map(run => ({ id:run.id, playedOn:run.playedOn, score:String(run.score) }));
  }

  /* L'ECHELLE VERTICALE DE LA COURBE, ET POURQUOI ELLE NE PART PAS DE ZERO.

     Une confrerie progresse par paliers de quelques pour cent. Cadree sur
     zero, une serie 212 000 → 255 500 — soit +20 % — s'ecrase en un filet
     plat dans le tiers haut du cadre, les deux tiers du bas restant vides :
     la progression qu'on vient justement consulter devient invisible.

     L'echelle se cadre donc sur les donnees, avec une marge, puis s'arrondit
     a un pas lisible (1, 2 ou 5 fois une puissance de dix) pour que chaque
     graduation tombe sur un nombre rond. Les graduations sont des ENTIERS :
     formatBossScore() les relit en BigInt et rendrait « — » sur une decimale.

     Le prix a payer est connu et assume : une courbe qui ne part pas de zero
     exagere visuellement l'ecart. C'est pour cela que les graduations sont
     chiffrees a l'ecran — on lit l'amplitude reelle, on ne la devine pas.

     Les pixels passent par Number ; les scores affiches restent des chaines. */
  function echelleProgressionEntrainement(scores){
    const valeurs = (scores || []).map(Number).filter(Number.isFinite);
    if(!valeurs.length) return null;
    const min = Math.min(...valeurs);
    const max = Math.max(...valeurs);
    /* Serie plate — une seule run, ou deux fois le meme score : sans etendue,
       toute division donnerait NaN. On ouvre une fenetre autour de la valeur
       pour que le point se pose au milieu du cadre. */
    const etendue = max - min || Math.max(1, Math.abs(max) * 0.1);
    /* Les bornes suivent les donnees au plus pres ; ce sont les GRADUATIONS
       qui tombent sur des nombres ronds, a l'interieur du cadre. Arrondir les
       bornes elles-memes rouvrirait le vide qu'on vient de fermer : sur une
       serie 212 000 → 255 500, un cadre 200 000 → 280 000 laisse la courbe
       n'occuper que la moitie de sa hauteur. */
    const bas = Math.max(0, min - etendue * 0.18);
    const haut = max + etendue * 0.18;
    const pas = pasAgreableEntrainement((haut - bas) / 5);
    const graduations = [];
    for(let valeur = Math.ceil(bas / pas) * pas; valeur <= haut; valeur += pas){
      graduations.push(Math.round(valeur));
    }
    return { bas, haut, pas, graduations };
  }

  /* 1, 2 ou 5 fois une puissance de dix : les seuls pas dont un lecteur
     additionne les graduations de tete. */
  function pasAgreableEntrainement(brut){
    const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(brut) || 1)));
    const normalise = Math.abs(brut) / magnitude;
    const choix = normalise <= 1 ? 1 : normalise <= 2 ? 2 : normalise <= 5 ? 5 : 10;
    return Math.max(1, choix * magnitude);
  }

  function resumeProgressionEntrainement(serie){
    if(!serie || !serie.length) return null;
    let meilleur = null;
    serie.forEach(point => {
      const valeur = BigInt(point.score);
      if(meilleur === null || valeur > meilleur) meilleur = valeur;
    });
    const dernier = BigInt(serie[serie.length - 1].score);
    return {
      meilleur:meilleur.toString(),
      dernier:dernier.toString(),
      ecart:(dernier - meilleur).toString()
    };
  }

  function topRunsEntrainement(runs, limite){
    const max = Number.isInteger(limite) && limite > 0 ? limite : 10;
    return (runs || [])
      .filter(run => scoreEntrainementBigInt(run.score) !== null)
      .slice()
      .sort((a, b) => {
        const scoreA = BigInt(a.score), scoreB = BigInt(b.score);
        if(scoreA !== scoreB) return scoreA > scoreB ? -1 : 1;
        return comparerDatesEntrainement(a, b);
      })
      .slice(0, max)
      .map((run, index) => ({ rang:index + 1, run }));
  }

  function medianeEntrainement(valeurs){
    const triees = valeurs.slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const milieu = Math.floor(triees.length / 2);
    return triees.length % 2
      ? triees[milieu]
      : (triees[milieu - 1] + triees[milieu]) / 2n;
  }

  function comparaisonEquipesEntrainement(runs, membreId){
    const groupes = new Map();
    (runs || []).forEach(run => {
      const entree = run.equipes && run.equipes[membreId];
      const cle = entree ? cleCompositionEntrainement(entree.snapshot) : null;
      const score = scoreEntrainementBigInt(run.score);
      if(!cle || score === null) return;
      if(!groupes.has(cle)){
        groupes.set(cle, { cle, heros:herosDuSnapshotEntrainement(entree.snapshot), scores:[] });
      }
      groupes.get(cle).scores.push(score);
    });
    return [...groupes.values()]
      .map(g => {
        const meilleur = g.scores.reduce((m, v) => (v > m ? v : m));
        return { cle:g.cle, heros:g.heros, runs:g.scores.length,
          meilleur:meilleur.toString(),
          mediane:medianeEntrainement(g.scores).toString() };
      })
      .sort((a, b) => {
        const meilleura = BigInt(a.meilleur), meilleurb = BigInt(b.meilleur);
        return meilleura === meilleurb ? a.cle.localeCompare(b.cle) : (meilleura > meilleurb ? -1 : 1);
      });
  }

export {
  ENTRAINEMENT_MAX_PARTICIPANTS,
  ENTRAINEMENT_NOTE_MAX,
  comparaisonEquipesEntrainement,
  dateParisEntrainement,
  echelleProgressionEntrainement,
  resumeProgressionEntrainement,
  serieProgressionEntrainement,
  topRunsEntrainement,
  trierRunsEntrainement,
  validerSaisieEntrainement
};
