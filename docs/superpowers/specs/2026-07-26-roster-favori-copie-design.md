# Roster — build favori et copie d'équipement

## Objectif

Permettre à chaque personnage de posséder un build favori servant de modèle
rapide pour ses autres types d'arme, tout en conservant la règle actuelle :
**un seul build modifiable par type d'arme**.

## Modèle de données

Le booléen `favorite` est stocké dans chaque objet du JSON `builds` existant :

```js
{
  builds: {
    "Hache": {
      weapon: "7ds-armes/Hache/x.webp",
      armor: {},
      jewel: {},
      note: "",
      favorite: true
    }
  }
}
```

Il n'y a donc aucune nouvelle colonne ni migration de table Supabase.

`emptyRosterBuild()` initialise `favorite` à `false`.
`normalizeRosterBuild()` normalise la valeur en booléen et
`normalizeRosterCharacter()` garantit qu'au plus un build autorisé reste favori.
Les anciens rosters sans ce champ migrent automatiquement avec
`favorite:false`.

## Règles du favori

- Seul un build réellement enregistré peut devenir favori.
- Cliquer sur l'étoile d'un build non favori retire le précédent favori et
  active celui-ci.
- Cliquer sur l'étoile du favori le désactive.
- Supprimer le build favori supprime naturellement le favori.
- Ouvrir l'éditeur d'un personnage sélectionne son type d'arme favori ; sans
  favori, le premier type compatible reste sélectionné.
- Les cartes et onglets du roster signalent le favori avec une étoile et un
  libellé accessible, pas uniquement par la couleur.

## Copie vers un autre type d'arme

Depuis un onglet d'arme différent du favori, une action
`Copier le favori ici` copie :

- les cinq armures ;
- les trois bijoux ;
- la note.

L'arme source n'est jamais copiée, car elle appartient à un autre type. Si la
destination possède déjà une arme compatible, elle est conservée. Si la
destination n'existe pas encore, elle est créée avec une arme vide.

Le statut favori reste uniquement sur la source et n'est pas copié. Les objets
`armor` et `jewel` sont clonés profondément afin qu'une modification ultérieure
de la destination ne modifie pas la source.

Si un build de destination existe déjà, une confirmation annonce que ses
armures, bijoux et sa note seront remplacés tandis que son arme sera conservée.
Une annulation ne modifie rien.

## Fonctions pures

La logique sera isolée dans des fonctions testables :

- `favoriteRosterWeaponType(entry): string | null` ;
- `setFavoriteRosterBuild(entry, weaponType): normalizedEntry` ;
- `copyFavoriteRosterBuild(entry, targetWeaponType): normalizedEntry`.

Les fonctions refusent les types non compatibles, un favori absent et une
destination égale à la source.

## Tests d'acceptation

- Un ancien build sans `favorite` reste valide et non favori.
- Plusieurs favoris entrants sont normalisés vers un seul favori déterministe.
- Marquer un second build favori désactive le premier.
- Retirer le favori n'efface pas son équipement.
- La copie transfère armures, bijoux et note, mais pas l'arme source.
- Une arme déjà présente dans la destination est conservée.
- Modifier la copie ne modifie pas le favori.
- L'éditeur s'ouvre sur le favori et expose des libellés accessibles.
- La confirmation protège un build de destination existant.

