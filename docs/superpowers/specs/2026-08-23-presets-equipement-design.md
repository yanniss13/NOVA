# Presets d'équipement — conception

Date : 23 août 2026
Branche : `feat/presets-equipement`

## Le problème

Dans 7DS Origin, une pièce d'équipement n'a qu'un porteur : équiper un set sur
Meliodas le retire à Escanor. Un joueur déplace donc physiquement ses sets
selon le contenu qu'il joue, et il le refait à chaque changement.

Le site sait décrire l'équipement d'un personnage, mais il ne sait pas nommer
un ensemble de pièces ni le reposer ailleurs. `copyFavoriteRosterBuild`
(`js/vues/roster-membres.js`) fait pourtant déjà le geste exact — recopier
`armor`, `armorConfig`, `jewel`, `jewelConfig` d'un build vers un autre en
gardant l'arme de la cible. Il lui manque trois choses : un nom, une existence
hors du personnage d'origine, et un chemin vers les autres écrans.

## Ce que l'exploration a établi

**Les builds existants sont indexés par type d'arme.** `roster_characters.builds`
est un objet dont les clés sont les trois armes compatibles du héros, avec un
favori. Ce n'est pas un espace de presets : on ne peut pas y ranger deux sets
pour la même arme, ni réutiliser un set sur un autre personnage.

**L'armure gravée est propre au personnage.** `ARMOR_SLOTS` vaut
`["Haut","Bas","Bottes","Ceinture","Armure liee"]`, et `js/metier/equipement.js`
note déjà : « L'armure liée est exclue : elle est propre au personnage et n'a
pas de set. » La clé interne `"Armure liee"` s'affiche « Armure gravée ».

**Une config décrit une pièce précise.** `supabase/schema.sql` avertit qu'une
config d'enchantement restaurée sur une pièce qui a changé est périmée. Pièce
et config ne se séparent donc jamais.

| | emplacements |
|---|---:|
| Armure transportable (`Haut`, `Bas`, `Bottes`, `Ceinture`) | 4 |
| Bijoux (`Anneau`, `Collier`, `Boucle d'oreille`) | 3 |
| **Portés par un preset** | **7** |
| Armure gravée — appartient au héros | 1 |

## Décisions prises avec l'utilisateur

| Question | Décision |
|---|---|
| Mécanique du jeu | Une pièce, un porteur. Le preset est un ordre de déménagement. |
| Contenu | 4 pièces d'armure + 3 bijoux, configs comprises. Armure gravée exclue. |
| Conflit d'inventaire | **Aucun.** Le site n'alloue pas l'inventaire, comme aujourd'hui à la main. |
| Surfaces | Fiche héros du roster, Builder d'équipe, calculateur de dégâts. |
| Création | Capture depuis un héros déjà équipé. Pas d'éditeur dédié. |
| Visibilité | Privés. Aucun partage à la confrérie. |
| Stockage | Table dédiée `gear_presets`. |

Le refus de gérer les conflits d'inventaire est un choix, pas un oubli : le
site n'a jamais modélisé la rareté d'une pièce, deux héros peuvent déjà porter
le même fichier d'armure. Ajouter l'allocation ici créerait une règle que le
reste du site ne tient pas.

## Modèle de données

Un preset :

```js
{
  id,                 // uuid, généré côté client (crypto.randomUUID)
  nom,                // 1 à 40 caractères, non vide après trim
  armor:{ Haut, Bas, Bottes, Ceinture },      // chemins de fichiers ou null
  armorConfig:{ [emplacement]: config },       // solidaire de sa pièce
  jewel:{ Anneau, Collier, "Boucle d'oreille" },
  jewelConfig:{ [emplacement]: config }
}
```

`"Armure liee"` n'apparaît dans aucune des deux structures. Un preset importé
qui en contiendrait une la perd à la normalisation, comme n'importe quelle clé
inconnue.

### SQL

