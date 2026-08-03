/* Logique pure des disponibilités hebdomadaires.
   Aucune dépendance : ni DOM, ni Supabase, ni état applicatif. Chaque fonction
   prend ses entrées et rend une valeur neuve, ce qui la rend testable seule et
   permet à l'aperçu de sélection d'être affiché puis jeté sans risque.
   Le rendu et la persistance vivent dans app.js. */

  /* ============================ Dispos ============================
     Les disponibilités tiennent dans un masque de 168 caractères, un par
     créneau d'une heure, à l'index jour * 24 + heure (jour 0 = lundi).
     Le masque étant une frise temporelle continue, franchir minuit revient à
     avancer d'un index : aucun cas particulier n'est nécessaire.
     ATTENTION : la semaine utilisée ici est la semaine ISO (lundi 00h), et non
     la semaine de boss qui bascule le lundi à 9h. */
  const AVAIL_DAYS = 7;
  const AVAIL_HOURS = 24;
  const AVAIL_SLOTS = AVAIL_DAYS * AVAIL_HOURS;
  const AVAIL_EMPTY_MASK = "0".repeat(AVAIL_SLOTS);

  /* La semaine est calculée en heure de Paris, comme currentBossWeek() et le
     tableau de bord : un membre connecté depuis un autre fuseau doit voir la
     même grille que les autres. Différence essentielle avec currentBossWeek() :
     aucune règle des 9h ici, la semaine ISO bascule le lundi à 00h.
     Toute l'arithmétique de dates se fait ensuite en UTC sur des dates civiles,
     ce qui met les changements d'heure hors de portée. */
  function availabilityParisParts(now){
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone:"Europe/Paris",
      year:"numeric", month:"2-digit", day:"2-digit", weekday:"short"
    }).formatToParts(now || new Date());
    const get = type => (parts.find(part => part.type === type) || {}).value;
    return {
      year:+get("year"),
      month:+get("month"),
      day:+get("day"),
      weekday:{ Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 }[get("weekday")]
    };
  }

  function availabilityWeekStart(now){
    const paris = availabilityParisParts(now);
    const base = new Date(Date.UTC(paris.year, paris.month - 1, paris.day));
    /* weekday place le dimanche à 0 ; on ramène le lundi à 0. */
    base.setUTCDate(base.getUTCDate() - ((paris.weekday + 6) % 7));
    return base.toISOString().slice(0, 10);
  }

  function availabilityPreviousWeekStart(weekStart){
    const parts = String(weekStart).split("-").map(Number);
    const day = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    day.setUTCDate(day.getUTCDate() - 7);
    return day.toISOString().slice(0, 10);
  }

  function availabilitySlotIndex(day, hour){
    return day * AVAIL_HOURS + hour;
  }

  function availabilitySlotFromIndex(index){
    return {
      day:Math.floor(index / AVAIL_HOURS),
      hour:index % AVAIL_HOURS
    };
  }

  /* Un masque valide : 168 créneaux, un caractère par heure de la semaine. */
  const AVAIL_MASK_PATTERN = /^[01]{168}$/;

  function normalizeAvailabilityMask(value){
    return typeof value === "string" && AVAIL_MASK_PATTERN.test(value)
      ? value
      : AVAIL_EMPTY_MASK;
  }

  function availabilityMaskHas(mask, index){
    return mask[index] === "1";
  }

  function availabilityMaskWith(mask, indexes, fill){
    if(!indexes || !indexes.length) return mask;
    const chars = mask.split("");
    indexes.forEach(index => { chars[index] = fill ? "1" : "0"; });
    return chars.join("");
  }

  /* Le masque étant une frise continue, une plage qui franchit minuit est une
     simple suite d'index : `jour * 24 + heure + n` traverse naturellement la
     limite du jour. Seule la fin de la semaine demande un écrêtage, la nuit du
     dimanche débordant sur la semaine suivante, hors de cette grille. */
  function applyAvailabilityRange(mask, startHour, endHour, days, fill){
    if(startHour === endHour) return { mask, clipped:false };
    const span = endHour > startHour
      ? endHour - startHour
      : (AVAIL_HOURS - startHour) + endHour;
    const indexes = [];
    let clipped = false;
    (days || []).forEach(day => {
      for(let step = 0; step < span; step += 1){
        const index = availabilitySlotIndex(day, startHour) + step;
        if(index >= AVAIL_SLOTS){ clipped = true; continue; }
        indexes.push(index);
      }
    });
    return { mask:availabilityMaskWith(mask, indexes, fill), clipped };
  }

  /* Peinture rectangulaire : les deux extrémités sont des cases, donc incluses.
     Glisser de 22h à 23h sélectionne bien deux créneaux. */
  function paintAvailabilityRectangle(mask, anchor, cursor, fill){
    const dayFrom = Math.min(anchor.day, cursor.day);
    const dayTo = Math.max(anchor.day, cursor.day);
    const hourFrom = Math.min(anchor.hour, cursor.hour);
    const hourTo = Math.max(anchor.hour, cursor.hour);
    const indexes = [];
    for(let day = dayFrom; day <= dayTo; day += 1){
      for(let hour = hourFrom; hour <= hourTo; hour += 1){
        indexes.push(availabilitySlotIndex(day, hour));
      }
    }
    return availabilityMaskWith(mask, indexes, fill);
  }

  /* Les raccourcis suivent la même règle que le glissement : tant qu'il reste
     une case vide on remplit, et on n'efface qu'une sélection déjà complète. */
  function availabilityToggleDay(mask, day){
    const indexes = [];
    for(let hour = 0; hour < AVAIL_HOURS; hour += 1){
      indexes.push(availabilitySlotIndex(day, hour));
    }
    const full = indexes.every(index => availabilityMaskHas(mask, index));
    return availabilityMaskWith(mask, indexes, !full);
  }

  function availabilityToggleHour(mask, hour){
    const indexes = [];
    for(let day = 0; day < AVAIL_DAYS; day += 1){
      indexes.push(availabilitySlotIndex(day, hour));
    }
    const full = indexes.every(index => availabilityMaskHas(mask, index));
    return availabilityMaskWith(mask, indexes, !full);
  }

  function aggregateAvailability(rows){
    const counts = new Array(AVAIL_SLOTS).fill(0);
    (rows || []).forEach(row => {
      const mask = normalizeAvailabilityMask(row && row.slots);
      for(let index = 0; index < AVAIL_SLOTS; index += 1){
        if(mask[index] === "1") counts[index] += 1;
      }
    });
    let max = 0;
    counts.forEach(count => { if(count > max) max = count; });
    /* À effectif égal, le créneau le plus tôt passe devant : le classement
       reste déterministe, donc testable et stable d'un rendu à l'autre. */
    const best = counts
      .map((count, index) => ({ index, count }))
      .filter(entry => entry.count > 0)
      .sort((a, b) => b.count - a.count || a.index - b.index)
      .slice(0, 3);
    return { counts, max, best };
  }

  function availabilityDensityTier(count, max){
    if(!count || !max) return 0;
    return Math.min(4, Math.ceil((count / max) * 4));
  }

  function availabilitySlotMembers(rows, index, options){
    const config = options || {};
    const pseudoOf = config.pseudoOf || (() => "");
    const withGroup = config.ownersWithGroup || new Set();
    const members = (rows || [])
      .filter(row => normalizeAvailabilityMask(row && row.slots)[index] === "1")
      .map(row => ({
        owner:row.owner,
        pseudo:pseudoOf(row.owner) || "Membre",
        isMe:row.owner === config.currentUserId,
        withoutGroup:!withGroup.has(row.owner)
      }));
    members.sort((a, b) =>
      (b.isMe ? 1 : 0) - (a.isMe ? 1 : 0)
      || a.pseudo.localeCompare(b.pseudo, "fr")
    );
    return members;
  }

  /* Purge auto-nettoyante : chaque membre supprime SES anciennes semaines en
     enregistrant, ce qui évite une tâche planifiée côté serveur. La comparaison
     de chaînes suffit, le format ISO étant ordonné lexicographiquement.
     `keepWeeks` compte la semaine courante : on recule donc de keepWeeks - 1
     semaines pour trouver la plus ancienne à conserver. */
  function staleAvailabilityWeeks(weekStarts, currentWeekStart, keepWeeks){
    let floor = currentWeekStart;
    for(let step = 1; step < keepWeeks; step += 1){
      floor = availabilityPreviousWeekStart(floor);
    }
    return (weekStarts || []).filter(week => week < floor);
  }

  /* L'écho Realtime de sa PROPRE écriture, ignoré dans deux cas distincts.

     1. Pendant la peinture (`savePending`) : l'écho réappliquerait un masque
        plus ancien que la sélection en cours.

     2. Après l'enregistrement, quand la ligne renvoyée dit EXACTEMENT ce que
        la grille affiche déjà. Ce second cas manquait, et c'est celui qui a
        été signalé : l'écho arrive forcément APRÈS la réponse de l'upsert,
        donc après que `savePending` soit retombé. Chaque créneau peint
        déclenchait ainsi une relecture complète — et, à l'époque où la grille
        était reconstruite, ramenait le membre en haut de page. Un membre seul
        sur le site se le faisait donc à lui-même.

     Comparer les masques plutôt que poser un délai garde le cas utile : une
     ligne qui diffère (saisie depuis un autre appareil) reste appliquée. */
  function shouldIgnoreAvailabilityEcho(
    payload, currentUserId, savePending, currentMask
  ){
    if(!payload || payload.owner !== currentUserId) return false;
    if(savePending) return true;
    return AVAIL_MASK_PATTERN.test(payload.slots) && payload.slots === currentMask;
  }

  const AVAIL_DAY_LABELS = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
  const AVAIL_DAY_FULL = [
    "Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"
  ];
  const AVAIL_MONTHS = [
    "janvier","février","mars","avril","mai","juin",
    "juillet","août","septembre","octobre","novembre","décembre"
  ];

  /* Dates civiles manipulées en UTC : `weekStart` est un jour du calendrier, pas
     un instant, et l'arithmétique UTC ignore les changements d'heure. */
  function availabilityDayDate(weekStart, day){
    const parts = String(weekStart).split("-").map(Number);
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    date.setUTCDate(date.getUTCDate() + day);
    return date;
  }

  function availabilityWeekLabel(weekStart){
    const first = availabilityDayDate(weekStart, 0);
    const last = availabilityDayDate(weekStart, 6);
    const lastLabel = last.getUTCDate()+" "+AVAIL_MONTHS[last.getUTCMonth()];
    const firstLabel = first.getUTCMonth() === last.getUTCMonth()
      ? String(first.getUTCDate())
      : first.getUTCDate()+" "+AVAIL_MONTHS[first.getUTCMonth()];
    return "semaine du "+firstLabel+" au "+lastLabel;
  }

  /* Fonction pure : elle décrit la vue sans toucher au DOM, ce qui permet de la
     tester sans navigateur. Un visiteur déconnecté ne reçoit AUCUNE donnée :
     les politiques RLS réservent déjà la lecture aux membres connectés, et la
     vue ne doit pas laisser croire le contraire. */
  function availabilityViewState(options){
    const config = options || {};
    const weekStart = availabilityWeekStart(config.now || new Date());
    const signedIn = !!config.currentUserId;
    const online = config.online !== false;
    const rows = signedIn ? (config.rows || []) : [];
    const own = rows.find(row => row.owner === config.currentUserId);
    let message = "";
    if(!signedIn){
      message = "Connecte-toi pour voir les dispos de la confrérie et poser les tiennes.";
    }else if(!online){
      message = "Tu es hors ligne : les dispos affichées viennent du cache et ne peuvent pas être modifiées.";
    }
    return {
      weekStart,
      weekLabel:availabilityWeekLabel(weekStart),
      mask:normalizeAvailabilityMask(own && own.slots),
      rows,
      mode:config.mode === "guild" ? "guild" : "mine",
      canEdit:signedIn && online,
      offline:signedIn && !online,
      message
    };
  }

export {
  AVAIL_DAYS,
  AVAIL_HOURS,
  AVAIL_EMPTY_MASK,
  availabilityWeekStart,
  availabilityPreviousWeekStart,
  availabilitySlotIndex,
  availabilitySlotFromIndex,
  normalizeAvailabilityMask,
  availabilityMaskHas,
  applyAvailabilityRange,
  paintAvailabilityRectangle,
  availabilityToggleDay,
  availabilityToggleHour,
  aggregateAvailability,
  availabilityDensityTier,
  availabilitySlotMembers,
  staleAvailabilityWeeks,
  shouldIgnoreAvailabilityEcho,
  AVAIL_DAY_LABELS,
  AVAIL_DAY_FULL,
  availabilityDayDate,
  availabilityViewState
};
