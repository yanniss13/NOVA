# Chronométrage fiable et DPS des compétences sans recharge

**Date :** 2026-08-22
**État :** design validé en conversation, à relire avant planification

## Objectif

Fiabiliser toute la chaîne de mesure des animations, puis utiliser une durée
validée pour calculer le DPS des compétences offensives sans recharge que le
simulateur sait représenter honnêtement.

Le travail est local uniquement. Il ne comprend ni commit, ni push, ni
déploiement de l’Edge Function, ni exécution du schéma dans Supabase.

## Périmètre

Deux lots sont livrés dans cet ordre :

1. empêcher, refuser et expliquer les mesures dont le protocole est incohérent ;
2. intégrer au simulateur les attaques normales et l’unique attaque spéciale
   sans recharge, mais seulement lorsque leur animation est mesurée.

Sont explicitement hors périmètre :

- la sauvegarde complète du compte ;
- le découpage de `js/vues/boss-sessions.js` ;
- la simulation des compétences de relève ;
- toute publication ou mutation d’un service externe ;
- l’invention d’une durée d’animation par défaut.

`data/animations-mesurees.json` reste la source manuelle et ne sera pas modifié
pour implémenter ou tester ces lots.

## Lot 1 — protocole de chronométrage fiable

### Protocole imposé par la compétence

L’outil ne demande plus au membre de choisir une méthode incompatible :

- une auto-attaque (`jumpatk` ou `normalatk`) utilise `mode:"rafale"` ;
- toute autre compétence utilise `mode:"unique"` ;
- en rafale, le nombre de cycles vaut 10 par défaut et reste modifiable à
  partir de 2 ;
- en mesure unique, le champ de répétitions est désactivé et la valeur envoyée
  est `reps:null`.

Les deux radios peuvent rester visibles pour expliquer le protocole, mais leur
état suit la compétence sélectionnée et n’est pas modifiable. Changer de héros,
d’arme ou de compétence recalcule immédiatement cet état.

`mesureCourante()` valide de nouveau ces règles. L’état impossible est donc
refusé même si le DOM est modifié manuellement ou si une future régression
réactive un contrôle.

### Cadence réellement envoyée

La cadence publiée avec la mesure vient de la même information que celle
affichée :

```text
fps = 1 / dureeImage
```

Elle est arrondie à une précision raisonnable, sans être forcée à un entier.
Lorsque `requestVideoFrameCallback` ne permet pas de mesurer la cadence,
l’outil emploie explicitement le repli de 60 FPS et l’indique dans l’interface.
La durée en secondes continue de reposer sur `mediaTime/currentTime`, jamais sur
le FPS déclaré.

### Envoi et retour utilisateur

Pendant l’insertion Supabase, le bouton d’envoi est désactivé. Il est réactivé
après succès ou échec. Un double clic ne peut donc pas créer deux lignes
identiques.

Le succès devient :

> Mesure envoyée, en attente de validation humaine.

Une compétence déjà présente dans le JSON manuel annonce qu’un nouvel envoi
sera proposé comme correction. Il ne prétend jamais remplacer automatiquement
la valeur publiée.

### Validation dans le rapatriement

`scripts/rapatrier-mesures.py` conserve les gardes déjà ajoutées et valide en
plus le protocole :

- `mode` appartient à `unique|rafale` ;
- `unique` exige `reps is null` ;
- `rafale` exige un entier `reps >= 2` ;
- un FPS renseigné est fini et compris entre 10 et 240 ;
- une ligne historique sans FPS reste lisible, mais l’absence est visible dans
  le détail soumis à l’humain.

Le dernier envoi de chaque auteur est toujours choisi avant validation. Une
correction invalide ne ressuscite jamais son ancienne mesure.

### Contraintes Supabase

`supabase/schema.sql` porte les mêmes invariants pour les nouvelles écritures :

