"use strict";

/* La rotation d'une équipe : une liste plate d'appuis, repliée en cases.

   Le module est PUR — les catalogues arrivent par argument. Les tests lisent
   donc les vrais fichiers de `data/` au lieu de fabriquer un faux catalogue :
   un catalogue inventé fait voir des bugs qui n'existent pas, et rate ceux qui
   existent. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { loadApp } = require("./helpers/load-app");

const { hooks } = loadApp();
const {
  PLAFOND_ROTATION, ajouterEtape, casesDeLaRotation, combinaisonsDeLEquipe,
  deplacerCase, etapeCombinee, normaliserRotation, paletteDeLEquipe,
  retirerLaCase, retirerUne, seriesDeLaRotation
} = hooks;

/* Les vrais catalogues, lus une fois pour tout le fichier. */
const racineDepot = path.join(__dirname, "..");
const catalogueDe = fichier => {
  const bacCatalogue = { window:{} };
  vm.runInNewContext(
    fs.readFileSync(path.join(racineDepot, "data", fichier), "utf8"),
    bacCatalogue
  );
  return bacCatalogue.window;
};
const COMPETENCES = catalogueDe("wiki-competences.js").SEVEN_DS_WIKI_COMPETENCES;
const COMBINAISONS = catalogueDe("ultimes-combines.js").SEVEN_DS_ULTIMES_COMBINES;
const JAUGES = catalogueDe("jauges-releve.js").SEVEN_DS_JAUGES_RELEVE;

const BAN_NUNCHAKU = {
  char:"ban", weapon:"7ds-armes/Nunchaku/Nunchaku de l'âme vorace.webp"
};
const BAN_GANTELETS = {
  char:"ban", weapon:"7ds-armes/Gantelets/Gantelets bénis.webp"
};
const TRISTAN = {
  char:"tristan",
  weapon:"7ds-armes/Epees doubles/Épées doubles à l'aura triomphale.webp"
};

assert.equal(typeof normaliserRotation, "function");
assert.equal(PLAFOND_ROTATION, 60, "le plafond compte les appuis, pas les cases");

/* NORMALISATION : ce qui entre dans Supabase doit être propre, quelle que soit
   la porte d'entrée. */
{
  assert.equal(normaliserRotation(null).length, 0);
  assert.equal(normaliserRotation("ban_cudgel3c_skill_e").length, 0,
    "une chaîne seule n'est pas une rotation");
  assert.equal(normaliserRotation({}).length, 0);

  const propre = normaliserRotation([
    "ban_cudgel3c_skill_e",
    42,
    null,
    "",
    "MAJUSCULES_INTERDITES",
    "ban cudgel3c skill e",
    "@combine:ban_gauntlets_skill_r:tristan_sworddual_skill_q",
    "@combine:seul",
    "@combine:a_b:c_d:e_f:g_h",
    "ban_cudgel3c_jumpatk"
  ]);
  assert.deepEqual(
    Array.from(propre),
    [
      "ban_cudgel3c_skill_e",
      "@combine:ban_gauntlets_skill_r:tristan_sworddual_skill_q",
      "ban_cudgel3c_jumpatk"
    ],
    "seuls un identifiant du jeu et une combinaison à deux ou trois passent"
  );

  /* Le plafond mord sur les APPUIS. Une rotation de 200 fois la même
     compétence est une case à l'écran, mais soixante appuis en mémoire. */
  const longue = normaliserRotation(new Array(200).fill("ban_cudgel3c_skill_e"));
  assert.equal(longue.length, PLAFOND_ROTATION);
}

/* LA COMBINAISON : le lanceur est en tête, la table le dit et le format le
   garde. Une combinaison mal formée rend null au lieu de deviner. */
{
  const deux = etapeCombinee(
    "@combine:ban_gauntlets_skill_r:tristan_sworddual_skill_q"
  );
  assert.equal(deux.lanceur, "ban_gauntlets_skill_r");
  assert.deepEqual(Array.from(deux.partenaires), ["tristan_sworddual_skill_q"]);

  const trois = etapeCombinee(
    "@combine:merlin_staff_skill_r:tristan_sworddual_skill_q:tioreh_book_skill_q"
  );
  assert.equal(trois.partenaires.length, 2, "une combinaison à trois héros");

  assert.equal(etapeCombinee("ban_cudgel3c_skill_e"), null,
    "une compétence ordinaire n'est pas une combinaison");
  assert.equal(etapeCombinee("@combine:seul"), null);
  assert.equal(etapeCombinee(null), null);
}

