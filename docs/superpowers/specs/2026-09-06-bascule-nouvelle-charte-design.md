# Bascule du site sur la nouvelle charte — conception de la migration

## Objet

Amener le site reel a ressembler a la maquette validee de
`docs/refonte-maquette/`, sans perdre une seule fonction en route.

La cible visuelle et la navigation sont deja decrites par
[2026-09-06-refonte-site-maquette-design.md](2026-09-06-refonte-site-maquette-design.md).
Ce document ne les redecrit pas : il decrit la MIGRATION, c'est-a-dire l'ordre
des travaux, ce que chaque lot deplace, et ce qui garantit qu'on peut revenir
en arriere.

## Ce que la bascule ne change pas

La refonte ne deplace que ce qui existe deja. Les blocs inventes par la
maquette et qu'aucun code ne sait encore calculer — statistiques du centre
Boss, recommandation automatique de groupes, priorites classees de Mon suivi —
restent hors perimetre et redeviendront des demandes separees.

Ne bougent pas non plus : le modele de donnees, Supabase et sa securite au
niveau des lignes, le service worker, les Edge Functions, les commandes
Discord, le calculateur de degats et le moteur OCR.

## Filet de securite

- `ancien-site` est cree sur le `main` d'avant travaux, et pousse sur GitHub.
  C'est le point de retour : `git reset --hard ancien-site` restaure le site
  tel qu'il etait.
- Le chantier vit sur `refonte-bascule`. `main` n'est touche qu'au moment
  d'une livraison de lot, jamais en cours de lot.
- Chaque lot est livrable seul : a la fin de n'importe quel lot, le site
  deploye est coherent, sans ecran a moitie refait.

## Decoupage

**Lot 0 — la bascule.** Jetons de la nouvelle palette, coquille, rubriques,
accueil public, repeinture des vues existantes. C'est le lot qui change le
visage du site.

**Lots 1 a 6 — les ecrans**, dans cet ordre : Boss de Guilde, Mon suivi,
Roster, Equipes et Team Builder, Outils, Compte et administration. Chacun
reconstruit un ecran avec les composants de la maquette.

Le reste de ce document specifie le lot 0. Chaque lot suivant recevra sa
propre section quand il commencera.

## Lot 0

### Les jetons

`css/base.css` recoit la palette de la maquette, mot pour mot, sous les noms de
la maquette. Les noms de jetons de l'ancienne charte sont CONSERVES et
redefinis comme alias des nouveaux.

Cet alias est le coeur du lot : les feuilles du site comptent 676 usages de
`var(--...)` contre une cinquantaine de couleurs ecrites en dur. Redefinir les
jetons repeint donc l'essentiel du site sans toucher aux vues, et les alias
disparaitront ecran par ecran au fil des lots 1 a 6.

Correspondance :

| Ancien | Nouveau |
| --- | --- |
| `--obsidian` | `--abyss` |
| `--obsidian-2`, `--panel` | `--slate` |
| `--panel-2` | `--slate-light` |
| `--gold-bright` | `--gold-light` |
| `--crimson` | `--alert` |
| `--muted` | `--mist` |
| `--ink` | `--abyss` |
| `--ui` | `--body` |

`--line` et `--line-soft` existent des deux cotes avec la meme opposition
franc / discret : ils prennent directement les valeurs de la maquette, deux
filets dores. `--radius` passe a 7px, `--shadow` a l'ombre de la maquette.

Le texte courant passe a `Georgia, "Times New Roman", serif`, comme la
maquette. C'est un ecart assume avec le document de conception, qui prevoyait
de garder la pile systeme : le proprietaire a valide la maquette telle qu'elle
s'affiche. La lisibilite des tableaux denses sera verifiee en capture avant
livraison du lot.

### La coquille

`index.html` remplace son en-tete, sa barre d'onglets, son menu mobile et son
pied de page par ceux de la maquette. Le balisage est ecrit dans le fichier, il
n'est pas genere en JavaScript : l'accueil public doit rester lisible sans JS,
pour l'apercu de lien et pour le premier affichage hors ligne.

La coquille comprend le lien d'evitement, l'en-tete a sceau et marque, la
navigation de bureau, le menu Outils, le bouton de compte, le bouton et le
tiroir mobiles, la barre mobile basse a cinq entrees, et le pied de page qui
recueille le lien LootBar avec son `rel="sponsored"`.

Deux ecarts assumes avec la maquette, tous deux invisibles pour un visiteur :

- une entree **Boss de guilde** est ajoutee a la navigation de bureau. Sans
  elle le centre de commandement, coeur du site, n'est atteignable que depuis
  l'accueil. Elle est masquee tant que la vue n'est pas autorisee, donc un
  visiteur sans compte voit exactement les quatre entrees de la maquette.
