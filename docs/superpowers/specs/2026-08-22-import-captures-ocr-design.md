# Import de builds depuis des captures d'écran

Date : 2026-08-22
Branche : `worktree-ocr-stats-screens`

## Objectif

Permettre à un membre de remplir la configuration d'équipement d'un héros en
déposant des captures d'écran du jeu, au lieu de saisir chaque champ à la main.

La saisie manuelle d'un héros complet représente huit pièces,
chacune avec son niveau, son renforcement et ses enchantements. C'est le principal frein au
remplissage du roster.

## Périmètre

Dans le périmètre :

- les sept pièces d'armure et de bijouterie (Haut, Bas, Ceinture, Bottes,
  Anneau, Collier, Boucle d'oreille) et la pièce gravée ;
- un héros à la fois, choisi avant l'import ;
- l'OCR exécuté dans le navigateur du membre.

Hors périmètre pour cette version :

- **l'arme.** Contrairement à une armure, elle ne calcule pas ses statistiques
  sans ses enchantements : une configuration aux emplacements vides est refusée
  — `incompatible` pour les enchantements `basic`, `incomplete` pour les perles
  `masterstone`. Mesure sur le catalogue : **60 armes sur 155** acceptent une
  configuration nue ; les 95 autres n'en produisent aucune, dont les armes SSR
  de fin de jeu.

  L'inversion décrite plus bas ne leur transfère donc pas. Les traiter
  demanderait de lire **et** de déduire les enchantements conjointement — le
  panneau les affiche, mais c'est un problème sensiblement plus gros, non
  mesuré. L'arme reste éditable à la main ;
- l'import de plusieurs héros en une fois. Il supposerait de reconnaître le
  héros sur chaque capture, ce qui n'a pas été testé ;
- la lecture de la grille de vignettes et des badges de renforcement. Elle
  devient inutile (voir « Déduction »).

## Ce que les mesures établissent

Les décisions de cette conception reposent sur des mesures faites sur huit
captures réelles : six iPhone en 2796x1290 et deux PC en 1920x1080.

| Question | Résultat |
|---|---|
| Lecture d'un panneau d'équipement | 36 stats sur 36, sorties identiques entre PC et mobile |
| Libellés du jeu présents dans `statLabels` | 13 sur 13, au caractère près |
| Recalage d'un libellé abîmé (3 dégâts OCR) | 99,56 % corrects, 0,03 % de faux silencieux |
| Inversion valeur principale vers (niveau, renfort) | unique dans 99,67 % des cas |
| Identification de la pièce par ses seules stats | 3 pièces sur 4 identifiées seules |
| Détection d'une valeur mal lue par l'inversion | 94,3 % en moyenne |
| Armes acceptant une configuration sans enchantements | 60 sur 155 — d'où leur exclusion |
| Seuil de résolution | s'effondre sous 0,6x ; la compression JPEG 50 ne gêne pas |
| Durée d'une capture | 0,86 s sur PC, environ 7 s pour huit |

Le moteur (`tesseract-core-lstm.wasm` 2,86 Mo, `fra.traineddata` 1,25 Mo, plus
le worker) pèse environ 5 Mo.

## Flux du membre

Le point d'entrée est la page de build d'un héros. Le héros est donc connu
d'emblée, ce qui restreint les candidats pour la pièce gravée.

1. **Dépôt.** Le membre dépose une à huit captures. Aucun ordre ni nommage
   imposé : l'emplacement se déduit de la pièce identifiée, qui se déduit
   elle-même des stats lues.
2. **Traitement.** Une barre de progression, capture par capture. Rien n'est
   écrit à ce stade.
3. **Récapitulatif.** Un tableau, une ligne par capture : emplacement, nom de
   pièce, niveau, renforcement, enchantements, et un état (`lu`, `à confirmer`,
   `échec`). Chaque ligne montre ce qui existe déjà dans le build, pour que le
   membre voie ce qu'il remplace.
4. **Enregistrement.** Un seul bouton. Il n'écrit que les lignes validées et
   passe par `gearConfigStatus()`, le validateur de la saisie manuelle. Une
   configuration qu'il refuse ne part pas, même si le membre a cliqué.

Un import partiel est accepté : trois captures sur huit remplissent trois
emplacements et laissent les autres intacts.

## Modules

### `js/metier/ocr-lecture.js`

Entrée : une image. Sortie : une liste de `{libelle, valeur}` et un état
(`ok`, `panneau-introuvable`).