/* LE REPLI EN CASES. Onze appuis de Meliodas deviennent quatre cases, et
   `debut` garde l'index du premier appui de chaque série — c'est lui qui rend
   les mutations possibles sans stocker de séries. */
{
  const rotation = [
    "meliodas_sword1h_jumpatk",
    "meliodas_sword1h_skill_e",
    "meliodas_sword1h_skill_e",
    "meliodas_sword1h_skill_e",
    "meliodas_sword1h_jumpatk",
    "meliodas_sword1h_skill_e"
  ];
  const series = seriesDeLaRotation(rotation);
  assert.equal(series.length, 4, "quatre cases pour six appuis");
  /* `Array.from` : un tableau rendu par le bac a sable `vm` n a pas le meme
     prototype qu un `[]` de ce fichier, et `deepEqual` les compare. */
  assert.deepEqual(Array.from(series.map(s => s.fois)), [1, 3, 1, 1]);
  assert.deepEqual(Array.from(series.map(s => s.debut)), [0, 1, 4, 5]);

  /* Deux séries identiques SÉPARÉES par autre chose ne se rejoignent pas :
     l'ordre est le message, le fusionner le détruirait. */
  assert.equal(series[1].etape, series[3].etape);
  assert.equal(series.length, 4);

  assert.equal(seriesDeLaRotation([]).length, 0);
  assert.equal(seriesDeLaRotation(null).length, 0);
}

/* LA PALETTE ET LES COMBINAISONS, contre les VRAIS catalogues. */
{
  /* La palette ne propose que l'arme ÉQUIPÉE, jamais tout le kit du héros. */
  const palette = paletteDeLEquipe([BAN_NUNCHAKU, TRISTAN, {}, {}], COMPETENCES);
  assert.equal(palette.length, 2, "un héros sans arme n'entre pas dans la palette");
  assert.equal(palette[0].char, "ban");
  assert.equal(palette[0].arme, "Cudgel3c");
  assert.ok(
    palette[0].competences.every(c => /^ban_cudgel3c_/.test(c.gameId)),
    "la palette de Ban au nunchaku ne porte que ses compétences de nunchaku"
  );
  assert.ok(
    palette[0].competences.every(c => c.categorie !== "PASSIVE"),
    "un passif ne se lance pas : il n'a rien à faire dans une rotation"
  );
  assert.ok(
    palette[0].competences.length >= 4,
    "auto, normale, spéciale, ultime au minimum, reçu : "
      + palette[0].competences.length
  );

  /* LE CŒUR DE LA FONCTIONNALITÉ. Ban ne lance de combinaison qu'aux
     gantelets : au nunchaku, l'équipe n'en propose aucune. */
  const sansCombinaison = combinaisonsDeLEquipe(
    [BAN_NUNCHAKU, TRISTAN, {}, {}], COMPETENCES, COMBINAISONS
  );
  assert.equal(
    sansCombinaison.length, 0,
    "Ban au nunchaku ne lance aucune combinaison"
  );

  const avecCombinaison = combinaisonsDeLEquipe(
    [BAN_GANTELETS, TRISTAN, {}, {}], COMPETENCES, COMBINAISONS
  );
  assert.ok(
    avecCombinaison.length >= 1,
    "Ban aux gantelets avec Tristan aux épées doubles en a une"
  );
  /* LA RELATION EST ORIENTÉE, et la table porte les deux sens comme deux
     lignes distinctes : Ban lance avec Tristan qui enchaîne, ET Tristan lance
     avec Ban qui enchaîne. Ce ne sont pas la même combinaison — c'est
     exactement pourquoi la case doit nommer son lanceur. */
  const lanceurs = new Set(avecCombinaison.map(c => c.lanceur));
  assert.deepEqual(
    [...lanceurs].sort(),
    ["ban_gauntlets_skill_r", "tristan_sworddual_skill_q"],
    "les deux sens existent, reçu : " + [...lanceurs].sort()
  );
  assert.ok(
    avecCombinaison.every(c => c.etape.startsWith("@combine:" + c.lanceur + ":")),
    "l'étape encode le lanceur en tête, quel qu'il soit"
  );

  /* Une combinaison à trois héros n'est retenue que si les TROIS sont là. */
  const troisIncomplete = combinaisonsDeLEquipe(
    [BAN_GANTELETS, {}, {}, {}], COMPETENCES, COMBINAISONS
  );
  assert.equal(
    troisIncomplete.length, 0,
    "sans partenaire, aucune combinaison ne tient"
  );

  assert.equal(combinaisonsDeLEquipe(null, COMPETENCES, COMBINAISONS).length, 0);
  assert.equal(paletteDeLEquipe(null, COMPETENCES).length, 0);
}

