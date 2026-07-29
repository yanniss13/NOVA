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
- [ ] Task 3 — calculer le transfert reconstructible de 30 %
- [ ] Task 4 — rendre le résultat partiel impossible à confondre
- [ ] Task 5 — changer de build par les trois icônes sans perte
- [ ] Task 6 — mettre à jour ou recharger le roster explicitement
- [ ] Task 7 — documenter, vérifier et préparer l'activation

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

## Vérifications

- Référence avant modification : `npm test` vert en 82,9 s.
- Task 1 RED : `snapshot.rosterBuilds` absent.
- Task 1 GREEN : `node tests/stats-build.test.js`.
- Régression potentiel : `node tests/potentiel-commun.test.js`.
- Task 2 RED : garde `rosterBuilds` absente du trigger d'équipe.
- Task 2 GREEN : `node tests/stats-build-schema.test.js`.
- Syntaxe SQL : `python -m unittest tests/test_schema_sql.py`.

## Activation

Le contenu complet de `supabase/schema.sql` devra être rejoué avant la fusion
du frontend. Aucun push ne sera effectué sans validation explicite.

## Mesures après déploiement

| Statistique | Site corrigé | Jeu | Écart restant |
| --- | ---: | ---: | ---: |
| PV | — | 98 184 | — |
| ATK | — | 22 422 | — |
| DEF | — | 36 355 | — |
