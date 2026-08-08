# Passifs de tenue gravée — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire entrer les passifs de tenue gravée dans le calcul — ceux du héros calculé et ceux de ses coéquipiers — et remplacer le choix d'équipe par trois emplacements alimentés par le roster, un personnage à la fois.

**Architecture:** Une table écrite à la main (`data/passifs-graves.js`) gardée par un test qui la confronte au texte source, un module métier pur qui la résout pour un niveau donné, et une seconde sortie dans `calculateur-entrees.js` pour les bonus de catégorie — qui ne peuvent pas traverser `entreesDuCalcul`. Le module `equipe-buffs.js` n'est pas touché.

**Tech Stack:** ES modules natifs, `window.SEVEN_DS_*` pour les données, tests node via `vm` (`tests/helpers/load-app.js`), Playwright pour le bout en bout.

**Spec :** `docs/superpowers/specs/2026-08-08-passifs-graves-calculateur-design.md`

## Global Constraints

- **Aucun chiffre existant ne doit bouger tant que le membre n'a rien coché ni rempli d'emplacement.**
- **Français sans accents dans les commentaires de code et les messages de commit** ; accents autorisés dans les chaînes affichées et le Markdown.
- **Les pourcentages sont en dix-millièmes** : `8000` vaut 80 %. `unite:"ten-thousandths"`.
- **`data/passifs-graves.js` s'écrit à la main.** Aucun générateur ne doit le produire ni le citer.
- **`modules-imports.test.js` refuse tout export mort** : chaque tâche livre son module ET son premier consommateur.
- **Tout nouveau module `js/` va dans `tests/helpers/modules.js` ET dans `CORE_ASSETS` de `sw.js`** — l'oubli du second casse le mode hors ligne, et un test l'attrape.
- **Le chargeur de tests concatène tous les modules dans une MÊME portée** : deux `const` de même nom se heurtent entre fichiers. D'où `RAPPORT`, `DIX_MILLIEMES`, `TAUX_PLEIN` pour une seule idée.
- **`weaponTypesOf(charId)` rend des DOSSIERS français** (`Epee 2 mains`), pas des enums.
- Commandes : `npm run test:unit`, `npm run test:e2e`, `npm test`.

---

### Task 1: Trois emplacements de coéquipier, depuis le roster

Remplace le sélecteur d'équipe livré la veille. `js/metier/equipe-buffs.js` n'est **pas** touché : il reçoit déjà `{ charId, typeArme, atk }`, seule la source change.

**Files:**
- Create: `js/donnees/coequipiers-store.js`
- Delete: `js/donnees/equipe-choisie-store.js`
- Modify: `js/noyau/constantes.js`, `js/vues/calculateur.js`, `sw.js`, `tests/helpers/modules.js`, `tests/calculateur.playwright.js`

**Interfaces:**
- Consumes: `buffsDeLEquipe({ element, coequipiers })` de `js/metier/equipe-buffs.js`. `fichesDuMembre()` et `typesDe(entry)`, déjà dans la vue. `rosterHeroSnapshot(fiche, typeArme)` de `js/metier/equipe-modele.js`, déjà importé.
- Produces: `CoequipiersStore.get()` → tableau de longueur `EMPLACEMENTS_COEQUIPIERS`, chaque case `{ charId, typeArme }` ou `null`. `CoequipiersStore.set(liste)` → la liste normalisée. `EMPLACEMENTS_COEQUIPIERS` = 3. Consommés par la Task 4.

- [ ] **Step 1: Remplacer la clé de stockage**

Dans `js/noyau/constantes.js`, remplacer :

```js
  /* Quelle equipe le calculateur regarde. Un reglage d'ecran, pas une donnee
     de confrerie : les EQUIPES vivent dans STORAGE_KEY et se synchronisent. */
  const EQUIPE_CHOISIE_KEY = "confrerie7ds.calculateur.equipe";
```

par :

```js
  /* Les coequipiers que le calculateur prend en compte. Un reglage d'ecran,
     pas une donnee de confrerie : on ne retient que des couples personnage +
     arme designant des builds du roster, jamais les builds eux-memes.

     L'ancienne cle `confrerie7ds.calculateur.equipe` retenait un identifiant
     d'equipe et devient morte. Elle n'est pas migree : elle ne portait qu'un
     reglage d'ecran, et le nouveau store ignore ce qu'il ne sait pas relire. */
  const COEQUIPIERS_KEY = "confrerie7ds.calculateur.coequipiers";
```

Et dans la liste `export { ... }`, remplacer `EQUIPE_CHOISIE_KEY,` par `COEQUIPIERS_KEY,`.

- [ ] **Step 2: Écrire le store**

Créer `js/donnees/coequipiers-store.js` :

```js
/* Les coequipiers retenus dans le calculateur, sur cet appareil.

   LOCAL, et volontairement pas synchronise : c'est un reglage d'ecran. On ne
   stocke que des COUPLES personnage + arme, jamais un build recopie - sinon
   une modification du roster laisserait ici une copie perimee.

   Un choix qui ne designe plus rien de reel est ignore a la lecture par la
   vue, qui ne propose que des builds existants. */

import { COEQUIPIERS_KEY } from "../noyau/constantes.js";

  /* Trois, parce que le heros calcule occupe le quatrieme siege. */
  const EMPLACEMENTS_COEQUIPIERS = 3;

  /* La liste garde TOUJOURS trois cases, vides comprises : la vue dessine
     trois emplacements, et une liste plus courte les ferait apparaitre et
     disparaitre au fil des choix. */
  function normaliser(brut){
    const liste = Array.isArray(brut) ? brut : [];
    const propre = [];
    for(let index = 0; index < EMPLACEMENTS_COEQUIPIERS; index++){
      const choix = liste[index];
      const valide = choix
        && typeof choix.charId === "string" && choix.charId
        && typeof choix.typeArme === "string" && choix.typeArme;
      propre.push(valide
        ? { charId:choix.charId, typeArme:choix.typeArme }
        : null);
    }
    return propre;
  }

  const CoequipiersStore = {
    get(){
      try{
        return normaliser(JSON.parse(localStorage.getItem(COEQUIPIERS_KEY)));
      }catch(erreur){
        /* Un stockage illisible ne doit pas condamner l'onglet : trois cases
           vides rendent le comportement du heros seul. */
        return normaliser(null);
      }
    },
    set(liste){
      const propre = normaliser(liste);
      try{
        localStorage.setItem(COEQUIPIERS_KEY, JSON.stringify(propre));
      }catch(erreur){
        /* Stockage plein ou refuse : le choix vaut pour la session. */
      }
      return propre;
    }
  };

export { EMPLACEMENTS_COEQUIPIERS, CoequipiersStore };
```

- [ ] **Step 3: Supprimer l'ancien store et le redéclarer**

```bash
git rm js/donnees/equipe-choisie-store.js
```

Dans `tests/helpers/modules.js`, remplacer `"donnees/equipe-choisie-store.js",` par `"donnees/coequipiers-store.js",`.

Dans `sw.js`, remplacer `"./js/donnees/equipe-choisie-store.js",` par `"./js/donnees/coequipiers-store.js",`.

- [ ] **Step 4: Remplacer les imports de la vue**

Dans `js/vues/calculateur.js`, remplacer :

```js
import { EquipeChoisieStore } from "../donnees/equipe-choisie-store.js";
import { Store } from "../donnees/equipes-store.js";
```

