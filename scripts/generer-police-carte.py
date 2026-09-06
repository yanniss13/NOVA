"""Fabrique l'atlas de polices de la carte Discord /build.

POURQUOI UN ATLAS, ET POURQUOI UN SECOND. Une Edge Function Deno ne sait pas
rasteriser une police : elle n'a ni Canvas ni FreeType. Le rendu pose donc des
pixels deja calcules, ranges cote a cote dans une bande — un atlas.

Celui de `/planning` (availability-font.js) ne connait que
« ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-/:.()|=? » : ni minuscules, ni accents.
Toutes les cartes sortaient donc en capitales, « Degats crit. » au lieu de
« Dégâts crit. ». Cet atlas-ci est SEPARE, et non un remplacement : `/planning`
garde le sien, et une refonte de la carte ne peut pas abimer le planning.

Les polices sources vivent dans `polices/`, sous licence ouverte, versionnees
avec le depot : sans elles l'atlas n'est pas reproductible, et personne ne
pourrait le regenerer apres une evolution du jeu.

Usage :
    python scripts/generer-police-carte.py
    python scripts/generer-police-carte.py --verifier
"""

import argparse
import base64
import json
import os
import sys
import zlib

from PIL import Image, ImageDraw, ImageFont

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POLICES = os.path.join(RACINE, "polices")
SORTIE = os.path.join(
    RACINE, "supabase", "functions", "_shared", "carte-font.js"
)

# Le jeu de caracteres. Les 70 premiers sont ceux que les noms d'objets, les
# libelles de statistiques et les elements emploient reellement ; le reste
# couvre les pseudos, les nombres et la ponctuation courante. Un caractere
# absent d'ici est traduit ou remplace par une espace au rendu, jamais dessine
# de travers.
CARACTERES = (
    " ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "abcdefghijklmnopqrstuvwxyz"
    "0123456789"
    "ÀÂÄÇÈÉÊËÎÏÔÖÙÛÜŸŒÆ"
    "àâäçèéêëîïôöùûüÿœæ"
    "!\"'()+,-./:;?%&«»×·…—"
)

# Quatre roles, deux familles. Cinzel est une capitale d'inscription : elle
# porte les titres, ou ses petites capitales sont un choix et non un defaut.
# EB Garamond, une garalde a vraies minuscules accentuees, porte tout le reste.
# Les deux sont des polices VARIABLES : la graisse se demande sur l'axe Weight
# plutot qu'en telechargeant un fichier par graisse.
FACES = [
    ("titre", "cinzel.ttf", 56, 700),
    ("section", "cinzel.ttf", 28, 600),
    ("corps", "ebgaramond.ttf", 26, 500),
    ("petit", "ebgaramond.ttf", 21, 500),
]


def chemin_police(fichier):
    chemin = os.path.join(POLICES, fichier)
    if not os.path.exists(chemin):
        raise SystemExit(
            "Police absente : " + chemin + "\n"
            "Depose les fichiers .ttf dans polices/ (voir polices/LISEZMOI.md)."
        )
    return chemin


def construire_face(chemin, taille, graisse):
    """Rasterise chaque caractere dans une cellule de largeur fixe.

    La cellule est aussi large que le plus large glyphe, et l'`inset` decale le
    dessin vers la gauche pour que les jambages qui depassent a gauche (le « j »
    par exemple) ne soient pas coupes. `advances` porte, lui, la vraie avance de
    plume : c'est elle qui espace les lettres, pas la largeur de cellule.
    """
    police = ImageFont.truetype(chemin, taille)
    # Les deux familles sont variables : sans ce reglage, tout sortirait
    # au poids par defaut, et les titres n'auraient aucune presence.
    police.set_variation_by_axes([graisse])
    boites = {c: police.getbbox(c) for c in CARACTERES}
    inset = max(0, -min(boite[0] for boite in boites.values()))
    largeur = max(boite[2] for boite in boites.values()) + inset + 2
    hauteur = max(boite[3] for boite in boites.values()) + 2
    image = Image.new("L", (largeur * len(CARACTERES), hauteur), 0)
    dessin = ImageDraw.Draw(image)
    avances = []
    for index, caractere in enumerate(CARACTERES):
        dessin.text((index * largeur + inset, 0), caractere,
                    font=police, fill=255)
        avances.append(int(round(police.getlength(caractere))))
    return {
        "cellWidth": largeur,
        "cellHeight": hauteur,
        "inset": inset,
        "advances": avances,
        # zlib, et non deflate brut : c'est ce que `DecompressionStream`
        # attend cote Deno, et ce que lit deja l'atlas du planning.
        "data": base64.b64encode(zlib.compress(image.tobytes(), 9)).decode(),
    }


def texte_de_sortie():
    atlas = {"characters": CARACTERES}
    for nom, fichier, taille, graisse in FACES:
        atlas[nom] = construire_face(
            chemin_police(fichier), taille, graisse)
    corps = json.dumps(atlas, ensure_ascii=False, indent=1)
    return (
        '"use strict";\n\n'
        "/* Genere par scripts/generer-police-carte.py. Ne pas editer a la main.\n"
        "   Les glyphes de la carte Discord /build, minuscules et accents\n"
        "   compris. L'atlas du planning reste separe. */\n"
        "const carteFontApi = " + corps + ";\n\n"
        'if(typeof module !== "undefined" && module.exports){\n'
        "  module.exports = carteFontApi;\n"
        "}\n"
        "globalThis.NOVA_CARTE_FONT = carteFontApi;\n"
    )


def principal(argv=None):
    analyse = argparse.ArgumentParser(description=__doc__)
    analyse.add_argument("--verifier", action="store_true",
                         help="echoue si l'atlas publie est perime")
    options = analyse.parse_args(argv)

    attendu = texte_de_sortie()
    if options.verifier:
        actuel = ""
        if os.path.exists(SORTIE):
            with open(SORTIE, encoding="utf-8") as fichier:
                actuel = fichier.read()
        # Les fins de ligne ne comptent pas : le depot est en CRLF sous Windows
        # et en LF sur le runner Linux.
        if actuel.replace("\r\n", "\n") != attendu.replace("\r\n", "\n"):
            print("carte-font.js est perime : relance"
                  " `python scripts/generer-police-carte.py`.", file=sys.stderr)
            return 1
        print("carte-font.js est a jour.")
        return 0

    with open(SORTIE, "w", encoding="utf-8", newline="\n") as fichier:
        fichier.write(attendu)
    poids = os.path.getsize(SORTIE) / 1024
    print("carte-font.js ecrit : %d caracteres, %d faces, %.1f Ko."
          % (len(CARACTERES), len(FACES), poids))
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
