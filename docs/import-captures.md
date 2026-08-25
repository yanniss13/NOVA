# Remplir un build à partir de captures d'écran

L'éditeur de roster sait lire les captures de l'écran d'équipement du jeu et en
tirer l'arme et les pièces d'un héros. Le membre dépose ses images, relit un
récapitulatif, et valide — **rien n'est écrit avant ce clic**.

## Pour le membre

Ouvre la fiche du héros dans le roster, clique sur **Importer des captures**,
et ajoute les images de son écran d'équipement de l'une de ces trois façons :

- glisse-dépose une ou plusieurs captures dans le cadre ;
- copie une capture, puis colle-la avec **Ctrl+V** tant que la modale est
  ouverte ;
- clique sur **Choisir des images** pour passer par le sélecteur de fichiers.

L'ordre n'a aucune importance : chaque capture dit elle-même de quel
emplacement elle parle. Un dépôt ou un collage sans image est refusé avant de
lancer la lecture.

Les panneaux du jeu en **français et en anglais** sont acceptés. Le nom de
l'arme et les libellés de statistiques sont rapprochés dans la langue affichée,
et les nombres anglais comme `4,937` sont lus comme des milliers.

Trois règles pratiques :

- **Envoie les fichiers d'origine.** Une image passée par une messagerie est
  souvent redimensionnée, et la lecture s'effondre sous 0,6× — le récapitulatif
  le dit alors au lieu de rendre des chiffres faux.
- **Garde le panneau entier**, en-tête compris. Le nom de l'arme y est écrit,
  et c'est lui qui l'identifie.
- **Le fond du jeu doit rester visible.** Le panneau se repère par contraste
  avec le ciel étoilé ; une capture recadrée au ras de la carte n'est plus
  détectable.

### Le récapitulatif

Chaque ligne porte un état :

| état | ce qu'il veut dire |
|---|---|
| **lu** | une seule configuration reproduit les chiffres affichés |
| **à confirmer** | plusieurs correspondent : choisis dans la liste |
| **échec** | aucune ne correspond, ou l'image n'a pas pu être lue |

Une ligne d'arme affiche aussi son grade, sa promotion, son outrepassement et
le nombre d'enchantements retrouvés. La mention **« élément supposé »** signale
le seul cas où le site comble un trou : voir plus bas.

Deux captures pour le même emplacement ? Aucune des deux n'est écrite. Le
membre tranche, sinon rien ne part pour cet emplacement.

## Pourquoi ça marche

Le site ne stocke pas des statistiques : il stocke une **configuration** —
pièce, niveau, renforcement, enchantements — et recalcule les chiffres à partir
des tables du jeu. L'import fait le trajet inverse.

Le point contre-intuitif : **on ne lit jamais ce qu'on cherche.** Le nom de la
pièce en doré sur doré, le badge `+5` de douze pixels, l'icône — c'est
exactement ce qu'un OCR lit le plus mal. Les valeurs de statistiques, elles, se
lisent très bien. On part donc des secondes pour retrouver les premières.

Cela fonctionne parce que l'espace est creux : à peine 3,56 % des entiers de la
plage d'une pièce correspondent à une configuration valide. La valeur
principale affichée détermine donc le couple (niveau, renforcement) dans
**99,67 %** des cas.

### Le filet

La même rareté sert de somme de contrôle. Une valeur mal lue d'un seul chiffre
ne correspond à **aucune** configuration : la ligne se signale au lieu d'entrer
dans le roster. Mesuré à **94,3 %** de détection sur les pièces, **99,3 %** sur
les armes — le niveau `Lv.XX` y resserre l'espace.

C'est cette propriété qui rend l'import sûr, bien plus que la qualité de l'OCR.
Un roster est lu par d'autres membres : une valeur fausse y passerait inaperçue.

### Les armes

Une arme se reconnaît à une chose : son en-tête affiche `Lv.50`. Une armure
n'affiche jamais de `Lv.`, seulement son emplacement et deux badges de
renforcement. Ce détail sépare les deux familles sans la moindre heuristique.

Le nom de l'arme, lui, doit être lu — il ne se déduit pas. Sur les 115 790
configurations du catalogue :

