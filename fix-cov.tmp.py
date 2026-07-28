"""Ajoute `uncovered` au contrat du moteur, cote lot 1 et cote plan du lot 2."""
from pathlib import Path

N = "\r\n"


def patch(path, edits):
    p = Path(path)
    source = p.read_text(encoding="utf-8", newline="")
    for old, new in edits:
        assert old in source, path + " : ancre introuvable — " + old[:60].replace(N, "|")
        assert source.count(old) == 1, path + " : ancre ambigue — " + old[:60].replace(N, "|")
        source = source.replace(old, new, 1)
    p.write_text(source, encoding="utf-8", newline="")


# ---- index.html : le moteur declare ce qu'il NE calcule pas ----------------
patch("index.html", [
    (
        "      coverage:[]," + N
        + "      assumptions:{ overlimitBase:OVERLIMIT_APPLICATION_MODE }," + N,
        "      coverage:[]," + N
        + "      uncovered:[]," + N
        + "      assumptions:{ overlimitBase:OVERLIMIT_APPLICATION_MODE }," + N,
    ),
    (
        '      coverage:["weapon"],' + N
        + "      assumptions:{ overlimitBase:OVERLIMIT_APPLICATION_MODE }," + N,
        '      coverage:["weapon"],' + N
        + "      /* Les 567 `passiveLevels` des armes ne sont ni au catalogue ni" + N
        + "         calcules. Sans cette declaration, leur absence passerait pour un" + N
        + "         vrai zero : le total serait lu comme complet alors qu'il est une" + N
        + "         borne inferieure. */" + N
        + '      uncovered:["weapon:passive"],' + N
        + "      assumptions:{ overlimitBase:OVERLIMIT_APPLICATION_MODE }," + N,
    ),
])

# ---- plan du lot 2 : coverage granulaire pour la gravure -------------------
plan = "docs/superpowers/plans/2026-07-28-stats-builds-lot2.md"
patch(plan, [
    (
        "- `coverage` passe à `[\"weapon\",\"armor\",\"jewel\",\"engraving\",\"set\"]`.",
        "- `coverage` passe à `[\"weapon\",\"armor\",\"jewel\",\"engraving\",\"set\"]` ;" + N
        + "- **`uncovered`** énumère ce qui existe dans les données mais n'est pas" + N
        + "  calculé. Sans lui, une source déclarée couverte dont une partie manque" + N
        + "  transforme ce manque en vrai zéro. Trois entrées obligatoires dans ce" + N
        + "  lot : `\"weapon:passive\"` (567 `passiveLevels` hors catalogue)," + N
        + "  `\"engraving:passive\"` (les passifs de gravure sont en prose, pas en" + N
        + "  paires `{stat, valeur}`) et `\"armor:passive\"` dès qu'une des 10 pièces" + N
        + "  portant un `equipPassive` est équipée." + N
        + N
        + "**Règle de lecture, à respecter partout :** une source listée dans" + N
        + "`coverage` et sans terme contribue vraiment zéro ; une source listée dans" + N
        + "`uncovered` est un manque connu, jamais un zéro." + N
        + N
        + "**Conséquence sur l'affichage :** dès que `uncovered` n'est pas vide, le" + N
        + "titre doit dire **« borne inférieure »**. Pour la gravure précisément :" + N
        + "**« Apport de la gravure hors passif — borne inférieure »**. Ne jamais" + N
        + "présenter un total comme complet quand `uncovered` contient quelque chose.",
    ),
    (
        "    return {" + N
        + "      version:1, status:\"valid\", coverage:[domain]," + N
        + "      assumptions:{ armorLevelOrigin:ARMOR_LEVEL_ORIGIN_MODE }," + N,
        "    /* La gravure garde ses contributions numeriques calculables, mais son" + N
        + "       passif est en prose : il est declare non couvert, jamais omis en" + N
        + "       silence. Les 10 armures portant un `equipPassive` suivent la meme" + N
        + "       regle. */" + N
        + "    const uncovered = [];" + N
        + "    if(domain === \"engraving\") uncovered.push(\"engraving:passive\");" + N
        + "    if(definition.equipPassive) uncovered.push(\"armor:passive\");" + N
        + "    return {" + N
        + "      version:1, status:\"valid\", coverage:[domain], uncovered," + N
        + "      assumptions:{ armorLevelOrigin:ARMOR_LEVEL_ORIGIN_MODE }," + N,
    ),
])

print("contrat `uncovered` ajoute au moteur et au plan")
