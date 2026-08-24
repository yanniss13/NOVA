# Fusionner `extraction-fichiers-du-jeu` dans `main`, puis publier

**Date :** 2026-08-24
**État :** 22 commits prêts, 78/78 tests unitaires au vert, rien n'est poussé.
**Mission :** fusionner la branche dans `main` et pousser. Rien d'autre.

## Où on en est

`main` est à `9484bb1` et **n'a pas bougé** depuis la création de la branche.
La branche `extraction-fichiers-du-jeu` est à `2e387af`, **22 commits d'avance**,
sans dépôt distant configuré. `git merge-tree` n'annonce aucun conflit.

Le point qui rend cette fusion urgente : **la fonction Edge `lecture-panneau`
est déjà déployée sur Supabase avec sa clé**, mais le code qui l'appelle vit
uniquement sur cette branche. Tant qu'elle n'est pas publiée, un membre qui
importe une capture tombe sur Tesseract sans le savoir. **La fusion est ce qui
allume la fonctionnalité.**

## La commande

```powershell
git checkout main
git merge --no-ff extraction-fichiers-du-jeu
git push
```

Le `--no-ff` est délibéré : ces 22 commits forment un tout, et une avance rapide
noierait le fil dans l'historique de `main`.

## Avant de pousser

```powershell
npm run test:unit    # doit rendre 78/78
npm run test:e2e     # 19 parcours navigateur
```

**Deux pièges connus, ni l'un ni l'autre imputable à cette branche :**

- `supabase-etape1` (44 px) et `accessibilite-mobile` (tuile du sélecteur)
  échouent par intermittence. Relancer avant de conclure à une régression.
- **La CI tourne sous Linux, où les polices sont plus larges qu'en local.** Une
  assertion de largeur peut passer ici et casser le déploiement là-bas. Si la CI
  rougit sur une mesure de largeur, c'est ça — pas la fusion.

## Ce que la branche apporte

**Extraction des fichiers du jeu.** Le usmap `mappings-1.7` fait passer les
tables lisibles de 420 à 1 409. Les données du dépôt ont été confrontées au
client : stats de base des 25 héros, 375 maîtrises, 232 équipements, 45 paliers
de sets, 200 constantes de combat. **Aucun écart.**

**Trois corrections de calcul, toutes lues dans les tables du jeu :**

- les six règles `bonus-stat/elementalAttack` versaient dans le taux d'attaque
  élémentaire ce que le jeu range en taux de dégâts. Meliodas, Drake, Klotho,
  Merlin ;
- deux buffs collectifs manquaient — Elizabeth +60 % de dégâts d'attaque
  normale, Manny +30 % d'ultime — que `BuffTable` déclare `ApplyType: Team` ;
- le boost de dégâts crit. du Bâton d'Elizabeth, absent en base **et** à ses
  paliers 6 et 10.

**Une correction retirée.** `docs/potentiels-divergents.md` annonçait 31
potentiels erronés. Ils étaient justes : la vérification devinait la clé de
localisation au lieu de la lire dans `DefaultSkillWeaponTypeTable`. Le document
est remplacé par `docs/potentiels-du-jeu.md`, qui conclut à 748 paliers exacts
sur 750.

**Lecture assistée des captures (Gemini).** Fonction Edge `lecture-panneau` +
client + repli intégral sur Tesseract hors ligne. Le modèle transcrit, il ne
déduit rien : sa sortie repasse par `deduireArme`/`deduirePiece`, qui ne
retiennent que les configurations dont les totaux recalculés reproduisent la
lecture. Éprouvé sur quatre captures réelles, toutes en candidate unique.
Détail dans `docs/lecture-assistee.md`.

**Deux retours de membres.** Un bouton « Tout au maximum » dans l'éditeur de
build, et le nom lu qui lève l'ambiguïté entre armures liées indiscernables.

## Ce qu'il ne faut PAS faire

- **Ne pousser aucune autre branche.** Il n'y en a pas d'autre ; s'il en
  apparaît une, elle n'est pas de ce lot.
- **Ne pas commiter `outils/fmodel/tous-les-chemins.txt`.** Il pèse 99 Mo, rien
  ne le lit, il se régénère en une commande. Il a été retiré de l'historique de
  la branche et ajouté au `.gitignore` — le `.git` est passé de 111 Mo à 25 Mo.
  Même chose pour `outils/fmodel/animations-completes.json`, sortie
  intermédiaire dupliquée dans `data/animations-extraites.json`.
- **Ne pas régénérer les données extraites** (`data/temps-action.json`,
  `data/animations-*.json`). Elles demandent un export FModel de 1,5 Go que la
  CI n'a pas.

## Après le push

Le site se déploie depuis `main`. Une fois en ligne, vérifier la lecture
assistée : **connecté**, ouvrir l'import de captures, déposer une capture
d'arme. Deux signes que Gemini a bien tourné — c'est quasi instantané, et les
quatre mégaoctets de Tesseract ne sont pas téléchargés (onglet Réseau).

En cas d'échec, le message nomme désormais le lecteur employé, et la lecture
complète part dans la console sous `[import]`.

## Ce qui reste ouvert, et n'est pas de ce lot

- **Le usmap 2.0**, à demander le mercredi 26 août. Deux cibles chiffrées :
  `Table/Skill/PC_SkillTable` (temps de recharge — débloquerait 76 compétences
  aujourd'hui absentes du classement) et `Actor/MonsterActorTable` (stats
  défensives des monstres, demandées pour le rétro-engineering de la formule).
  37 tables échouent encore.
- **La constante C** du calcul de dégâts : intestable depuis les fichiers, il
  faut un coup en jeu sur cible défendue.
- **Question 3 des buffs** (`docs/buffs-portee-lue-dans-le-jeu.md`) : le taux
  élémentaire du receveur multiplie-t-il le buff plat ? Question de formule, pas
  de table.
- **Le buff de Drake** porte `UltimateSkill_DamAdd_Rate 3000` que ni la
  description de la compétence ni celle du buff ne mentionnent. À +90 % de
  dégâts d'ultime à trois cumuls, ça demande une mesure avant d'être publié.
