"""Liste les competences a chronometrer, classees par ce que la mesure rapporte.

Pourquoi cette liste existe : aucune source publique ne donne les temps
d'animation de 7DS Origin. Ni 7dsorigin.app, ni sevencodex, ni 7dscalc - ce
dernier ecrit noir sur blanc que le vrai DPS demande le temps d'animation et
qu'il ne le modelise pas. La mesure est donc manuelle, et cette liste sert a la
rendre finie : elle dit quoi mesurer d'abord, et ce que chaque mesure rapporte.

Deux regimes, et ils ne se valent pas :

  - Une competence SANS recharge ne se rejoue que lorsque son animation se
    termine. Son animation n'est pas une correction, c'est le denominateur
    entier : sans elle, son DPS n'existe pas. Ces mesures debloquent.

  - Une competence AVEC recharge se rejoue quand sa recharge tombe. L'animation
    n'ajoute qu'un retard : ignorer 1,5 s sur 12 s de recharge se trompe de
    11 %. Ces mesures affinent.

Le tableau se remplit a la main dans data/animations-mesurees.json, jamais ici :
ce fichier-ci est regenere, celui-la ne l'est pas.

    python scripts/lister-chronometrage.py
"""

import json
import os
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATALOGUE = os.path.join(RACINE, "data", "competences.js")
WIKI = os.path.join(RACINE, "data", "wiki-competences.js")
MESURES = os.path.join(RACINE, "data", "animations-mesurees.json")
SORTIE = os.path.join(RACINE, "docs", "chronometrage-animations.md")
# Le meme classement, reduit a ce qu'une page web a besoin d'afficher. Le
# tableau complet pese trop pour etre charge par le navigateur, et « Mon suivi »
# n'a besoin que du compte et des toutes prochaines mesures.
AVANCEMENT = os.path.join(RACINE, "data", "chronometrage-avancement.json")

# Cinq lignes : de quoi donner une direction sans transformer une carte de
# tableau de bord en second tableau.
PROCHAINES = 5

# Hypothese de travail pour classer, PAS une valeur utilisee dans un calcul :
# elle ne sert qu'a comparer les competences entre elles.
ANIMATION_SUPPOSEE = 1.5

# Les categories qui pesent dans une rotation offensive, dans l'ordre ou un
# joueur les enchaine. Une categorie absente d'ici reste listee, en queue.
ORDRE_CATEGORIES = ["NORMAL", "NORMAL_SKILL", "ACTIVE_THIRD", "ULTIMATE", "TAG_SKILL"]

LIBELLES_CATEGORIES = {
    "NORMAL": "Attaque normale",
    "NORMAL_SKILL": "Compétence normale",
    "ACTIVE_THIRD": "Attaque spéciale",
    "ULTIMATE": "Attaque ultime",
    "TAG_SKILL": "Compétence de relève",
}

# Verifie en jeu. Les noms internes des gameId ont derive : `skill_rmb_ready`
# se declenche sur Q et `skill_q` sur R. La categorie reste donc la source de
# la touche, et c'est bien elle qui portait l'erreur.
TOUCHES_CATEGORIES = {
    "NORMAL": "clic gauche",
    "NORMAL_SKILL": "E",
    "ACTIVE_THIRD": "Q",
    "ULTIMATE": "R",
    "TAG_SKILL": "1 à 4",
}

LIBELLES_ARMES = {
    "Axe": "Hache",
    "Book": "Grimoire",
    "SwordDual": "Épées doubles",
    "Rapier": "Rapière",
    "Shield": "Épée & bouclier",
    "Lance": "Lance",
    "Sword1h": "Épée à une main",
    "Cudgel3c": "Nunchaku",
    "Gauntlets": "Gantelets",
    "Sword2h": "Épée à deux mains",
    "Staff": "Bâton",
    "Wand": "Baguette",
}


def catalogue():
    source = open(CATALOGUE, encoding="utf-8").read()
    debut = source.index("{", source.index("="))
    return json.loads(source[debut:].rstrip().rstrip(";"))


def noms_francais():
    with open(WIKI, encoding="utf-8") as fichier:
        source = fichier.read()
    debut = source.index("{", source.index("="))
    wiki = json.loads(source[debut:].rstrip().rstrip(";"))
    return {
        skill["gameId"]: skill["nomFr"]
        for liste in wiki.values()
        for skill in liste
        if skill.get("gameId") and skill.get("nomFr")
    }


def competences():
    for heros, liste in sorted(catalogue().items()):
        for skill in liste:
            if (skill.get("pourcentage") or 0) <= 0:
                continue
            yield heros, skill


def rang_categorie(nom):
    return ORDRE_CATEGORIES.index(nom) if nom in ORDRE_CATEGORIES else len(ORDRE_CATEGORIES)


def mesures_existantes():
    if not os.path.exists(MESURES):
        return {}
    contenu = json.load(open(MESURES, encoding="utf-8"))
    return contenu.get("animations", {})


