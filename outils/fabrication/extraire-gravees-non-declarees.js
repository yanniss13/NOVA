/* Les armures gravees lues dans les tables du jeu, sous deux angles.

   MODE PAR DEFAUT — celles dont le client connait les STATISTIQUES sans les
   declarer comme objets.

   Ces armures n'ont aucune ligne dans `Item/ItemTable_Data_Equip` — le correctif
   qui les active n'est pas arrive — mais `Item/Option_StaticTable` porte deja
   leurs valeurs, et la localisation leurs noms. Le jeu livre en couches.

   CE QUI EST DISPONIBLE, ET CE QUI NE L'EST PAS

     Option_StaticTable   mainStat, subStat, extraStats, toutes les progressions
     Localization         nameFr, nameEn, description
     MakingRecipe         bindingMaterials
     UIImg/.../BindArmor  iconUrl, deduit de l'identifiant (voir plus bas)

     ItemTable_Data_Equip  ABSENTE -> qualite, rarete, personnage, promotion,
                           passifs de gravure, options aleatoires restent a
                           null. Ne pas les inventer.

   Sortie : 7ds-stats/armures-gravees-nouvelles.json, au format de
   7ds-stats/armures-gravees.json. Fichier SEPARE : les entrees sont
   incompletes, les fusionner dans le fichier vivant est une decision a part.

   MODE `--fusionner` — les tenues gravees DECLAREES d'un heros absent du site
   public, celui que `7ds-stats/contenu-jeu.json` decrit.

   Ces pieces-la, le client les declare entierement : `ItemTable_Data_Equip`
   donne la qualite, la promotion, les passifs et les options aleatoires,
   `ItemTable_Growth_*` les couts, `Option_RandomTable` les tirages,
   `ItemTable_Equip_Passive_*` les textes et `CostumeTable` la tenue qui les
   ouvre. La reconstruction rend donc la forme COMPLETE d'armures-gravees.json,
   et elle a ete eprouvee sur les pieces deja publiees.

   Rien ne se devine : un texte non traduit, un code de stat inconnu du depot,
   une valeur de transcendance ambigue ou un palier de passif manquant
   interrompent la piece au lieu de publier une approximation.

   Deux champs restent hors de portee du client et sont declares tels quels :
   `iconUrl`, qui designe une image de la source publique, reste null, et
   `qualityMinLive`/`qualityMaxLive`, que la source publique ne remplit pas non
   plus.

   La fusion n'ecrit que les pieces des heros du snapshot : un `gameId` deja
   present et rattache a un autre heros arrete tout.

   Lancer : node outils/fabrication/extraire-gravees-non-declarees.js
            node outils/fabrication/extraire-gravees-non-declarees.js --fusionner
*/
const fs = require('fs');
const path = require('path');

const EXPORTS = (process.env.DONNEES_JEU || '');
const DEPOT = path.resolve(__dirname, '..', '..');
const GRAVEES = DEPOT + '/7ds-stats/armures-gravees.json';
const SNAPSHOT = DEPOT + '/7ds-stats/contenu-jeu.json';

function table(chemin) {
  const brut = JSON.parse(fs.readFileSync(EXPORTS + '/Table/' + chemin, 'utf8'));
  return (brut[0] && brut[0].Rows) || {};
}
function textes(langue) {
  const p = EXPORTS + '/Localization/Game/' + langue + '/Game.json';
  if (!fs.existsSync(p)) return {};
  const brut = JSON.parse(fs.readFileSync(p, 'utf8')).client_language_table || {};
  /* Les tables citent la meme cle tantot en capitales, tantot en minuscules :
     on indexe une fois pour toutes plutot que de deviner a chaque appel. */
  const index = {};
  for (const cle of Object.keys(brut)) index[cle.toLowerCase()] = brut[cle];
  return index;
}

function chargerTables() {
  return {
    equip: table('Item/ItemTable_Data_Equip.json'),
    options: table('Item/Option_StaticTable.json'),
    ranges: table('Item/GrowthTypeRangeTable.json'),
    promotion: table('Item/ItemTable_Growth_Promotion.json'),
    exp: table('Item/ItemTable_Growth_Exp.json'),
    expKeys: table('Item/ItemTable_Growth_ExpKey.json'),
    random: table('Item/Option_RandomTable.json'),
    passiveBase: table('Item/ItemTable_Equip_Passive_Base.json'),
    passiveGroup: table('Item/ItemTable_Equip_Passive_Group.json'),
    costumes: table('CostumeTable.json'),
    recipes: table('Making/MakingRecipe.json'),
    fr: textes('fr'),
    en: textes('en'),
  };
}

