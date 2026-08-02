# Refactor de `index.html` — passation

> **À LIRE EN PREMIER, avant toute autre ligne de ce document.**
>
> Ce fichier peut être périmé dès sa rédaction. **L'avancement réel se lit dans
> les commits, jamais ici.** Commence toujours par :
>
> ```bash
> git log --oneline main..HEAD
> git status --short
> npm test
> ```
>
> Le journal fait foi. Si un commit contredit ce document, c'est ce document qui
> a tort — corrige-le.

## Où en est-on

**Branche :** `refactor/decoupage-index`, créée le 1er août 2026 depuis `main`
au commit `5e0b491`.

**Conception : TRANCHÉE avec l'utilisateur le 1er août 2026.** Elle est écrite
dans [2026-08-01-refactor-index-design.md](2026-08-01-refactor-index-design.md).
La section « Ce qu'il faut trancher » plus bas est conservée pour mémoire, mais
**elle est close** — n'y retourne pas poser les questions.

Décisions retenues, en résumé :

- **modules ES**, choix explicite de l'utilisateur en connaissance du coût ;
- **JavaScript seul**, le CSS et le balisage restent dans `index.html` ;
- **découpage par domaine**, un lot par domaine, `npm test` vert avant commit ;
- **l'ouverture en `file://` est abandonnée** — l'utilisateur passe toujours par
  GitHub Pages.

La branche a été remise à niveau sur `main` (correctif mobile des dispos
inclus).

### Lot 0 — TERMINÉ

Les six tests Playwright ne chargent plus le site en `file://` : ils passent par
un serveur statique local. **`index.html` n'a pas été touché d'une ligne.**
`npm test` est vert. La dette du harnais est donc payée sans que la branche
soit jamais passée au rouge.

- `tests/helpers/serve.js` — `serveRepo()` → `{ url, close }`, serveur
  `node:http` sur un port éphémère de `127.0.0.1`, sans dépendance.
  **Piège déjà résolu :** `close()` appelle `closeAllConnections()`, sans quoi
  Playwright garde des sockets ouvertes et le processus de test se fige.
- `tests/serve.test.js` — couvre le type MIME JavaScript (un module servi en
  `text/plain` serait refusé par le navigateur), le 404, et le refus de lire
  hors du dépôt.
- Les six `.playwright.js` démarrent le serveur en tête et le ferment dans leur
  `finally`. `grep -rn pathToFileURL tests/` ne renvoie plus rien.
- `tests/pwa-update.playwright.js` était le cas à risque : il redéfinit
  `navigator.serviceWorker`, qui existe vraiment en `http` alors qu'il n'existe
  pas en `file://`. Il passe sans modification, son descripteur portant déjà
  `configurable: true`.

Commits : `77d18c0` (serveur), `35c0bcb` (conversion des six tests).

### Lot 1 — TERMINÉ

Le script principal a quitté `index.html` pour `js/app.js`, chargé par
`<script type="module" src="js/app.js"></script>`. **Déplacement pur : aucune
ligne de code applicatif n'a été modifiée.** `npm test` est vert, tests
navigateur compris — ce qui prouve que le module se charge bien en http.

- `index.html` : **12 752 → 2 263 lignes**. Il ne reste que le CSS, le balisage
  et les deux petits scripts de fin (service worker, header rétractable), qui
  restent classiques et en ligne à dessein.
- `js/app.js` : 10 489 lignes, toujours une seule IIFE. **Rien n'y est encore
  découpé.**
- `sw.js` : `"./js/app.js"` ajouté à `CORE_ASSETS`.
- `tests/helpers/modules.js` : **source unique de vérité** de l'ordre des
  modules. Toute extraction s'y déclare, sinon ni le chargeur `vm` ni le lecteur
  de source ne verront le nouveau fichier.
- `tests/helpers/app-source.js` : concatène `index.html` et les modules pour les
  tests qui vérifient la structure du code. Quatre fichiers l'utilisent —
  `availability`, `potentiel-commun`, `stats-build` — parce que leurs assertions
  cherchaient du JavaScript qui a déménagé.
- `AGENTS.md` : les quatre passages qui promettaient `file://` sont corrigés.

Commit : `692833c`.

### Lot 2 — TERMINÉ : le mécanisme d'extraction est validé

`js/dispos-logique.js` (282 lignes) porte la logique pure des disponibilités.
**22 symboles exportés, 5 devenus privés** — `AVAIL_SLOTS`,
`availabilityParisParts`, `availabilityMaskWith`, `AVAIL_MONTHS`,
`availabilityWeekLabel` ne sortent plus du module. C'est exactement le bénéfice
recherché.

`npm test` est vert, **tests navigateur compris** : cela prouve que les
`import`/`export` se chargent réellement en http, et pas seulement dans le `vm`.

`tests/helpers/load-app.js` neutralise désormais les lignes de module avant
d'exécuter la concaténation, avec une garde qui échoue si une déclaration
survit. Ce mécanisme est **le point le plus fragile du chantier** ; il est
maintenant écrit et couvert.

Commit : `255636e`.

### Lots 3 et 4 — TERMINÉS

- **Lot 3** : `js/modal-stack.js` (167 lignes), la pile de modales. Bloc net,
  n'exposant que `ModalStack`. Commit `6630876`.