def lignes():
    mesurees = mesures_existantes()
    noms = noms_francais()
    debloquent, affinent = [], []
    for heros, skill in competences():
        recharge = skill.get("recharge") or 0
        categorie = skill.get("categorie") or "?"
        arme = skill.get("weaponType") or "-"
        game_id = skill.get("gameId") or ""
        ligne = {
            "heros": heros,
            "arme": LIBELLES_ARMES.get(arme, arme),
            "nom": noms.get(game_id) or skill.get("nom") or "?",
            "gameId": game_id,
            "categorie": categorie,
            "categorieLabel": LIBELLES_CATEGORIES.get(categorie, categorie),
            "touche": TOUCHES_CATEGORIES.get(categorie, "-"),
            "recharge": recharge,
            "degats": skill.get("pourcentage") or 0,
            "mesure": mesurees.get(skill.get("gameId") or ""),
        }
        if recharge > 0:
            ligne["impact"] = ANIMATION_SUPPOSEE / (recharge + ANIMATION_SUPPOSEE) * 100
            affinent.append(ligne)
        else:
            ligne["impact"] = None
            debloquent.append(ligne)
    debloquent.sort(key=lambda l: (rang_categorie(l["categorie"]), -l["degats"]))
    affinent.sort(key=lambda l: -l["impact"])
    return debloquent, affinent


def tableau(entetes, corps):
    sortie = ["| " + " | ".join(entetes) + " |",
              "|" + "|".join("---" for _ in entetes) + "|"]
    sortie.extend("| " + " | ".join(cells) + " |" for cells in corps)
    return sortie


def rendre():
    debloquent, affinent = lignes()
    faites = sum(1 for l in debloquent + affinent if l["mesure"] is not None)
    total = len(debloquent) + len(affinent)

    out = [
        "# Chronométrage des animations",
        "",
        "> Fichier **généré** par `python scripts/lister-chronometrage.py`.",
        "> Les mesures se saisissent dans `data/animations-mesurees.json`,",
        "> jamais ici : cette page est réécrite à chaque exécution.",
        "",
        "Aucune source publique ne donne ces temps. Ils se mesurent en jeu, et",
        "cette liste existe pour rendre ce travail fini : elle dit quoi mesurer",
        "d'abord, et ce que chaque mesure rapporte.",
        "",
        "**Avancement : %d / %d mesurées.**" % (faites, total),
        "",
        "## 1. Ce que la mesure débloque — %d compétences" % len(debloquent),
        "",
        "Sans recharge : la compétence se rejoue quand son animation finit.",
        "L'animation **est** le dénominateur. Sans elle, aucun DPS n'est calculable.",
        "",
    ]
    out += tableau(
        ["héros", "arme", "compétence", "catégorie", "touche", "dégâts %", "mesure (s)"],
        [[l["heros"], l["arme"], l["nom"], l["categorieLabel"],
          l["touche"],
          "%g" % l["degats"],
          ("**%g**" % l["mesure"]) if l["mesure"] is not None else ""]
         for l in debloquent])
    out += [
        "",
        "## 2. Ce que la mesure affine — %d compétences" % len(affinent),
        "",
        "Avec recharge : l'animation ajoute un retard. La colonne « erreur »",
        "donne ce qu'on se trompe en l'ignorant, pour une animation supposée",
        "de %g s. Classement par erreur décroissante." % ANIMATION_SUPPOSEE,
        "",
    ]
    out += tableau(
        ["héros", "arme", "compétence", "catégorie", "touche", "recharge", "erreur", "mesure (s)"],
        [[l["heros"], l["arme"], l["nom"], l["categorieLabel"],
          l["touche"],
          "%g s" % l["recharge"], "%.0f %%" % l["impact"],
          ("**%g**" % l["mesure"]) if l["mesure"] is not None else ""]
         for l in affinent])
    out.append("")
    return "\n".join(out)


def rendre_avancement():
    """Le meme classement, reduit a ce que « Mon suivi » affiche.

    Les competences qui debloquent passent devant : sans leur animation, aucun
    DPS n'est calculable, tandis qu'une competence a recharge n'est qu'imprecise.
    Une mesure deja faite ne se propose plus."""
    debloquent, affinent = lignes()
    faites = sum(1 for l in debloquent + affinent if l["mesure"] is not None)
    restantes = [
        dict(l, role="debloque" if l["impact"] is None else "affine")
        for l in debloquent + affinent
        if l["mesure"] is None
    ]
    contenu = {
        "_lisezmoi": [
            "Genere par scripts/lister-chronometrage.py, comme",
            "docs/chronometrage-animations.md. Ne pas editer a la main.",
            "Les mesures se saisissent dans data/animations-mesurees.json.",
        ],
        "total": len(debloquent) + len(affinent),
        "mesurees": faites,
        "debloquent": len(debloquent),
        "prochaines": [
            {
                "gameId": l["gameId"],
                "heros": l["heros"],
                "arme": l["arme"],
                "nom": l["nom"],
                "categorie": l["categorieLabel"],
                "touche": l["touche"],
                "role": l["role"],
            }
            for l in restantes[:PROCHAINES]
        ],
    }
    return json.dumps(contenu, ensure_ascii=False, indent=1) + "\n"


if __name__ == "__main__":
    texte = rendre()
    avancement = rendre_avancement()
    sorties = [(SORTIE, texte), (AVANCEMENT, avancement)]
    if "--check" in sys.argv:
        for chemin, attendu in sorties:
            actuel = (open(chemin, encoding="utf-8").read()
                      if os.path.exists(chemin) else "")
            if actuel != attendu:
                print(os.path.relpath(chemin, RACINE).replace(os.sep, "/")
                      + " n'est plus a jour : "
                      "relancer python scripts/lister-chronometrage.py")
                sys.exit(1)
        print("chronometrage : liste a jour")
    else:
        for chemin, contenu in sorties:
            open(chemin, "w", encoding="utf-8", newline="\n").write(contenu)
            print("ecrit " + os.path.relpath(chemin, RACINE).replace(os.sep, "/"))