- `seconds > 0 and seconds <= 30` ;
- `fps is null or (fps >= 10 and fps <= 240)` pour conserver les éventuelles
  lignes historiques ;
- `(mode = 'unique' and reps is null) or
  (mode = 'rafale' and reps is not null and reps >= 2)`.

Le script reste idempotent pour une installation neuve comme pour une table
existante. Les contraintes sont nommées, supprimées puis recréées lorsque
nécessaire. Aucune politique `update` ou `delete` n’est ajoutée : la boîte de
réception reste en ajout seul.

## Lot 2 — DPS sans recharge mesurée

### Compétences concernées

Les 151 compétences chiffrées sans recharge actuelles se répartissent en :

- 75 attaques normales (`NORMAL`) ;
- 1 attaque spéciale (`ACTIVE_THIRD`) ;
- 75 compétences de relève (`TAG_SKILL`).

Le moteur prend en charge les 76 premières. Les relèves restent exclues : elles
changent de héros et exigeraient une simulation d’équipe, alors que le
comparateur actuel oppose les builds d’un seul héros.

### Condition d’éligibilité

Une compétence offensive est planifiable si :

- sa catégorie est déjà couverte et sa recharge est strictement positive ; ou
- sa catégorie est `NORMAL` ou `ACTIVE_THIRD`, sa recharge vaut zéro et son
  `gameId` possède une animation mesurée strictement positive.

Une durée absente, nulle, non finie ou négative laisse la compétence hors
calcul. Ce garde-fou empêche qu’une action sans recharge soit rejouée une
infinité de fois au même instant.

### Cadence et rotation

`NORMAL` reçoit une catégorie interne dédiée dans `CATEGORIE_DPS` et dans
l’état des recharges. Pour une compétence sans recharge, la prochaine
disponibilité coïncide avec la fin de son animation mesurée. Le verrouillage
global du héros et la cadence de cette compétence racontent donc la même durée,
sans délai inventé.

Une attaque normale mesurée reste une vraie action du moteur et conserve ses
dégâts, ses déclencheurs et son verrouillage d’animation. Elle n’entre toutefois
plus dans l’énumération exhaustive de tous les ordres : toujours disponible,
elle rendait l’espace de recherche exponentiel et une fenêtre de 60 secondes ne
terminait plus.

Le moteur la traite comme un **remplissage déterministe** :

- tant qu’une compétence à recharge est disponible, seules les compétences à
  recharge participent à la recherche d’ordre existante ;
- lorsqu’aucune n’est disponible, l’attaque normale est lancée si son animation
  finit au plus tard au prochain retour d’une compétence à recharge ;
- ce retour est projeté à partir des échéances et événements déjà planifiés,
  notamment les ticks et événements périodiques jusqu’à la fin de l’animation :
  un événement intermédiaire n’est une barrière que s’il rend réellement une
  compétence disponible ;
- une réduction causée par la normale candidate ne peut pas interdire son propre
  déclencheur : elle s’applique seulement après le lancement, avec le
  verrouillage d’animation normal de cette action ;
- si ce retour survient avant la fin de l’animation, le moteur attend le
  cooldown au lieu de le retarder ;
- sans cooldown restant dans la fenêtre, les attaques normales remplissent le
  temps jusqu’à la borne semi-ouverte.

Ce choix privilégie explicitement les compétences à recharge. Il garantit une
simulation finie et reproductible, mais ne prétend plus trouver l’optimum global
si un futur passif exotique rendait préférable de retarder volontairement une
compétence prête au profit d’une attaque normale. L’interface remplace donc
« Rotation optimale selon les données connues » par
« Rotation simulée selon les priorités connues » et affiche l’hypothèse
`attaques-normales-remplissage` lorsqu’une normale est calculée.

La raison d’exclusion des relèves devient
`releve-hors-simulation-equipe`, au lieu de les confondre avec une recharge
invalide.

### Hypothèses et couverture affichées