- **Lot 4** : `js/dom.js` (45 lignes) — `$`, `uid`, `norm`, `initials`,
  `numericKeyboardInputProps`, `el`. Commit `68f4e39`.

Le lot 4 mérite une explication, parce qu'il n'était pas dans l'ordre prévu.
`Picker`, `Potentiel`, `DashboardStore` et `RealtimeSync` semblaient être les
prochains candidats évidents ; le relevé de leurs dépendances a montré qu'ils
s'appuient **tous** sur `$`, `el` et `norm`. Ces utilitaires étaient donc la
vraie feuille de l'arbre. Les sortir en premier débloque les quatre.

**Leçon pour la suite : ne pas se fier à l'ordre proposé, relever les
dépendances réelles avant de choisir.** La commande est donnée plus bas.

### Où en sont les fichiers

`js/` est rangé en cinq couches. **Lire [js/ARCHITECTURE.md](../../../js/ARCHITECTURE.md)**
avant toute reprise : la carte, la règle des couches et les pièges y sont.

**`index.html` : 12 752 → 2 263. `js/app.js` : 10 489 → 5139.** 30 modules.

| Fichier | Lignes |
|---|---|
| `index.html` | 2 263 |
| `js/app.js` | **5139** |
| `js/metier/stats-calcul.js` | 1119 |
| `js/vues/editeur-arme.js` | 823 |
| `js/vues/dispos.js` | 718 |
| `js/metier/build-config.js` | 406 |
| `js/vues/editeur-equipement.js` | 353 |
| `js/metier/boss-logique.js` | 292 |
| `js/metier/dispos-logique.js` | 282 |
| `js/vues/stats-heros.js` | 267 |
| `js/vues/stats-affichage.js` | 264 |
| `js/metier/equipe-modele.js` | 248 |
| `js/vues/modal-stack.js` | 167 |
| `js/donnees/suivi-store.js` | 162 |
| `js/donnees/roster-store.js` | 158 |
| `js/donnees/boss-store.js` | 127 |
| `js/donnees/equipes-store.js` | 120 |
| `js/metier/equipement.js` | 107 |
| `js/noyau/constantes.js` | 99 |
| `js/vues/picker.js` | 98 |
| `js/metier/perles.js` | 76 |
| `js/noyau/dom.js` | 45 |
| `js/vues/elements.js` | 43 |
| `js/metier/armes.js` | 32 |
| `js/metier/catalogue.js` | 26 |
| `js/vues/toast.js` | 24 |
| `js/donnees/roster-profils.js` | 24 |
| `js/etat/brouillon-equipe.js` | 21 |
| `js/etat/session.js` | 20 |
| `js/noyau/outils.js` | 14 |
| `js/noyau/supabase-client.js` | 13 |

### La méthode de relevé — REMPLACÉE, lire ceci d'abord

L'ancien script (conservé plus bas pour mémoire) ne listait que les *appels*
d'un bloc en IIFE et ne comparait qu'à `js/app.js`. Il a deux angles morts qui
ont chacun coûté un échec :

- il ne voit pas les symboles **déjà extraits** (`ModalStack` au lot 5, `uid` au
  lot 13) — d'où le garde-fou `tests/modules-imports.test.js` ;
- il ne calcule pas la **fermeture transitive**, donc il ne dit pas si un bloc
  est extractible sans cycle.

**La bonne méthode est un graphe de dépendances entre déclarations de premier
niveau, puis la clôture transitive de chaque déclaration.** Une clôture est
extractible telle quelle : par construction elle ne dépend de rien d'autre.
C'est ce qui a permis les lots 14 à 18, dont `js/dispos.js` (718 lignes).

Écrire le script dans un fichier, **pas dans un heredoc** : les accents graves
des expressions régulières y sont mangés par le shell.

```python
# releve.py — lancer avec : python releve.py
import io, os, re
NL = "\r\n"
lines = io.open("js/app.js", encoding="utf-8", newline="").read().split(NL)

decl = re.compile(r"  (?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)")
starts = [(i, m.group(1)) for i, l in enumerate(lines, 1) for m in [decl.match(l)] if m]
blocs = {nom: (i, (starts[k+1][0]-1 if k+1 < len(starts) else len(lines)))
         for k, (i, nom) in enumerate(starts)}

def code(t):
    t = re.sub(r"/\*[\s\S]*?\*/", " ", t); t = re.sub(r"//[^\n]*", " ", t)
    t = re.sub(r'"(?:[^"\\\n]|\\.)*"', '""', t)
    return re.sub(r"'(?:[^'\\\n]|\\.)*'", "''", t)

deps = {}
for nom, (d, f) in blocs.items():
    txt = code(NL.join(lines[d-1:f]))
    deps[nom] = {a for a in blocs if a != nom
                 and re.search(r"(?<![\w$.])" + re.escape(a) + r"(?![\w$])", txt)}

def cloture(n):
    vus, pile = set(), [n]
    while pile:
        x = pile.pop()
        if x not in vus:
            vus.add(x); pile.extend(deps.get(x, ()))
    return vus

res = []
for nom in blocs:
    c = cloture(nom)
    lg = sum(blocs[x][1] - blocs[x][0] + 1 for x in c)
    bornes = sorted(blocs[x] for x in c)
    contigu = all(bornes[i][1] + 1 >= bornes[i+1][0] - 3 for i in range(len(bornes)-1))
    if len(c) <= 30 and lg >= 60:
        res.append((lg, len(c), contigu, nom, bornes[0][0], bornes[-1][1]))
for lg, n, contigu, nom, a, b in sorted(res, reverse=True)[:25]:
    print("%6d lignes %3d symb  %-3s  %-30s %d-%d"
          % (lg, n, "OUI" if contigu else "non", nom, a, b))
```