par :

```js
import {
  EMPLACEMENTS_COEQUIPIERS, CoequipiersStore
} from "../donnees/coequipiers-store.js";
```

- [ ] **Step 5: Remplacer l'état**

Dans l'objet `etat`, remplacer :

```js
    /* L'equipe regardee, restauree du stockage : le membre la retrouve a la
       visite suivante. `null` vaut « aucune equipe », qui reste le defaut et
       rend la liste complete des buffs, comme avant ce choix. */
    equipeId:EquipeChoisieStore.get(),
```

par :

```js
    /* Les coequipiers retenus, restaures du stockage. Trois cases vides par
       defaut : le chiffre reste celui du heros seul tant qu'on n'y touche
       pas. */
    coequipiers:CoequipiersStore.get(),
```

- [ ] **Step 6: Remplacer la lecture des coéquipiers**

Dans `js/vues/calculateur.js`, remplacer le bloc allant de `function equipesDisponibles(){` jusqu'à la fin de `function coequipiersDeLEquipe(){ ... }` par :

```js
  /* Tous les builds du roster, un par couple personnage + arme.

     C'est le bon grain : l'arme decide quels buffs le coequipier apporte -
     Daisy au Livre et Daisy a la Baguette n'en donnent pas les memes. Un seul
     choix plutot que deux, donc, et rien a deviner. */
  function buildsDuRoster(){
    return fichesDuMembre()
      .flatMap(fiche => typesDe(fiche).map(typeArme => ({
        charId:fiche.charId,
        typeArme,
        libelle:nomDuPersonnage(fiche.charId) + " · " + typeArme
      })))
      .sort((a, b) => a.libelle.localeCompare(b.libelle, "fr"));
  }

  /* L'ATK d'un coequipier, ou null si son build n'est pas exploitable.

     rosterHeroSnapshot rend EXACTEMENT la forme qu'attend calculateHeroStats -
     la meme que pour le heros calcule - donc son potentiel, son arme et sa
     tenue gravee entrent dans ce chiffre sans conversion. */
  function atkDuBuild(heros){
    if(!heros) return null;
    const result = calculateHeroStats(heros);
    if(result.status !== "valid" && result.status !== "partial") return null;
    const trouve = groupBuildStatResults(result)
      .flatMap(groupe => groupe.stats)
      .find(stat => stat.stat === "B_Atk");
    return trouve && Number.isFinite(trouve.value) ? trouve.value : null;
  }

  /* Le build d'un coequipier retenu, ou null si le roster ne le porte plus. */
  function herosDuChoix(choix){
    if(!choix) return null;
    const fiche = ficheDe(choix.charId);
    return fiche ? rosterHeroSnapshot(fiche, choix.typeArme) : null;
  }

  /* Les coequipiers reduits a ce dont equipe-buffs.js a besoin. `null` quand
     aucun emplacement n'est rempli : le module rend alors la liste complete
     des buffs, comme avant tout choix. */
  function coequipiersChoisis(){
    const retenus = etat.coequipiers
      .map(choix => ({ choix, heros:herosDuChoix(choix) }))
      .filter(entree => entree.heros);
    if(!retenus.length) return null;
    return retenus.map(entree => ({
      charId:entree.choix.charId,
      typeArme:entree.choix.typeArme,
      atk:atkDuBuild(entree.heros)
    }));
  }
```

- [ ] **Step 7: Renommer `nomDuSoutien` en `nomDuPersonnage`**

La fonction sert désormais aussi à nommer les coéquipiers et le héros calculé, pas seulement les soutiens.

Dans `js/vues/calculateur.js`, renommer la déclaration `function nomDuSoutien(slug){` en `function nomDuPersonnage(slug){`, et remplacer **tous** ses appels :

```bash
grep -n "nomDuSoutien" js/vues/calculateur.js
```

Il doit rester zéro occurrence de `nomDuSoutien` après le renommage.

- [ ] **Step 8: Remplacer le sélecteur**

Remplacer entièrement `function selecteurEquipe(redessiner){ ... }` par :

```js
  function selecteurCoequipier(index, redessiner){
    const choix = el("select",{
      class:"calc-coequipier",
      onchange:event => {
        const brut = event.target.value || "";
        const separateur = brut.indexOf("|");
        const suivants = etat.coequipiers.slice();
        suivants[index] = separateur > 0
          ? {
              charId:brut.slice(0, separateur),
              typeArme:brut.slice(separateur + 1)
            }
          : null;
        /* Un meme personnage ne peut pas tenir deux sieges : le jeu ne le
           permet pas, et ses buffs se cumuleraient a tort. Le choisir ici le
           retire donc de l'emplacement ou il etait. */
        if(suivants[index]){
          suivants.forEach((autre, rang) => {
            if(rang !== index && autre
              && autre.charId === suivants[index].charId){
              suivants[rang] = null;
            }
          });
        }
        etat.coequipiers = CoequipiersStore.set(suivants);
        /* Changer de coequipier change les buffs PROPOSES : ceux qui etaient
           coches et ne le sont plus n'auraient plus de case pour etre
           decoches, et continueraient d'agir sans rien a l'ecran pour le
           dire. */
        etat.coches.clear();
        redessiner();
      }
    });
    const vide = el("option",{ value:"", text:"—" });
    vide.selected = !etat.coequipiers[index];
    choix.appendChild(vide);
    buildsDuRoster().forEach(build => {
      const valeur = build.charId + "|" + build.typeArme;
      const retenu = etat.coequipiers[index];
      const option = el("option",{ value:valeur, text:build.libelle });
      option.selected = Boolean(retenu)
        && retenu.charId === build.charId
        && retenu.typeArme === build.typeArme;
      choix.appendChild(option);
    });
    return el("div",{class:"calc-champ"},[
      el("label",{text:"Coéquipier " + (index + 1)}), choix
    ]);
  }

  /* Les trois emplacements, dessines ensemble. */
  function selecteursCoequipiers(redessiner){
    const bloc = el("div",{class:"calc-coequipiers"});
    for(let index = 0; index < EMPLACEMENTS_COEQUIPIERS; index++){
      bloc.appendChild(selecteurCoequipier(index, redessiner));
    }
    return bloc;
  }
```

- [ ] **Step 9: Dessiner les emplacements aux deux endroits**

Remplacer `bloc.appendChild(selecteurEquipe(redessiner));` par :

```js
    bloc.appendChild(selecteursCoequipiers(redessiner));
```

Et `selecteurEquipe(dessiner)` par :

```js
        selecteursCoequipiers(dessiner)
```

- [ ] **Step 10: Brancher la nouvelle source**

Dans `buffsProposes` et dans `sectionSoutiens`, remplacer les deux appels à `coequipiersDeLEquipe()` par `coequipiersChoisis()`.

```bash
grep -n "coequipiersDeLEquipe\|equipeCourante\|equipesDisponibles\|EquipeChoisieStore\|selecteurEquipe" js/vues/calculateur.js
```

Il doit rester zéro occurrence de chacun.

- [ ] **Step 11: Adapter le test de bout en bout**

Dans `tests/calculateur.playwright.js`, remplacer tout le bloc commençant par `/* LE CHOIX D'EQUIPE.` et finissant par l'assertion `"revenir a « Aucune equipe » doit restaurer la liste complete"` par :

