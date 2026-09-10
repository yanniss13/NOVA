# Les deux ambiances NOVA

Réalisé le 10 septembre 2026, à partir de deux références visuelles fournies
par le propriétaire. Les références inspirent l'atmosphère ; la mise en page
conserve les outils réels du site.

## Direction visuelle

**Liones, la capitale du royaume**, sous deux lumières : nuit améthyste avec
Meliodas en Assault Mode et aube dorée avec Elizabeth. Les illustrations v2
reprennent le même château au centre et les personnages à droite ; les
références et prompts sont dans `bannieres-nova-v2.md`. Le décor se concentre dans la
bannière ; les cartes et formulaires utilisent des contours fins et des fonds
lisibles. Titres de bannière en Constantia/Palatino/Georgia, titres d'interface
dans le Cinzel existant, contrôles dans la police système.

**La bannière n'a aucun bord.** C'est la correction du 10 septembre : la
première version l'encadrait d'un filet doré et n'en fondait que 45 px, si bien
qu'elle se lisait comme une image posée sur la page plutôt que comme la page
elle-même. Trois gestes l'ont dissoute :

- Le filet doré a disparu, sous la bannière comme sous l'en-tête.
- Le panorama **remonte sous l'en-tête**, qui est **entièrement transparent**
  tant qu'il le survole : ni fond, ni flou. La navigation et le décor sont la
  même image.

  Dès qu'on a défilé au-delà de la bannière, l'en-tête reprend son verre
  (`--header-glass`) et son flou de 16 px. Ce n'est pas une demi-mesure : sous
  la bannière, ce qui passe derrière lui n'est plus le panorama mais les
  cartes de héros, et des onglets posés dessus seraient illisibles.
  `suivreDefilementAmbiance` pose `data-defile` sur la racine ; le seuil est
  lu à chaque trame plutôt que calculé une fois, parce que l'en-tête grandit
  d'une ligne dans les vues « Boss de Guilde » et change de hauteur quand les
  onglets passent à la ligne.

  Un voile haut (`--banner-scrim`) densifie la seule bande occupée par
  l'en-tête, à pleine force sur 74 % de sa hauteur puis éteint 44 px plus bas.
  Sans lui, les derniers onglets tombaient dans les zones claires du ciel et
  « Connexion » disparaissait dans le soleil du thème clair. Un halo de texte
  complète, actif uniquement quand l'en-tête est transparent.
- Le bas s'éteint sur 170 px. Ce fondu est un **masque** (`--banner-fondu`) et
  non un dégradé vers une couleur : il va vers la transparence réelle, suit
  donc le halo radial du `body` et les deux ambiances sans qu'aucune teinte
  soit dupliquée. Un dégradé vers `--obsidian` aurait laissé une trace là où
  le halo passe.

La bannière est **identique dans toutes les vues**. Elle n'a plus de version
courte : même titre, même taille, même accroche, même lien d'appel. Un jeu de
règles la raccourcissait auparavant dans les catalogues — titre à 36 px, lien
masqué — et c'est ce qui la faisait changer d'aspect d'une page à l'autre. Un
test compare la signature complète de la bannière entre l'Accueil et trois
catalogues, et refuse la moindre différence.

Le texte est **ancré au bas** d'une bannière de hauteur constante
(`--banner-hauteur`, 480 px), et non calé sous l'en-tête. Les vues du groupe « Boss de
Guilde » portent une seconde ligne d'onglets : l'en-tête y gagne une
cinquantaine de pixels, et un texte calé sous lui descendait d'autant d'une vue
à l'autre. Ancré en bas, il se pose au même endroit partout — c'est l'en-tête
plus haut qui recouvre un peu plus de ciel. Les 460 px viennent de la mesure :
419 px au plus haut (298 px de texte et 121 px d'en-tête, atteints entre 561 et
820 px de large), plus les 40 px de la seconde ligne d'onglets, soit 459 px —
et 480 plutôt que 460, parce qu'à 1 px près l'ancrage lâchait au moindre pixel
de texte en plus, et le titre redescendait avec l'en-tête. Le `padding-top` reste la
garantie qu'aucun texte ne passe derrière la navigation si ces deux nombres
bougent. Un test fait grandir l'en-tête et vérifie que le titre ne bouge pas. Il doit
attendre que `--topbar-h` ait rejoint la nouvelle hauteur : le `ResizeObserver`
ne le republie qu'à la trame suivante, et mesurer entre les deux lit une
bannière encore réglée sur l'ancienne valeur.

