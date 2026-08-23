# Import de captures : armes et enchantements

Extension de `2026-08-22-import-captures-ocr-design.md`, dont elle reprend
l'architecture et le vocabulaire. Deux manques y étaient assumés : les armes
n'entraient pas, et les pièces entraient sans leurs enchantements.

## Ce que les mesures ont établi

### Les armes étaient exclues pour une mauvaise raison

La première mesure concluait que 95 armes sur 155 n'admettaient aucune
configuration nue. Elle était fausse : la sonde passait `enchantments: []`
alors qu'une arme à perle en attend **un** emplacement vide, `[null]`.

Avec la bonne configuration nue, **154 armes sur 155** s'inversent. La seule
exception est l'`Épée longue usée`, dont les courbes sont nulles dans
`data/stats-build.js` — un trou de données, pas une limite de méthode.

### Le nom de l'arme est indispensable, et il se lit

Sur les 115 790 configurations valides du catalogue :

| ce qu'on connaît | part de configurations à signature unique |
|---|---|
| les valeurs seules | 11,13 % |
| \+ le nom de l'arme | 98,00 % |
| \+ le niveau `Lv.XX` | 99,47 % |
| \+ le niveau de passif `Niv. N` | **99,96 %** |

Le nom ne se déduit donc pas : il se lit. Or il vit dans l'en-tête, que
`detecterPanneau` laissait dehors — le cadre doré mesure 192,8 de luminance
pour un seuil à 195. En élargissant la zone vers le haut, les huit captures
disponibles rendent leur en-tête sans une faute :

```
Baguette des ailes de la flamme noire      Rapière de l'âme vorace
Baguette                    Lv.50          Rapière            Lv.50
```

### Le discriminant arme/armure est gratuit

Une armure n'affiche jamais `Lv.` : elle affiche son emplacement et deux
badges de renforcement (`Haut  +5`, `+159`). La présence de `Lv.<nombre>` dans
l'en-tête sépare les deux familles sans heuristique.

### Le filet reste tendu

Une valeur principale mal lue d'un chiffre ne correspond à **aucune**
configuration dans 99,32 % des cas (2 640 411 mal-lectures simulées, niveau
supposé connu). C'est mieux que les 94,3 % relevés sur les armures : connaître
le niveau resserre l'espace des configurations.

### Les enchantements se lisent plus qu'ils ne se déduisent

Un enchantement d'armure gravée est un triplet `{slot, stat, value}` : le
libellé donne la stat, le nombre donne la valeur, le rang donne
l'emplacement. Vérifié sur `Le Sanglier de la Gourmandise` — les trois lignes
sous « Bonus de gravure » tombent dans les plages du catalogue.

Une perle d'arme demande en plus un palier et un élément. Le palier se déduit
du nombre de lignes croisé avec les bornes de valeur ; l'élément, des stats
élémentaires quand il y en a. Vérifié :

| arme | lignes | déduction |
|---|---|---|
| Baguette des ailes de la flamme noire | 4 | palier 5, **foudre** — unique |
| Rapière de l'âme vorace | 3 | palier 5, élément indéterminé (9 groupes) |

## Décisions

**Les armures ordinaires n'ont pas d'enchantements.** `randomOptions` est
absent de toutes les pièces non gravées : le lot « enchantements d'armure » ne
concerne que les 83 gravées, à trois emplacements chacune.

**Un élément indéterminé ne bloque pas l'import.** Les plages de valeur sont
identiques d'un groupe élémentaire à l'autre pour les stats non élémentaires :
le choix ne change aucun chiffre calculé. On retient l'élément de l'arme —
lisible sur ses propres stats (`Attaque de Vent` → `wind`) — et la ligne du
récapitulatif le signale comme supposé. C'est une supposition affichée, pas une
supposition cachée.

**Une ligne d'enchantement illisible n'annule pas la pièce.** La configuration
part alors avec cet emplacement vide plutôt que d'être rejetée : le membre
récupère l'essentiel et complète à la main. Le récapitulatif compte les
emplacements remplis.

**Le bruit de bordure se filtre par la longueur des mots.** Les trois captures
d'arme font ressortir le libellé principal pollué (`Le V4 LS X Attaque de
l'équipement`). Un fragment de libellé doit désormais contenir au moins un mot
de quatre lettres — les treize libellés relevés sur captures réelles en
contiennent tous un, les débris de bordure aucun.

## Découpage des modules

Le partage actuel — géométrie pure d'un côté, inversion de l'autre — tient. Il
faut seulement en extraire le socle commun, sans quoi l'inversion des
enchantements et celle des pièces se citeraient mutuellement.

| module | responsabilité |
|---|---|
| `metier/ocr-libelles.js` | **nouveau.** Normalisation, distance, recalage d'un libellé sur le catalogue, lecture d'un nombre. Extrait de `ocr-deduction.js`. |
| `metier/ocr-panneau.js` | géométrie. Gagne l'en-tête, la section d'appartenance de chaque ligne, le niveau de passif. |
| `metier/ocr-enchantements.js` | **nouveau.** Des lignes lues vers des choix d'enchantement — armure gravée et arme, basique et perle. |
| `metier/ocr-deduction.js` | inversion d'une pièce d'équipement. Perd son socle, gagne les enchantements. |
| `metier/ocr-arme.js` | **nouveau.** Inversion d'une arme : nom, grade, promotion, niveau, dépassement. |
| `vues/import-captures.js` | pixels, passes d'OCR, aiguillage arme/armure, récapitulatif. |
| `vues/roster-membres.js` | écriture dans le brouillon de roster. |

L'ordre de chargement suit : `ocr-libelles` avant `ocr-panneau`, puis
`ocr-enchantements`, puis `ocr-deduction`, puis `ocr-arme`.

## Ce qui reste dehors

- L'`Épée longue usée` : courbes absentes des données.
- Les deux `Sortie décontractée` : nom français partagé, le catalogue indexe
  par nom de fichier.
- Le renforcement et le niveau affichés dans l'en-tête d'une **armure** ne sont
  pas exploités. L'inversion les retrouve déjà ; les lire ne servirait qu'à un
  recoupement, et un recoupement qui échoue pose plus de questions qu'il n'en
  résout.