| ce qu'on connaît | déduction unique |
|---|---|
| les valeurs seules | 11,13 % |
| \+ le nom de l'arme | 98,00 % |
| \+ le niveau `Lv.XX` | 99,47 % |
| \+ le niveau de passif `Niv. N` | 99,96 % |

### Les enchantements

Ils ne se déduisent presque pas : ils s'affichent. Le libellé donne la
statistique, le nombre la valeur, le rang l'emplacement. Le catalogue ne sert
qu'à vérifier que le triplet est possible — une valeur hors des bornes est
refusée, jamais arrondie.

Une **perle de sortilège** demande deux choses de plus, un palier et un
élément, qui ne sont écrits nulle part sur le panneau. Le nombre de lignes
remplies borne le palier, les bornes de valeur l'affinent, et une statistique
élémentaire désigne l'élément.

Quand plusieurs éléments expliquent aussi bien la lecture, aucun chiffre ne les
sépare : leurs plages sont identiques pour les statistiques non élémentaires.
Le site retient alors l'élément de l'arme elle-même — une Rapière portant
« Attaque de Vent » est présumée sertie d'une perle de Vent — et **l'affiche
comme supposé**. C'est une supposition montrée, pas une supposition cachée, et
elle ne change aucun chiffre calculé.

## Ce que l'import ne fait pas

- **L'`Épée longue usée`** n'entre pas : ses courbes sont nulles dans les
  données du jeu. C'est l'épée de départ.
- **Les deux `Sortie décontractée`** — celle de Tioreh et celle de Griamore —
  restent hors catalogue : deux pièces différentes, un seul nom français, et le
  catalogue indexe par nom de fichier.
- **Rien n'est deviné.** Une ligne illisible laisse son emplacement vide ; le
  membre complète à la main.

## Sous le capot

Le moteur OCR est **versé dans le dépôt** (`vendor/tesseract/`, environ 5 Mo).
La PWA doit rester utilisable hors ligne, et `sw.js` déclare les CDN en
`network-only` : charger le moteur depuis un CDN casserait le mode hors ligne
au moment précis où le membre travaille.

Il est en revanche volontairement **absent de `CORE_ASSETS`**. Cinq mégaoctets
téléchargés par chaque membre, dont la plupart n'importeront jamais de capture,
coûteraient plus qu'ils ne rapportent : le service worker le met en cache le
jour où il est réellement demandé.

Deux passes d'OCR par capture, et ce n'est pas un luxe : la première lit le
panneau entier pour les libellés, la seconde une bande étroite à droite pour
les valeurs. Sans la seconde, deux valeurs sur six étaient perdues sur mobile.
Une troisième lit l'en-tête. Comptez environ une seconde par capture.

**Aucune coordonnée n'est codée en dur.** Le panneau se détecte par sa zone
claire collée au bord droit, les colonnes se déduisent de son contenu. C'est ce
qui permet à la même lecture de traiter du 1920×1080, du 2796×1290 et du
3440×1440 — trois résolutions et trois rapports d'image — sans un réglage.

Un seuil de luminance reste néanmoins nécessaire pour séparer la carte du ciel
étoilé, et il porte plus loin qu'il n'en a l'air : c'est lui qui décide si le
**bandeau du titre** entre dans la zone lue. Or ce bandeau change de couleur
selon la pièce — doré sur la `Baguette des ailes de la flamme noire`, violet
sur le `Grimoire flamboyant`, qui descend à 63 de luminance. Un seuil calé sur
une seule teinte donne alors l'échec le plus déroutant qui soit : tous les
chiffres lus correctement, et l'arme introuvable faute de nom. Les deux teintes
sont en fixture.

| module | rôle |
|---|---|
| `js/metier/ocr-libelles.js` | recaler un texte lu sur le catalogue |
| `js/metier/ocr-panneau.js` | géométrie : panneau, en-tête, lignes, sections |
| `js/metier/ocr-enchantements.js` | lignes lues → choix d'enchantement |
| `js/metier/ocr-deduction.js` | inversion d'une pièce d'équipement |
| `js/metier/ocr-arme.js` | inversion d'une arme |
| `js/vues/import-captures.js` | pixels, moteur, modale, aiguillage |

Conception détaillée :
`docs/superpowers/specs/2026-08-22-import-captures-ocr-design.md` et
`docs/superpowers/specs/2026-08-23-import-captures-armes-enchantements-design.md`.
