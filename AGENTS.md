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
- [ ] Partage réseau entre membres (voir « Évolutions prévues »). **Non commencé.**

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
├─ index.html              # L'appli (HTML + CSS + JS inline). Charge data.js + potentiels.js.
├─ package.json            # Scripts de test Node + Playwright (développement uniquement).
├─ package-lock.json       # Versions verrouillées des dépendances de test.
├─ tests/                  # Régressions du potentiel commun et parcours Chromium.
├─ data.js                 # GÉNÉRÉ. window.SEVEN_DS_DATA = { personnages, armes, armures, bijoux }.
├─ generate-data.ps1       # Régénère data.js en scannant les dossiers d'images.
├─ potentiels.js           # GÉNÉRÉ. 3 armes compatibles + bonus par héros.
├─ generate-potentiels.py  # Régénère potentiels.js depuis 7dsorigin.app (internet requis).
├─ AGENTS.md               # Ce fichier.
├─ docs/superpowers/specs/ # Spec de design détaillée.
├─ 7ds-personnages/        # <id>.webp  (ex. meliodas.webp)
├─ 7ds-armes/<Type>/       # 12 dossiers de types d'armes, *.webp
├─ 7ds-armures-ssr/<Slot>/ # Haut, Bas, Bottes, Ceinture, Armure liee — *.webp
└─ 7ds-bijoux/<Slot>/      # Anneau, Collier, Boucle d'oreille — *.webp (vides pour l'instant)
```

## Règle d'or sur les assets

**On ne hardcode JAMAIS la liste des images dans `index.html`.**
Quand l'utilisateur ajoute/retire des images, il relance `generate-data.ps1`
et `data.js` est régénéré. `index.html` ne lit QUE `window.SEVEN_DS_DATA`.

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
dont le dossier n'appartient pas aux 3 clés de potentiel du personnage.

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
