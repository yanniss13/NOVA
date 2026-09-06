# Maquette de refonte NOVA

Depuis la racine du dépôt :

```powershell
python -m http.server
```

Ouvrir `http://localhost:8000/docs/refonte-maquette/`.

La maquette n'utilise aucune donnée réelle. Le bouton **Connexion** active un
état de démonstration. Les routes, onglets, menus, équipements et modales sont
cliquables ; aucune action n'est enregistrée.

## Routes

- `#home` : accueil public ;
- `#dashboard` : Mon suivi ;
- `#teams` : Team Builder et équipes partagées ;
- `#boss` : centre Boss de Guilde ;
- `#roster` : roster personnel et roster des membres ;
- `#tools` : Wiki, Collection, Calculateur et Analyse ;
- `#admin` : administration des membres.

Le bouton **Plus** donne accès aux outils sur téléphone. Les commandes
« Prévisualiser » de Mon suivi montrent les états vide, hors ligne et erreur.