Le panorama ne connaît pas la hauteur de l'en-tête, et le CSS seul ne sait pas
la lire. `js/vues/ambiance.js` la publie donc en `--topbar-h`, et un
`ResizeObserver` la republie : elle change quand les onglets passent à la
ligne, quand le mobile bascule en paysage, ou quand la seconde ligne « Boss de
Guilde » apparaît.

- Ténèbres : obsidienne `#100d18`, panneaux `#201a2a`, or `#d0ad70`,
  améthyste `#c2a0ee`, texte `#f1e9df`.
- Lumière : ivoire `#f4eee2`, panneaux `#fffaf1`, bronze `#896127`,
  texte `#392d26`, texte secondaire `#6d5d4c`.

`js/vues/ambiance.js` lit uniquement `confrerie7ds.ambiance` (`dark`/`light`).
Une valeur inconnue revient à Ténèbres. Le choix fonctionne au clavier et
sans stockage disponible ; l'événement `storage` synchronise les onglets.
Changer d'ambiance ne relit pas Supabase et ne reconstruit aucun formulaire.

## Le pied de page, et pourquoi il est sombre dans les deux ambiances

Il n'existait aucun pied de page : la page s'arrêtait sur `</main>`. Il en
existe un depuis que le lien affilié LootBar est descendu de l'en-tête.

Le déplacement répond à un fait mesurable : le logo est du `#FFCC00` pur sur
transparence, sans un seul pixel sombre. Sur l'ivoire du thème Lumière, son
contraste tombe à environ 1.6:1 — illisible. La première version compensait par
une pastille `#211b29`, un rectangle noir violacé au milieu d'un en-tête crème.

Le pied de page est donc un **socle sombre dans les deux ambiances** : `#261c14`
en Lumière, `#0a0710` en Ténèbres. Le jaune de marque y tient sans pastille
rapportée. Ce n'est pas un thème clair oublié — un test mesure la luminance du
socle dans les deux ambiances.

Le parti pris du pied : la page **s'ouvre sur Liones en pleine lumière et se
ferme sur sa silhouette**. C'est le même panorama, déjà précaché, assombri et
masqué au point qu'on n'en devine que la ligne de crête. Il ne coûte donc pas un
octet de plus, et n'a de sens que sur ce site-là. Toujours le panorama *sombre*,
même en ambiance Lumière : le socle est sombre dans les deux cas.

Le filet du haut s'éteint vers la droite, comme le voile de la bannière s'éteint
vers elle : les deux extrémités de la page se répondent. Le bouton « Haut de
page » est un `<button>` et non un lien — le site route sur le fragment d'URL,
et un `href` inconnu ferait replier la vue courante.

Le pied porte aussi la mention « Lien partenaire ». Elle **améliore la
divulgation** : jusque-là, la nature rémunérée du lien n'était portée que par
`rel="sponsored"`, que lisent les moteurs et pas les membres.

Ses styles vivent dans `css/base.css` et non dans la couche d'ambiance, parce
qu'`akumu.html` ne charge que cette feuille-là et porte le même pied de page.
En mobile, c'est lui — et non plus `main` — qui réserve sa place à la barre au
pouce : il est devenu le dernier bloc de la page.

`css/ambiance.css` est chargée après toutes les autres feuilles. Les fonds
historiques et les messages de statut sont adaptés explicitement au thème
clair, sans inverser les illustrations ou les couleurs des éléments du jeu.
Les images sont précachées pour rendre les deux ambiances disponibles hors
ligne. Leur taille cumulée est d'environ 221 Ko.

