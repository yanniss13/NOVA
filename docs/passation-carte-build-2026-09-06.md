# Passation — la carte Discord `/build`

Date : **2026-09-06**. Dépôt : `C:\Users\yanni\Desktop\Site Confrérie 7ds`.
Langue de travail avec le propriétaire : **français**.

## 1. Où en est le travail

`/build <joueur> <personnage> [arme]` est **en production** depuis le commit
`1049790` : elle publie dans Discord une fiche illustrée du build d'un membre,
avec autocomplétion sur les trois champs.

Depuis, une refonte graphique complète a été faite, **commitée mais non
poussée**. Le propriétaire a fourni une maquette (fiche de jeu à cadre filé
d'or, trois zones) et a demandé de s'en inspirer. Elle fonctionne : la carte
sort à `1660 × 974`, en minuscules accentuées, avec jauges et barres.

**Aucun de ces changements n'est poussé.** Le propriétaire a explicitement
demandé qu'on **ne pousse jamais sans son accord** — un « vas-y » vaut pour ce
changement-là, pas pour les suivants.

## 2. État exact de git

```text
HEAD          8d009c1  feat(carte): la fiche /build reprend la maquette,
                       en minuscules accentuees
origin/main   1049790  fix(discord): les etoiles sont celles de
                       l outrepassement, et la promotion s en va
```

**`8d009c1` est commité localement mais PAS poussé.** Le propriétaire décidera
lui-même quand pousser ; ne pas le faire à sa place.

**`npm run test:unit` : 91/91 au vert** au moment de ce commit.

`apercu-build.png` traîne à la racine, non suivi : c'est un rendu jetable, ne
pas le commiter.

Fichiers du propriétaire à ne jamais toucher ni commiter :
`docs/passation-claude-2026-08-28.md`, `docs/stats-monstres-discord.txt`,
`docs/transcendances-muettes-partage.html`.

## 3. Ce qui a été construit, et pourquoi

### La typographie — c'était le vrai verrou

L'atlas du planning (`availability-font.js`) ne connaît que
`ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-/:.()|=?` : toutes les cartes sortaient
en capitales sans accents. Son générateur n'est pas dans le dépôt.

`scripts/generer-police-carte.py` en fabrique un **second**, séparé :
`supabase/functions/_shared/carte-font.js`, 120 caractères, quatre faces
(`titre`, `section`, `corps`, `petit`), 95 Ko. Le planning garde le sien —
une refonte de la carte ne peut pas l'abîmer.

Les polices sont dans `polices/` : **Cinzel** (titres) et **EB Garamond**
(corps), toutes deux sous SIL Open Font License, téléchargées depuis le dépôt
Google Fonts avec leur `OFL.txt`. La licence exige que ces fichiers de licence
voyagent avec les polices : **ne pas les supprimer**.

Côté rendu, `availability-pdf.js` a gagné `atlasTextExact` et
`atlasStringWidthExact`, qui dessinent et mesurent **sans mettre en
capitales** — `atlasText` continue de le faire pour le planning.

### La carte

`_shared/discord-build-png.js` a été réécrit sur la maquette : cadre extérieur
à double filet et équerres, en-tête centré, puis trois zones — portrait à
gauche, `01 ARME` au centre (arme + armure gravée), `02 ARMURE` en grille 2×2
et `03 BIJOUX` à droite.

L'armure gravée a rejoint la section « Arme » parce qu'elle porte un passif et
des enchantements, comme l'arme ; les quatre pièces ordinaires n'ont qu'un nom
et tiennent donc en grille. Chaque section porte un champ `disposition`
(`colonne` / `grille` / `liste`) : c'est le modèle qui dit comment il se
dessine, pas le rendu qui devine.

### Les jauges

Le niveau, l'outrepassement et **chaque enchantement** sont des jauges :
libellé à gauche, valeur à droite, trait dessous. Les enchantements se
remplissent selon la position de la valeur tirée entre son minimum et son
maximum possibles, comme le jeu le montre.

Ces bornes viennent de `data/libelles-discord.json`, dédoublonnées : publiées
telles quelles elles pesaient 590 Ko, elles en font **18**. Deux constats
vérifiés dans les données le permettent :

1. l'élément d'une perle ne change **pas** les bornes, seulement la liste des
   statistiques proposées — zéro désaccord sur 17 141 paires `palier|stat` ;
2. quatre tables suffisent aux 276 grades d'arme, dix-huit aux 136 pièces.

**Les bornes d'une pièce s'emploient brutes ; celles d'une arme se mettent à
l'échelle du taux de leur emplacement — mais seulement pour les armes de type
`basic`.** Les perles (`masterstone`) ont un `slots` vide et emploient leurs
bornes telles quelles. C'est ce que fait l'éditeur du site.

## 4. Ce qui reste à faire

1. **Regarder `apercu-build.png`** et juger la carte avec le propriétaire.
   Le rendre avec le script de la section 6.
2. **Les vignettes ont changé de taille** : `TAILLE_OBJET` 72 → 80,
   `TAILLE_PORTRAIT` 144 → 288. Le dossier `_site/7ds-vignettes` pèse 5,2 Mo
   au lieu de 2,9. Vérifier que ça reste acceptable au déploiement.
3. **Espace vide** en bas des colonnes gauche et milieu : les trois colonnes
   sont forcées à la même hauteur. La maquette a le même défaut ; à voir si le
   propriétaire veut mieux.
4. **Les icônes au trait de la maquette** ne sont pas reproduites : la carte
   pose les vraies icônes du jeu, en couleur. Assumé, dit au propriétaire.
5. **`docs/discord-planning.md` n'est pas à jour** : il décrit encore la carte
   en capitales et sans jauges d'enchantement.
6. Trois demandes du propriétaire jamais commencées :
   - le refus d'autorisation de l'autocomplétion répond une **liste vide**, ce
     qui ressemble à une panne ; y mettre une proposition qui explique ;
   - quand le champ `joueur` est vide, `personnage` ne propose **rien** ;
     proposer les personnages présents dans les rosters de la confrérie ;
   - il a dit que ces deux points étaient « déjà corrigés » de son côté —
     **le vérifier avant de coder quoi que ce soit**.

## 5. Les pièges de ce chantier

- **Le dépôt est en CRLF sous Windows, LF sur le runner.** Toute comparaison
  de fichier généré doit normaliser les fins de ligne. `estAJour` de
  `generer-libelles-discord.js` le fait ; s'en inspirer.
- **La CLI Supabase n'est pas installée.** Préfixer chaque commande de
  `npx -y supabase@latest`. Sans le préfixe, PowerShell répond « n'est pas
  reconnu ».
- **Chaque module de `_shared/` doit être importé explicitement par
  `index.ts`**, même si un autre module partagé s'en sert déjà : la CLI
  Supabase construit la liste des fichiers à téléverser en suivant les
  `import`, jamais les `require`. Un module oublié fait tomber la fonction
  entière à son premier appel. Un test le vérifie.
- **`deno check` remonte trois erreurs `Blob([Uint8Array])`** : deux
  préexistent sur `main` et la fonction tourne en production. Ce n'est pas une
  régression.
- Les vignettes sont **fabriquées au déploiement** par le job `package` du
  workflow Pages, jamais versionnées. `7ds-vignettes/` est dans `.gitignore`.

## 6. Rendre un aperçu

```powershell
python scripts/generer-vignettes.py    # une fois, pour avoir les images
node scripts/apercu-carte-build.js     # écrit apercu-build.png
```

## 7. Déployer, quand le propriétaire le demandera

```powershell
npx -y supabase@latest functions deploy discord-planning --project-ref uxouhbgdlolidjmxwgae
```

Compter les lignes « Uploading asset » : il en faut **neuf** désormais
(`carte-font.js` s'ajoute). Une de moins veut dire qu'un module manque à
`index.ts`.

L'enregistrement des commandes n'est à relancer que si une **définition**
change (nom, description, options) :

```powershell
$env:DISCORD_APPLICATION_ID = "<application-id>"
$env:DISCORD_GUILD_ID = "<id-du-serveur>"
$env:DISCORD_BOT_TOKEN = "<token-bot>"
npm run discord:register-commands
Remove-Item Env:DISCORD_BOT_TOKEN
```