```js
    /* LES EMPLACEMENTS DE COEQUIPIER. Localises par LIBELLE, jamais par
       index : un `.calc-champ` de plus decale tout reperage positionnel, et
       c'est exactement ce qui a casse ce fichier une fois deja. */
    const premierCoequipier = page
      .locator(".calc-champ", { hasText:"Coéquipier 1" }).locator("select");
    await premierCoequipier.waitFor();
    assert.equal(await premierCoequipier.inputValue(), "",
      "les emplacements doivent demarrer vides : aucun chiffre ne bouge tant "
        + "que le membre n'a rien touche");
    assert.equal(
      await page.locator(".calc-coequipier").count(), 3,
      "trois emplacements, le heros calcule occupant le quatrieme siege"
    );

    const soutiensAvant = await page.locator(".calc-soutien").count();
    assert.ok(soutiensAvant > 0,
      "sans coequipier, tous les soutiens du catalogue doivent etre proposes");

    /* Le roster de la fixture ne porte que Meliodas, qui n'apporte aucun buff
       modelise : le retenir doit donc VIDER la liste, et le dire. */
    await premierCoequipier.selectOption({ index:1 });
    await page.locator(".calc-table tbody tr").first().waitFor();
    const soutiensApres = await page.locator(".calc-soutien").count();
    assert.ok(soutiensApres < soutiensAvant,
      "un coequipier sans buff modelise doit reduire la liste, recu "
        + soutiensApres + " apres " + soutiensAvant);
    assert.match(
      await page.locator(".calc-soutiens").textContent(),
      /n'apporte de buff modélisé|Aucun buff modélisé/,
      "un coequipier sans buff modelise doit etre nomme, pas tu"
    );

    /* Vider l'emplacement restaure la liste complete. */
    await premierCoequipier.selectOption("");
    await page.locator(".calc-table tbody tr").first().waitFor();
    assert.equal(await page.locator(".calc-soutien").count(), soutiensAvant,
      "vider l'emplacement doit restaurer la liste complete");
```

- [ ] **Step 12: Lancer les tests**

```bash
npm run test:unit && node tests/calculateur.playwright.js
```

Attendu : tout passe, `modules-imports.test.js` compris.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: composer ses coequipiers depuis le roster, un par un

Le calculateur choisissait une EQUIPE enregistree. Trop rigide : essayer
« et si je mettais Derieri a la place ? » obligeait a aller composer une
equipe dans le builder avant de pouvoir la voir.

Trois emplacements la remplacent, chacun listant tous les builds du roster.
Le couple personnage + arme est un SEUL choix, parce que l'arme n'est pas un
detail de presentation : elle decide quels buffs le coequipier apporte.

Un meme personnage ne peut pas tenir deux sieges - le jeu ne le permet pas,
et ses buffs se cumuleraient a tort.

js/metier/equipe-buffs.js n'est pas touche : il recevait deja
{ charId, typeArme, atk }, seule la source change. EquipesStore sort du
calculateur.

nomDuSoutien devient nomDuPersonnage : il nomme desormais aussi des
coequipiers et le heros calcule.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Les bonus de catégorie venus des buffs cochés

Sans cette sortie, un buff de catégorie coché ne changerait **rien** : ses cinq codes de stat n'existent pas dans `CIBLE_DU_BUFF`, et pour une bonne raison — les seaux de `entreesDuCalcul` valent pour toutes les compétences à la fois.

**Files:**
- Modify: `js/metier/calculateur-entrees.js`, `js/vues/calculateur.js`, `tests/calculateur-entrees.test.js`

**Interfaces:**
- Consumes: `STAT_DE_LA_CATEGORIE` de `js/metier/calculateur-entrees.js`.
- Produces: `bonusCategorieDesBuffs(buffsCoches)` → objet `{ NORMAL_SKILL:8000, … }`, catégories absentes quand aucun buff ne les vise. Consommé par la Task 4.

- [ ] **Step 1: Écrire le test qui échoue**

À ajouter dans `tests/calculateur-entrees.test.js`, juste avant la ligne `console.log(` finale :

```js
/* Les bonus de categorie ne peuvent pas traverser entreesDuCalcul : ses seaux
   valent pour TOUTES les competences a la fois, et y verser un bonus de
   competence normale gonflerait l'ultime. Ils sortent donc a part. */
{
  const { bonusCategorieDesBuffs } = hooks;
  assert.equal(typeof bonusCategorieDesBuffs, "function",
    "bonusCategorieDesBuffs doit etre expose par le chargeur de tests");

  assert.deepEqual(bonusCategorieDesBuffs([]), {},
    "sans buff, aucune categorie ne recoit quoi que ce soit");

  assert.deepEqual(
    bonusCategorieDesBuffs([
      { stat:"Normalskill_Damadd_Rate", valeur:8000 }
    ]),
    { NORMAL_SKILL:8000 },
    "un buff de categorie atterrit dans SA categorie, et nulle part ailleurs"
  );

  /* Deux buffs de la meme categorie s'additionnent : ils viennent de sources
     differentes - une tenue gravee et un soutien - et le jeu les cumule. */
  assert.deepEqual(
    bonusCategorieDesBuffs([
      { stat:"Normalskill_Damadd_Rate", valeur:8000 },
      { stat:"Normalskill_Damadd_Rate", valeur:5000 }
    ]),
    { NORMAL_SKILL:13000 }
  );

  /* Un buff ordinaire n'y met rien : il a deja son seau dans le moteur. */
  assert.deepEqual(
    bonusCategorieDesBuffs([{ stat:"C_Critical_Rate", valeur:2000 }]), {},
    "un buff hors categorie ne doit rien ajouter"
  );

  /* Une valeur illisible est ignoree, elle ne devient jamais NaN : un NaN
     dans le seau ferait disparaitre toute la ligne de degats. */
  assert.deepEqual(
    bonusCategorieDesBuffs([
      { stat:"Ultimateskill_Damadd_Rate", valeur:"beaucoup" }
    ]), {}
  );
}
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

```bash
node tests/calculateur-entrees.test.js
```

Attendu : ÉCHEC sur `bonusCategorieDesBuffs doit etre expose par le chargeur de tests`.

- [ ] **Step 3: Écrire la fonction**

Dans `js/metier/calculateur-entrees.js`, juste après la déclaration de `STAT_DE_LA_CATEGORIE` :

```js
  /* L'inverse de la table ci-dessus, derive d'ELLE plutot que reecrit : deux
     listes tenues en parallele finiraient par diverger. */
  const CATEGORIE_DE_LA_STAT = Object.fromEntries(
    Object.entries(STAT_DE_LA_CATEGORIE)
      .map(([categorie, code]) => [code, categorie])
  );

  /* Les bonus de categorie apportes par des buffs COCHES.

     Ils ne peuvent pas passer par entreesDuCalcul, dont les seaux valent pour
     toutes les competences a la fois : y verser un bonus de competence
     normale gonflerait l'ultime. Ils sortent donc a part, pour etre fusionnes
     avec ceux que le build porte deja.

     Une valeur illisible est ignoree plutot que propagee : un NaN dans le seau
     ferait disparaitre la ligne de degats entiere, sans rien dire. */
  function bonusCategorieDesBuffs(buffsCoches){
    const liste = Array.isArray(buffsCoches) ? buffsCoches : [];
    return liste.reduce((bonus, buff) => {
      const categorie = CATEGORIE_DE_LA_STAT[buff && buff.stat];
      const valeur = Number(buff && buff.valeur);
      if(!categorie || !Number.isFinite(valeur)) return bonus;
      bonus[categorie] = (bonus[categorie] || 0) + valeur;
      return bonus;
    }, {});
  }
