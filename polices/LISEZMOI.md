# Les polices de la carte Discord `/build`

Trois fichiers `.ttf` sont attendus ici. Ils ne sont pas téléchargés
automatiquement : le dépôt est public, et seule une licence ouverte autorise à
redistribuer une police et les images qu'on en tire.

| Fichier attendu | Police à déposer | Rôle sur la carte |
|---|---|---|
| `titre.ttf` | **Cinzel Bold** | le nom du personnage |
| `section.ttf` | **Cinzel Regular** | `01 ARME`, `02 ARMURE`, `03 BIJOUX` |
| `corps.ttf` | **EB Garamond Regular** | noms d'objets, libellés, valeurs |

Les deux familles sont sous **SIL Open Font License 1.1**, qui autorise
explicitement la redistribution et l'incorporation. Elles se téléchargent sur
Google Fonts :

- <https://fonts.google.com/specimen/Cinzel>
- <https://fonts.google.com/specimen/EB+Garamond>

**La licence doit accompagner les fichiers.** Chaque archive contient un
`OFL.txt` : le déposer ici aussi, sous `OFL-Cinzel.txt` et
`OFL-EBGaramond.txt`. C'est une obligation de l'OFL, pas une politesse.

Cinzel est une capitale d'inscription : ses minuscules sont dessinées en
petites capitales. C'est voulu pour les titres, et c'est pourquoi le corps du
texte emploie EB Garamond, une garalde qui porte de vraies minuscules
accentuées.

## Ensuite

```powershell
python scripts/generer-police-carte.py
```

Le script écrit `supabase/functions/_shared/carte-font.js`, l'atlas que l'Edge
Function lit — 119 caractères, quatre tailles. L'atlas du planning
(`availability-font.js`) reste séparé et intact : une refonte de la carte ne
peut pas abîmer le planning.

`--verifier` échoue si l'atlas publié ne correspond plus aux polices déposées.
