# =============================================================================
#  telecharger-images.py
#  Complete les dossiers d'images locaux avec ce que le jeu a publie depuis la
#  derniere fois. Ne telecharge que ce qui manque et ne remplace jamais un
#  fichier existant : les assets deja presents restent ceux fournis a l'origine.
#
#  Usage :   python scripts/telecharger-images.py [--liste]
#            --liste  n'ecrit rien, annonce seulement ce qui manque.
#
#  Puis relancer generate-data.ps1 pour que data.js voie les nouveaux fichiers.
#
#  Les URL sont celles dont proviennent les images deja commitees, verifiees
#  octet pour octet :
#    armes   ->  /images/weapons/<gameId>.webp   (iconUrl publie par /fr/armes)
#    bijoux  ->  /images/items/<gameId>.webp     (grade5 seulement)
#  Le nom de fichier est le `displayName` FR, comme pour l'existant.
# =============================================================================
import argparse
import importlib.util
import os
import sys
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")
RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Le nom du fichier contient un tiret : import par chemin, pas par `import`.
_spec = importlib.util.spec_from_file_location(
    "generate_stats", os.path.join(RACINE, "scripts", "generate-stats.py")
)
_gen = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_gen)

BASE = "https://7dsorigin.app"
PAGE_ARMES = BASE + "/fr/armes"
PAGE_BIJOUX = BASE + "/fr/bijoux"

# enum weaponType du site -> dossier local
DOSSIER_ARME = {
    "Axe": "Hache", "Book": "Livre", "SwordDual": "Epees doubles",
    "Rapier": "Rapiere", "Shield": "Bouclier", "Lance": "Lance",
    "Sword1h": "Epee 1 main", "Cudgel3c": "Nunchaku", "Gauntlets": "Gantelets",
    "Sword2h": "Epee 2 mains", "Staff": "Baton", "Wand": "Baguette",
}
DOSSIER_BIJOU = {"Ring": "Anneau", "Necklace": "Collier",
                 "Earring": "Boucle d'oreille"}
# Le seul grade que le depot embarque, comme les badges « SSR » du site.
GRADE_BIJOU = "grade5"


def telecharge(url):
    requete = urllib.request.Request(url, headers=_gen.HEADERS)
    with urllib.request.urlopen(requete, timeout=60) as reponse:
        return reponse.read()


def attendus():
    """(dossier, nom de fichier, url) de toutes les images que le site publie."""
    armes = _gen.collect(_gen.flight_payload(_gen.fetch(PAGE_ARMES)), "items")
    if not armes:
        armes = _gen.collect(_gen.flight_payload(_gen.fetch(PAGE_ARMES)), "weapons")
    for arme in armes:
        dossier = DOSSIER_ARME.get(arme.get("weaponType"))
        icone = arme.get("iconUrl")
        if not (dossier and icone and arme.get("displayName")):
            continue
        yield (os.path.join("7ds-armes", dossier), arme["displayName"], BASE + icone)

    bijoux = _gen.collect(_gen.flight_payload(_gen.fetch(PAGE_BIJOUX)), "items")
    for bijou in bijoux:
        dossier = DOSSIER_BIJOU.get(bijou.get("slot"))
        if not (dossier and bijou.get("grade") == GRADE_BIJOU and bijou.get("gameId")):
            continue
        yield (os.path.join("7ds-bijoux", dossier), bijou["displayName"],
               "%s/images/items/%s.webp" % (BASE, bijou["gameId"]))


def main():
    parseur = argparse.ArgumentParser()
    parseur.add_argument("--liste", action="store_true")
    options = parseur.parse_args()

    presents, manquants = 0, []
    for dossier, nom, url in attendus():
        chemin = os.path.join(RACINE, dossier, nom + ".webp")
        if os.path.exists(chemin):
            presents += 1
        else:
            manquants.append((chemin, dossier, nom, url))

    print("%d images deja presentes, %d manquantes" % (presents, len(manquants)))
    for _chemin, dossier, nom, url in manquants:
        print("  %-28s %s" % (dossier, nom))
    if options.liste or not manquants:
        return

    for chemin, dossier, nom, url in manquants:
        octets = telecharge(url)
        # Un 404 renvoie une page HTML avec un code 200 sur certains hebergeurs :
        # on refuse tout ce qui n'est pas un WebP plutot que d'ecrire un leurre.
        if not (octets.startswith(b"RIFF") and octets[8:12] == b"WEBP"):
            raise SystemExit("pas un webp : %s" % url)
        os.makedirs(os.path.dirname(chemin), exist_ok=True)
        with open(chemin, "wb") as fichier:
            fichier.write(octets)
        print("OK %-28s %-46s %6d octets" % (dossier, nom, len(octets)))

    print()
    print("Relance maintenant scripts/generate-data.ps1.")


if __name__ == "__main__":
    main()