```

Puis ajouter `bonusCategorieDesBuffs,` à la liste `export { ... }`, après `buffsApplicables,`.

- [ ] **Step 4: Exposer la fonction aux tests**

Dans `tests/helpers/load-app.js`, à côté de `buffsDeLEquipe` :

```js
  bonusCategorieDesBuffs:typeof bonusCategorieDesBuffs === "function"
    ? bonusCategorieDesBuffs
    : undefined,
```

- [ ] **Step 5: Fusionner dans la vue**

Dans `js/vues/calculateur.js`, la vue calcule aujourd'hui `const coches = buffsProposes(element).filter(...)`. Juste après ce calcul, ajouter :

```js
    /* Les bonus de categorie du BUILD et ceux des buffs coches
       s'ADDITIONNENT : ils viennent de sources differentes - potentiels,
       equipement, tenue gravee, soutiens - et le jeu les cumule. */
    const bonusDesBuffs = bonusCategorieDesBuffs(coches);
    const bonusParCategorie = Object.assign({}, bases.bonusParCategorie);
    Object.keys(bonusDesBuffs).forEach(categorie => {
      bonusParCategorie[categorie] =
        (Number(bonusParCategorie[categorie]) || 0) + bonusDesBuffs[categorie];
    });
```

Puis remplacer les **deux** usages de `bases.bonusParCategorie` plus bas — dans l'appel à `tableauDesCompetences` et dans celui à `sectionCalibration` — par `bonusParCategorie`.

Et ajouter `bonusCategorieDesBuffs` à l'import depuis `../metier/calculateur-entrees.js`.

- [ ] **Step 6: Lancer les tests**

```bash
npm run test:unit && node tests/calculateur.playwright.js
```

Attendu : tout passe. Aucun buff actuel ne porte de code de catégorie, donc aucun chiffre ne bouge — la fonction rend `{}` partout.

- [ ] **Step 7: Commit**

```bash
git add js/metier/calculateur-entrees.js js/vues/calculateur.js tests/calculateur-entrees.test.js tests/helpers/load-app.js
git commit -m "feat: faire atterrir les buffs de categorie dans leur seule categorie

Les cinq codes de stat de categorie ne sont pas dans CIBLE_DU_BUFF, et ne
peuvent pas y etre : les seaux d'entreesDuCalcul valent pour TOUTES les
competences a la fois, donc un bonus de competence normale y gonflerait
l'ultime. Un buff portant un de ces codes ne changeait donc rien du tout.

bonusCategorieDesBuffs les sort a part, pour etre fusionnes avec les bonus que
le build porte deja - potentiels, armes, equipement. Les deux sources
s'additionnent, le jeu les cumulant.

La table inverse est derivee de STAT_DE_LA_CATEGORIE plutot que reecrite :
deux listes tenues en parallele finiraient par diverger.

Aucun buff actuel ne porte de code de categorie, donc aucun chiffre ne bouge.
C'est la machinerie qu'attendaient les passifs de tenue gravee, et les cinq
buffs de soutien restreints listes dans l'en-tete de buffs-supports.js.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: La table des 26 passifs « sur soi », et sa garde

**C'est la seule tâche risquée, et elle est isolée pour cela.** Ces passifs portent deux ou trois effets chacun, donc autant de nombres : attribuer la valeur d'un effet à un autre serait une erreur **muette**. Aucun code ne lit encore la table à la fin de cette tâche — c'est voulu, un relecteur doit pouvoir la vérifier seule.

**Files:**
- Create: `data/passifs-graves.js`, `tests/passifs-graves.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `window.SEVEN_DS_BUILD_STATS.engravedByFile` de `data/stats-build.js`.
- Produces: `window.SEVEN_DS_PASSIFS_GRAVES` — objet dont la clé est le fichier de tenue et la valeur un tableau d'entrées `{ id, libelle, cible, stat|effet, operation, unite, element, niveaux, provenance }`. Consommé par la Task 4.

- [ ] **Step 1: Écrire le test de garde**

Créer `tests/passifs-graves.test.js` :

```js
"use strict";

/* La table des passifs de tenue gravee est ECRITE A LA MAIN. Ce test tient
   lieu de generateur.

   Sa regle centrale : la PHRASE citee est choisie pour que le nombre qui la
   suit immediatement SOIT la valeur stockee. Le test la cherche dans le texte
   de chacun des trois niveaux et compare. Sans cela, rien n'empecherait
   d'attribuer a un effet la valeur d'un autre - ces passifs en portent deux ou
   trois chacun - et l'erreur serait muette : aucun test ne casse, seuls les
   degats sont faux. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const racine = path.join(__dirname, "..");

function catalogueDe(fichier, cle){
  const bac = { window:{} };
  vm.runInNewContext(
    fs.readFileSync(path.join(racine, "data", fichier), "utf8"), bac
  );
  return bac.window[cle];
}

const TABLE = catalogueDe("passifs-graves.js", "SEVEN_DS_PASSIFS_GRAVES");
const GRAVEES = catalogueDe("stats-build.js", "SEVEN_DS_BUILD_STATS")
  .engravedByFile;
const LIBELLES = JSON.parse(fs.readFileSync(
  path.join(racine, "7ds-stats", "libelles-stats.json"), "utf8"
));

const nu = texte => (texte || "").replace(/\[#?[0-9A-Fa-f-]*\]/g, "");
const identifiants = new Set();
let lignes = 0;

Object.keys(TABLE).forEach(fichier => {
  const tenue = GRAVEES[fichier];
  assert.ok(tenue, "tenue inconnue du catalogue : " + fichier);
  const niveaux = tenue.passiveLevels || [];
  assert.equal(niveaux.length, 3,
    fichier + " : trois niveaux de passif attendus, recu " + niveaux.length);

  TABLE[fichier].forEach(passif => {
    lignes++;
    assert.ok(!identifiants.has(passif.id),
      "identifiant en double : " + passif.id);
    identifiants.add(passif.id);

    /* Une entree porte SOIT un code de stat du heros, SOIT un effet sur la
       cible. Jamais les deux, jamais aucun : sans cette exclusion, une ligne
       mal ecrite tomberait dans la branche permissive et passerait. */
    const surLaCible = Object.prototype.hasOwnProperty.call(passif, "effet");
    assert.notEqual(surLaCible,
      Object.prototype.hasOwnProperty.call(passif, "stat"),
      passif.id + " : une entree porte `stat` OU `effet`, exactement un des deux");
    if(surLaCible){
      assert.ok(["defense", "defenseCritique"].includes(passif.effet),
        passif.id + " : effet inconnu sur la cible -> " + passif.effet);
      assert.equal(passif.cibleEnnemi, true,
        passif.id + " : un malus sur la cible doit porter cibleEnnemi:true");
    }else{
      assert.ok(Object.prototype.hasOwnProperty.call(LIBELLES, passif.stat),
        passif.id + " : code de stat inconnu du depot -> " + passif.stat);
    }

    assert.ok(["soi", "allies"].includes(passif.cible),
      passif.id + " : cible doit valoir \"soi\" ou \"allies\"");
    assert.ok(["add", "multiply"].includes(passif.operation),
      passif.id + " : operation invalide -> " + passif.operation);
    assert.ok(["flat", "ten-thousandths"].includes(passif.unite),
      passif.id + " : unite invalide -> " + passif.unite);
    assert.ok(passif.libelle && passif.libelle.trim(),
      passif.id + " : un passif sans libelle est illisible a l'ecran");
    assert.equal(passif.niveaux.length, 3,
      passif.id + " : trois valeurs attendues, une par niveau");
    assert.ok(passif.niveaux.every(v => typeof v === "number" && v > 0),
      passif.id + " : une valeur absente s'omet, elle ne vaut jamais zero");

    /* LA garde. Pour chacun des trois niveaux : la phrase citee doit etre un
       extrait litteral du texte de CE niveau, y apparaitre EXACTEMENT une
       fois - sinon on ne saurait pas de quel nombre on parle - et le nombre
       qui la suit doit valoir la valeur stockee. */
    niveaux.forEach((source, index) => {
      const texte = nu(source.textFr);
      const morceaux = texte.split(passif.provenance.phrase);
      assert.equal(morceaux.length, 2,
        passif.id + " : la phrase doit apparaitre EXACTEMENT une fois au "
          + "niveau " + source.level + "\n  cherche : "
          + passif.provenance.phrase);
      const trouve = /^(-?\d+(?:[.,]\d+)?)\s*%?/.exec(morceaux[1]);
      assert.ok(trouve && trouve[1],
        passif.id + " : aucun nombre ne suit la phrase au niveau "
          + source.level);
      const lu = Number(trouve[1].replace(",", "."));
      const attendu = passif.unite === "ten-thousandths"
        ? passif.niveaux[index] / 100
        : passif.niveaux[index];
      assert.equal(lu, attendu,
        passif.id + " : niveau " + source.level + ", le texte annonce " + lu
          + " et la table stocke " + attendu);
    });
  });
});

