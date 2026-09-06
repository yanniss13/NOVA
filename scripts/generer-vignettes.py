"""Fabrique les vignettes PNG que la carte Discord /build affiche.

POURQUOI DES PNG ALORS QUE LE SITE EST EN WEBP. La carte est dessinee dans
une Edge Function Deno, qui ne sait decoder aucun webp — ni VP8, ni VP8L.
Elle sait en revanche inflater un flux deflate, donc lire un PNG. Les images
du jeu sont donc converties une fois, a la taille ou la carte les affiche.

POURQUOI ELLES NE SONT PAS DANS LE DEPOT. Le dossier complet pese environ
2,4 Mo, soit un second exemplaire de chaque image du site. Le workflow Pages
construit `_site` a partir du depot : cette conversion s'y greffe, et les
vignettes sont publiees sans jamais etre versionnees.

Usage :
    python scripts/generer-vignettes.py                 -> ./7ds-vignettes
    python scripts/generer-vignettes.py --sortie _site  -> _site/7ds-vignettes
    python scripts/generer-vignettes.py --verifier      -> controle sans ecrire
"""

import argparse
import json
import os
import sys

from PIL import Image

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOSSIER = "7ds-vignettes"
# EXACTEMENT la taille a laquelle la carte les dessine. Le rendu recopie les
# pixels un pour un : toute autre taille l obligerait a reechantillonner au
# plus proche voisin, qui crenelerait les icones. Ces deux nombres doivent
# rester d accord avec ICONE et PORTRAIT de _shared/discord-build-png.js.
TAILLE_OBJET = 72
TAILLE_PORTRAIT = 144


def lire_data():
    """Le catalogue du site est un script de navigateur : on en extrait l'objet."""
    chemin = os.path.join(RACINE, "data", "data.js")
    with open(chemin, encoding="utf-8") as fichier:
        source = fichier.read()
    source = source[source.index("{"):].rstrip().rstrip(";")
    return json.loads(source)


def images_a_convertir(data):
    """Rend (chemin relatif, taille) pour chaque image que la carte peut afficher."""
    entrees = []
    for personnage in data.get("personnages", []):
        if personnage.get("file"):
            entrees.append((personnage["file"], TAILLE_PORTRAIT))
    for categorie in ("armes", "armures", "bijoux"):
        for liste in data.get(categorie, {}).values():
            for objet in liste:
                if objet.get("file"):
                    entrees.append((objet["file"], TAILLE_OBJET))
    return entrees


def chemin_vignette(base, relatif):
    return os.path.join(base, DOSSIER, *relatif.split("/")).rsplit(".", 1)[0] + ".png"


def convertir(entrees, base, verifier):
    ecrites = 0
    manquantes = []
    for relatif, taille in entrees:
        source = os.path.join(RACINE, *relatif.split("/"))
        if not os.path.exists(source):
            manquantes.append(relatif)
            continue
        cible = chemin_vignette(base, relatif)
        if verifier:
            if not os.path.exists(cible):
                manquantes.append(relatif)
            continue
        os.makedirs(os.path.dirname(cible), exist_ok=True)
        with Image.open(source) as image:
            vignette = image.convert("RGBA").resize(
                (taille, taille), Image.LANCZOS
            )
            # RGBA 8 bits, sans entrelacement : c'est exactement ce que le
            # decodeur de l'Edge Function sait lire, et rien de plus.
            vignette.save(cible, format="PNG", optimize=True)
        ecrites += 1
    return ecrites, manquantes


def principal(argv=None):
    analyse = argparse.ArgumentParser(description=__doc__)
    analyse.add_argument("--sortie", default=RACINE,
                         help="repertoire qui recevra 7ds-vignettes/")
    analyse.add_argument("--verifier", action="store_true",
                         help="controle la presence des vignettes sans rien ecrire")
    options = analyse.parse_args(argv)

    base = os.path.abspath(options.sortie)
    entrees = images_a_convertir(lire_data())
    ecrites, manquantes = convertir(entrees, base, options.verifier)

    if manquantes:
        print("Images manquantes : %d" % len(manquantes), file=sys.stderr)
        for relatif in manquantes[:10]:
            print("  " + relatif, file=sys.stderr)
        return 1
    if options.verifier:
        print("%d vignettes presentes dans %s." % (len(entrees), base))
        return 0
    poids = sum(
        os.path.getsize(chemin_vignette(base, relatif))
        for relatif, _ in entrees
    )
    print("%d vignettes ecrites dans %s (%.1f Mo)."
          % (ecrites, os.path.join(base, DOSSIER), poids / 1024 / 1024))
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