## Le bloc du compte

La capsule du compte a un rayon de 999 px, donc une extrémité parfaitement
arrondie, mais ne laissait que 6 px à droite au bouton « Déconnexion », dont les
angles étaient à 4 px. Là où la courbe rentre, elle venait au contact du coin
carré : le rectangle semblait sortir de la capsule.

Le bouton est devenu une capsule lui aussi, emboîtée dans la première, et a
perdu sa bordure — deux liserés concentriques faisaient du bruit pour rien. Les
marges sont maintenant symétriques : 6 px à droite comme en haut et en bas. En
ambiance Lumière sa teinte est plus soutenue qu'en Ténèbres : sur l'ivoire, une
teinte faible ne se lit plus comme un bouton une fois la bordure retirée.

## Les glyphes du jeu en ambiance Lumière

Les icônes de `7ds-ui/mastery/` (12 armes) et `7ds-ui/skills/` (325 compétences)
sont du **blanc pur sur transparence** — mesuré à luminance 255 et saturation 0.
Sur l'ivoire du thème clair elles deviennent invisibles. Un `filter:brightness(0)`
les passe en noir en gardant exactement leur découpe.

La règle vise le **chemin** et non une classe, pour couvrir tous les endroits où
ces images apparaissent, y compris ceux qu'on ajoutera. Les icônes de
`7ds-ui/role-elements/` en sont volontairement exclues : ce sont des
illustrations en couleur, les noircir les détruirait. Un test le vérifie.

Le piège : **un filtre s'applique à tout l'élément, son fond et sa bordure
compris.** Les deux porteurs de glyphe se traitent donc différemment.

- `.wiki-skill-icon` est l'image elle-même et portait son fond sombre : le
  noircir peignait un carré noir plein. Son fond et sa bordure passent en
  transparent, et le glyphe se pose sur la carte claire.
- `.wslot` est le **parent** de son image : le filtre ne l'atteint pas, et son
  fond sombre écrit en dur s'éclaircit simplement avec le thème.

Le test mesure les deux à la fois — glyphe noirci, fond resté clair — parce que
l'un sans l'autre ne prouve rien.

## Anciens panoramas du jeu, conservés comme repli

Avant les illustrations v2 demandées ensuite par le propriétaire, les
panoramas génériques avaient été remplacés. Le propriétaire l'avait dit
franchement : *« elles sont très belles mais elles n'ont pas vraiment de rapport
avec 7DS ou la NOVA »*. C'était exact — les prompts d'origine, conservés plus
bas, demandaient une « fantasy citadel » sans une seule référence au jeu.

Ces deux anciens panoramas représentent **Liones, la capitale du royaume**, tirée des
écrans de chargement officiels du jeu. C'est le lieu le plus reconnaissable de
Seven Deadly Sins, et le concept du site tient toujours : la même ville, deux
lumières.

| Ambiance | Fichier source du jeu |
|---|---|
| Ténèbres | `UIImg/origin/LoadingScreen/Texture/loading_bg_map_Liones_02.png` (2048 × 1024) |
| Lumière | `UIImg/origin/LoadingScreen/Texture/loading_bg_map_Liones_03.png` (2048 × 1024) |

Trouvés dans l'export FModel `Exports-2.0-build-24929381`, le seul des trois à
contenir des PNG — celui du build courant n'a exporté que du JSON. Le dossier
`UIImg/origin/LoadingScreen/Texture` contient une cinquantaine d'autres décors
de Britannia : Forêt du Roi des Fées, Plaine de Vanya, Ravens, Ferzen.

Traitement appliqué, sans aucune génération d'image :

1. Recadrage en 3:1 — Ténèbres `y 140..823`, Lumière `y 60..743`.
2. Accord colorimétrique vers la palette de chaque ambiance : luminosité,
   saturation, contraste, puis un mélange à 16 % vers `#100d18` ou `#f4eee2`.