**Lire le résultat :** une clôture `contigu = OUI` est une tranche unique à
couper, c'est le cas sûr. `non` veut dire déclarations éparpillées — faisable
(l'extracteur accepte plusieurs tranches) mais **garder l'ordre d'origine**,
sinon un `const` est lu avant son initialisation.

**Trois endroits à mettre à jour à chaque extraction**, en oublier un casse
quelque chose de silencieux :

1. `MODULES` dans `tests/helpers/modules.js` — **avant** son consommateur ;
2. `CORE_ASSETS` dans `sw.js` — sinon le mode hors ligne casse sans test rouge ;
3. l'`import` réel en tête de `js/app.js`, **au-dessus de l'IIFE** : un `import`
   ne peut pas vivre dans une portée de fonction.

Les trois sont vérifiés par `node tests/modules-imports.test.js`, qui tourne en
une seconde. **Le lancer après chaque extraction, avant `npm test`.**

### L'ancien script, pour mémoire — ne plus s'en servir seul

**Relever les dépendances réelles avant de choisir le prochain domaine.** Ce
script donne, pour chaque module en IIFE, ses bornes et ce dont il dépend encore :

```bash
python - <<'PY'
import io, re
NL="\r\n"
lines = io.open("js/app.js", encoding="utf-8", newline="").read().split(NL)
def bornes(nom):
    deb = next(i for i,l in enumerate(lines,1)
               if l.startswith("  const %s = (function(){" % nom))
    fin = next(i for i in range(deb, len(lines)+1) if lines[i-1].startswith("  })();"))
    return deb, fin
for nom in ["Picker","Potentiel","DashboardStore","RealtimeSync","Availability"]:
    try: d, f = bornes(nom)
    except StopIteration: print(nom, ": deja extrait ou introuvable"); continue
    bloc = lines[d-1:f]
    appels = set(re.findall(r"(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(", NL.join(bloc)))
    internes = {m.group(1) for l in bloc
                for m in [re.match(r"\s+(?:const|let|function)\s+([A-Za-z_$][\w$]*)", l)] if m}
    builtins = {"if","for","while","switch","catch","return","function","Number","String",
                "Array","Object","Date","Set","Map","Math","JSON","parseInt","parseFloat",
                "setTimeout","clearTimeout","requestAnimationFrame","Promise","Boolean"}
    ext = sorted(a for a in appels if a not in internes and a not in builtins and a != nom)
    print("%-15s %5d-%-5d (%4d lignes) | depend de : %s"
          % (nom, d, f, f-d+1, ", ".join(ext[:12]) or "rien"))
PY
```

État constaté au lot 4 — à refaire, il a changé depuis :

| Module | Lignes | Dépend encore de |
|---|---|---|
| `Picker` | 90 | `$`, `el`, `norm` → **désormais extraits, il est prêt** |
| `Potentiel` | 64 | `charOf`, `normalizePotentiel`, `potentielDetailsOf`, `renderBonus`, `renderBuilder`, `weaponTypesOf` |
| `DashboardStore` | 95 | `buildDashboardState`, `currentBossWeek`, `readDashboardCache`, `writeDashboardCache` |
| `RealtimeSync` | 141 | les rendus de toutes les vues — **à garder pour la fin** |

### Lot 5 — TERMINÉ : `Picker`, et la cause de l'échec précédent

`js/picker.js` (98 lignes) porte la modale de sélection réutilisable. Elle
n'expose que `Picker`. `npm test` est vert, exit 0.

**Une première tentative avait échoué et été annulée. La piste consignée alors
— « le moment d'évaluation » — était fausse.** La vraie cause, reproduite puis
confirmée par retrait délibéré :

> `js/picker.js` appelle `ModalStack.open()` et `ModalStack.close()`, mais la
> tentative n'avait importé que `{ $, el, norm } from "./dom.js"`. Sans
> `import { ModalStack } from "./modal-stack.js";`, l'appel lève un
> `ReferenceError` à l'ouverture de la modale — d'où le
> `element is not visible` de `potentiel-commun.playwright.js`.

**Pourquoi le relevé de dépendances était passé à côté :** il cherchait les
identifiants **encore présents dans `js/app.js`**. Or `ModalStack` en était
déjà sorti au lot 3. Un symbole déjà extrait est invisible pour ce relevé tout
en restant une dépendance bien réelle.

**Pourquoi `npm run test:unit` restait vert :** le chargeur `vm` **concatène
tous les modules dans une portée commune**, où `ModalStack` est visible. Le
`vm` ne peut donc structurellement pas détecter un `import` manquant. Seul le
navigateur, qui isole réellement les modules, le voit.

**Les deux leçons, à ne pas réapprendre :**

1. **Relever les dépendances contre *tous* les modules déjà extraits, pas
   seulement contre `js/app.js`.** C'est désormais automatisé :
   `tests/modules-imports.test.js` échoue si un module emploie un symbole
   exporté par un autre sans l'importer. Il rejoue le cas `Picker`.
2. **`npm run test:unit` ne valide jamais une extraction à lui seul.** Toujours
   `npm test` en entier. Garde-fou à réutiliser :

```bash
npm test >/dev/null 2>&1 && git add js/ sw.js tests/ && git commit -m "…" \
  || echo "ECHEC : rien n'est commite"
```

Commit : voir `git log` (message `refactor: extraire le Picker vers js/picker.js`).

**Instabilité observée, non imputée à ce lot.** Au premier `npm test` complet,
`accessibilite-mobile.playwright.js:1206` a échoué une fois — attente d'une
tuile `Une nouvelle aventure` dans `#pickerGrid`. Vérifications faites avant de
commiter :

- 4 exécutions isolées après extraction : vertes ; 6 exécutions sur la base
  d'avant extraction : vertes ; 3 `npm test` complets d'affilée : verts.
- Aucun mécanisme de rattachement : après extraction, `js/app.js` ne référence
  plus du tout `#overlay` ni `#pickerClose`, et `modal-stack.js` s'évalue
  toujours avant `picker.js`. L'ordre d'enregistrement des écouteurs est
  inchangé.

**Conclusion : intermittence du test, comme `supabase-etape1.playwright.js`.**
Relancer avant de conclure à une régression.

### Lot 6 — TERMINÉ

`js/boss-logique.js` (292 lignes) porte la logique pure des sessions de boss et
du tableau « Mon suivi » : `currentBossWeek`, la projection
`buildDashboardState`, le formatage des scores et les statistiques de semaine.
**14 déclarations, 10 exportées, 4 devenues privées** — `BOSS_SCORE_FORMAT`,
`dashboardParisParts`, `dashboardRunCountLabel`, `dashboardDeadlineStatus`.
`npm test` vert deux fois d'affilée, exit 0.

**Pourquoi ce bloc et pas `Potentiel`.** Le relevé a montré que `Potentiel`
dépend de `renderBuilder` et `renderBonus`, deux rendus qui restent dans
`js/app.js` : l'extraire créerait un cycle `app.js → potentiel.js → app.js`.
Le bloc « Mon suivi », lui, portait déjà en commentaire la promesse d'être pur
— vérifiée : **il n'emploie aucun symbole de premier niveau de `js/app.js`**.
C'est la même forme que le lot 2, et c'est la forme qui marche.

**Méthode de relevé, corrigée.** Le script plus haut ne liste que les *appels*
et compare au seul `js/app.js`. Le bon relevé compare les déclarations de
premier niveau du bloc à celles du reste, dans les deux sens :

```bash
# 1. ce qui sort du bloc : declarations du bloc encore citees ailleurs
# 2. ce qui entre : declarations de premier niveau du reste citees par le bloc
#    -> si cette seconde liste n'est pas vide, le bloc n'est pas une feuille
```

Le garde-fou `tests/modules-imports.test.js` rattrape ce qui échappe au relevé.

### Lot 7 — TERMINÉ

`js/constantes.js` (99 lignes) : catalogues, libellés et clés de stockage —
`DATA`, `BUILD_STATS`, `ELEMENTS`, `ROLES`, `WEAPON_ENUM`, `ARMOR_*`,
`JEWEL_*`, `FOLDER_TO_ENUM`, `ENUM_TO_FOLDER`, `metaOf`… 23 symboles, tous
exportés. Feuille de l'arbre au même titre que `dom.js`. `npm test` vert deux
fois, exit 0.

**C'est le lot qui débloque les autres**, comme `dom.js` au lot 4. Nombre de
symboles de `js/app.js` dont chaque zone dépend encore, avant → après :

| Zone | Avant | Après |
|---|---|---|
| Builder | 57 | 48 |
| Roster des membres | 48 | 34 |
| Roster (page d'affichage) | 31 | 27 |
| Brouillon d'équipe | 23 | 13 |
| Export / Import | 13 | 10 |
| Démarrage | 3 | 1 |

**Deux choses sont restées dans `js/app.js`, délibérément :**

- `builderWeaponSwitcher` — seule déclaration de la zone à dépendre du Builder
  (`builderBuildIsDirty`, `rosterWeaponLabel`, `switchBuilderHeroBuild`) ;
- `currentUser`, `currentPseudo`, `sessionApplicationEpoch` — sortis au lot 8.

### Lot 8 — TERMINÉ : l'état mutable de session est débloqué

`js/session.js` (20 lignes) porte `sessionCourante`, un objet unique
`{ user, pseudo, applicationEpoch, rosterProfiles }`. **Décision prise par
l'utilisateur** parmi trois options (porteur d'état / injection au démarrage /
s'arrêter là). `npm test` vert deux fois, exit 0 — dont le parcours d'auth
Supabase, qui est la couverture qui compte ici.

**C'est le premier lot qui touche au code applicatif** : 183 références
renommées (`currentUser` → `sessionCourante.user`, `currentPseudo`,
`sessionApplicationEpoch`, `rosterProfiles`). Le renommage a été fait sous
assertion de comptage exact — le script refusait de s'exécuter si un seul site
manquait à l'appel.

**⚠️ Le piège évité, à ne pas réintroduire.** Le nom naturel, `session`, était
**déjà pris** : `async function applySession(session)` reçoit l'objet d'auth
Supabase, et c'est précisément la fonction qui écrit `currentUser` et
`currentPseudo`. Nommer l'export `session` y aurait écrit dans l'objet d'auth
au lieu de l'état applicatif, **sans lever la moindre erreur**. D'où
`sessionCourante`. Vérifier les collisions de nom avant tout renommage global :

```bash
grep -nE "(const|let|var|function)\s+NOM\b|\(\s*NOM\s*[,)]|,\s*NOM\s*[,)]" js/*.js
```

Effet sur les zones — l'état de session a disparu de toutes :

| Zone | Lot 6 | Lot 7 | Lot 8 |
|---|---|---|---|
| Équipes : local + Supabase | 6 | 4 | **2** |
| Export / Import | 13 | 10 | **8** |
| Authentification Supabase | 16 | 15 | **11** |
| Sessions de boss | 14 | 14 | **12** |
| Builder | 57 | 48 | **46** |

**La leçon générale, valable pour la suite :** le même raisonnement vaut pour
tout `let` de premier niveau partagé entre plusieurs zones. La plupart des
autres (`memberRoster*`, `boss*`, `analyse*`) sont **locaux à une vue** et
voyageront avec elle — ils ne posent pas de problème. Ceux qui restent
réellement partagés sont `draft`, `cloudTeamsCache`, `cloudRosterCache` : même
traitement le jour où leur zone sortira.

### Lot 9 — TERMINÉ

`js/equipement.js` (107 lignes) : détection des sets d'équipement (armures et
bijoux, par racine commune des noms de fichiers) et modèles vides
(`emptyArmor`, `emptyJewel`, `emptyPot`). **11 déclarations, 6 exportées,
5 devenues privées** — `ARMOR_SET_MIN_STEM`, `stripSetNote`, `commonSuffix`,
`armorSetLabel`, `equipmentSetsFrom`. `npm test` vert deux fois, exit 0.

Le bloc est en tête de la zone `Brouillon d'équipe` et n'en dépendait pas :
**relevé à zéro dépendance vers `js/app.js`**, il ne consomme que
`js/constantes.js`.

### Prochain candidat

**Attention : le découpage par bannière touche à sa limite.** Les zones
restantes sont grosses et fortement entrelacées. Le relevé après lot 9 :

| Zone | Lignes | Dépendances vers `app.js` |
|---|---|---|
| `Démarrage` | 13 | 1 (`renderBuilder`) |
| `Navigation onglets` | 49 | 2 (rendus de vues) |
| **`Équipes : local + Supabase`** | **103** | **1 (`normalizeTeam`)** |
| `Export / Import` | 112 | 7 |
| `Analyse` | 208 | 11 |
| `Authentification Supabase` | 886 | 10 |
| `Sessions de boss` | 1 888 | 11 |
| `Builder` | 735 | 44 |
| `Brouillon d'équipe` | 3 717 | 11 |

### Lot 10 — TERMINÉ

`js/supabase-client.js` (12 lignes) : le seul `sb`, client créé une fois pour
tout le site, `null` si la configuration manque. Minuscule, mais il retire une
dépendance à `Équipes`, `Export/Import`, `Authentification` et `Sessions de
boss` d'un coup — même pari que `dom.js` au lot 4, et il a payé trois fois.
`npm test` vert deux fois, exit 0.

**`Équipes : local + Supabase` n'a plus qu'UNE dépendance : `normalizeTeam`.**

### Lots 11 à 18 — TERMINÉS, par la méthode du graphe

Le découpage par bannière était épuisé. Le passage au **graphe de clôtures**
(méthode décrite plus haut) a rouvert huit lots d'un coup, en cherchant non
plus des zones mais des **clôtures transitives contiguës** :

| Module | Lignes | Ce qu'il apporte |
|---|---|---|
| `js/toast.js` | 24 | 34 déclarations l'appelaient |
| `js/roster-profils.js` | 24 | partagé par dispos, roster et analyse |
| `js/boss-store.js` | 127 | accès Supabase des boss, sans rendu |
| **`js/dispos.js`** | **718** | **la plus grosse sortie du chantier** |
| `js/stats-affichage.js` | 222 | 7 déclarations sur 11 devenues privées |
| `js/outils.js` | 14 | `jsonCopy`, `owns`, `isInteger` |
| `js/perles.js` | 76 | `PEARL_TIERS` devenu privé |

`js/dispos.js` est l'exemple à retenir : sa clôture était **d'un seul tenant**
et ne dépendait que de modules déjà sortis. Deux déclarations exportées, huit
devenues privées. Aucun relevé par bannière ne pouvait le voir.

**Le garde-fou a payé deux fois de plus :** un `uid` employé sans import dans
`boss-store.js` (le bug exact du lot 5, arrêté automatiquement), et
`pearlTierOf` exporté alors que seuls ses voisins de module l'appellent.

Il a aussi gagné un **second contrôle : un `import` qui ne sert plus est une
erreur**. 25 imports morts retirés au passage, dont les 21 symboles de
`dispos-logique` que `app.js` gardait alors que la vue était partie.

### Lots 19 à 24 — le calcul de stats, l'éditeur d'arme, et le rangement

| Module | Lignes | Ce qu'il apporte |
|---|---|---|
| `metier/stats-calcul.js` | 1 119 | 33 déclarations privées sur 38 |
| `vues/editeur-arme.js` | 837 | 25 privées sur 32 |
| `metier/build-config.js` | 406 | catalogue + diagnostic d'une config |
| `metier/armes.js` | 32 | identité d'une arme |
| `etat/brouillon-equipe.js` | 21 | débloque l'éditeur d'arme |

La grappe du calcul de stats — 85 symboles, 1 579 lignes — était **entièrement
fermée** mais mêlait identité d'arme, catalogue, validation et calcul. La
couper en trois couches empilées la rend lisible.

### ⚠️ Trois régressions, et ce qu'elles ont appris au garde-fou

Toutes les trois ont passé `npm run test:unit` au vert. **Le chargeur `vm`
concatène tout dans une portée commune : il ne peut structurellement pas voir
un symbole manquant.** Seul le navigateur les a levées.

1. **`HERO_STAT_COVERAGE`** — resté dans `app.js` alors que son appelant
   partait. Le garde-fou ne regardait pas `app.js`, dont rien n'est exporté.
2. **`ARMOR_LEVEL_ORIGIN_MODE`, `gearPassiveStatus`, `weaponPassiveFact`** —
   déclarés dans `build-config.js` mais **non exportés**. Le garde-fou ne
   vérifiait que les symboles déjà exportés.
3. **Le garde-fou lui-même était troué** : il excluait tout nom précédé d'un
   point pour ignorer `objet.nom`, et manquait donc les **spread `...NOM`**.
   C'est ce qui avait laissé passer le cas 1.

Le contrôle couvre désormais les trois formes, plus les imports inutiles et
**les imports qui remontent les couches**. `node tests/modules-imports.test.js`
tourne en une seconde : **le lancer après chaque déplacement.**

### Deux pièges de renommage global

Rencontrés en portant `draft` vers `brouillonEquipe.equipe` :

- **l'ombrage** : `draft` était aussi un paramètre local dans neuf fonctions.
  Un renommage aveugle a produit
  `function weaponDraftHasChoices(brouillonEquipe.equipe)`. Sauter toute
  déclaration qui lie le nom localement — et vérifier ensuite chaque
  occurrence restante une par une.
- **les clés d'objet** : `draft:initial` n'est pas un emploi du symbole.

Corollaire : l'heuristique qui détecte l'ombrage doit exclure `if(x){`, qui
ressemble à une liste de paramètres. Ce détail a coûté une régression.

### Lots 25 à 30 — les éditeurs, le modèle, les stores

| Module | Lignes |
|---|---|
| `metier/equipe-modele.js` | 248 |
| `vues/editeur-equipement.js` | 353 |
| `vues/stats-heros.js` | 267 |
| `donnees/suivi-store.js` | 162 |
| `donnees/roster-store.js` | 158 |
| `donnees/equipes-store.js` | 120 |
| `vues/elements.js` + `metier/catalogue.js` | 69 |

**La leçon qui s'est répétée trois fois : sortir la base avant ce qui s'appuie
dessus.** Les clôtures avant / après :

| | avant | après |
|---|---|---|
| éditeur d'équipement (après `elements`/`catalogue`) | 21 symb | **12** |
| `Store` (après `equipe-modele`) | 17 | **7** |
| `MemberRosterStore` (idem) | 14 | **7** |
| `DashboardStore` (idem) | 23 | **6** |

### Le contrôle des couches a désigné un rangement tout seul

`weaponTermLabel` et `gearTermLabel` vivaient dans les deux éditeurs. Quand
`stats-heros.js` en a eu besoin, le test a refusé l'import : un module
d'affichage de stats ne peut pas dépendre d'un éditeur déclaré après lui. Ces
libellés appartenaient à `stats-affichage.js`. **Quand ce test proteste, c'est
presque toujours le rangement qui a tort.**

### Lot 31 — `fiche-heros.js`, le noyau commun des modales

Le relevé annoncé par la passation précédente s'est vérifié cette fois : 7
symboles, 171 lignes, clôture fermée (« dépend encore de app.js : RIEN »).

**Le rangement n'a pas suivi la clôture telle quelle.** Deux des sept symboles
n'avaient rien à faire dans une fiche de héros, et le nombre de leurs appelants
le disait :

| Symbole | Appels hors fiche | Rangé dans |
|---|---|---|
| `authMessage` | 13 — auth, roster, équipes, boss | `noyau/supabase-client.js` |
| `canManageTeam` | 4 — gestion d'équipe | `etat/session.js` |

Les laisser dans `vues/fiche-heros.js` aurait obligé `app.js` à importer son
formateur d'erreurs Supabase depuis une carte de héros. `authMessage` ne traduit
que les erreurs de `sb` : il vit avec lui. `canManageTeam` est une question
posée à la session courante, pas une règle sur l'équipe — et `equipe-modele.js`
promet dans son en-tête de rester lisible sans connaître l'utilisateur, donc il
ne pouvait pas l'accueillir.

Restent cinq symboles dans `js/vues/fiche-heros.js` (204 lignes), dont **trois
exportés seulement** : `equipLine` et `importTeamHeroToRoster` ne servent qu'à
la fiche.

Un import est mort en chemin — `equippedEnumOf` dans `app.js` — attrapé par
`tests/modules-imports.test.js`, pas par la lecture. Et la bannière
`/* ==== Données & constantes ==== */` est tombée : les constantes étaient
parties depuis longtemps, les deux dernières fonctions sous elle venaient de
sortir, elle ne décrivait plus rien.

### Lot 32 — `detail-equipe.js`, et le piège que le relevé ne voit pas

Sorti avant `bossReportParticipant`, qui le contient : l'inverse aurait fait le
travail deux fois.

**Le relevé ne liste que les déclarations.** Sous `closeTeamDetail` traînaient
quatre lignes de premier niveau qu'aucune clôture ne signale :

```js
  $("#teamClose").addEventListener("click", closeTeamDetail);
  $("#teamOverlay").addEventListener("click", event => {
    if(event.target === $("#teamOverlay")) closeTeamDetail();
  });
```

Les laisser dans `app.js` l'aurait obligé à importer `closeTeamDetail`, qui n'a
sinon aucun appelant dehors. Elles sont parties avec le module — le précédent
existait déjà dans `editeur-arme.js`, `picker.js` et `dispos.js`, qui branchent
tous leurs boutons au chargement. Le balisage vient d'`index.html` et les
modules sont différés : l'élément existe quand le module s'exécute.

**À retenir : relire les lignes autour de la tranche avant de couper.** Une
clôture transitive est aveugle aux instructions de premier niveau.

`openTeamDetail` sort seul ; `closeTeamDetail` et le câblage restent privés.

### Où ça s'arrête

**`js/app.js` : 10 489 → 4 938 lignes**, 32 modules. `npm test` vert, exit 0,
Playwright compris.

Restent deux modales, toutes deux à clôture fermée donc extractibles sans
cycle. **Relevé refait après le lot `detail-equipe` :**

| Racine | Symboles | Lignes | Clôture |
|---|---|---|---|
| `openRosterDetailFor` | 10 | 185 | `closeRosterDetail`, `favoriteRosterWeaponType`, `moveRosterDetail`, `openRosterDetailFor`, `renderRosterDetail`, `rosterDetail`, `rosterDetailOwnerLabel`, `rosterDetailWeaponSwitch`, `rosterHeroSnapshot`, `rosterWeaponLabel` |
| `bossReportParticipant` | 3 | 57 | `bossReportParticipant`, `bossTeamBanner`, `teamFromBossSnapshot` |

**La leçon « sortir la base avant ce qui s'appuie dessus » se vérifie une
sixième fois :** ces racines pesaient 17, 12 et 9 symboles avant `fiche-heros`,
sans qu'une ligne de leur code ne change.

**Refais le relevé avant de commencer** : ces nombres changent à chaque
extraction, et ce document a déjà été faux deux fois sur ce point précis.

## Pourquoi ce refactor

`index.html` fait **12 701 lignes pour 500 Ko**. Un seul fichier porte le style,
le balisage et la totalité de la logique applicative. Conséquences concrètes :

- toute modification demande de retrouver son chemin dans un fichier qu'aucun
  outil n'ouvre confortablement ;
- les agents qui reprennent le projet ne peuvent pas tenir le fichier en
  contexte, ce qui rend leurs éditions moins fiables ;
- les frontières entre domaines existent (bannières de commentaires, modules en
  IIFE) mais ne sont imposées par rien : rien n'empêche une fonction du Builder
  d'appeler un détail interne du Roster.

## Cartographie du fichier

Relevé le 1er août 2026 au commit `5e0b491`. **Les numéros de ligne bougent à
chaque commit — re-fais le relevé avant de t'en servir :**

```bash
grep -nE "^  /\* =+ .* =+ \*/|^  const [A-Z][A-Za-z]+ = \(function\(\)\{" index.html
```

| Zone | Lignes | Taille |
|---|---|---|
| `<style>` | 18 – 1569 | ~1 550 lignes |
| `<body>` (balisage) | 1570 – 1989 | ~420 lignes |
| Scripts externes existants | 1990 – 1996 | `data.js`, `stats-build.js`, `potentiels.js`, `armures-liees.js`, `personnages-meta.js`, supabase-js (CDN), `supabase-config.js` |
| **Script principal en ligne** | **1997 – 12435** | **~10 440 lignes** |
| Script « service worker » | 12436 – 12572 | ~135 lignes, déjà isolé |
| Script « header rétractable » | 12573 – 12699 | ~125 lignes, déjà isolé |

Les deux derniers blocs sont **déjà séparés volontairement** : leur commentaire
d'en-tête explique que le bac à sable `vm` des tests n'a ni `navigator`, ni
`matchMedia`, ni `window.addEventListener`. C'est le précédent à suivre.

### Découpage interne du script principal

Bannières et modules, dans l'ordre du fichier :

| Ligne | Bloc |
|---|---|
| 2001 | Données & constantes |
| 2196 | Utilitaires |
| 2229 | `ModalStack` (IIFE) |
| 2411 | Équipes : local + Supabase |
| 2514 | Brouillon d'équipe |
| 6318 | Analyse : DPS dérivés du Roster |
| 6516 | Toast |
| 6529 | `RealtimeSync` (IIFE) |
| 6671 | Authentification Supabase |
| 7181 | `Availability` (IIFE) |
| 7756 | Navigation onglets |
| 7805 | `Picker` (IIFE) |
| 7897 | Roster des membres |
| 8878 | Builder |
| 9477 | `Potentiel` (IIFE) |
| 9613 | Roster (page d'affichage) |
| 9941 | Export / Import |
| 10053 | Analyse |
| 10261 | Sessions de boss |
| 10758 | `DashboardStore` (IIFE) |
| 12423 | Démarrage |

Le CSS (lignes 18–1569) porte lui aussi des bannières par domaine et se découpe
selon les mêmes frontières.

## Les trois contraintes qui décident de tout

Ce sont elles qui écartent la solution « évidente ». Ne les contourne pas sans
l'accord explicite de l'utilisateur.

### 1. Le site doit rester ouvrable en `file://`

C'est une propriété produit affirmée dans [AGENTS.md](../../../AGENTS.md)
(« Double-clic sur `index.html` […] Aucun serveur, aucune install, aucun
build »).

**Conséquence majeure : les modules ES sont exclus.** Un
`<script type="module" src="…">` est bloqué par la politique d'origine des
navigateurs sur `file://` — la page se charge, aucun module ne s'exécute, et le
site est mort pour quiconque ouvre le fichier en double-clic. Vérifie-le
toi-même avant d'en douter, c'est rapide.

Le découpage doit donc se faire en **scripts classiques** `<script src="…">`,
chargés dans l'ordre des dépendances, partageant leur état par un objet global
unique plutôt que par des `import`.

### 2. Le harnais de tests lit le script en ligne par expression régulière

`tests/helpers/load-app.js` fait exactement ceci :

```js
const source = scripts.find(script => script.includes("(function(){"));
const exposed = source.replace(/\}\)\(\);\s*$/, HOOK_EXPORT);
```

Il **cherche le bloc `<script>` en ligne** qui contient l'IIFE, puis remplace sa
fermeture par l'export des fonctions internes, et exécute le tout dans un `vm`.

**Sortir le code d'`index.html` casse ce mécanisme et, avec lui, la totalité des
tests unitaires** (14 fichiers Node en dépendent). Adapter ce chargeur fait
partie intégrante du refactor, ce n'est pas un détail de fin de chantier : il
devra concaténer les fichiers extraits dans l'ordre de chargement avant de les
exécuter dans le `vm`.

Le faux DOM de ce chargeur est volontairement minimal (`FakeElement`). Tout code
exécuté au chargement qui touche au DOM doit rester tolérant, ou vivre dans un
bloc séparé comme les deux scripts de fin de fichier.

### 3. Le service worker doit connaître chaque nouveau fichier

`sw.js` liste `CORE_ASSETS` explicitement. **Un fichier extrait qui n'y est pas
ajouté casse le mode hors ligne** sans qu'aucun test ne s'en aperçoive
forcément. La mise en cache est faite fichier par fichier — un 404 n'y vide plus
tout le cache, mais le fichier manquant reste absent hors ligne.

`tests/pwa.test.js` couvre une partie du contrat : lis-le avant de modifier
`sw.js`.

## Ce qu'il faut trancher avec l'utilisateur

**N'écris pas une ligne de code avant d'avoir ces réponses.** Passe par la skill
`superpowers:brainstorming`, puis `superpowers:writing-plans`.

1. **Périmètre.** Découper uniquement le JavaScript, ou aussi le CSS et le
   balisage ? Le CSS est plus simple et sans risque pour les tests ; le balisage
   n'a pas de mécanisme d'inclusion sans build, donc il resterait dans
   `index.html`.
2. **Frontière de découpage.** Un fichier par domaine métier (builder, roster,
   boss, dispos, analyse…) ou par nature technique (état, rendu, réseau) ? Le
   fichier suit aujourd'hui les domaines — les suivre coûte le moins cher.
3. **Partage de l'état.** Aujourd'hui tout vit dans la portée d'une seule IIFE.
   Après découpage, il faut un porteur explicite : un objet global unique
   (`window.Conf7DS = {}`) que chaque fichier complète, ou des IIFE qui
   s'exposent nommément. À décider une fois pour toutes.
4. **Granularité de la livraison.** Un refactor de cette taille ne peut pas être
   un seul commit. Combien de fichiers extraits par lot, avec `npm test` vert
   entre chaque ?
5. **Renoncement possible.** Si l'utilisateur accepte d'abandonner `file://`, le
   passage aux modules ES devient possible et change tout. C'est **sa** décision,
   pas la tienne : cette propriété est annoncée dans la documentation du projet.

## Règles de reprise

- **Un lot = un commit vert.** `npm test` doit passer avant chaque commit. Ne
  jamais empiler deux extractions non testées.
- **Le refactor ne change aucun comportement.** Aucun test existant ne doit être
  modifié pour « passer », sauf s'il vérifie explicitement la structure du
  fichier (c'est le cas de `load-app.js`, dont l'adaptation est prévue).
- **Interdit de renormaliser les fins de ligne.** `index.html` est en CRLF ; un
  outil qui réécrit tout le fichier produit un diff illisible qui rend la
  relecture impossible.
- **Ne touche ni `.claude/`, ni `.vscode/`, ni `.worktrees/`.**
- Commentaires, libellés et messages de commit **en français**.
- La branche part de `main`. En cas de doute sur le point de départ :
  `git merge-base main HEAD`.

## Si tu es coupé en cours de route

1. Commite ce qui est vert, même partiel, avec un message qui dit où ça s'arrête.
2. Mets à jour la section « Où en est-on » de ce document **dans le même
   commit**.
3. N'écris jamais dans ce document une étape « en cours » : soit elle est
   commitée, soit elle n'existe pas.
