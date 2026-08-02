# Comment ce code est organisé

Tu reprends ce projet ? Lis cette page en entier, elle fait cinq minutes et
t'évitera de chercher.

## En une phrase

`index.html` porte le style et le balisage ; tout le JavaScript vit dans `js/`,
rangé en **cinq couches** qui ne se regardent que dans un sens.

## Les cinq couches

Elles sont empilées. **Une couche n'appelle jamais une couche située
au-dessus d'elle dans ce tableau.** C'est la seule règle d'architecture du
projet, et elle est vérifiée par un test.

| Couche | Rôle | Peut appeler |
|---|---|---|
| `noyau/` | Briques sans domaine : DOM, utilitaires, constantes, client Supabase | rien |
| `etat/` | État mutable partagé entre les vues | `noyau` |
| `metier/` | Logique pure : calculs, règles du jeu. **Ni DOM ni réseau.** | `noyau`, `etat` |
| `donnees/` | Lectures et écritures Supabase. **Aucun rendu.** | `noyau`, `etat`, `metier` |
| `vues/` | Tout ce qui touche au DOM | toutes les précédentes |
| `app.js` | Le reste, pas encore découpé : les vues qui n'ont pas encore été sorties, et le démarrage | tout |

## Où trouver quoi

### `noyau/` — les fondations

| Fichier | Contenu |
|---|---|
| `constantes.js` | Catalogues et libellés (`DATA`, `ELEMENTS`, `WEAPON_ENUM`, clés de stockage) |
| `dom.js` | `$`, `el`, `norm`, `uid`, `initials` |
| `outils.js` | `jsonCopy`, `owns`, `isInteger` |
| `supabase-client.js` | `sb`, le client — **`null` si la configuration manque**, donc à tester avant usage — et `authMessage`, qui traduit ses erreurs |

### `etat/` — ce qui change

| Fichier | Contenu |
|---|---|
| `session.js` | `sessionCourante` : utilisateur, pseudo, profils du roster — et `canManageTeam`, la seule question qu'on lui pose |
| `brouillon-equipe.js` | `brouillonEquipe` : l'équipe en cours d'édition dans le Builder |

**Pourquoi des objets et pas des `let` exportés ?** Parce qu'une liaison
exportée par un module ES est **en lecture seule chez l'importateur** : on peut
la lire, jamais la réaffecter. Une propriété d'objet, si. Sans ça, aucune vue
ne pouvait sortir de `app.js`.

### `metier/` — les règles du jeu

| Fichier | Contenu |
|---|---|
| `catalogue.js` | Index sur les données générées : `nameOfFile`, `charOf` |
| `armes.js` | Identité d'une arme : dossier, type, compatibilité |
| `equipement.js` | Sets d'armure et de bijoux, modèles vides |
| `perles.js` | Perle de sortilège : paliers, longueur des enchantements |
| `build-config.js` | Lecture du catalogue généré + diagnostic d'une configuration saisie |
| `stats-calcul.js` | **Le moteur de calcul des stats** |
| `equipe-modele.js` | Normalisation de toute équipe venue du dehors |
| `dispos-logique.js` | Masques de disponibilité, semaines, agrégation |
| `boss-logique.js` | Semaine de boss, projection « Mon suivi », scores |

`stats-calcul.js` mérite un mot : il produit des **termes** — « +120 ATK, venant
du passif de l'arme » — et non des totaux opaques. C'est ce qui permet à
l'interface d'expliquer chaque chiffre au membre. Ne casse pas ça.

`equipe-modele.js` aussi : ses fonctions **ne lèvent jamais**. Elles complètent
ce qui manque et rognent ce qui déborde, pour qu'une équipe sauvegardée par une
version plus ancienne du site reste ouvrable.

### `donnees/` — le réseau

| Fichier | Contenu |
|---|---|
| `roster-profils.js` | Les pseudos de la confrérie, lus une fois puis mis en cache |
| `equipes-store.js` | Les équipes : `LocalTeams` (localStorage) et `Store` (arbitre local/nuage) |
| `roster-store.js` | Le roster des membres, cache indexé par propriétaire |
| `boss-store.js` | Sessions de boss : groupes, inscriptions, rapports |
| `suivi-store.js` | « Mon suivi » : assemblage et cache hors ligne |

