# Site Confrérie 7DS — Team Builder (Boss de Guilde)

Outil web local pour que les membres d'une confrérie **7DS Origin** construisent des
équipes (perso + arme + armures + notes) et les affichent sur une page
**« Équipes dispo pour le Boss de Guilde »**.

> Ce fichier est le point d'entrée pour tout agent (Codex, Claude, etc.) qui
> reprend le projet. Lis-le en entier avant de coder.

## État actuel — 2026-07-24

- [x] Assets rangés dans des dossiers (fournis par l'utilisateur, ne pas renommer).
- [x] `generate-data.ps1` — scanne les dossiers et génère `data.js`.
- [x] `data.js` — données d'assets générées (24 persos, 12 types d'armes, 5 armures).
- [x] `index.html` — appli complète (builder + page d'affichage), autonome.
- [x] Bijoux **SSR uniquement** (grade5) : 34 images intégrées
      (11 anneaux, 12 colliers, 11 boucles d'oreilles) — correspond aux badges
      « SSR » du site. Source : `https://7dsorigin.app/images/items/<gameId>.webp`
      (gameId lu dans le JSON embarqué de `7dsorigin.app/fr/bijoux`, filtré sur
      `grade == grade5`, `displayName` = nom de fichier, `slot`
      Ring/Necklace/Earring → dossier Anneau/Collier/Boucle d'oreille).
- [x] Potentiels : palier T0→T10 par héros, façon page team-builder du site.
      Données FR (24 persos × ~3 types d'arme × 10 paliers) dans `potentiels.js`,
      régénérable via `generate-potentiels.py`. Le palier est **commun au héros** ;
      les 3 clés d'armes par héros déterminent les armes compatibles et l'arme
      équipée choisit les descriptions de bonus affichées.
- [x] Compatibilité des armes : le picker ne propose que les 3 types autorisés
      du héros. Toute arme incompatible est automatiquement retirée.
- [x] Compatibilité des armures liées : 66 images locales associées aux 24 héros
      (2 ou 3 par héros). Le picker filtre selon le personnage et retire les
      anciennes valeurs incompatibles.
- [x] Badges **élément + armes** par personnage. `personnages-meta.js`
      (`generate-meta.py`) : role/rarity + `weapons` = 3 slots
      `{weapon, role, element}`. ⚠️ L'élément **dépend de l'arme équipée**
      (chaque slot a son élément) — ne PAS afficher `meta.element` fixe.
      `badgesRow(ch, hero, compact)` : la pastille d'élément et le surlignage
      suivent l'arme équipée (`FOLDER_TO_ENUM` mappe le dossier → enum du slot).
      Builder = 3 armes (équipée surlignée, autres estompées) ; roster = seule
      l'arme équipée. Icônes locales `7ds-ui/mastery/<arme>.webp` (12) +
      `role-elements/<element>_<role>.webp` (30), depuis `7dsorigin.app/images/ui/`.
- [x] Roster épuré : les cartes d'équipe ne montrent plus les icônes
      d'équipement (portrait, nom, badge d'arme équipée, potentiel, note).
      Clic sur la carte / bouton « Voir l'équipement » → modal `#teamOverlay`
      (`openTeamDetail`/`heroDetail`/`equipLine`) avec l'équipement complet
      (arme + 5 armures + 3 bijoux, noms) par héros.
- [~] **Partage réseau (Supabase) — EN COURS, Étape 1**. Comptes + équipes +
      recensement partagés. Projet Supabase créé, config + SQL prêts.
      👉 **Codex : lis `docs/superpowers/specs/2026-07-25-supabase-etape1-handoff.md`**
      (contexte complet, modèle de données, plan d'implémentation, manips Supabase
      restantes). Fichiers : `supabase-config.js`, `supabase/schema.sql`.
      Auth validée = email + mot de passe SANS confirmation email.

L'appli fonctionne en **local uniquement** : on ouvre `index.html` par double-clic
(protocole `file://`). Les équipes sont stockées dans le **localStorage** du
navigateur. Partage prévu plus tard (l'utilisateur partage via Discord pour l'instant).

## Comment lancer

Double-clic sur `index.html`. Aucun serveur, aucune install, aucun build.
Fonctionne hors-ligne (les polices web ont un repli système).

Pour les tests de développement uniquement :

```powershell
npm test
```

Playwright et Chromium sont des outils de vérification ; l'application livrée
reste autonome et ne dépend pas de npm.

## Structure du dépôt

```
Site Confrérie 7ds/
├─ index.html              # L'appli. Charge data.js + potentiels.js + armures-liees.js + personnages-meta.js.
├─ package.json            # Scripts de test Node + Playwright (développement uniquement).
├─ package-lock.json       # Versions verrouillées des dépendances de test.
├─ tests/                  # Régressions du potentiel commun et parcours Chromium.
├─ data.js                 # GÉNÉRÉ. window.SEVEN_DS_DATA = { personnages, armes, armures, bijoux }.
├─ generate-data.ps1       # Régénère data.js en scannant les dossiers d'images.
├─ potentiels.js           # GÉNÉRÉ. 3 armes compatibles + bonus par héros.
├─ generate-potentiels.py  # Régénère potentiels.js depuis 7dsorigin.app (internet requis).
├─ armures-liees.js        # GÉNÉRÉ. Fichiers d’armure liée par personnage.
├─ generate-armures-liees.py # Régénération manuelle depuis la page publique.
├─ personnages-meta.js     # GÉNÉRÉ. element/role/rarity + weapons[] par personnage.
├─ generate-meta.py        # Régénère personnages-meta.js depuis 7dsorigin.app.
├─ 7ds-ui/                 # Icônes d'UI : mastery/<arme>.webp, role-elements/<el>_<role>.webp
├─ AGENTS.md               # Ce fichier.
├─ docs/superpowers/specs/ # Spec de design détaillée.
├─ 7ds-personnages/        # <id>.webp  (ex. meliodas.webp)
├─ 7ds-armes/<Type>/       # 12 dossiers de types d'armes, *.webp
├─ 7ds-armures-ssr/<Slot>/ # Haut, Bas, Bottes, Ceinture, Armure liee — *.webp
└─ 7ds-bijoux/<Slot>/      # Anneau, Collier, Boucle d'oreille — *.webp (vides pour l'instant)
```

## Règle d'or sur les assets

**On ne hardcode JAMAIS la liste des images dans `index.html`.**
Les assets proviennent de `window.SEVEN_DS_DATA`, régénéré via
`generate-data.ps1` lorsque l'utilisateur ajoute ou retire des images. La
compatibilité des armures liées provient de `window.SEVEN_DS_ARMURES_LIEES`.

Pourquoi un fichier généré et pas un scan JS direct ? En `file://`, JavaScript ne
peut pas lister le contenu d'un dossier. `data.js` contourne ça sans serveur.

### Forme de `window.SEVEN_DS_DATA`
```js
{
  generatedAt: "AAAA-MM-JJ HH:mm:ss",
  personnages: [ { id, name, file } ],          // file = chemin relatif .webp
  armes:   { "<Libellé type>": [ { name, file } ] },   // groupé par type
  armures: { "Haut": [ { name, file } ], "Bas": [...], "Bottes": [...],
             "Ceinture": [...], "Armure liee": [...] }, // groupé par emplacement
  bijoux:  { "Anneau": [ { name, file } ], "Collier": [...],
             "Boucle d'oreille": [...] }  // groupé par emplacement (peut être vide)
}
```

### Armures liées (`window.SEVEN_DS_ARMURES_LIEES`, depuis `armures-liees.js`)
```js
window.SEVEN_DS_ARMURES_LIEES = {
  "<charId>": [
    "7ds-armures-ssr/Armure liee/<nom>.webp"
  ]
};
```

`generate-armures-liees.py` régénère cet instantané uniquement lorsqu’il est
lancé manuellement avec `python generate-armures-liees.py`. Il lit la page
publique de référence en une requête, sans télécharger aucune image. Il ne
s’exécute jamais dans le navigateur : `index.html` ne charge que
`armures-liees.js` local et ne contacte donc jamais cette source.

`normalizeHero()` refuse une valeur de `armor["Armure liee"]` si son fichier
n’appartient pas au tableau du héros. Les quatre emplacements universels
`Haut`, `Bas`, `Bottes` et `Ceinture` ne sont pas filtrés par cette règle.

## Modèle de données d'une équipe (localStorage)

Clé localStorage : `confrerie7ds.teams` → tableau JSON d'équipes.

```js
{
  id: "uuid",
  pseudo: "NomDuMembre",
  boss: "",                 // réservé (non utilisé dans l'UI actuelle)
  createdAt: 1690000000000,
  updatedAt: 1690000000000,
  heroes: [                 // TOUJOURS 4 entrées (slot vide = char null)
    {
      char: "meliodas" | null,        // id de personnage
      weapon: "7ds-armes/.../x.webp" | null, // forcément compatible avec char
      armor: { "Haut": file|null, "Bas": file|null, "Bottes": file|null,
               "Ceinture": file|null, "Armure liee": file|null },
      jewel: { "Anneau": file|null, "Collier": file|null,
               "Boucle d'oreille": file|null },
      potentiel: { tier: 0..10 },
      note: "texte libre"
    }
    // x4
  ]
}
```

### Potentiels (`window.SEVEN_DS_POTENTIELS`, depuis `potentiels.js`)
```js
{ "<charId>": { "<dossier d'arme>": [ "<bonusFr T1>", ... "<T10>" ] } }
// dossier d'arme = segment de chemin de hero.weapon (ex. "Hache", "Epee 1 main").
// bonusFr contient un balisage couleur [#RRGGBB]texte[-] rendu par renderBonus().
// Les 3 sous-clés sont les armes compatibles du héros.
// L'arme équipée choisit la liste affichée ; le palier stocké reste commun au héros.
```

Constantes utiles dans `index.html` : `STORAGE_KEY`, `TEAM_SIZE` (= 4),
`ARMOR_SLOTS`, `JEWEL_SLOTS` (ordre d'affichage des emplacements).
Le Store, `editTeam()` et l'import normalisent les anciennes équipes : ajout des
champs d'équipement manquants et migration de l'ancien potentiel
`{ weaponType, tier }` vers `{ tier }`. `normalizeHero()` retire aussi toute arme
dont le dossier n'appartient pas aux 3 clés de potentiel du personnage, ainsi
que toute armure liée incompatible avec le héros.

## Décisions de conception (ne pas casser sans raison)

- **4 personnages** par équipe (format boss de guilde). Voir `TEAM_SIZE`.
- Équipement par héros : 1 arme + 5 armures + **3 bijoux** (Anneau, Collier,
  Boucle d'oreille), calqués sur les 3 catégories du site de référence.
- Chaque équipe porte un **pseudo de membre** (seule métadonnée demandée).
- **Potentiel** par héros : un palier commun T0–T10, indépendant de son arme.
  L'arme équipée choisit seulement les descriptions officielles affichées.
  `renderBonus()` rend leur balisage couleur. Pas de calcul de stats.
- **Pas de calcul de stats chiffrées** : aucune donnée de stats n'existe dans les
  assets. Le « détail » d'un perso = arme + 5 armures + une note libre.
- Arme choisie en 2 temps : type puis arme. Le picker filtre les groupes aux
  3 types autorisés par les clés de `window.SEVEN_DS_POTENTIELS[charId]`.
- Export / Import JSON = sauvegarde de secours et base du futur partage.

## Évolutions prévues (non commencées)

- **Partage réseau** : passer du localStorage à une base partagée (ex. Supabase
  gratuit) pour que « chacun crée son équipe, visible par tous » via un lien
  Discord. Garder l'export/import JSON comme format d'échange pivot.
- Champ **boss ciblé** et **note globale d'équipe** (déjà réservés dans le modèle).

## Conventions

- Français partout dans l'UI.
- Tout est inline dans `index.html` (pas d'outillage). Rester sans dépendance.
- Thème : héraldique sombre (obsidienne + or vieilli + pourpre). Voir la spec.
- Après modif des dossiers d'images : relancer `generate-data.ps1`.