```sql
create table if not exists public.gear_presets (
  owner      uuid not null references auth.users(id) on delete cascade,
  id         uuid not null,
  nom        text not null check (length(btrim(nom)) between 1 and 40),
  payload    jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (owner, id)
);
create index if not exists gear_presets_owner_idx on public.gear_presets(owner);
```

RLS : `select`, `insert`, `update`, `delete` réservés à `auth.uid() = owner`.
Aucune politique `for all`, aucune lecture par un autre membre — le test de
schéma refusera l'un comme l'autre, sur le modèle d'`animation_measures`.

Une ligne par preset, jamais un tableau. Le schéma explique déjà pourquoi à
propos de `collection_items` : un tableau imposerait de tout réécrire à chaque
geste, et deux appareils ouverts se perdraient mutuellement des entrées.

## Modules

**`js/metier/presets.js`** — pur, sans DOM ni réseau.

- `capturerPreset(build, nom)` → un preset, ou `null` si le build est vide.
  Ne lit que les 7 emplacements transportables.
- `appliquerPreset(build, preset)` → un **nouveau** build. Remplace les 4
  emplacements d'armure, les 3 de bijoux et leurs configs. Préserve `weapon`,
  `weaponConfig`, `note`, `favorite` et `armor["Armure liee"]` avec sa config.
  Suit la convention des `apply*` de `js/vues/edition-build.js`, qui ne
  modifient jamais sur place.
- `normaliserPreset(source)` → forme sûre, emplacements inconnus écartés.

**`js/donnees/presets-store.js`** — Supabase et cache local, sur le modèle de
`collection-store.js`. Pas de Realtime : un preset ne concerne que son auteur.

**Sélecteur partagé** dans `js/vues/edition-build.js`, le module qui existe
précisément parce que plusieurs écrans partagent ces widgets.

## Surfaces

| Écran | Appliquer | Capturer |
|---|---|---|
| Fiche héros du roster | écrit le build du type d'arme courant | oui |
| Builder d'équipe | écrit le brouillon d'équipe | oui |
| Calculateur de dégâts | **temporaire**, n'écrit rien | non |

La distinction du calculateur est essentielle : on y compare des hypothèses.
Appliquer un preset pour voir un DPS ne doit pas modifier l'équipement
enregistré du héros.

## Erreurs et cas limites

- **Preset vide** — capturer un héros sans aucune des 7 pièces est refusé, avec
  un message qui dit pourquoi plutôt qu'un bouton inerte.
- **Nom déjà pris** — accepté. Deux presets peuvent porter le même nom ; l'`id`
  les distingue. Interdire imposerait une contrainte que rien ne réclame.
- **Pièce disparue du catalogue** — à l'application, un fichier inconnu de
  `BUILD_GEAR` est posé tel quel et signalé à l'affichage, comme un build
  ancien. On ne supprime pas silencieusement.
- **Hors ligne** — l'écriture échoue et le dit. Pas de file d'attente : le site
  n'en a nulle part ailleurs.
- **Limite** — 40 presets par membre, refusés **côté client** avec un message
  clair. Pas de contrainte SQL : compter les lignes d'un propriétaire dans un
  `check` demanderait un déclencheur, machinerie disproportionnée pour un
  garde-fou de confort. La base reste protégée par la RLS, qui est ce qui
  compte.

## Tests

- `tests/presets.test.js` — capture, application, armure gravée intacte, arme
  préservée, config solidaire de sa pièce, emplacement inconnu écarté.
- `tests/presets-schema.test.js` — la table porte sa contrainte de nom, et la
  RLS refuse `for all` comme toute lecture par un tiers.
- Playwright — une application par surface, et la preuve que le calculateur
  n'écrit rien.
- `tests/modules-imports.test.js` couvre déjà les nouveaux modules.

## Hors périmètre

Partage des presets entre membres, allocation d'inventaire, éditeur de preset
dédié, presets d'arme, import ou export de fichier.
