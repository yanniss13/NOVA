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
| `supabase-client.js` | `sb`, le client — **`null` si la configuration manque**, donc à tester avant usage |

### `etat/` — ce qui change

| Fichier | Contenu |
|---|---|
| `session.js` | `sessionCourante` : utilisateur, pseudo, profils du roster |
| `brouillon-equipe.js` | `brouillonEquipe` : l'équipe en cours d'édition dans le Builder |

**Pourquoi des objets et pas des `let` exportés ?** Parce qu'une liaison
exportée par un module ES est **en lecture seule chez l'importateur** : on peut
la lire, jamais la réaffecter. Une propriété d'objet, si. Sans ça, aucune vue
ne pouvait sortir de `app.js`.

### `metier/` — les règles du jeu

| Fichier | Contenu |
|---|---|
| `armes.js` | Identité d'une arme : dossier, type, compatibilité |
| `equipement.js` | Sets d'armure et de bijoux, modèles vides |
| `perles.js` | Perle de sortilège : paliers, longueur des enchantements |
| `build-config.js` | Lecture du catalogue généré + diagnostic d'une configuration saisie |
| `stats-calcul.js` | **Le moteur de calcul des stats** |
| `dispos-logique.js` | Masques de disponibilité, semaines, agrégation |
| `boss-logique.js` | Semaine de boss, projection « Mon suivi », scores |

`stats-calcul.js` mérite un mot : il produit des **termes** — « +120 ATK, venant
du passif de l'arme » — et non des totaux opaques. C'est ce qui permet à
l'interface d'expliquer chaque chiffre au membre. Ne casse pas ça.

### `donnees/` — le réseau

| Fichier | Contenu |
|---|---|
| `roster-profils.js` | Les pseudos de la confrérie, lus une fois puis mis en cache |
| `boss-store.js` | Sessions de boss : groupes, inscriptions, rapports |

### `vues/` — l'écran

| Fichier | Contenu |
|---|---|
| `toast.js` | Le bandeau de notification |
| `modal-stack.js` | La pile de modales : ouverture, fermeture, restitution du focus |
| `picker.js` | La modale de sélection réutilisable |
| `stats-affichage.js` | Mise en forme des termes de stats |
| `editeur-arme.js` | La modale de configuration d'une arme |
| `dispos.js` | La vue des disponibilités hebdomadaires |

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
- un import qui **remonte les couches** ;
- un module absent de `MODULES` ou de `CORE_ASSETS`.

## Si tu veux découper davantage

`app.js` n'est pas fini. La méthode qui marche, et l'état exact du chantier,
sont dans
[docs/superpowers/specs/2026-08-01-refactor-index-passation.md](../docs/superpowers/specs/2026-08-01-refactor-index-passation.md).

En résumé : construis le graphe de dépendances entre déclarations de premier
niveau, calcule la **clôture transitive** de chaque déclaration, et extrais une
clôture entière. Par construction elle ne dépend de rien d'autre — donc pas de
cycle. Découper « par zone de commentaire » ne marche plus depuis longtemps.

Deux pièges de renommage, tous deux rencontrés pour de vrai :

- un nom peut être **aussi un paramètre local** ailleurs (`draft` l'était dans
  neuf fonctions) — vérifier l'ombrage avant tout renommage global ;
- un nom peut être une **clé d'objet** (`draft:initial`) — à ne pas renommer.
