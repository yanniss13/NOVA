"""Liste les competences a chronometrer, classees par ce que la mesure rapporte.

Pourquoi cette liste existe : aucune source publique ne donne les temps
d'animation de 7DS Origin. Ni 7dsorigin.app, ni sevencodex, ni 7dscalc - ce
dernier ecrit noir sur blanc que le vrai DPS demande le temps d'animation et
qu'il ne le modelise pas. La mesure est donc manuelle, et cette liste sert a la
rendre finie : elle dit quoi mesurer d'abord, et ce que chaque mesure rapporte.

Trois groupes, selon ce que la mesure apporte au simulateur :

  - Une attaque normale ou speciale SANS recharge utilise son animation comme
    denominateur du modele de cadence. Ces mesures debloquent le DPS actuel.

  - Une competence AVEC recharge est deja prise en charge par le simulateur.
    Son animation ajoute un retard : ignorer 1,5 s sur 12 s de recharge se
    trompe de 11 %. Ces mesures affinent le DPS actuel.

  - Une competence de releve `TAG_SKILL`, avec ou sans recharge, attend la
    simulation d'equipe. Sa mesure preparera ce modele futur.

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
VERROUS = os.path.join(RACINE, "data", "animations-verrous.json")
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
# joueur les enchaine. Une categorie inconnue est refusee explicitement.
ORDRE_CATEGORIES = ["NORMAL", "NORMAL_SKILL", "ACTIVE_THIRD", "ULTIMATE", "TAG_SKILL"]
CATEGORIES_SIMULEES = {"NORMAL", "NORMAL_SKILL", "ACTIVE_THIRD", "ULTIMATE"}
CATEGORIES_DEBLOQUEES = {"NORMAL", "ACTIVE_THIRD"}

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
    "Sword1h": "Épée longue",
    "Cudgel3c": "Nunchaku",
    "Gauntlets": "Gantelets",
    "Sword2h": "Espadon",
    "Staff": "Bâton",
    "Wand": "Baguette",
}


def catalogue():
    with open(CATALOGUE, encoding="utf-8") as fichier:
        source = fichier.read()
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
    with open(MESURES, encoding="utf-8") as fichier:
        contenu = json.load(fichier)
    return contenu.get("animations", {})


def verrous_deduits():
    """Les verrous que les fichiers du jeu donnent deja.

    Tant qu'`animations-verrous.json` n'existait pas, il fallait
    chronometrer chaque competence a la main. Ce n'est plus vrai : le
    montage porte ses marqueurs `EEnableSkipBy*`, et `ecrire-verrous.js`
    en tire le premier instant ou le heros peut relancer une action
    offensive.

    Demander une mesure pour une competence deja renseignee, c'est
    envoyer quelqu'un refaire un travail que le jeu publie. Elles sortent
    donc de la liste, et le compteur cesse d'afficher un retard qui
    n'existe pas.

    Restent a mesurer : celles dont aucune fenetre n'est connue, et les
    attaques sautees, que `ecrire-verrous.js` ecarte volontairement.
    """
    if not os.path.exists(VERROUS):
        return {}
    with open(VERROUS, encoding="utf-8") as fichier:
        return json.load(fichier).get("animations", {})


def lignes():
    mesurees = mesures_existantes()
    deduits = verrous_deduits()
    noms = noms_francais()
    debloquent, affinent, releves = [], [], []
    for heros, skill in competences():
        recharge = skill.get("recharge") or 0
        categorie = skill.get("categorie") or "?"
        arme = skill.get("weaponType") or "-"
        game_id = skill.get("gameId") or ""
        # Le jeu a deja repondu : rien a mesurer ici. Un verrou nul en
        # fait partie — « relancable aussitot » est une reponse.
        if game_id in deduits:
            continue
        # Les attaques sautees sont bridees par le saut, pas par leur
        # animation, et aucun simulateur ici ne modelise le saut. Les
        # chronometrer ne changerait aucun chiffre.
        if "jumpatk" in game_id:
            continue
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
        if categorie == "TAG_SKILL":
            ligne["impact"] = None
            releves.append(ligne)
        elif categorie not in CATEGORIES_SIMULEES:
            raise ValueError(
                "Compétence hors catalogue : %s (%s)" % (game_id, categorie)
            )
        elif recharge > 0:
            ligne["impact"] = ANIMATION_SUPPOSEE / (recharge + ANIMATION_SUPPOSEE) * 100
            affinent.append(ligne)
        elif categorie in CATEGORIES_DEBLOQUEES:
            ligne["impact"] = None
            debloquent.append(ligne)
        else:
            raise ValueError(
                "Compétence sans recharge hors catalogue : %s (%s)"
                % (game_id, categorie)
            )
    debloquent.sort(key=lambda l: (rang_categorie(l["categorie"]), -l["degats"]))
    affinent.sort(key=lambda l: -l["impact"])
    releves.sort(key=lambda l: (rang_categorie(l["categorie"]), -l["degats"]))
    return debloquent, affinent, releves


def tableau(entetes, corps):
    sortie = ["| " + " | ".join(entetes) + " |",
              "|" + "|".join("---" for _ in entetes) + "|"]
    sortie.extend("| " + " | ".join(cells) + " |" for cells in corps)
    return sortie


def rendre():
    deduits = verrous_deduits()
    debloquent, affinent, releves = lignes()
    toutes = debloquent + affinent + releves
    faites = sum(1 for l in toutes if l["mesure"] is not None)
    total = len(toutes)

    out = [
        "# Chronométrage des animations",
        "",
        "> Fichier **généré** par `python scripts/lister-chronometrage.py`.",
        "> Les mesures se saisissent dans `data/animations-mesurees.json`,",
        "> jamais ici : cette page est réécrite à chaque exécution.",
        "",
        "Les montages du jeu portent ces temps : `animations-verrous.json` en",
        "déduit %d verrous, et la liste ci-dessous ne retient plus que ce" % len(deduits),
        "qu'aucun fichier ne renseigne. Elle dit quoi mesurer d'abord, et ce",
        "que chaque mesure rapporte.",
        "",
        "**Avancement : %d / %d mesurées.**" % (faites, total),
        "",
        "Les %d verrous déduits ne sont pas pour autant acquis : ce sont des" % len(deduits),
        "lectures de marqueurs, pas des chronomètres. Une mesure saisie dans",
        "`animations-mesurees.json` **écrase** la déduction pour cette",
        "compétence. Là où les deux concordent, la déduction est confirmée ;",
        "là où elles divergent, c'est qu'une mécanique s'intercale — et c'est",
        "précisément ce qui vaut la peine d'être trouvé.",
        "",
        "## 1. Mesures qui débloquent maintenant — %d compétences" % len(debloquent),
        "",
        "Sans recharge : l'animation sert de dénominateur au modèle de cadence.",
        "Ces attaques normales et spéciales débloquent maintenant le calcul du DPS.",
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
        "## 2. Mesures qui affinent maintenant — %d compétences" % len(affinent),
        "",
        "Avec recharge : le simulateur calcule déjà la compétence et",
        "l'animation ajoute un retard. La colonne « erreur » donne ce qu'on",
        "se trompe en l'ignorant, pour une animation supposée de %g s." % ANIMATION_SUPPOSEE,
        "Classement par erreur décroissante.",
        "",
    ]
    out += tableau(
        ["héros", "arme", "compétence", "catégorie", "touche", "recharge", "erreur", "mesure (s)"],
        [[l["heros"], l["arme"], l["nom"], l["categorieLabel"],
          l["touche"],
          "%g s" % l["recharge"], "%.0f %%" % l["impact"],
          ("**%g**" % l["mesure"]) if l["mesure"] is not None else ""]
         for l in affinent])
    out += [
        "",
        "## 3. Relèves — simulation d’équipe future — %d compétences" % len(releves),
        "",
        "Les compétences de relève seront calculées avec une future simulation",
        "d'équipe. Leur mesure est utile pour préparer ce modèle, sans modifier",
        "encore le DPS affiché.",
        "",
    ]
    out += tableau(
        ["héros", "arme", "compétence", "catégorie", "touche", "dégâts %", "mesure (s)"],
        [[l["heros"], l["arme"], l["nom"], l["categorieLabel"],
          l["touche"],
          "%g" % l["degats"],
          ("**%g**" % l["mesure"]) if l["mesure"] is not None else ""]
         for l in releves])
    out.append("")
    return "\n".join(out)


def rendre_avancement():
    """Le meme classement, reduit a ce que « Mon suivi » affiche.

    Les normales et speciales sans recharge debloquent le modele de cadence,
    les recharges affinent le modele actuel, les releves attendent le modele
    d'equipe. Une mesure deja faite ne se propose plus."""
    debloquent, affinent, releves = lignes()
    toutes = debloquent + affinent + releves
    faites = sum(1 for l in toutes if l["mesure"] is not None)
    restantes = [
        dict(l, role=role)
        for role, liste in (("debloque", debloquent), ("affine", affinent), ("releve", releves))
        for l in liste
        if l["mesure"] is None
    ]
    contenu = {
        "_lisezmoi": [
            "Genere par scripts/lister-chronometrage.py, comme",
            "docs/chronometrage-animations.md. Ne pas editer a la main.",
            "Les mesures se saisissent dans data/animations-mesurees.json.",
        ],
        "total": len(toutes),
        "mesurees": faites,
        "debloquent": len(debloquent),
        "affinent": len(affinent),
        "releves": len(releves),
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
            if os.path.exists(chemin):
                with open(chemin, encoding="utf-8") as fichier:
                    actuel = fichier.read()
            else:
                actuel = ""
            if actuel != attendu:
                print(os.path.relpath(chemin, RACINE).replace(os.sep, "/")
                      + " n'est plus a jour : "
                      "relancer python scripts/lister-chronometrage.py")
                sys.exit(1)
        print("chronometrage : liste a jour")
    else:
        for chemin, contenu in sorties:
            with open(chemin, "w", encoding="utf-8", newline="\n") as fichier:
                fichier.write(contenu)
            print("ecrit " + os.path.relpath(chemin, RACINE).replace(os.sep, "/"))