/* Les 26 passifs offensifs « sur soi » sont le lot de ce chantier. Les 14
   « allies » suivront. Ce compte empeche qu'un oubli passe inapercu. */
assert.equal(Object.keys(TABLE).length, 26,
  "26 tenues attendues dans ce lot, recu " + Object.keys(TABLE).length);

console.log("passifs-graves.test.js OK (" + lignes + " lignes sur "
  + Object.keys(TABLE).length + " tenues)");
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

```bash
node tests/passifs-graves.test.js
```

Attendu : ÉCHEC — `data/passifs-graves.js` n'existe pas encore.

- [ ] **Step 3: Écrire l'en-tête du fichier de données**

Créer `data/passifs-graves.js` avec cet en-tête, puis l'objet à remplir :

```js
// Passifs de tenue gravee qui changent les degats.
//
// ECRIT ET MAINTENU A LA MAIN, comme data/buffs-supports.js : aucun script ne
// le regenere, et aucun ne doit le citer.
//
// Cle = le fichier de la tenue, celui d'engravedByFile dans stats-build.js.
//
// LA REGLE DE TRANSCRIPTION, et elle n'est pas negociable :
//   `provenance.phrase` est choisie pour que le NOMBRE QUI LA SUIT
//   IMMEDIATEMENT soit la valeur stockee, et elle doit apparaitre exactement
//   UNE fois dans le texte de chaque niveau.
//
//   Ces passifs portent deux ou trois effets chacun, donc autant de nombres.
//   Sans cette regle, rien n'empecherait d'attribuer a un effet la valeur d'un
//   autre, et l'erreur serait MUETTE : aucun test ne casse, seuls les degats
//   sont faux. Un test relit les trois niveaux dans stats-build.js et compare.
//
//   Pour un cumul - « +5 % par coup (Max : 30 %) » - la phrase pointe
//   « (Max : » et la valeur vaut 30. Le transcripteur est force de designer le
//   nombre exact au lieu de le deduire. C'est la convention « max atteignable »
//   deja retenue pour buffs-supports.js.
//
// niveaux : les trois valeurs, du niveau 1 au niveau 3, en dix-milliemes.
// cible   : "soi"     le passif ne profite qu'a celui qui porte la tenue ;
//           "allies"  il dit « tous les heros allies », donc il profite a
//                     l'equipe ENTIERE, porteur compris.
// element : null, ou l'attribut vise quand le buff ne concerne que lui.
//
// CE QUI N'Y FIGURE PAS : les passifs sans effet offensif - barrieres, soins,
// recharges, jauges, vitesse de deplacement. Sans conversion offensive ils ne
// changent aucun degat, et les chiffrer a zero se lirait comme « ce passif ne
// sert a rien ». Vingt-huit des soixante-huit tenues sont dans ce cas.
window.SEVEN_DS_PASSIFS_GRAVES = {
};
```

- [ ] **Step 4: Transcrire les 26 tenues, une par une**

Pour chaque tenue de la liste ci-dessous, lire les **trois** niveaux :

```bash
node -e "
const D='c:/Users/yanni/Desktop/Site Confrérie 7ds/';
global.window={};require(D+'data/stats-build.js');
const E=window.SEVEN_DS_BUILD_STATS.engravedByFile;
const k=Object.keys(E).find(x=>x.includes(process.argv[1]));
console.log(k);
E[k].passiveLevels.forEach(p=>console.log('N'+p.level+' | '
  +(p.textFr||'').replace(/\[#?[-0-9A-Fa-f]*\]/g,'').replace(/\n/g,' | ')));
" "Défense simple"
```

**Les 26 tenues :** Aventure du prince (tristan), Aventure en toute sécurité (howzer), Chevalier honorable (dreyfus), Chevalier sacré de la tempête (howzer), Chevalier sacré des explosions (guila), Chevalier sacré prometteur (gil-thunder), Chevalier sacré à la visière en étoile (jericho), Défense simple (meliodas), Défense solide (dreydrin), Fille de la forêt et de la terre (tioreh), Fille enjouée (diane), Gloire du passé (drake), Le Grizzly de la Paresse (king), Le Sanglier de la Gourmandise (merlin), Le Serpent de l'Envie (diane), Lumière de guidance (elaine), Majesté bien malveillante (meliodas), Piste de la flamme cramoisie (guila), Retour du Chevalier Sacré (hendrickson), Rituel sacré (manny), Résistance et révolution (derieri), Tenue d'exercice d'exploratrice (klotho), Tenue de fête légère (klotho), Tenue modeste (dreyfus), Traces de souvenirs (jericho), Vêtements formels légers (merlin).

**Ne transcrire que les effets offensifs.** Ignorer barrières, soins, recharges, jauges, déplacement, perforation.

**Correspondance des codes de stat :**

| Ce que dit le texte | Code |
|---|---|
| chances crit. | `C_Critical_Rate` |
| dégâts crit. | `C_Critical_Dam_Rate` |
| augmente l'attaque (du héros, en %) | `I_AtkAdd_Rate` |
| dégâts de *Feu / Foudre / Vent / Froid / Terre / Ténèbres / Sacré* | `Fire_/Thunder_/Wind_/Ice_/Earth_/Dark_/Holy_Element_Rate` + `element` |
| dégâts d'attaque normale | `Normalattack_Damadd_Rate` |
| dégâts de compétence normale | `Normalskill_Damadd_Rate` |
| dégâts d'attaque spéciale | `Activethird_Damadd_Rate` |
| dégâts d'attaque ultime | `Ultimateskill_Damadd_Rate` |
| dégâts de compétence de relève | `Normalskillchangetag_Damadd_Rate` |
| percement de défense | `D_Protect_Cur_Rate` |
| réduit la défense de l'ennemi | `effet:"defense"`, `cibleEnnemi:true` |
| réduit la défense crit. de l'ennemi | `effet:"defenseCritique"`, `cibleEnnemi:true` |

