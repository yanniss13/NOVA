# Moteur OCR embarqué

Fichiers repris de `tesseract.js` 7.0.0 et `tesseract.js-core`, plus le modèle
français `fra.traineddata`.

| Fichier | Provenance | Poids |
|---|---|---|
| `tesseract.esm.min.js` | `tesseract.js/dist/` | 62 Ko |
| `worker.min.js` | `tesseract.js/dist/` | 109 Ko |
| `tesseract-core-lstm.wasm.js` | `tesseract.js-core/` | 3,7 Mo |
| `fra.traineddata` | `tessdata` | 1,2 Mo |

Environ 5 Mo au total.

## Deux réglages sans lesquels rien ne démarre

**Le cœur est épinglé.** `corePath` pointe directement sur
`tesseract-core-lstm.wasm.js`, pas sur le dossier. Sinon le worker choisit une
variante selon les capacités SIMD du navigateur et réclame un fichier qu'on n'a
pas versé (`tesseract-core-relaxedsimd-lstm.wasm.js`). La variante retenue
embarque son WASM : un seul fichier au lieu d'une paire, aucune requête de plus.

**`gzip:false`.** Le moteur réclame `fra.traineddata.gz` par défaut. On sert le
modèle en clair : un fichier de moins à produire, et il reste inspectable.

## Pourquoi ils sont dans le dépôt

La PWA doit rester utilisable hors ligne, et `sw.js` déclare les CDN en
`network-only`. Charger le moteur depuis un CDN casserait le mode hors ligne et
créerait une dépendance réseau au moment précis où le membre travaille.

## Le correctif appliqué

Les fichiers d'origine portent des URL `cdn.jsdelivr.net` comme valeurs **par
défaut** de `workerPath`, `corePath` et `langPath`. La vue passe explicitement
ses propres chemins, donc ces valeurs ne devraient jamais servir — mais « ne
devrait jamais » n'est pas une garantie, et un chemin de code oublié sortirait
sur Internet sans qu'on le voie.

Trois expressions ont donc été remplacées par des chemins relatifs :

```
tesseract.esm.min.js
  "https://cdn.jsdelivr.net/npm/tesseract.js@v".concat(c,"/dist/worker.min.js")
    -> "./vendor/tesseract/worker.min.js"

worker.min.js
  "https://cdn.jsdelivr.net/npm/@tesseract.js-data/".concat(i,...)
    -> "./vendor/tesseract"
  "https://cdn.jsdelivr.net/npm/tesseract.js-core@v".concat(h.substring(1))
    -> "./vendor/tesseract"
```

**À refaire à chaque mise à jour du moteur.** `tests/vendor-tesseract.test.js`
échoue si une référence CDN réapparaît — c'est ce qui rend l'oubli impossible.

## Pas de préchargement

Ces fichiers sont volontairement **absents** de `CORE_ASSETS` dans `sw.js` :
quatre mégaoctets téléchargés par chaque membre, dont la plupart n'importeront
jamais de capture, coûteraient plus qu'ils ne rapportent. Le gestionnaire
`fetch` du service worker les met en cache le jour où ils sont réellement
demandés. C'est la même logique que celle déjà appliquée à l'icône 512.

Le test vérifie aussi cette absence : ajouter le moteur à `CORE_ASSETS` le fait
échouer.