/* LA RÉSOLUTION DES CASES. */
{
  const equipe = [BAN_NUNCHAKU, TRISTAN, {}, {}];

  const cases = casesDeLaRotation(
    [
      "ban_cudgel3c_skill_e",
      "ban_cudgel3c_skill_e",
      "merlin_staff_skill_e",
      "@combine:ban_gauntlets_skill_r:tristan_sworddual_skill_q"
    ],
    equipe, COMPETENCES
  );
  assert.equal(cases.length, 3);
  assert.equal(cases[0].fois, 2, "deux appuis de suite font une case ×2");
  assert.equal(cases[0].orpheline, false);
  assert.ok(cases[0].competence, "une case résolue porte sa compétence");
  assert.equal(cases[0].char, "ban");

  /* UNE ÉTAPE ORPHELINE GARDE SA CASE. Merlin n'est pas dans l'équipe : la
     supprimer en silence ferait disparaître le travail du membre sans qu'il
     comprenne pourquoi. Même règle que le catalogue de compétences, où une
     compétence non chiffrable garde sa ligne. */
  assert.equal(cases[1].orpheline, true, "Merlin n'est pas dans cette équipe");
  assert.equal(cases[1].competence, null);

  /* Ban est au nunchaku : la combinaison aux gantelets est orpheline elle
     aussi, et pour la même raison. */
  assert.equal(cases[2].orpheline, true);
  assert.equal(
    cases[2].participants.length, 2,
    "une combinaison orpheline nomme quand même ses participants"
  );
  assert.equal(
    cases[2].participants[0].gameId, "ban_gauntlets_skill_r",
    "le lanceur reste en tête, même orphelin"
  );

  assert.equal(casesDeLaRotation([], equipe, COMPETENCES).length, 0);
  assert.equal(casesDeLaRotation(null, equipe, COMPETENCES).length, 0);
}

/* LES MUTATIONS : elles portent sur des INDEX DE CASE, jamais d'appui. */
{
  const base = ["a_un", "a_un", "b_deux", "c_trois"];

  const ajoute = ajouterEtape(base, "d_quatre");
  assert.deepEqual(
    Array.from(ajoute), ["a_un", "a_un", "b_deux", "c_trois", "d_quatre"]
  );
  assert.deepEqual(
    Array.from(base), ["a_un", "a_un", "b_deux", "c_trois"],
    "une mutation ne mute jamais son entrée"
  );

  /* Le plafond tient jusque dans l'ajout. */
  const pleine = new Array(60).fill("a_un");
  assert.equal(
    ajouterEtape(pleine, "b_deux").length, 60,
    "au plafond, un ajout de plus ne passe pas"
  );

  /* −1 sur une série de deux laisse la case à ×1. */
  assert.deepEqual(
    Array.from(retirerUne(base, 0)), ["a_un", "b_deux", "c_trois"]
  );
  /* −1 sur une série de un fait disparaître la case. */
  assert.deepEqual(
    Array.from(retirerUne(base, 1)), ["a_un", "a_un", "c_trois"]
  );
  /* Retirer la case emporte toute la série. */
  assert.deepEqual(
    Array.from(retirerLaCase(base, 0)), ["b_deux", "c_trois"]
  );

  /* Déplacer emporte la série entière, dans les deux sens. */
  assert.deepEqual(
    Array.from(deplacerCase(base, 0, 2)), ["b_deux", "c_trois", "a_un", "a_un"]
  );
  assert.deepEqual(
    Array.from(deplacerCase(base, 2, 0)), ["c_trois", "a_un", "a_un", "b_deux"]
  );

  /* Un index hors bornes ne casse rien et ne change rien. */
  assert.deepEqual(Array.from(deplacerCase(base, 0, 9)), Array.from(base));
  assert.deepEqual(Array.from(deplacerCase(base, -1, 0)), Array.from(base));
  assert.deepEqual(Array.from(retirerUne(base, 9)), Array.from(base));
  assert.deepEqual(Array.from(retirerLaCase(base, 9)), Array.from(base));
}