- une entree **Membres** apparait pour les seuls administrateurs.

Les feuilles nouvelles sont `css/coquille.css` et `css/accueil.css`, reprises
de `maquette.css`. `tests/css-ordre.test.js` est mis a jour en consequence.

### Les rubriques

`js/vues/navigation.js` porte deja un groupe unique, le Boss de Guilde, avec
ses trois sous-onglets. Ce mecanisme est generalise : une table de rubriques
remplace `GROUPE_BOSS` et `VUES_DU_GROUPE`.

Cette table part dans un module pur, `js/metier/rubriques.js`, testable sans
navigateur, sur le modele de `js/metier/routage.js`.

| Rubrique | Onglets locaux | Vues existantes |
| --- | --- | --- |
| Notre guilde | — | `home`, `dashboard` |
| Equipes | Creer une equipe · Equipes partagees | `builder`, `roster` |
| Boss de guilde | Disponibilites · Groupes et rapports | `availability`, `boss` |
| Roster | — | `member-roster` |
| Outils | Wiki · Collection · Calculateur · Analyse | `wiki`, `collection`, `calculateur`, `analyse` |
| Membres | — | `admin` |

Un piege de nommage est traite explicitement : la vue `roster` du site est
« Equipes dispo pour le Boss de Guilde », alors que la rubrique **Roster** de
la maquette designe le roster personnel, c'est-a-dire la vue `member-roster`.
Les identifiants de rubrique sont donc distincts des noms de vue.

Chaque vue appartient a exactement une rubrique. La rubrique reste surlignee
tant qu'une de ses vues est ouverte. `showView` garde son contrat : les onze
vues enregistrees dans `js/app.js` ne changent pas d'une ligne.

### L'accueil public

Une douzieme vue, `home`, est ajoutee : `js/vues/accueil.js`, section
`#view-home` dans `index.html`, feuille `css/accueil.css`. Elle reprend
exactement l'accueil de la maquette — banniere, trois cartes essentielles,
bande d'outils, appel a la connexion.

Elle est publique et devient la vue de repli du visiteur sans compte, a la
place du Wiki. Un membre connecte qui ouvre « Notre guilde » arrive sur
`dashboard`, comme le prevoit le document de conception.

`js/metier/routage.js` gagne la route `home` ; `js/app.js` enregistre la vue.

### La repeinture

Apres les alias de jetons, il reste une cinquantaine de couleurs hexadecimales
et une centaine de `rgba()` ecrites en dur dans les treize feuilles. Elles sont
remplacees par les jetons correspondants, feuille par feuille.

Aucune structure de vue n'est modifiee dans ce lot : seules les couleurs, les
bordures, les rayons et les ombres changent.

### Les tests

Le lot casse par construction les tests navigateur qui cliquent sur les
onglets actuels. Deux regles :

- les tests unitaires ne doivent pas bouger. S'ils cassent, c'est une
  regression, pas un effet de bord attendu.
- les tests navigateur sont mis a jour pour viser les ancres de la nouvelle
  coquille, et JAMAIS assouplis. Un test qui verifiait qu'un onglet mene
  quelque part doit continuer a le verifier.

Ancres stables offertes par la coquille, sur lesquelles les tests s'appuient :
`[data-view]` pour une vue, `[data-rubrique]` pour une rubrique, `#view-<nom>`
pour la section, `.view.active` pour la vue ouverte.

Tests nouveaux :

- `tests/rubriques.test.js` : la table des rubriques couvre les douze vues,
  chaque vue appartient a une seule rubrique, aucun identifiant de rubrique
  n'entre en collision avec un nom de vue.
- `tests/coquille.test.js` : `index.html` porte les elements de la coquille,
  le lien LootBar garde son `rel="sponsored"`, chaque rubrique de la table a
  son entree de navigation.
- `tests/refonte-coquille.playwright.js` : navigation de bureau et mobile,
  onglets locaux, menu Outils, tiroir mobile, focus au clavier, et absence de
  debordement horizontal a 1440, 1024, 390 et 320 px.

### Validation

1. `npm test` complet, unitaires et navigateur.
2. Captures a 1440, 1024, 390 et 320 px des douze vues.
3. Lecture des captures : contrastes, debordements, lisibilite du texte
   courant en Georgia sur les tableaux denses.
4. Comparaison de l'accueil reel avec l'accueil de la maquette.

## Hors perimetre du lot 0

La composition interne des vues. Un ecran garde sa structure actuelle,
repeinte a la nouvelle charte, jusqu'a ce que son lot le reconstruise avec les
composants de la maquette.