Détection du panneau, double passe OCR, regroupement en lignes, recollage des
libellés coupés. Ce module ne connaît rien au 7DS : ni les stats, ni les
pièces. C'est un lecteur de panneaux.

Trois mécanismes y sont validés et doivent être conservés :

- **détection du panneau** par la zone claire collée au bord droit, sans aucune
  coordonnée en dur. C'est ce qui permet à la même lecture de fonctionner en
  1920x1080 et en 2796x1290 ;
- **double passe OCR**. La première lit le panneau entier pour les libellés. La
  seconde ne lit qu'une bande à droite, sans barre ni libellé, pour les
  valeurs. Sans elle, deux valeurs sur six étaient perdues sur mobile ;
- **machine à états** : une stat est un bloc de libellé plus exactement une
  valeur. Deux dispositions coexistent dans le jeu — valeur sur la première
  ligne du libellé, ou valeur après une barre de progression — et la présence
  de texte réel sur la ligne de la valeur les distingue ;
- **lecture du bandeau**, au-dessus du panneau clair, autour de 22 à 30 % de la
  hauteur du panneau ; les bandes plus étroites ne rendent que du bruit. Elle
  n'est pas utilisée par la v1 — elle servait à l'arme — mais reste mesurée et
  documentée pour le jour où l'arme entrera.

Ne pas revenir à une détection fondée sur les icônes en début de ligne :
l'OCR les rate sur mobile, ce qui produisait un faux silencieux.

### `js/metier/ocr-deduction.js`

Entrée : la liste de `{libelle, valeur}` et le slug du héros. Sortie :
`{fichier, level, reinforce, enchantments}` et un état (`unique`, `ambigu` avec
la liste des candidats, `aucun`).

Deux étapes :

1. **Recalage des libellés** sur `statLabels`. Le jeu écrit exactement les
   mêmes chaînes que le catalogue, donc l'OCR n'a pas besoin d'être exact : il
   suffit qu'il soit assez proche. Trois contraintes se cumulent — normalisation
   (accents, casse, ponctuation, espaces insécables), unité déduite de la
   présence d'un `%`, et restriction aux stats que la pièce peut porter.
   L'unité est indispensable : sans elle, sept paires de libellés homonymes
   (`Attaque de Feu` brute contre `Attaque de Feu` en pourcentage) produisaient
   4,3 % de faux silencieux ; avec elle, zéro.
2. **Inversion** : parcourir les pièces compatibles avec la stat principale et
   la stat secondaire lues, tester les couples (niveau, renforcement), retenir
   ceux qui reproduisent les valeurs observées.


Ce module s'appuie sur `stats-calcul.js` et `build-config.js` : il ne
réimplémente aucune formule. Si les tables du jeu évoluent, l'import suit.

### `js/vues/import-captures.js`

Zone de dépôt, progression, tableau récapitulatif, bouton d'enregistrement.
Elle orchestre les deux modules précédents et n'écrit qu'en passant par le
chemin de sauvegarde existant.

## Déduction

C'est le cœur de la conception, et le point le plus contre-intuitif.

Le site ne stocke pas des statistiques : il stocke une configuration (pièce,
niveau, renforcement, enchantements) et recalcule les statistiques à partir des
tables du jeu. Le panneau du jeu, lui, affiche des résultats.

Les trois données nécessaires pour identifier une pièce — le niveau en chiffres
dorés, le badge de renforcement, l'icône — sont précisément celles qui se
lisent le plus mal. Les badges sont illisibles à toute échelle.

Mais la relation est inversible. Les valeurs atteignables sont rares dans leur
intervalle : 3,56 % des entiers en médiane correspondent à une configuration
valide. Il suffit donc de la valeur principale affichée, qui se lit à plus de 90 % de
confiance, pour retrouver le couple (niveau, renforcement) — et souvent la
pièce elle-même.

Cette rareté a une seconde conséquence, plus importante que la première :
**l'inversion sert de filet**. Si l'OCR se trompe d'un chiffre, il n'existe
presque jamais de configuration qui reproduise le nombre lu. L'erreur se
signale au lieu de s'écrire — 94,3 % des lectures fausses sont détectées.

## Ambiguïtés et échecs

Rien d'ambigu ni d'échoué n'est jamais écrit en silence.

**Ambigu — une question posée au membre**, résolue en un clic :