/* LA RELÈVE SE DÉDUIT DE LA JAUGE, PAS DU CHANGEMENT DE HÉROS.

   Première version : « changer de héros, c'est relever ». Faux, et c'est le
   membre qui l'a vu sur sa propre rotation — « en jeu j'ai pas assez, elle se
   déclenche après sur Elisabeth ». On permute quand on veut ; c'est l'attaque
   d'entrée qui coûte un point.

   Les valeurs ci-dessous sont celles du jeu, lues dans `data/jauges-releve.js`
   (champ `UI_TagGauge` de `Skill/PC_SkillTable`). Les écrire en clair est
   volontaire : si le jeu les change, ces tests doivent tomber bruyamment.

     Ban gantelets   — E 181 · Q 111 · auto 76 · ultime 0 · relève 0
     Tristan épées   — E 140 · auto 142 · Q 0 · relève 0

   Une relève coûte 1000 (`tagpoint_gauge`), on en cumule 3
   (`tagpoint_maxstack`). */
{
  const equipe = [BAN_GANTELETS, TRISTAN];
  const cases = rotation => casesDeLaRotation(rotation, equipe, COMPETENCES, JAUGES);
  const releveDe = (char, arme) => COMPETENCES[char]
    .find(c => c.weaponType === arme && c.categorie === "TAG_SKILL");
  const releveTristan = releveDe("tristan", "SwordDual");
  const releveBan = releveDe("ban", "Gauntlets");
  assert.ok(releveTristan && releveBan, "le catalogue publie une relève par arme");

  assert.equal(JAUGES.ban_gauntlets_skill_e, 181,
    "la jauge du E de Ban aux gantelets a changé, tout ce bloc est à relire");
  assert.equal(JAUGES.tristan_sworddual_skill_e, 140);

  /* PAS ASSEZ DE JAUGE : un seul E de Ban (181) ne paye pas une relève. Le
     changement de héros se fait quand même — il est libre. */
  const tropTot = cases(["ban_gauntlets_skill_e", "tristan_sworddual_skill_e"]);
  assert.equal(tropTot.length, 2, "à 181 de jauge, aucune relève ne part");
  assert.equal(tropTot.filter(item => item.releve).length, 0);

  /* ASSEZ DE JAUGE : six E de Ban font 1086, donc un point. La relève part au
     changement, et elle porte la compétence de celui qui ENTRE. */
  const assez = cases(
    new Array(6).fill("ban_gauntlets_skill_e").concat(["tristan_sworddual_skill_e"])
  );
  assert.equal(assez.length, 3, "une case ×6, une relève, une case");
  assert.equal(assez[1].releve, true);
  assert.equal(assez[1].char, "tristan", "la relève est celle du héros qui entre");
  assert.equal(assez[1].sortant, "ban", "elle nomme aussi celui qui sort");
  assert.equal(assez[1].competence.gameId, releveTristan.gameId);
  assert.equal(assez[1].serie, null, "une relève ne vise aucune étape rangée");

  /* LE POINT SE DÉPENSE. Six E donnent UN point ; le premier changement le
     consomme, le retour vers Ban n'a plus rien — même si Tristan a versé 140
     entre-temps. */
  const unSeulPoint = cases(
    new Array(6).fill("ban_gauntlets_skill_e")
      .concat(["tristan_sworddual_skill_e", "ban_gauntlets_jumpatk"])
  );
  assert.deepEqual(
    Array.from(unSeulPoint.filter(item => item.releve).map(item => item.char)),
    ["tristan"],
    "un point payé une fois ne paye pas le retour"
  );

  /* DE QUOI FAIRE LES DEUX : douze E de Ban font 2172, soit deux points. */
  const deuxPoints = cases(
    new Array(12).fill("ban_gauntlets_skill_e")
      .concat(["tristan_sworddual_skill_e", "ban_gauntlets_jumpatk"])
  );
  assert.deepEqual(
    Array.from(deuxPoints.filter(item => item.releve).map(item => item.char)),
    ["tristan", "ban"],
    "deux points payent deux relèves"
  );

  /* LE PLAFOND. `tagpoint_maxstack` vaut 3 : quarante E de Ban font 7240, de
     quoi payer sept relèves si la barre banquait sans limite. Elle n'en stocke
     que trois, le reste est perdu.

     Le test enchaîne donc QUATRE changements sur des compétences à zéro de
     jauge — `tristan_sworddual_skill_q` et `ban_gauntlets_skill_r` valent 0.
     Sans ce détail il ne prouverait rien : dépenser un point libère de la
     place, la barre restée pleine à ras bord se recharge à la première
     compétence qui verse, et un cinquième changement repartirait. C'est le
     jeu, pas un défaut — mais ça ne teste alors plus le plafond. */
  assert.equal(JAUGES.tristan_sworddual_skill_q, 0, "le Q de Tristan doit être à 0");
  assert.equal(JAUGES.ban_gauntlets_skill_r, 0, "l'ultime de Ban doit être à 0");
  const plafond = cases(
    new Array(40).fill("ban_gauntlets_skill_e").concat([
      "tristan_sworddual_skill_q", "ban_gauntlets_skill_r",
      "tristan_sworddual_skill_q", "ban_gauntlets_skill_r"
    ])
  );
  assert.equal(
    plafond.filter(item => item.releve).length, 3,
    "on ne stocke jamais plus de trois relèves"
  );

  /* Aucune relève avant la première case : ce héros est déjà sur le terrain. */
  assert.equal(
    cases(new Array(6).fill("ban_gauntlets_skill_e")).length, 1,
    "on ne relève pas vers le héros par lequel on commence"
  );

  /* Deux compétences du MÊME héros ne relèvent pas, même la jauge pleine. */
  assert.equal(
    cases(new Array(6).fill("ban_gauntlets_skill_e")
      .concat(["ban_gauntlets_jumpatk"]))
      .filter(item => item.releve).length,
    0,
    "rester sur le même héros ne relève pas"
  );

  /* LE RANG DES MUTATIONS ne se confond pas avec la place à l'écran. */
  assert.deepEqual(
    Array.from(deuxPoints.map(item => item.serie)), [0, null, 1, null, 2],
    "les cases posées gardent leur rang de rotation"
  );

  /* UNE RELÈVE POSÉE À LA MAIN tient lieu de relève et DÉPENSE son point : la
     rotation composée avant ce modèle reste juste. */
  const posee = cases(
    new Array(12).fill("ban_gauntlets_skill_e").concat([
      releveTristan.gameId, "tristan_sworddual_skill_e", "ban_gauntlets_jumpatk"
    ])
  );
  assert.equal(
    posee.filter(item => item.releve).length, 1,
    "la relève posée consomme un point, il n'en reste qu'un pour le retour"
  );
  assert.equal(posee[1].releve, undefined, "la case posée reste une case posée");
  assert.equal(posee[1].orpheline, false,
    "une relève posée reste une case normale, pas une orpheline");

  /* SANS CATALOGUE DE JAUGES, la rotation s'affiche entière et cesse seulement
     de placer les relèves. Jamais une page en moins pour un catalogue en
     moins. */
  const sansJauges = casesDeLaRotation(
    new Array(12).fill("ban_gauntlets_skill_e").concat(["tristan_sworddual_skill_e"]),
    equipe, COMPETENCES, null
  );
  assert.equal(sansJauges.length, 2, "les cases restent");
  assert.equal(sansJauges.filter(item => item.releve).length, 0);

  /* LA PALETTE NE PROPOSE PLUS LA RELÈVE : elle se déduit. */
  const palette = paletteDeLEquipe(equipe, COMPETENCES);
  const offertes = palette.reduce(
    (tout, entree) => tout.concat(entree.competences.map(c => c.categorie)), []
  );
  assert.equal(
    offertes.filter(categorie => categorie === "TAG_SKILL").length, 0,
    "la palette ne propose plus la compétence de relève"
  );
  assert.ok(offertes.length >= 8, "elle propose toujours le reste du kit");

  /* Une COMBINAISON met son LANCEUR sur le terrain : les partenaires
     enchaînent depuis leur banc, ils ne prennent pas la place. */
  const combinee = cases(
    new Array(12).fill("ban_gauntlets_skill_e").concat([
      "@combine:ban_gauntlets_skill_r:tristan_sworddual_skill_q",
      "ban_gauntlets_jumpatk"
    ])
  );
  assert.equal(
    combinee.filter(item => item.releve).length, 0,
    "une combinaison lancée par Ban laisse Ban sur le terrain"
  );
}

console.log("rotation-equipe.test.js OK");
