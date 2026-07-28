"""Ajoute le contrat `uncovered` au plan du lot 2."""
from pathlib import Path

PATH = Path("docs/superpowers/plans/2026-07-28-stats-builds-lot2.md")
source = PATH.read_text(encoding="utf-8", newline="")
N = "\r\n" if "\r\n" in source else "\n"


def swap(old, new):
    global source
    assert old in source, "ancre introuvable : " + old[:60].replace(N, "|")
    assert source.count(old) == 1, "ancre ambigue : " + old[:60].replace(N, "|")
    source = source.replace(old, new, 1)


# 1. Section 6 du contrat : le champ `uncovered` et sa regle de lecture.
swap(
    "- `coverage` passe à `[\"weapon\",\"armor\",\"jewel\",\"engraving\",\"set\"]`.",
    "- `coverage` passe à `[\"weapon\",\"armor\",\"jewel\",\"engraving\",\"set\"]` ;" + N
    + "- **`uncovered`** énumère ce qui existe dans les données mais n'est pas" + N
    + "  calculé. Sans lui, une source déclarée couverte dont une partie manque" + N
    + "  transforme ce manque en vrai zéro. Trois entrées à prévoir :" + N
    + "  `\"weapon:passive\"` (567 `passiveLevels` hors catalogue)," + N
    + "  `\"engraving:passive\"` (les passifs de gravure sont en prose, pas des" + N
    + "  paires `{stat, valeur}`) et `\"armor:passive\"` dès qu'une des 10 pièces" + N
    + "  portant un `equipPassive` est équipée." + N
    + N
    + "**Règle de lecture, valable partout :** une source listée dans `coverage`" + N
    + "et sans terme contribue vraiment zéro ; une source listée dans `uncovered`" + N
    + "est un manque connu, jamais un zéro." + N
    + N
    + "**Conséquence sur l'affichage :** dès que `uncovered` n'est pas vide, le" + N
    + "titre doit dire **« borne inférieure »**. Pour la gravure :" + N
    + "**« Apport de la gravure hors passif — borne inférieure »**. Ne jamais" + N
    + "présenter un total comme complet quand `uncovered` contient quelque chose.",
)

# 2. Tache 4 : la gravure garde ses contributions calculables, son passif est
#    declare non couvert.
swap(
    "      version:1, status:\"valid\", coverage:[domain]," + N,
    "      version:1, status:\"valid\", coverage:[domain], uncovered," + N,
)
swap(
    "    return {" + N + "      version:1, status:\"valid\", coverage:[domain], uncovered,",
    "    /* La gravure garde ses contributions numériques calculables, mais son" + N
    + "       passif est en prose : il est déclaré non couvert, jamais omis en" + N
    + "       silence. Les 10 armures portant un `equipPassive` suivent la même" + N
    + "       règle. */" + N
    + "    const uncovered = [];" + N
    + "    if(domain === \"engraving\") uncovered.push(\"engraving:passive\");" + N
    + "    if(definition.equipPassive) uncovered.push(\"armor:passive\");" + N
    + "    return {" + N
    + "      version:1, status:\"valid\", coverage:[domain], uncovered,",
)

# 3. Le resultat vide porte aussi le champ, pour que la forme soit constante.
swap(
    "        version:1, status, coverage:[]," + N,
    "        version:1, status, coverage:[], uncovered:[]," + N,
)

# 4. Interfaces de la tache 5 : l'agregation propage `uncovered`.
swap(
    "  - `calculateBuildStats(build)` → "
    "`{version:1, coverage, assumptions, terms, totals, statuses}`",
    "  - `calculateBuildStats(build)` → "
    "`{version:1, coverage, uncovered, assumptions, terms, totals, statuses}`",
)

PATH.write_text(source, encoding="utf-8", newline="")
print("plan corrige : contrat uncovered")