**Trois exemples travaillés, à recopier comme modèle :**

*Cas simple, un seul effet retenu.* `Défense simple` (Meliodas) — niveau 1 : « Recevoir Libération infernale augmente les dégâts de compétence normale de **50%** pendant 5 s. Lorsque l'effet est actif, les attaques dans le dos ont 25% de chances de réduire le temps de recharge… » La seconde phrase est une recharge : hors modèle.

```js
  "7ds-armures-ssr/Armure liee/Défense simple.webp":[
    {
      id:"meliodas-defense-simple-competence-normale",
      libelle:"Libération infernale reçue : compétence normale +80 %",
      cible:"soi",
      stat:"Normalskill_Damadd_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:null,
      niveaux:[5000, 6500, 8000],
      provenance:{ phrase:"augmente les dégâts de compétence normale de " }
    }
  ],
```

*Cas à cumul, deux effets retenus.* `Chevalier honorable` (Dreyfus) — niveau 3 : « À chaque boost de dégâts crit. obtenu, augmente les dégâts d'attaque ultime de 15% pendant 10 s. **(Max : 75%)** — Augmente les dégâts du Sacré de **40%** pendant 20 s en attaquant un ennemi qui bénéficie d'une barrière. »

```js
  "7ds-armures-ssr/Armure liee/Chevalier honorable.webp":[
    {
      id:"dreyfus-chevalier-honorable-ultime",
      libelle:"Boosts de dégâts crit. cumulés : ultime +75 %",
      cible:"soi",
      stat:"Ultimateskill_Damadd_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:null,
      niveaux:[4500, 6000, 7500],
      provenance:{ phrase:"(Max : " }
    },
    {
      id:"dreyfus-chevalier-honorable-sacre",
      libelle:"Cible sous barrière : dégâts du Sacré +40 %",
      cible:"soi",
      stat:"Holy_Element_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:"holy",
      niveaux:[2400, 3200, 4000],
      provenance:{ phrase:"Augmente les dégâts du Sacré de " }
    }
  ],
```

*Piège à connaître.* `Le Grizzly de la Paresse` (King) porte **aussi** un `(Max : ` et **aussi** « dégâts du Sacré ». Les phrases citées doivent rester uniques **dans leur propre tenue** — le test le vérifie tenue par tenue, donc deux tenues peuvent citer la même phrase sans conflit.

- [ ] **Step 5: Lancer le test après chaque tenue**

```bash
node tests/passifs-graves.test.js
```

Ne pas attendre les 26 pour lancer : le test nomme la tenue, le niveau, le nombre lu et le nombre stocké. C'est ce qui rend l'erreur visible pendant qu'on l'écrit plutôt que six mois plus tard.

L'assertion des 26 tenues échoue jusqu'à la dernière — c'est normal, et c'est ce qui garantit qu'aucune n'est oubliée.

- [ ] **Step 6: Brancher le test dans npm**

Dans `package.json`, ajouter `&& node tests/passifs-graves.test.js` juste après `node tests/equipe-buffs.test.js`, dans `test` ET dans `test:unit`.

- [ ] **Step 7: Lancer la suite**

```bash
npm run test:unit
```

Attendu : tout passe. Aucun code ne lit encore la table, donc aucun chiffre ne bouge.

- [ ] **Step 8: Commit**

```bash
git add data/passifs-graves.js tests/passifs-graves.test.js package.json
git commit -m "feat: transcrire les 26 passifs de tenue gravee du porteur

Les soixante-huit tenues gravees portent un passif, et aucun n'entrait dans le
calcul. Vingt-six sont offensifs pour leur porteur - dont les +80 % de degats
de competence normale de Defense simple sur Meliodas. Vingt-huit sont hors
modele et le restent : barrieres, soins, recharges, jauges.

La garde vaut mieux que celle des buffs de soutien, et elle doit : ces passifs
portent deux ou trois effets chacun, donc autant de nombres. La phrase citee
est choisie pour que le nombre qui la SUIT soit la valeur stockee, et elle doit
apparaitre exactement une fois par niveau. Le test relit les trois niveaux dans
stats-build.js et compare. Sans cela, attribuer la valeur d'un effet a un autre
ne casserait rien - seuls les degats seraient faux.

Aucun code ne lit encore cette table : elle est livree seule pour qu'un
relecteur puisse la verifier ligne a ligne.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Le module pur et l'affichage

**Files:**
- Create: `js/metier/passifs-graves.js`
- Modify: `js/vues/calculateur.js`, `sw.js`, `tests/helpers/modules.js`, `tests/helpers/load-app.js`, `tests/passifs-graves.test.js`, `tests/calculateur.playwright.js`

**Interfaces:**
- Consumes: `window.SEVEN_DS_PASSIFS_GRAVES` (Task 3), `bonusCategorieDesBuffs` (Task 2), `CoequipiersStore` (Task 1), `LINKED_ARMOR_SLOT` de `js/noyau/constantes.js`, `gearPassiveStatus` et `buildGearDefinition` de `js/metier/build-config.js`.
- Produces: `passifsGravesApplicables({ porteurs, element })` → tableau d'entrées copiées, chacune avec `support` (le charId du porteur), `tenue`, `valeur` résolue et `niveauInconnu` (booléen).

- [ ] **Step 1: Écrire le test qui échoue**

À ajouter à la fin de `tests/passifs-graves.test.js`, avant le `console.log` final :

```js
/* Le module pur : qui recoit quoi, et a quelle valeur. */
{
  const { loadApp } = require("./helpers/load-app");
  const { passifsGravesApplicables } = loadApp().hooks;
  assert.equal(typeof passifsGravesApplicables, "function",
    "passifsGravesApplicables doit etre expose par le chargeur de tests");

  const TENUE = "7ds-armures-ssr/Armure liee/Défense simple.webp";
  const porteur = (extra) => Object.assign(
    { charId:"meliodas", tenue:TENUE, niveau:3, estLeHeros:true }, extra
  );

  /* Le heros recoit les passifs « soi » de SA tenue. */
  const sien = passifsGravesApplicables({
    element:"dark", porteurs:[porteur()]
  });
  assert.ok(sien.length > 0, "le heros doit recevoir les passifs de sa tenue");
  assert.equal(sien[0].support, "meliodas",
    "chaque ligne doit nommer son porteur");
  assert.equal(sien[0].valeur, 8000,
    "au niveau 3, la valeur est la troisieme du tableau");
  assert.equal(sien[0].niveauInconnu, false);

  /* Le passif « soi » d'un COEQUIPIER ne concerne pas le heros. */
  assert.deepEqual(
    passifsGravesApplicables({
      element:"dark", porteurs:[porteur({ estLeHeros:false })]
    }),
    [],
    "un passif « soi » porte par un coequipier ne doit pas atteindre le heros"
  );

  /* Le niveau decide de la valeur. */
  assert.equal(
    passifsGravesApplicables({
      element:"dark", porteurs:[porteur({ niveau:1 })]
    })[0].valeur,
    5000
  );

  /* Niveau inconnu : la valeur PLANCHER, et le drapeau leve. Le plancher et
     non le plafond : le chiffre ne peut alors qu'etre sous-estime, jamais
     flatte. */
  const inconnu = passifsGravesApplicables({
    element:"dark", porteurs:[porteur({ niveau:null })]
  })[0];
  assert.equal(inconnu.valeur, 5000, "niveau inconnu : la valeur plancher");
  assert.equal(inconnu.niveauInconnu, true, "et le drapeau doit etre leve");

  /* Une tenue sans passif modelise n'apporte rien, et ne casse rien. */
  assert.deepEqual(
    passifsGravesApplicables({
      element:"dark",
      porteurs:[porteur({ tenue:"inconnue.webp" })]
    }),
    []
  );

  /* Le filtre par element s'applique par-dessus, comme pour les soutiens. */
  const parElement = TABLE[TENUE].filter(p => p.element);
  if(parElement.length){
    const autre = parElement[0].element === "fire" ? "ice" : "fire";
    assert.ok(
      passifsGravesApplicables({ element:autre, porteurs:[porteur()] })
        .every(ligne => ligne.id !== parElement[0].id),
      "un passif elementaire ne doit pas atteindre un build d'un autre element"
    );
  }

  /* AUCUNE ENTREE INERTE. Cochee, une ligne doit changer quelque chose : soit
     une entree du moteur, soit un bonus de categorie.

     Ce filet a deja attrape des codes de stat inventes dans buffs-supports.js,
     mais il doit ici accepter les DEUX sorties : un buff de categorie ne
     touche justement aucune entree du moteur, et le filet d'origine le
     rejetterait a tort - alors que c'est exactement ce qu'on construit. */
  const { entreesDuCalcul, bonusCategorieDesBuffs } = loadApp().hooks;
  const NEUTRE = {
    atk:1000, attaqueElementaire:500, def:400, maxHp:20000,
    critRate:3000, critDamage:12000, percementDefense:500
  };
  Object.keys(TABLE).forEach(fichier => TABLE[fichier].forEach(passif => {
    const ligne = Object.assign({}, passif, { valeur:passif.niveaux[2] });
    const nu = entreesDuCalcul({ statsDuBuild:NEUTRE, buffsCoches:[] });
    const avec = entreesDuCalcul({ statsDuBuild:NEUTRE, buffsCoches:[ligne] });
    const changeLeMoteur = Object.keys(nu).some(cle => nu[cle] !== avec[cle]);
    const changeUneCategorie =
      Object.keys(bonusCategorieDesBuffs([ligne])).length > 0;
    assert.ok(changeLeMoteur || changeUneCategorie,
      passif.id + " : ce passif ne change NI une entree du moteur NI un bonus "
        + "de categorie. Son code de stat n'est branche nulle part, donc il "
        + "serait coche sans rien faire.");
  }));
}
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