### `vues/` — l'écran

| Fichier | Contenu |
|---|---|
| `elements.js` | Briques de rendu partagées : `gearSlot`, `renderBonus`, `rosterWeaponLabel` |
| `toast.js` | Le bandeau de notification |
| `modal-stack.js` | La pile de modales : ouverture, fermeture, restitution du focus, `closeModalAfterAsyncRefresh` |
| `picker.js` | La modale de sélection réutilisable |
| `stats-affichage.js` | Mise en forme des termes de stats, libellés partagés |
| `stats-heros.js` | Le bloc de statistiques d'un héros, dans les fiches |
| `fiche-heros.js` | La fiche d'un héros — **le noyau commun aux grosses modales** |
| `detail-equipe.js` | La modale de détail d'une équipe : l'équipement héros par héros |
| `equipe-boss.js` | L'équipe d'un membre dans une session de boss : bandeau et participant |
| `detail-roster.js` | La modale de détail d'un personnage consulté chez un autre membre |
| `editeur-arme.js` | La modale de configuration d'une arme |
| `editeur-equipement.js` | La modale de configuration d'une pièce d'équipement |
| `dispos.js` | La vue des disponibilités hebdomadaires |
| `navigation.js` | Les onglets et **le registre des vues** — la seule façon de changer d'onglet |
| `modale-auth.js` | La fenêtre de connexion (le contenant seul) |
| `boss-sessions.js` | L'onglet « Sessions de boss » : groupes, inscriptions, rapports, archive |

**Un cas instructif :** `weaponTermLabel` et `gearTermLabel` vivaient dans les
deux éditeurs. Quand `stats-heros.js` en a eu besoin, le contrôle des couches a
refusé — un module d'affichage de stats ne peut pas importer d'un éditeur
déclaré après lui. La règle a désigné le bon rangement toute seule : ces
libellés appartenaient à `stats-affichage.js`. **Quand le test des couches
proteste, c'est presque toujours le rangement qui a tort, pas le test.**

## Les trois fichiers à ne jamais oublier

Une extraction touche **trois** endroits en plus du code. En oublier un casse
quelque chose de silencieux :

1. **`tests/helpers/modules.js`** — l'ordre de chargement, source unique de
   vérité. Le chargeur `vm` des tests unitaires s'en sert.
2. **`sw.js`, tableau `CORE_ASSETS`** — sinon le mode hors ligne casse **sans
   aucun test rouge visible**.
3. **l'`import` réel**, en tête du module, au-dessus de l'IIFE.

`node tests/modules-imports.test.js` vérifie les trois en une seconde.
**Lance-le après chaque déplacement, avant `npm test`.**

## Le piège qui a mordu quatre fois

Le chargeur de tests unitaires **concatène tous les modules dans une portée
commune**. Un symbole oublié y reste donc visible : `npm run test:unit` passe
au vert alors que le navigateur, lui, lèvera un `ReferenceError`.

**Conséquence : les tests unitaires ne valident jamais une extraction.**
Toujours `npm test` en entier.

`tests/modules-imports.test.js` existe pour combler ce trou. Il refuse :

- un symbole employé sans être importé ;
- un symbole employé alors que son module ne l'exporte pas ;
- un symbole employé alors qu'il est resté dans `app.js` ;
- un `import` qui ne sert plus ;
- un **`export` que personne n'importe** ;
- un import qui **remonte les couches** ;
- un module absent de `MODULES` ou de `CORE_ASSETS`.

Le contrôle des exports orphelins est le plus récent. Il est sûr parce que le
chargeur `vm` **retire les `export`** avant de concaténer : un symbole n'a
jamais besoin d'être exporté pour être testé. Un export que personne n'importe
est donc mort sans ambiguïté. Il a immédiatement trouvé `ROLES` (trois rôles),
resté là après le passage à `WSLOT_ROLES` (cinq, « vocabulaire plus fin »).

## Si tu veux découper davantage

