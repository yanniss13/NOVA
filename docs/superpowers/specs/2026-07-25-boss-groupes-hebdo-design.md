# Groupes de boss hebdomadaires — design

## Contexte
Le boss de confrérie (*Akumu, bête démoniaque*) reset chaque **lundi 9h**. On remplace
l'ancien système de « sessions » créées à la main (élément + dégâts + suivi) par des
**groupes auto-créés chaque semaine** que les membres rejoignent.

## Comportement
- **6 groupes** (`Groupe 1` … `Groupe 6`) par semaine, boss = *Akumu, bête démoniaque*.
- **Création automatique, sans nouvelle infra** : à l'ouverture de la page, l'appli calcule
  la semaine courante (lundi 9h Paris → lundi suivant) et fait un `upsert` des 6 groupes.
  Clé unique `(week_start, slot)` + `ignoreDuplicates` → aucun doublon même si plusieurs
  membres ouvrent la page en même temps ; le premier crée, les autres ne réécrivent rien.
- **Rejoindre / Quitter** : chaque membre peut rejoindre **un ou plusieurs** groupes
  (`boss_participation` = { session_id, owner, pseudo }). « Juste rejoindre » : pas de
  saisie d'élément / d'équipe / de dégâts.
- **Archivage automatique** : les groupes dont `week_start` ≠ semaine courante passent dans
  une section repliable « Semaines précédentes » (lecture seule). Rien à supprimer.

## Modèle de données (Supabase)
`boss_sessions` : + `week_start date`, + `slot int`, index unique `(week_start, slot)`.
`boss_participation` : inchangé (PK `(session_id, owner)`) ; on n'utilise plus que
`session_id, owner, pseudo` pour l'appartenance.

## Calcul de la semaine (`currentBossWeek` / `currentBossWeekStart`)
Lundi 9h Paris le plus récent ≤ maintenant. Un lundi **avant 9h** compte encore pour la
semaine précédente. Renvoyé en date `YYYY-MM-DD` (indépendant du fuseau/DST). Même calcul
côté appli (index.html) et côté rappel (scripts/reminder-core.js).

## Rappel Discord (inchangé côté planification)
Chaque **dimanche midi Paris** (GitHub Actions, crons 10h+11h UTC + garde côté script),
on ping les membres qui **n'ont rejoint aucun groupe** de la semaine courante
(`absentPseudos(profiles, memberships)`), sans vrai @mention.

## Tests
- `tests/reminder.test.js` : fenêtre, `currentBossWeekStart` (4 cas dont lundi <9h), absents, message.
- `tests/supabase-etape1.playwright.js` : 6 groupes créés (sans doublon), rejoindre → 1,
  multi-groupes → 2, quitter → 1. Le faux client Supabase gère `.in()`, `.order().order()`
  chaînés et l'`upsert` `ignoreDuplicates` sur `(week_start, slot)`.