3. Encodage WebP qualité 88, méthode 6.

- `assets/ambiance/nova-tenebres.webp` : 2048 × 683, **74 Ko** (était 158 Ko).
- `assets/ambiance/nova-lumiere.webp` : 2048 × 683, **147 Ko** (était 247 Ko).

Le précache passe donc d'environ 406 Ko à **221 Ko**. Les noms de fichiers n'ont
pas changé : ils désignent le RÔLE — la bannière sombre du site — et non le
sujet. Le socle du pied de page pointe sur `nova-tenebres.webp` pour sa
silhouette, et n'a rien eu à changer.

Ce sont des assets de Netmarble, comme les portraits, les vignettes d'objets et
les icônes que le site utilise déjà partout.

## Le blason de la confrérie

`.guild-crest` remplace le mot « NOVA » qui signait le bas de la bannière : la
confrérie a désormais une marque et pas seulement un nom. Un écu, sa bordure
intérieure, et l'étoile de NOVA en meuble central — la même que l'emblème de
l'en-tête et que celui du pied de page, si bien que la marque se répète aux
trois bouts de la page.

Le champ de l'écu est un voile translucide et non une couleur pleine : le décor
transparaît au lieu d'être découpé. En ambiance Lumière il passe au bronze
`#6d4d17`, et son ombre portée devient un halo clair — l'or clair s'effacerait
sur le ciel du couchant. Il est masqué sous 561 px, comme l'ancienne signature.

## Prompts de la première version, pour mémoire

Ces prompts ont produit les panoramas remplacés ci-dessus. Ils sont conservés
parce qu'ils expliquent d'où venait la citadelle générique, et ce qu'il ne faut
pas redemander.

Prompt Ténèbres :

> Use case: stylized-concept. Create an original panoramic environment painting for the hero banner of NOVA, a French Seven Deadly Sins Origin guild website. Wide landscape, 3:1 composition. A magnificent ancient fantasy citadel on a rocky island on the RIGHT half, slender gothic towers and arched bridge, a huge luminous lavender eclipse behind its spires, layers of distant mountains and purple cloud mist. Foreground right has a restrained weathered carved stone arch and a few drifting golden embers. LEFT 45 percent is quiet dark plum mist and negative space for HTML title overlay, no large foreground objects there. Rich hand-painted high-end anime RPG environment art, delicate architectural detail, cinematic atmosphere, obsidian black-purple, muted amethyst, tiny antique gold lights in windows. Beautiful and inviting guild sanctuary, not horror. No characters, no text, no letters, no logo, no UI, no frame. Deliver a landscape image.

Prompt Lumière, avec le PNG Ténèbres comme référence d'édition :

> Use case: lighting-weather. This is the dark hero artwork of the NOVA guild website; create its LIGHT theme companion. Preserve the exact panoramic 3:1 composition, architecture, island, bridge, right foreground arch, and empty left half. Transform the scene into a luminous celestial dawn: warm ivory and alabaster citadel stone, softly glowing golden sun replacing the lavender eclipse, champagne and peach clouds, distant pale blue mountains, light mist. Beautiful warm gilded sunrise, elegant high-end hand painted anime fantasy environment, detailed but airy. The left 45 percent must be pale low-contrast warm cream mist, suitable for dark brown HTML text overlay. No characters, no text, no UI, no logos. Keep geometry and framing identical.

## Vérifier

`npm test` inclut `tests/ambiance.playwright.js` : mémoire, clavier, stockage
refusé, synchronisation entre onglets, conservation du brouillon et absence
de débordement à 320, 390, 768 et 1440 px dans les deux thèmes.

Pour le rendu, ouvrir `http://localhost:8000/#builder` après avoir lancé
`python -m http.server`. Vérifier aussi le Wiki, le sélecteur de héros et les
cartes de boss dans les deux thèmes. Attendre la fin des transitions de
couleur avant de capturer l'écran.