/* LE VOCABULAIRE DU DEPOT, PAS CELUI DU JEU

   Le depot ecrit `B_MaxHp_Equip` la ou le jeu ecrit `B_MaxHP_Equip`, et il
   n'ecrit pas le meme code de la meme facon partout : les options aleatoires
   des pieces publiees disent `Ultimateskill_Damadd_Rate` quand leurs
   statistiques supplementaires disent `UltimateSkill_DamAdd_Rate`. Aucune
   regle mecanique ne relie ces graphies : on reprend celle que les pieces deja
   publiees emploient DANS LE MEME CHAMP, et a defaut celle des tables de
   libelles. L'ordre des options aleatoires vient de la meme source, pour que
   le diff d'une regeneration ne soit fait que de vraies nouveautes. */
const indexBas = new WeakMap();
function parCodeBas(table) {
  if (!indexBas.has(table)) {
    const index = {};
    for (const [cle, valeur] of Object.entries(table)) index[cle.toLowerCase()] = valeur;
    indexBas.set(table, index);
  }
  return indexBas.get(table);
}

function vocabulaireHistorique(existantes, libelles, metadonnees) {
  const canonique = new Map();
  for (const cle of [...Object.keys(libelles), ...Object.keys(metadonnees)]) {
    canonique.set(cle.toLowerCase(), cle);
  }
  const comptes = { stat: new Map(), random: new Map() };
  const compter = (contexte, valeur) => {
    if (typeof valeur !== 'string' || !valeur) return;
    const bas = valeur.toLowerCase();
    if (!comptes[contexte].has(bas)) comptes[contexte].set(bas, new Map());
    const variantes = comptes[contexte].get(bas);
    variantes.set(valeur, (variantes.get(valeur) || 0) + 1);
  };
  const ordre = [];
  for (const piece of existantes || []) {
    const growth = piece.growth || {};
    compter('stat', piece.mainStat);
    compter('stat', piece.subStat);
    for (const extra of growth.extraStats || []) compter('stat', extra.key);
    for (const option of (growth.limitBreak || {}).options || []) {
      compter('stat', option.abilityType);
    }
    const stats = (growth.randomOptions || {}).stats || [];
    for (const stat of stats) compter('random', stat.key);
    if (stats.length > ordre.length) {
      ordre.length = 0;
      for (const stat of stats) ordre.push(String(stat.key).toLowerCase());
    }
  }
  const retenue = contexte => {
    const choisi = new Map();
    for (const [bas, variantes] of comptes[contexte]) {
      const meilleures = [...variantes.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      choisi.set(bas, meilleures[0][0]);
    }
    return choisi;
  };
  const graphies = { stat: retenue('stat'), random: retenue('random') };
  return {
    libelles,
    metadonnees,
    ordreOptions: ordre,
    code(abilityType, contexte = 'stat') {
      const brut = String(abilityType || '').replace(/^EAbilityType::/, '');
      if (!brut || brut === 'None') return null;
      const bas = brut.toLowerCase();
      const trouve = graphies[contexte].get(bas) || canonique.get(bas);
      if (!trouve) throw new Error('code de stat inconnu du depot : ' + brut);
      return trouve;
    },
    /* Libelles et unites se cherchent sans tenir compte de la casse : la
       graphie retenue plus haut est celle du champ, pas celle des tables. */
    libelle(code) {
      const l = parCodeBas(libelles)[String(code).toLowerCase()];
      return l
        ? { nameEn: l.en || null, nameFr: l.fr || null }
        : { nameEn: null, nameFr: null };
    },
    estTaux(code) {
      const meta = parCodeBas(metadonnees)[String(code).toLowerCase()] || {};
      return meta.unit === 'ten-thousandths';
    },
  };
}

/* Les progressions du jeu vivent dans Value_Add_1..N et sont bordees de zeros.
   La position n'est pas une donnee : un `equiplv_15` range toujours sa valeur
   unique en Value_Add_2, et le depot n'en garde que la valeur — verifie sur les
   armures deja publiees. On ne conserve donc que la plage renseignee, tete et
   queue elaguees. Les `reinforce` en sortent inchanges. Les pieces declarees
   vont jusqu'a Value_Add_15 : leurs quinze multiplicateurs de renforcement y
   sont ecrits en clair. */
function progression(ligne, dernier = 10) {
  const v = [];
  for (let i = 1; i <= dernier; i++) v.push(ligne['Value_Add_' + i] || 0);
  let debut = 0, fin = v.length;
  while (debut < fin && v[debut] === 0) debut++;
  while (fin > debut && v[fin - 1] === 0) fin--;
  return v.slice(debut, fin);
}

/* ------------------------------------------------------------------ *
 *  Les pieces DECLAREES : forme complete d'armures-gravees.json       *
 * ------------------------------------------------------------------ */

function texteLocalise(tables, langue, cle, remplacements, obligatoire) {
  let sortie = tables[langue][String(cle || '').toLowerCase()];
  if (typeof sortie !== 'string') {
    if (obligatoire) throw new Error('texte ' + langue + ' absent : ' + cle);
    return null;
  }
  for (const regle of remplacements || []) {
    const decoupe = String(regle).match(/^\{(\d+)\}:\{([\s\S]*)\}$/);
    if (decoupe) sortie = sortie.split('{' + decoupe[1] + '}').join(decoupe[2]);
  }
  return sortie;
}

function passifDeclare(tables, identifiant) {
  const base = tables.passiveBase[String(identifiant).toLowerCase()];
  if (!base) throw new Error('passif absent des tables : ' + identifiant);
  const niveaux = Object.values(tables.passiveGroup)
    .filter(ligne => String(ligne.GroupID).toLowerCase() === String(base.GroupID).toLowerCase())
    .sort((a, b) => a.Level - b.Level);
  const attendus = base.MaxLv || niveaux.length;
  if (niveaux.length !== attendus) {
    throw new Error(identifiant + ' : ' + niveaux.length + ' niveaux pour '
      + attendus + ' annonces');
  }
  return { base, niveaux };
}

function pieceGravee(gameId, tables, vocabulaire, herosParId) {
  const objet = tables.equip[gameId];
  if (!objet) throw new Error('objet absent des tables : ' + gameId);
  const identifiantHeros = (objet.OnlyUse || [])[0];
  const heros = herosParId[identifiantHeros];
  if (!heros) throw new Error('heros inconnu du depot : ' + identifiantHeros);

  const emplacement = (cle, contexte = 'stat') => {
    const decoupe = String(cle).match(/^(.*)_(\d+)$/);
    if (!decoupe || !tables.options[cle]) {
      throw new Error('ligne de statistique absente : ' + cle);
    }
    const bloc = autre => {
      const ligne = tables.options[autre];
      if (!ligne) return null;
      return {
        base: ligne.Value_Base || 0,
        growthType: ligne.GrowthType || null,
        abilityType: vocabulaire.code(ligne.AbilityType, contexte),
        progression: progression(ligne, 15),
      };
    };
    return {
      code: vocabulaire.code(tables.options[cle].AbilityType, contexte),
      statValues: bloc(cle),
      equiplvAdd: bloc(decoupe[1] + '_equiplv_' + decoupe[2]),
      reinforce: bloc(decoupe[1] + '_reinforce_' + decoupe[2]),
    };
  };

  const [main1, main2] = objet.Growth_Ability_Main || [];
  const sousStats = objet.Growth_Ability_Sub || [];
  const principale = emplacement(main1);
  const secondaire = sousStats[0] ? emplacement(sousStats[0]) : null;

  const extraStats = [];
  const supplementaires = [];
  if (main2) supplementaires.push([main2, 'main']);
  for (const cle of sousStats.slice(1)) supplementaires.push([cle, 'sub']);
  for (const [cle, slot] of supplementaires) {
    const e = emplacement(cle);
    extraStats.push({
      key: e.code,
      slot,
      isRate: vocabulaire.estTaux(e.code),
      ...vocabulaire.libelle(e.code),
      reinforce: e.reinforce,
      equiplvAdd: e.equiplvAdd,
      statValues: e.statValues,
    });
  }

  /* Les bornes de segment se lisent dans la table de plage du type de
     croissance : une piece qui porte N valeurs de niveau a N+1 bornes. */
  const plage = tables.ranges[principale.statValues.growthType];
  if (!plage) {
    throw new Error('plage de croissance absente : ' + principale.statValues.growthType);
  }
  const bornes = progression(plage, 15)
    .slice(0, principale.statValues.progression.length + 1);

  const promotion = Object.values(tables.promotion)
    .filter(ligne => ligne.PromotionGroupID === objet.PromotionGroupID)
    .sort((a, b) => a.PromotionLevel - b.PromotionLevel)
    .map(ligne => ({
      gold: ligne.Cost,
      rate: ligne.PromotionRate,
      tier: ligne.PromotionLevel,
      isMax: ligne.Is_Max,
      items: (ligne.NeedItem || []).length
        ? ligne.NeedItem.map(item => ({ count: item.Count, itemId: String(item.Item_ID) }))
        : null,
      maxReinforce: ligne.MaxReinforce,
    }));
  if (!promotion.length) {
    throw new Error('promotion absente : ' + objet.PromotionGroupID);
  }

  /* Les couts de renforcement se rangent par qualite (`ExpKey` s1..s5, soit
     les paliers 0 a 4) puis par niveau de renforcement. */
  const qualites = Object.keys(tables.expKeys).filter(cle => /^s\d+$/.test(cle)).sort();
  const reinforcement = Object.values(tables.exp)
    .filter(ligne => ligne.ExpGroupID === objet.ExpGroupID)
    .map(ligne => {
      const tier = qualites.indexOf(ligne.ExpKey);
      if (tier < 0) throw new Error('palier de qualite inconnu : ' + ligne.ExpKey);
      return {
        exp: ligne.exp,
        gold: ligne.Cost,
        tier,
        items: (ligne.NeedItem || []).length ? ligne.NeedItem : null,
        level: ligne.Reinforce,
      };
    })
    .sort((a, b) => a.level - b.level || a.tier - b.tier);
  if (!reinforcement.length) {
    throw new Error('couts de renforcement absents : ' + objet.ExpGroupID);
  }

  let randomOptions = null;
  const groupes = objet.Equip_Option || [];
  if (groupes.length) {
    const groupe = groupes[0];
    if (groupes.some(autre => autre !== groupe)) {
      throw new Error(gameId + ' : deux groupes d\'options differents');
    }
    const lignes = Object.values(tables.random).filter(ligne => ligne.Group_ID === groupe);
    if (!lignes.length) throw new Error('groupe d\'options absent : ' + groupe);
    const parCode = new Map();
    for (const ligne of lignes) {
      const code = vocabulaire.code(ligne.AbilityType, 'random');
      if (!parCode.has(code)) parCode.set(code, []);
      parCode.get(code).push(ligne);
    }
    const totalRate = lignes.reduce((somme, ligne) => somme + ligne.OptionRate, 0);
    const rang = code => {
      const index = vocabulaire.ordreOptions.indexOf(code.toLowerCase());
      return index < 0 ? vocabulaire.ordreOptions.length : index;
    };
    const codes = [...parCode.keys()].sort((a, b) => rang(a) - rang(b));
    randomOptions = {
      slots: groupes.length,
      stats: codes.map(code => {
        const tirages = parCode.get(code);
        const somme = tirages.reduce((total, ligne) => total + ligne.OptionRate, 0);
        return {
          key: code,
          max: Math.max(...tirages.map(ligne => ligne.Value_Max)),
          min: Math.min(...tirages.map(ligne => ligne.Value_Min)),
          tiers: tirages
            .slice()
            .sort((a, b) => a.Tier - b.Tier)
            .map(ligne => ({
              max: ligne.Value_Max,
              min: ligne.Value_Min,
              tier: ligne.Tier,
              chance: Math.round(ligne.OptionRate / somme * 10000),
            })),
          chance: Math.round(somme / totalRate * 10000),
          isRate: vocabulaire.estTaux(code),
          ...vocabulaire.libelle(code),
        };
      }),
    };
  }

  let limitBreak = null;
  const optionsTranscendance = objet.LimitBreak_Option || [];
  const passifTranscendance = (objet.LimitBreak_Passive || [])[0];
  if (optionsTranscendance.length || passifTranscendance) {
    let passive = null;
    if (passifTranscendance) {
      const { base, niveaux } = passifDeclare(tables, passifTranscendance.EquipPassiveID);
      const niveau = niveaux[0];
      passive = {
        id: passifTranscendance.EquipPassiveID,
        tier: passifTranscendance.PromotionLevel,
        descEn: texteLocalise(tables, 'en', niveau.Desc, niveau.Local_Replace, true),
        descFr: texteLocalise(tables, 'fr', niveau.Desc, niveau.Local_Replace, true),
        nameEn: texteLocalise(tables, 'en', base.Core_Name, [], true),
        nameFr: texteLocalise(tables, 'fr', base.Core_Name, [], true),
      };
    }
    limitBreak = {
      options: optionsTranscendance.map((cle, index) => {
        const ligne = tables.options[cle];
        if (!ligne) throw new Error('option de transcendance absente : ' + cle);
        const valeurs = [ligne.Value_Base, ...progression(ligne, 15)].filter(Boolean);
        if (valeurs.length !== 1) {
          throw new Error('valeur de transcendance ambigue : ' + cle);
        }
        return {
          tier: index + 1,
          value: valeurs[0],
          abilityType: vocabulaire.code(ligne.AbilityType),
        };
      }),
      passive,
    };
  }

  const engravingPassives = [...new Set((objet.Equip_Passive || [])
    .map(ligne => ligne.EquipPassiveID))]
    .map(identifiant => {
      const { base, niveaux } = passifDeclare(tables, identifiant);
      return {
        id: identifiant,
        icon: base.Icon,
        levels: niveaux.map(niveau => ({
          level: niveau.Level,
          descEn: texteLocalise(tables, 'en', niveau.Desc, niveau.Local_Replace, true),
          descFr: texteLocalise(tables, 'fr', niveau.Desc, niveau.Local_Replace, true),
        })),
        nameEn: texteLocalise(tables, 'en', base.Core_Name, [], true),
        nameFr: texteLocalise(tables, 'fr', base.Core_Name, [], true),
      };
    });

  const costume = Object.values(tables.costumes)
    .find(ligne => (ligne.Open_Condition_Value || []).includes(gameId));
  if (!costume) throw new Error('aucune tenue n\'ouvre la piece : ' + gameId);

  const rarete = { 'EGrade::Grade5': 'SSR', 'EGrade::Grade4': 'SR' }[objet.grade];
  if (!rarete) throw new Error('grade inconnu du site : ' + objet.grade);

  const recette = tables.recipes[gameId];
  const bindingMaterials = [];
  for (let i = 1; recette && i <= 7; i++) {
    const tid = recette['Material_TID_' + i];
    const quantite = recette['Material_Cnt_' + i] || 0;
    if (!tid || tid === 'None' || !quantite) continue;
    bindingMaterials.push({ itemId: String(tid), quantity: quantite });
  }

  const growth = { promotion, extraStats };
  if (limitBreak) growth.limitBreak = limitBreak;
  Object.assign(growth, {
    subReinforce: secondaire ? secondaire.reinforce : null,
    subStatLabel: secondaire ? vocabulaire.libelle(secondaire.code) : null,
    mainReinforce: principale.reinforce,
    mainStatLabel: vocabulaire.libelle(principale.code),
    randomOptions,
    reinforcement,
    subEquiplvAdd: secondaire ? secondaire.equiplvAdd : null,
    subStatValues: secondaire ? secondaire.statValues : null,
    mainEquiplvAdd: principale.equiplvAdd,
    mainStatValues: principale.statValues,
  });

  return {
    gameId,
    mainStat: principale.code,
    subStat: secondaire ? secondaire.code : null,
    qualityMin: objet.Quality_Min,
    qualityMax: objet.Quality_MAX,
    // La source publique ne remplit pas ces deux champs ; le client non plus.
    qualityMinLive: null,
    qualityMaxLive: null,
    tierBoundaries: bornes,
    growth,
    personnage: heros.slug,
    personnageNomFr: heros.nameFr,
    costumeSlug: heros.slug + '-costume-' + costume.ItemId,
    nameFr: texteLocalise(tables, 'fr', 'local_item_equip_name_' + gameId, [], true),
    nameEn: texteLocalise(tables, 'en', 'local_item_equip_name_' + gameId, [], true),
    rarity: rarete,
    effectNameFr: texteLocalise(tables, 'fr', costume.Achive_Key, [], true),
    engravingPassives: engravingPassives.length ? engravingPassives : null,
    bindingMaterials: bindingMaterials.length ? bindingMaterials : null,
    // Image de la source publique : le client n'en porte pas l'equivalent.
    iconUrl: null,
  };
}

/* La fusion ne touche QUE les pieces des heros du snapshot. Une piece deja
   publiee pour un autre heros arrete tout : le catalogue vivant est la
   reference des 26 heros publics, pas un brouillon. */
function fusionnerGravees(existantes, nouvelles, slugsClients) {
  const clients = new Set(slugsClients);
  const parId = new Map();
  for (const piece of existantes) parId.set(piece.gameId, piece);
  const vues = new Set();
  for (const piece of nouvelles) {
    if (vues.has(piece.gameId)) {
      throw new Error('gameId dupliqué dans la fusion : ' + piece.gameId);
    }
    vues.add(piece.gameId);
    const ancienne = parId.get(piece.gameId);
    if (ancienne && !clients.has(ancienne.personnage)) {
      throw new Error('gameId déjà publié pour ' + ancienne.personnage + ' : '
        + piece.gameId);
    }
    parId.set(piece.gameId, piece);
  }
  return [...parId.values()].sort((a, b) => a.gameId.localeCompare(b.gameId));
}

function herosDuSnapshot(snapshot) {
  const parId = {};
  for (const [slug, heros] of Object.entries(snapshot.heroes || {})) {
    parId[String(heros.id)] = { slug, nameFr: heros.nameFr };
  }
  return parId;
}

function ecrireJson(chemin, valeur) {
  const temporaire = chemin + '.tmp';
  fs.writeFileSync(temporaire, JSON.stringify(valeur, null, 1) + '\n', 'utf8');
  fs.renameSync(temporaire, chemin);
}

function fusionner() {
  const tables = chargerTables();
  const libelles = JSON.parse(fs.readFileSync(DEPOT + '/7ds-stats/libelles-stats.json', 'utf8'));
  const metadonnees = JSON.parse(fs.readFileSync(DEPOT + '/7ds-stats/stat-metadata.json', 'utf8'));
  const existantes = JSON.parse(fs.readFileSync(GRAVEES, 'utf8'));
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
  const vocabulaire = vocabulaireHistorique(existantes, libelles, metadonnees);
  const herosParId = herosDuSnapshot(snapshot);

  const nouvelles = [];
  for (const [slug, heros] of Object.entries(snapshot.heroes || {})) {
    for (const armure of heros.linkedArmors || []) {
      const piece = pieceGravee(armure.gameId, tables, vocabulaire, herosParId);
      if (piece.personnage !== slug) {
        throw new Error(armure.gameId + ' : piece de ' + piece.personnage
          + ' citee par ' + slug);
      }
      if (piece.nameFr !== armure.nameFr) {
        throw new Error(armure.gameId + ' : nom « ' + piece.nameFr
          + ' » contre « ' + armure.nameFr + ' » dans le snapshot');
      }
      nouvelles.push(piece);
    }
  }
  const fusion = fusionnerGravees(existantes, nouvelles, Object.keys(snapshot.heroes || {}));
  ecrireJson(GRAVEES, fusion);

  console.log('armures gravees : ' + fusion.length
    + ' (' + nouvelles.length + ' fusionnees)');
  for (const piece of nouvelles) {
    console.log('  ' + piece.gameId + '  ' + piece.personnage.padEnd(10)
      + '  ' + piece.nameFr);
  }
  console.log('ecrit dans 7ds-stats/armures-gravees.json');
}

/* ------------------------------------------------------------------ *
 *  Les pieces NON DECLAREES : rapport separe, champs inconnus a null  *
 * ------------------------------------------------------------------ */

function nonDeclarees() {
  const options = table('Item/Option_StaticTable.json');
  const objets = table('Item/ItemTable_Data_Equip.json');
  const recettes = table('Making/MakingRecipe.json');
  const fr = textes('fr');
  const en = textes('en');
  const libelles = JSON.parse(fs.readFileSync(DEPOT + '/7ds-stats/libelles-stats.json', 'utf8'));
  const metadonnees = JSON.parse(fs.readFileSync(DEPOT + '/7ds-stats/stat-metadata.json', 'utf8'));
  const canonique = new Map();
  for (const cle of [...Object.keys(libelles), ...Object.keys(metadonnees)]) {
    canonique.set(cle.toLowerCase(), cle);
  }
  const inconnus = new Set();

  function codeStat(abilityType) {
    const brut = String(abilityType || '').replace(/^EAbilityType::/, '');
    if (!brut || brut === 'None') return null;
    const trouve = canonique.get(brut.toLowerCase());
    if (!trouve) inconnus.add(brut);
    return trouve || brut;
  }

  function libelle(code) {
    const l = libelles[code];
    return l ? { nameEn: l.en || null, nameFr: l.fr || null } : { nameEn: null, nameFr: null };
  }

  function bloc(cle) {
    const ligne = options[cle];
    if (!ligne) return null;
    return {
      base: ligne.Value_Base || 0,
      growthType: ligne.GrowthType || null,
      abilityType: codeStat(ligne.AbilityType),
      progression: progression(ligne),
    };
  }

  function emplacement(prefixe, id) {
    const socle = options[prefixe + '_' + id];
    if (!socle) return null;
    const code = codeStat(socle.AbilityType);
    return {
      code,
      reinforce: bloc(prefixe + '_reinforce_' + id),
      equiplvAdd: bloc(prefixe + '_equiplv_' + id),
      statValues: bloc(prefixe + '_' + id),
    };
  }

  /* L'icone se deduit de l'identifiant, regle apprise sur les armures
     declarees et verifiee sur elles : `IconName` vaut
     `icon_bindarmor_<heros>_<type>_<code>`, ou <code> est exactement les quatre
     derniers chiffres de l'identifiant, et <heros> se lit sur les deux
     chiffres qui precedent (index 01 = tristan ... 41 = derieri).
     Le type se deduit du code : 5001 cloth, 5002 leather, 5003 plate ; 4001
     prend les trois. */
  const ICONES_DIR = EXPORTS + '/UIImg/Icon_Item/BindArmor';
  const fichiersIcone = new Map();
  if (fs.existsSync(ICONES_DIR)) {
    for (const f of fs.readdirSync(ICONES_DIR)) {
      if (f.toLowerCase().endsWith('.png')) fichiersIcone.set(f.slice(0, -4).toLowerCase(), f);
    }
  }
  const herosParIndex = new Map();
  const typesParCode = new Map();
  for (const [id, v] of Object.entries(objets)) {
    if (!id.startsWith('133')) continue;
    const m = /^icon_bindarmor_(.+)_([a-z]+)_(\d{4})$/.exec(String(v.IconName || ''));
    if (!m) continue;
    herosParIndex.set(id.slice(3, 5), m[1]);
    if (!typesParCode.has(m[3])) typesParCode.set(m[3], new Set());
    typesParCode.get(m[3]).add(m[2]);
  }

  function icone(id) {
    const heros = herosParIndex.get(id.slice(3, 5));
    if (!heros) return null;              // heros inconnu : ne rien inventer
    const code = id.slice(5, 9);
    const types = [...(typesParCode.get(code) || ['cloth', 'leather', 'plate'])];
    for (const t of types) {
      const nom = (heros + '_' + t + '_' + code).toLowerCase();
      if (fichiersIcone.has(nom)) return 'UIImg/Icon_Item/BindArmor/' + fichiersIcone.get(nom);
    }
    return null;
  }

  function materiaux(id) {
    const r = recettes[id];
    if (!r) return null;
    const sortie = [];
    for (let i = 1; i <= 7; i++) {
      const tid = r['Material_TID_' + i];
      const cnt = r['Material_Cnt_' + i] || 0;
      if (!tid || tid === 'None' || !cnt) continue;
      sortie.push({ itemId: String(tid), quantity: cnt });
    }
    return sortie.length ? sortie : null;
  }

  /* Les armures gravees se reconnaissent au prefixe 133 de leur identifiant.
     On retient celles qu'Option_StaticTable connait et qu'ItemTable_Data_Equip
     ignore. */
  const identifiants = new Set();
  for (const cle of Object.keys(options)) {
    const m = /^armor_[a-z0-9_]*?(\d{6,})$/.exec(cle);
    if (m && m[1].startsWith('133') && !objets[m[1]]) identifiants.add(m[1]);
  }

  const sortie = [];
  for (const id of [...identifiants].sort()) {
    const main1 = emplacement('armor_main1', id);
    if (!main1) continue;
    const sub1 = emplacement('armor_sub1', id);

    const extraStats = [];
    for (const [prefixe, slot] of [['armor_main2', 'main'], ['armor_sub2', 'sub'],
                                   ['armor_sub3', 'sub']]) {
      const e = emplacement(prefixe, id);
      if (!e) continue;
      const meta = metadonnees[e.code] || {};
      extraStats.push({
        key: e.code,
        slot,
        isRate: meta.unit === 'ten-thousandths',
        ...libelle(e.code),
        reinforce: e.reinforce,
        equiplvAdd: e.equiplvAdd,
        statValues: e.statValues,
      });
    }

    sortie.push({
      gameId: id,
      mainStat: main1.code,
      subStat: sub1 ? sub1.code : null,
      // Sans ligne d'objet, la qualite est inconnue. Ne pas deviner.
      qualityMin: null, qualityMax: null,
      qualityMinLive: null, qualityMaxLive: null,
      tierBoundaries: null,
      growth: {
        promotion: null,
        extraStats,
        subReinforce: sub1 ? sub1.reinforce : null,
        subStatLabel: sub1 ? libelle(sub1.code) : null,
        mainReinforce: main1.reinforce,
        mainStatLabel: libelle(main1.code),
        randomOptions: null,
      },
      personnage: null,
      personnageNomFr: null,
      costumeSlug: null,
      nameFr: fr['local_item_equip_name_' + id] || null,
      nameEn: en['local_item_equip_name_' + id] || null,
      descFr: fr['local_item_equip_desc_' + id] || null,
      rarity: null,
      effectNameFr: null,
      engravingPassives: null,
      bindingMaterials: materiaux(id),
      iconUrl: icone(id),
      provenance: {
        source: 'Option_StaticTable + Localization/Game/{fr,en} + MakingRecipe',
        absentDe: 'Item/ItemTable_Data_Equip',
        champsInconnus: ['qualityMin', 'qualityMax', 'tierBoundaries', 'rarity',
          'personnage', 'costumeSlug', 'engravingPassives',
          'randomOptions', 'growth.promotion']
          .concat(icone(id) ? [] : ['iconUrl']),
        transcendance: 'absente du client : Value_Add_6..10 valent 0 partout',
      },
    });
  }

  const destination = DEPOT + '/7ds-stats/armures-gravees-nouvelles.json';
  fs.writeFileSync(destination, JSON.stringify(sortie, null, 1) + '\n', 'utf8');

  console.log('armures gravees non declarees : ' + sortie.length);
  console.log('');
  console.log('id           nom                                   mainStat            sub   extra  mat   icone');
  for (const e of sortie) {
    console.log(
      e.gameId.padEnd(12),
      String(e.nameFr || '?').slice(0, 36).padEnd(38),
      String(e.mainStat).padEnd(20),
      (e.subStat ? 'oui' : '-').padEnd(6),
      String(e.growth.extraStats.length).padEnd(6),
      e.bindingMaterials ? e.bindingMaterials.length : 0,
      e.iconUrl ? 'icone' : '-');
  }
  if (inconnus.size) {
    console.log('');
    console.log('codes de stat absents du vocabulaire du depot : ' + [...inconnus].join(', '));
  }
  console.log('');
  console.log('ecrit dans 7ds-stats/armures-gravees-nouvelles.json');
}

function main() {
  if (process.argv.includes('--fusionner')) fusionner();
  else nonDeclarees();
}

if (require.main === module) main();

module.exports = {
  pieceGravee, vocabulaireHistorique, fusionnerGravees, herosDuSnapshot,
  progression, chargerTables,
};
