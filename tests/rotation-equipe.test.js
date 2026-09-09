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

/* LA RELÈVE, DÉDUITE DU CHANGEMENT DE HÉROS.

   Changer de personnage dans le jeu, c'est relever : la compétence de relève
   du héros qui ENTRE joue toute seule. Le membre n'a donc rien à poser, et le
   site n'a rien à ranger — c'est une vue, exactement comme le repli « ×N ».

   Le catalogue publie une relève par couple (héros, arme), catégorie
   `TAG_SKILL`. C'est le vrai catalogue qui est lu ici, pas un faux. */
{
  const equipe = [BAN_NUNCHAKU, TRISTAN];
  const releveDe = (char, arme) => COMPETENCES[char]
    .find(c => c.weaponType === arme && c.categorie === "TAG_SKILL");
  const releveTristan = releveDe("tristan", "SwordDual");
  const releveBan = releveDe("ban", "Cudgel3c");
  assert.ok(releveTristan && releveBan, "le catalogue publie une relève par arme");

  /* Deux héros à la suite : une relève s'intercale, et elle porte la
     compétence de celui qui ENTRE. */
  const melange = casesDeLaRotation(
    ["ban_cudgel3c_skill_e", "tristan_sworddual_skill_e"], equipe, COMPETENCES
  );
  assert.equal(melange.length, 3, "deux cases posées, une relève déduite");
  assert.equal(melange[1].releve, true);
  assert.equal(melange[1].char, "tristan", "la relève est celle du héros qui entre");
  assert.equal(melange[1].sortant, "ban", "elle nomme aussi celui qui sort");
  assert.equal(melange[1].competence.gameId, releveTristan.gameId);
  assert.equal(melange[1].serie, null, "une relève ne vise aucune étape rangée");

  /* Aucune relève avant la première case : ce héros est déjà sur le terrain. */
  assert.equal(
    casesDeLaRotation(["ban_cudgel3c_skill_e"], equipe, COMPETENCES).length, 1,
    "on ne relève pas vers le héros par lequel on commence"
  );

  /* Deux compétences du MÊME héros ne relèvent pas, même séparées. */
  const memeHeros = casesDeLaRotation(
    ["ban_cudgel3c_skill_e", "ban_cudgel3c_jumpatk"], equipe, COMPETENCES
  );
  assert.equal(
    memeHeros.filter(item => item.releve).length, 0,
    "rester sur le même héros ne relève pas"
  );

  /* Un aller-retour relève DEUX fois. */
  const allerRetour = casesDeLaRotation(
    ["ban_cudgel3c_skill_e", "tristan_sworddual_skill_e", "ban_cudgel3c_jumpatk"],
    equipe, COMPETENCES
  );
  assert.deepEqual(
    Array.from(allerRetour.filter(item => item.releve).map(item => item.char)),
    ["tristan", "ban"],
    "chaque changement de héros relève"
  );

  /* LE RANG DES MUTATIONS ne se confond pas avec la place à l'écran. La
     troisième case posée est en quatrième position une fois les relèves
     intercalées — c'est `serie` qui fait autorité, jamais l'index visuel. */
  assert.deepEqual(
    Array.from(allerRetour.map(item => item.serie)), [0, null, 1, null, 2],
    "les cases posées gardent leur rang de rotation"
  );

  /* UNE RELÈVE POSÉE À LA MAIN n'en fait pas apparaître une seconde. Une
     rotation composée avant ce changement peut en contenir une. */
  const posee = casesDeLaRotation(
    ["ban_cudgel3c_skill_e", releveTristan.gameId], equipe, COMPETENCES
  );
  assert.equal(posee.length, 2, "la relève posée tient lieu de relève déduite");
  assert.equal(posee[1].releve, undefined);
  assert.equal(posee[1].orpheline, false,
    "une relève posée reste une case normale, pas une orpheline");

  /* LA PALETTE NE PROPOSE PLUS LA RELÈVE : elle se déduit, l'offrir ferait
     poser deux fois la même chose. */
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
  const combinee = casesDeLaRotation(
    [
      "ban_gauntlets_skill_e",
      "@combine:ban_gauntlets_skill_r:tristan_sworddual_skill_q",
      "ban_gauntlets_jumpatk"
    ],
    [BAN_GANTELETS, TRISTAN], COMPETENCES
  );
  assert.equal(
    combinee.filter(item => item.releve).length, 0,
    "une combinaison lancée par Ban laisse Ban sur le terrain"
  );
}

console.log("rotation-equipe.test.js OK");