```bash
node tests/passifs-graves.test.js
```

Attendu : ÉCHEC sur `passifsGravesApplicables doit etre expose par le chargeur de tests`.

- [ ] **Step 3: Écrire le module**

Créer `js/metier/passifs-graves.js` :

```js
/* Les passifs de tenue gravee qui atteignent le heros calcule.

   Module PUR : ni DOM, ni reseau, ni roster. La vue lui passe des porteurs
   deja reduits a { charId, tenue, niveau, estLeHeros } ; c'est elle qui lit
   l'armure liee de chaque build et le niveau de son passif.

   `niveau` vaut 1, 2, 3 ou null. Null n'est pas une erreur : le membre peut
   ne pas avoir renseigne ce champ, et le calcul doit rester possible. */

  /* Le catalogue est charge A LA DEMANDE par la vue, comme les competences et
     les buffs : le lire par window plutot que par import evite de le faire
     payer aux visiteurs qui ne calculent rien. */
  function tableDesPassifs(){
    return window.SEVEN_DS_PASSIFS_GRAVES || {};
  }

  /* Qui recoit quoi.

     Le heros recoit les DEUX sortes : un passif « allies » dit « tous les
     heros allies », et il en fait partie. Le passif « soi » d'un coequipier ne
     le concerne pas. */
  function atteintLeHeros(passif, porteur){
    return porteur.estLeHeros || passif.cible === "allies";
  }

  function passifsGravesApplicables(entree){
    const source = entree || {};
    const vise = (source.element || "").toLowerCase();
    const porteurs = Array.isArray(source.porteurs) ? source.porteurs : [];
    return porteurs.flatMap(porteur => (tableDesPassifs()[porteur.tenue] || [])
      .filter(passif => atteintLeHeros(passif, porteur))
      .filter(passif => !passif.element
        || passif.element.toLowerCase() === vise)
      .map(passif => {
        /* Niveau inconnu : la valeur PLANCHER. Pas le plafond : le chiffre ne
           peut alors qu'etre sous-estime, jamais flatte, et la vue le dit pour
           que le membre sache quoi renseigner. */
        const niveauInconnu = !(porteur.niveau >= 1 && porteur.niveau <= 3);
        const rang = niveauInconnu ? 0 : porteur.niveau - 1;
        return Object.assign({}, passif, {
          support:porteur.charId,
          tenue:porteur.tenue,
          valeur:passif.niveaux[rang],
          niveauInconnu
        });
      }));
  }

export { passifsGravesApplicables };
```

- [ ] **Step 4: Déclarer le module et exposer la fonction**

Dans `tests/helpers/modules.js`, ajouter `"metier/passifs-graves.js",` juste après `"metier/equipe-buffs.js",`.

Dans `sw.js`, ajouter `"./js/metier/passifs-graves.js",` juste après `"./js/metier/equipe-buffs.js",`, et `"./data/passifs-graves.js",` juste après `"./data/buffs-supports.js",`.

Dans `tests/helpers/load-app.js`, à côté de `buffsDeLEquipe` :

```js
  passifsGravesApplicables:typeof passifsGravesApplicables === "function"
    ? passifsGravesApplicables
    : undefined,
```

Dans `tests/helpers/load-app.js`, charger aussi la table dans le bac à sable, juste après le bloc qui charge `buffs-supports.js` :

```js
  const passifsSandbox = { window:{} };
  vm.runInNewContext(
    fs.readFileSync(path.join(ROOT, "data", "passifs-graves.js"), "utf8"),
    passifsSandbox,
    { filename:"passifs-graves.js" }
  );
  sandbox.SEVEN_DS_PASSIFS_GRAVES = passifsSandbox.window.SEVEN_DS_PASSIFS_GRAVES;
```

- [ ] **Step 5: Charger la table dans la vue**

Dans `js/vues/calculateur.js`, `chargerCatalogues()` injecte déjà deux fichiers. Ajouter le troisième : dans la condition de tête, `&& window.SEVEN_DS_PASSIFS_GRAVES`, et dans le `Promise.all`, une troisième entrée :

```js
      window.SEVEN_DS_PASSIFS_GRAVES
        ? Promise.resolve(true) : injecter("./data/passifs-graves.js")
```

- [ ] **Step 6: Lire les porteurs dans la vue**

Ajouter les imports :

```js
import { passifsGravesApplicables } from "../metier/passifs-graves.js";
import { LINKED_ARMOR_SLOT } from "../noyau/constantes.js";
import { buildGearDefinition, gearPassiveStatus } from "../metier/build-config.js";
```

