# Suivi d'avancement — Armes secondaires et Team Builder

Dernière mise à jour : 2026-07-29

Branche de travail : `stats-builds-secondary-weapons`

Conception :
`docs/superpowers/specs/2026-07-29-armes-secondaires-team-builder-design.md`

Plan :
`docs/superpowers/plans/2026-07-29-armes-secondaires-team-builder.md`

## État global

- [x] Task 1 — normaliser et transporter les trois builds
- [x] Task 2 — protéger `rosterBuilds` contre les anciennes PWA
- [x] Task 3 — calculer le transfert reconstructible de 30 %
- [x] Task 4 — rendre le résultat partiel impossible à confondre
- [x] Task 5 — changer de build par les trois icônes sans perte
- [x] Task 6 — mettre à jour ou recharger le roster explicitement
- [x] Task 7 — documenter, vérifier et préparer l'activation

## Points validés par le propriétaire

- Chaque arme non utilisée transfère 30 % de son ATK plate.
- Niveau, promotion, outrepassement et enchantements ATK plats sont inclus.
- Les bonus ATK % des armes secondaires sont exclus.
- Un seul build est visible et modifiable à la fois.
- Cliquer une icône charge le build complet correspondant.
- Les modifications non enregistrées survivent à A → B → A.
- « Mettre à jour mon roster » ne sauvegarde que le build affiché et le
  potentiel commun.
- Une arme secondaire manquante laisse les nombres disponibles visibles et
  marque uniquement l'ATK comme incomplète.

## Mesure de référence avant correction

| Statistique | Site | Jeu |
| --- | ---: | ---: |
| PV | 77 931,36 | 98 184 |
| ATK | 13 055,26 | 22 422 |
| DEF | 29 053,2 | 36 355 |

## Commits

| SHA | Message | Tâche |
| --- | --- | --- |
| `194e3e5` | `docs: concevoir le transfert des armes secondaires` | Conception |
| `de2eb17` | `docs: planifier les armes secondaires` | Plan |
| `3e30b8c` | `feat: conserver les trois builds d'un héros` | Task 1 |
| `d7f1fee` | `fix: préserver les trois builds d'équipe` | Task 2 |
| `97c12df` | `feat: calculer l'ATK des armes secondaires` | Task 3 |
| `ec49817` | `feat: signaler l'ATK secondaire incomplète` | Task 4 |
| `c584442` | `feat: changer de build depuis une équipe` | Task 5 |
| `c0fa47c` | `feat: synchroniser un build d'équipe vers le roster` | Task 6 |
| `aa6063d` | `fix: calculer les armes secondaires dans le roster` | Revue |
| `c727101` | `fix: rendre la synchronisation roster atomique` | Revue |
| `27c9232` | `fix: préserver le jeton exact du roster` | Revue |
| `3f24ad3` | `fix: détecter les versions roster exactes` | Revue |

## Vérifications

- Référence avant modification : `npm test` vert en 82,9 s.
- Task 1 RED : `snapshot.rosterBuilds` absent.
- Task 1 GREEN : `node tests/stats-build.test.js`.
- Régression potentiel : `node tests/potentiel-commun.test.js`.
- Task 2 RED : garde `rosterBuilds` absente du trigger d'équipe.
- Task 2 GREEN : `node tests/stats-build-schema.test.js`.
- Syntaxe SQL : `python -m unittest tests/test_schema_sql.py`.
- Task 3 RED : mode et termes d'armes secondaires absents.
- Task 3 GREEN : `node tests/stats-build.test.js`.
- Task 3 formule : transferts synthétiques `67,8` et `61,5`, sans ATK %.
- Task 4 RED : titre partiel et avertissement ATK absents du rendu.
- Task 4 GREEN : `node tests/stats-build.test.js`.
- Task 4 navigateur : `node tests/potentiel-commun.playwright.js`.
- Task 5 RED : `applyCharacterChange()` absent, puis zéro bouton de build.
- Task 5 GREEN : `node tests/stats-build.test.js`.
- Task 5 navigateur : `node tests/supabase-etape1.playwright.js`.
- Régression potentiel : `node tests/potentiel-commun.playwright.js`.
- Task 6 RED : action de mise à jour absente dans le Team Builder.
- Task 6 GREEN modèle : `node tests/stats-build.test.js`.
- Task 6 Supabase : `node tests/supabase-etape1.playwright.js`.
- Task 6 mobile : `node tests/accessibilite-mobile.playwright.js`.
- Générateur : `python generate-stats-build.py --check`.
- Syntaxe SQL : `python -m unittest tests/test_schema_sql.py`.
- Garde SQL : `node tests/stats-build-schema.test.js`.
- Parcours potentiel : `node tests/potentiel-commun.playwright.js`.
- Parcours Supabase : `node tests/supabase-etape1.playwright.js`.
- Parcours mobile : `node tests/accessibilite-mobile.playwright.js`.
- Régression éditeur roster RED : les deux armes secondaires configurées
  laissaient « calcul partiel ».
- Régression éditeur roster GREEN :
  `node tests/supabase-etape1.playwright.js`.
- Revue indépendante : zéro constat critique, trois constats importants
  vérifiés puis corrigés.
- Concurrence roster : RPC compare-and-swap testée avec une mutation distante
  injectée entre `refresh()` et l'écriture.
- Identité des baselines : compte et personnage obligatoires, réinitialisés aux
  changements d'identité.
- Ancienne PWA : `activeWeaponType` préservé par omission, mais jamais lorsqu'un
  `null` explicite est envoyé.
- Précision CAS : le `timestamptz` PostgreSQL exact reste un jeton opaque ;
  régression couverte avec six chiffres décimaux et deux écritures successives.
- Détection de conflit : deux versions différentes dans la même milliseconde
  déclenchent encore la confirmation ; repli numérique réservé aux anciens
  caches sans jeton.
- Suite complète après le correctif de revue : `npm test` vert en 109,2 s.
- Suite complète après les trois corrections : `npm test` vert en 88,2 s.
- Suite complète après conservation du jeton exact : `npm test` vert en 86,9 s.
- Revue finale : aucun constat Critical ou Important.
- Suite complète finale après la revue : `npm test` vert en 88,9 s.

## Activation

**Schéma Supabase à rejouer avant fusion** : le contenu complet de
`supabase/schema.sql` doit être exécuté dans le SQL Editor avant la fusion du
frontend. Aucun push ne sera effectué sans validation explicite.

## Mesures après déploiement

| Statistique | Site corrigé | Jeu | Écart restant |
| --- | ---: | ---: | ---: |
| PV | — | 98 184 | — |
| ATK | — | 22 422 | — |
| DEF | — | 36 355 | — |