L’hypothèse `attaques-normales-non-chiffrees` disparaît pour un build lorsque
son attaque normale chiffrée est réellement incluse grâce à une animation
mesurée. Elle reste visible sinon.

Le compte `animations:{mesurees,total}` porte uniquement sur les compétences
qui appartiennent au périmètre calculable du build. Une relève exclue ne gonfle
pas artificiellement ce total.

Les libellés de la fiche continuent d’annoncer toute couverture partielle et
n’affichent jamais un faux zéro.

## Nouveau classement des mesures

`scripts/lister-chronometrage.py` produit trois groupes :

1. **Débloque maintenant — 76 compétences** : `NORMAL` et l’`ACTIVE_THIRD`
   sans recharge ;
2. **Affine maintenant — 184 compétences** : catégories déjà simulées avec
   recharge positive, classées par erreur décroissante ;
3. **Simulation d’équipe future — 75 compétences** : relèves.

`data/chronometrage-avancement.json` propose d’abord les animations non mesurées
du premier groupe, puis celles du deuxième, puis les relèves. Les compteurs
restent explicites afin que « Mon suivi » et `/chrono` n’affirment pas que les
75 relèves sont déjà calculables.

Son contrat conserve `total`, `mesurees`, `debloquent` et `prochaines`, puis
ajoute `affinent` et `releves`. Les valeurs publiées avec le catalogue actuel
sont respectivement 335, 0, 76, 184 et 75. Le champ `role` d’une prochaine
mesure vaut exactement `debloque`, `affine` ou `releve`.

`docs/chronometrage-animations.md`, la carte « Mon suivi », le message Discord
et `AGENTS.md` emploient les mêmes catégories. Les deux sorties générées sont
régénérées par le script ; le JSON manuel des mesures ne l’est jamais.

## Erreurs et compatibilité

- Une mesure refusée côté outil explique le protocole attendu.
- Une contrainte Supabase refusée remonte par le message d’envoi existant.
- Une ligne historique incohérente est signalée puis ignorée par le script de
  rapatriement ; elle ne bloque pas les autres animations.
- Les équipes et builds sauvegardés ne changent pas de format.
- Sans aucune animation mesurée, les résultats DPS existants restent inchangés.

## Tests et vérification

La mise en œuvre suit des régressions rouges puis vertes.

### Chronométrage

- changement automatique `rafale|unique` selon la compétence ;
- répétitions désactivées et `null` en mode unique ;
- refus d’un protocole DOM incohérent ;
- cadence détectée à 30 FPS réellement envoyée à 30, et repli à 60 ;
- bouton protégé contre un double envoi ;
- texte d’attente de validation ;
- validation Python de `mode/reps/fps` ;
- contraintes SQL présentes et syntaxiquement valides.

### Simulateur

- recharge nulle sans animation : exclusion et terminaison garantie ;
- attaque normale avec animation : répétition à sa cadence ;
- attaque spéciale sans recharge avec animation : même garde ;
- relève mesurée : toujours exclue avec la raison dédiée ;
- compétence à recharge positive : résultat historique inchangé ;
- hypothèse d’attaque normale retirée uniquement lorsque la couverture existe ;
- attaque normale utilisée comme remplissage sans retarder un cooldown ;
- compétences à recharge prioritaires lorsqu’elles sont disponibles ;
- fenêtre de 60 secondes avec les quatre catégories terminée en moins de cinq
  secondes dans un sous-processus de test borné ;
- classement généré `76 → 184 → 75` et cinq prochaines cohérentes.

### Validation finale

- tests ciblés Python, Node et Playwright ;
- `python scripts/lister-chronometrage.py --check` ;
- parse de `supabase/schema.sql` ;
- `git diff --check` ;
- preuve que `data/animations-mesurees.json` est inchangé ;
- `npm test` complet.

Le résultat reste local et non commité jusqu’au feu vert explicite du
propriétaire.