`app.js` est passé de **10 489 à 3 382 lignes**. Ce qui reste :

| Zone | Lignes | Frontière | Bloqué par |
|---|---|---|---|
| Roster des membres | 819 | 2 sorties, 8 entrées | les aides du Builder (l. 246-670) |
| Builder | 708 | 7 sorties, 19 entrées | ses propres aides, éparpillées en tête |
| Analyse (+ DPS dérivés) | ~530 | — | — |
| **Mon suivi** | **343** | **1 sortie, 1 entrée** | **`resetTeamDraft` seul** |
| Équipes, Export/Import, auth, démarrage | ~980 | — | — |

**Le prochain lot évident est « Mon suivi » : une seule sortie
(`renderDashboardView`), un seul verrou (`resetTeamDraft`).**

Et ce verrou est le même que celui qui bloquait les sessions de boss :
`resetTeamDraft` appelle `renderBuilder`, donc il ne peut pas descendre dans
`etat/`. **Sortir le Builder débloque tout le reste d'un coup** — c'est lui, la
dernière base commune.

⚠️ Attention : le Builder ne tient pas dans sa bannière. Une vingtaine de ses
aides (`emptyDraft`, `applyGearChange`, `builderWeaponSwitcher`,
`resetBuilderRosterBaselines`…) vivent **lignes 246 à 670**, loin au-dessus.
Le relevé de frontière les montre ; la lecture par bannière, non.

### La leçon qui s'est vérifiée sept fois

Les modales pesaient 17, 12, 9 et 7 symboles ; les sessions de boss,
1 575 lignes. À chaque fois, **sortir la base commune d'abord** a fait tomber
les clôtures sans toucher une ligne du code qui s'appuyait dessus.

Et **une clôture dit ce qui sort ENSEMBLE, pas où chaque morceau atterrit.**
Huit symboles tirés par ces extractions ne devaient pas suivre la vue et sont
descendus d'une couche : `authMessage`, `canManageTeam`, `teamFromBossSnapshot`,
`favoriteRosterWeaponType`, `rosterHeroSnapshot`, `rosterWeaponLabel`,
`closeModalAfterAsyncRefresh`, `bossStatCell`. Le signal qui tranche :
**compter les appelants hors du domaine**.

### Quand deux modules se veulent l'un l'autre : le registre

`showView` citait chaque vue, donc la navigation importait tout le monde ; et
chaque vue voulait appeler `showView`. Aucune ne pouvait sortir en premier.

`vues/navigation.js` renverse la dépendance : il ne connaît personne, chaque
vue s'annonce au chargement par `enregistrerVue(nom, rendu)`. C'est ce qui a
débloqué les 1 575 lignes des sessions de boss. **Garde ce motif en tête pour
le Builder** — c'est probablement la même sortie.

⚠️ **Une clôture ne voit que les déclarations.** Trois modales traînaient des
lignes de câblage d'événements au premier niveau (`$("#x").addEventListener…`)
qu'aucun relevé ne signale. Relis toujours les lignes autour de la tranche.

## La méthode

Construis le graphe de dépendances entre déclarations de premier niveau,
calcule la **clôture transitive** de chaque déclaration, et extrais une clôture
entière. Par construction elle ne dépend de rien d'autre — donc pas de cycle.
Découper « par zone de commentaire » ne marche plus depuis longtemps.

Le script est dans
[la passation](../docs/superpowers/specs/2026-08-01-refactor-index-passation.md).
L'écrire dans un fichier, **pas dans un heredoc** : le shell y mange les
accents graves des expressions régulières.

Trois pièges rencontrés pour de vrai :

- **l'ombrage** : un nom peut être aussi un paramètre local ailleurs (`draft`
  l'était dans neuf fonctions). Vérifier avant tout renommage global, et
  relire ensuite chaque occurrence restante.
- **les clés d'objet** : `draft:initial` n'est pas un emploi du symbole.
- **l'ordre des déclarations** : garder l'ordre d'origine dans le module
  produit. Un `const` déplacé avant son initialisation ne casse pas au
  chargement, seulement plus tard, à l'usage.
