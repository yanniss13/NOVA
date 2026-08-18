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
MESURES = os.path.join(RACINE, "data", "animations-mesurees.json")
SORTIE = os.path.join(RACINE, "docs", "chronometrage-animations.md")

# Hypothese de travail pour classer, PAS une valeur utilisee dans un calcul :
# elle ne sert qu'a comparer les competences entre elles.
ANIMATION_SUPPOSEE = 1.5

# Les categories qui pesent dans une rotation offensive, dans l'ordre ou un
# joueur les enchaine. Une categorie absente d'ici reste listee, en queue.
ORDRE_CATEGORIES = ["NORMAL", "NORMAL_SKILL", "ACTIVE_THIRD", "ULTIMATE", "TAG_SKILL"]


def catalogue():
    source = open(CATALOGUE, encoding="utf-8").read()
    debut = source.index("{", source.index("="))
    return json.loads(source[debut:].rstrip().rstrip(";"))


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
    debloquent, affinent = [], []
    for heros, skill in competences():
        recharge = skill.get("recharge") or 0
        ligne = {
            "heros": heros,
            "arme": skill.get("weaponType") or "-",
            "nom": skill.get("nom") or "?",
            "gameId": skill.get("gameId") or "",
            "categorie": skill.get("categorie") or "?",
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
        ["héros", "arme", "compétence", "catégorie", "dégâts %", "mesure (s)"],
        [[l["heros"], l["arme"], l["nom"], l["categorie"],
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
        ["héros", "arme", "compétence", "catégorie", "recharge", "erreur", "mesure (s)"],
        [[l["heros"], l["arme"], l["nom"], l["categorie"],
          "%g s" % l["recharge"], "%.0f %%" % l["impact"],
          ("**%g**" % l["mesure"]) if l["mesure"] is not None else ""]
         for l in affinent])
    out.append("")
    return "\n".join(out)


if __name__ == "__main__":
    texte = rendre()
    if "--check" in sys.argv:
        actuel = open(SORTIE, encoding="utf-8").read() if os.path.exists(SORTIE) else ""
        if actuel != texte:
            print("docs/chronometrage-animations.md n'est plus a jour : "
                  "relancer python scripts/lister-chronometrage.py")
            sys.exit(1)
        print("chronometrage : liste a jour")
    else:
        open(SORTIE, "w", encoding="utf-8", newline="\n").write(texte)
        print("ecrit " + os.path.relpath(SORTIE, RACINE))