- deux couples (niveau, renforcement) donnent la même valeur : 0,33 % des cas ;
- plusieurs pièces candidates, surtout les gravées. Leur champ `character` les
  filtre par héros ; s'il en reste, on propose la courte liste ;
- un libellé trop proche d'un autre, presque toujours la famille élémentaire
  (Feu, Froid, Foudre, Vent).

**Échec — la ligne reste vide et rien n'est touché** :

- panneau introuvable ;
- aucun libellé reconnu ;
- aucune configuration compatible : le filet a fonctionné, la lecture est
  déclarée douteuse.

**Garde-fou de résolution.** Sous environ 400 px de large de panneau détecté,
on prévient avant même de lancer l'OCR. Une capture qui transite par une
messagerie est souvent redimensionnée, et l'effondrement mesuré sous 0,6x est
brutal.

**Conflit.** Si deux captures désignent le même emplacement, les deux restent
visibles et le membre choisit. Aucune n'est écrasée arbitrairement.

## Le moteur et le service worker

Le moteur vit dans `vendor/tesseract/` : worker, wasm et `fra.traineddata`.

Il n'est **pas** dans `CORE_ASSETS` de `sw.js`. Il est chargé au premier usage
puis mis en cache par le gestionnaire `fetch`. Un membre qui n'utilise jamais
la fonction ne télécharge rien. C'est la même logique que celle déjà appliquée
à l'icône 512.

Aucun appel à un CDN : tout est servi depuis le dépôt, ce qui préserve le mode
hors ligne et évite une dépendance réseau au moment où le membre travaille.

## Erreurs et compatibilité

- Aucune modification du schéma Supabase ni du chemin d'écriture. L'import
  produit exactement les mêmes objets de configuration que l'éditeur manuel.
- Aucune modification des modules existants, hormis l'ajout d'un bouton sur la
  page de build.
- Un navigateur sans WebAssembly ne peut pas exécuter le moteur : le bouton est
  masqué plutôt que de proposer une fonction qui échouera.
- Les captures ne quittent jamais l'appareil du membre.

## Tests et vérification

### `ocr-deduction.js`

Logique pure, testable sans image. C'est le module qui décide ce qui s'écrit,
donc celui à couvrir le plus. Trois familles :

- déduction unique : stats connues vers configuration attendue ;
- ambiguïté : deux candidats attendus, aucun choix automatique ;
- valeur incohérente : état `aucun`, aucune configuration proposée ;
- entrée dégénérée : liste vide ou héros inconnu, aucun candidat, aucune levée.

### `ocr-lecture.js`

Test de non-régression sur une collection de captures de référence avec leur
sortie attendue. Une capture PC et une mobile sont conservées entières — elles
seules testent la détection du panneau. Les autres sont recadrées sur le
panneau, ce qui divise le poids par six sans toucher à la résolution.

### Recalage

La campagne de dégradations synthétiques devient un test avec un plancher
chiffré : au moins 99 % de lectures correctes à trois dégâts, et zéro faux
silencieux à un dégât. Une évolution des données qui casserait cette propriété
serait signalée.

### Vue

Test Playwright avec le module de lecture remplacé par un bouchon : états du
tableau, correction d'une ligne ambiguë, et surtout vérification qu'aucune
écriture ne part avant le clic final.

## Décisions écartées

- **Appariement d'icônes** contre les 285 fichiers du dépôt pour identifier la
  pièce. Rendu inutile par la déduction à partir des stats.
- **Faire entrer l'arme dans le périmètre.** Tentée, puis retirée. La mesure
  qui l'avait justifiée était fausse : elle comptait comme « sans ambiguïté »
  les 95 armes qui ne produisaient aucune configuration. Le signal était
  pourtant visible — seulement 60 combinaisons distinctes pour 155 armes — et
  n'a pas été diagnostiqué. Leçon retenue : un dénominateur qui s'effondre est
  un symptôme, pas un détail.
- **Lecture de la grille de vignettes** pour récupérer les niveaux des sept
  pièces d'un coup. Les niveaux s'y lisent bien, mais les badges de
  renforcement sont illisibles, et l'inversion fournit les deux.
- **OCR côté serveur** dans une fonction edge. Écarté : coût, envoi des images,
  perte du mode hors ligne, alors que 7 s de traitement local suffisent.
- **Écriture directe avec signalement des doutes seulement.** Écartée : un
  roster est lu par d'autres membres, et une lecture fausse mais confiante
  s'écrirait sans que personne ne la voie.