(`LINKED_ARMOR_SLOT` s'ajoute à l'import existant depuis `../noyau/constantes.js` plutôt que d'en créer un second.)

Puis, à côté de `coequipiersChoisis` :

```js
  /* La tenue gravee d'un build, et le niveau de son passif.

     Le niveau vaut null quand le membre ne l'a pas renseigne : c'est un etat
     normal, que gearPassiveStatus nomme « missing ». Le module pur retombe
     alors sur la valeur plancher. */
  function porteurDeTenue(charId, heros, estLeHeros){
    const tenue = heros && heros.armor
      ? heros.armor[LINKED_ARMOR_SLOT] : null;
    if(!tenue) return null;
    const config = heros.armorConfig
      ? heros.armorConfig[LINKED_ARMOR_SLOT] : null;
    const statut = gearPassiveStatus(buildGearDefinition(tenue), config);
    return {
      charId,
      tenue,
      niveau:statut === "valid" ? config.passiveLevel : null,
      estLeHeros
    };
  }

  /* Le heros calcule d'abord, puis ses coequipiers : le membre lit sa propre
     tenue en tete, avant celles qu'il emprunte. */
  function porteursDeTenues(hero){
    const liste = [porteurDeTenue(etat.charId, hero, true)];
    etat.coequipiers.forEach(choix => {
      if(!choix) return;
      liste.push(porteurDeTenue(choix.charId, herosDuChoix(choix), false));
    });
    return liste.filter(Boolean);
  }
```

- [ ] **Step 7: Dessiner la section**

Ajouter dans `js/vues/calculateur.js`, juste après `sectionSoutiens` :

```js
  /* Les passifs de tenue gravee. Une section a PART des soutiens, qui restent
     les buffs venus des competences : la tenue du heros calcule n'est pas un
     soutien, et les melanger brouillerait les deux. */
  function sectionTenuesGravees(passifs, redessiner){
    const section = el("section",{class:"calc-tenues"},[
      el("strong",{text:"Tenues gravées"})
    ]);
    if(!passifs.length){
      section.appendChild(el("p",{class:"calc-muette",
        text:"Aucun passif de tenue gravée ne s'applique à ce build."}));
      return section;
    }
    const parPorteur = new Map();
    passifs.forEach(passif => {
      const cle = passif.support + "|" + passif.tenue;
      if(!parPorteur.has(cle)) parPorteur.set(cle, []);
      parPorteur.get(cle).push(passif);
    });

    const grille = el("div",{class:"calc-soutiens-grille"});
    parPorteur.forEach(lignes => {
      const bloc = el("div",{class:"calc-soutien"});
      const nomTenue = String(lignes[0].tenue).split("/").pop()
        .replace(/\.webp$/, "");
      bloc.appendChild(el("h4",{class:"calc-soutien-nom",
        text:nomDuPersonnage(lignes[0].support) + " · " + nomTenue}));
      lignes.forEach(passif => {
        const caseACocher = el("input",{
          type:"checkbox",
          onchange:()=>{
            if(etat.coches.has(passif.id)) etat.coches.delete(passif.id);
            else etat.coches.add(passif.id);
            redessiner();
          }
        });
        caseACocher.checked = etat.coches.has(passif.id);
        bloc.appendChild(el("label",{class:"calc-buff"},[
          caseACocher,
          el("span",{text:passif.libelle})
        ]));
        if(passif.niveauInconnu){
          bloc.appendChild(el("p",{class:"calc-muette",
            text:"Niveau de passif non renseigné — valeur du niveau 1."}));
        }
      });
      grille.appendChild(bloc);
    });
    section.appendChild(grille);
    return section;
  }
```

- [ ] **Step 8: Brancher la section et le calcul**

Dans `js/vues/calculateur.js`, juste après `vue.appendChild(sectionSoutiens(element, dessiner));`, ajouter :

```js
    const passifsGraves = passifsGravesApplicables({
      element, porteurs:porteursDeTenues(hero)
    });
    vue.appendChild(sectionTenuesGravees(passifsGraves, dessiner));
```

Puis remplacer le calcul de `coches` :

```js
    const coches = buffsProposes(element)
      .filter(buff => etat.coches.has(buff.id));
```

par :

```js
    /* Les deux sources se rejoignent ici, et une seule fois : buffs de
       soutien et passifs graves portent la meme forme - `stat`, `valeur`,
       `operation` - donc le moteur ignore d'ou ils viennent. */
    const coches = buffsProposes(element)
      .concat(passifsGraves)
      .filter(entree => etat.coches.has(entree.id));
```

- [ ] **Step 9: Étendre le test de bout en bout**

Dans `tests/calculateur.playwright.js`, juste avant l'assertion finale `assert.deepEqual(errors, [], …)` :

```js
    /* La section des tenues gravees existe, et ses cases sont DECOCHEES : ces
       passifs sont presque tous conditionnels, donc rien ne s'applique sans un
       geste du membre. */
    const tenues = page.locator(".calc-tenues");
    await tenues.waitFor();
    assert.equal(await tenues.locator("input:checked").count(), 0,
      "aucun passif de tenue gravee coche par defaut");
```

- [ ] **Step 10: Lancer la suite complète**

```bash
npm test
```

Attendu : tout passe. Deux tests sont connus pour être instables — `supabase-etape1.playwright.js` et `accessibilite-mobile.playwright.js` — les relancer avant de conclure à une régression.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: appliquer les passifs de tenue gravee aux degats

Les vingt-six passifs offensifs du porteur entrent enfin dans le calcul, a
commencer par les +80 % de degats de competence normale que Defense simple
donne a Meliodas - le plus gros levier qui manquait a la page.

Qui recoit quoi : le heros calcule prend les passifs « soi » ET « allies » de
sa propre tenue, un passif « allies » disant « tous les heros allies » et lui
en faisant partie. D'un coequipier, il ne prend que les « allies ».

Le niveau vient du build. Non renseigne, on sert la valeur du niveau 1 et on
l'ecrit : le chiffre ne peut alors qu'etre sous-estime, jamais flatte, et le
membre sait quoi renseigner pour gagner le vrai.

Des cases a cocher, decochees par defaut, dans une section a PART des
soutiens : ces passifs sont presque tous conditionnels, et la tenue du heros
calcule n'est pas un soutien.

Buffs de soutien et passifs graves portent la meme forme, donc le moteur
ignore d'ou ils viennent - et les bonus de categorie des deux passent par
bonusCategorieDesBuffs, qui les fait atterrir sur leur seule categorie.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Ce que ce plan ne fait PAS

- **Les 14 passifs `allies`.** La machinerie les gère dès la Task 4 — `cible` les distingue — mais la table ne les porte pas. Pure transcription à venir, sans code. L'assertion « 26 tenues » de `tests/passifs-graves.test.js` devra alors monter à 40.
- **Les 28 passifs hors modèle.** Barrières, soins, recharges, jauges : ils ne changent aucun dégât.
- **Les cinq buffs de soutien restreints à une catégorie**, listés dans l'en-tête de `data/buffs-supports.js`. La Task 2 les débloque techniquement ; les écrire reste un geste à part.
- **Les passifs d'arme et d'armure ordinaire**, toujours déclarés non couverts par `stats-calcul.js`.
