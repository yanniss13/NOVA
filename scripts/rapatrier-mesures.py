"""Rapatrie les mesures envoyees par les membres dans animations-mesurees.json.

Supabase est une boite de reception, pas la source de verite : ce script
montre ce qui est arrive, signale les desaccords, et n'ecrit que ce qu'un
humain a valide. Les chiffres qu'il produit determinent tout le calcul de DPS
de la confrerie — une valeur fausse qui passe inapercue vaut moins que pas de
valeur du tout.

Une mesure vaut pour un couple heros x emplacement, donc pour toutes les armes
du meme heros : le moveset appartient au heros, pas a l'arme equipee. Le
fichier reste indexe par gameId, ce qui laisse la possibilite d'ecraser une
seule ligne le jour ou une arme s'avererait faire exception.

    python scripts/rapatrier-mesures.py
"""

import json
import os
import sys
import urllib.request

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATALOGUE = os.path.join(RACINE, "data", "competences.js")
MESURES = os.path.join(RACINE, "data", "animations-mesurees.json")
CONFIG = os.path.join(RACINE, "supabase-config.js")

DEBUTS_DE_SLOT = ("jumpatk", "normalatk", "skill_")
ECART_TOLERE = 0.10


def slot_de_game_id(game_id):
    texte = str(game_id or "")
    positions = [texte.find(debut) for debut in DEBUTS_DE_SLOT]
    positions = [position for position in positions if position >= 0]
    return texte[min(positions):] if positions else texte


def game_ids_du_couple(catalogue, heros, slot):
    return [
        skill["gameId"]
        for skill in catalogue.get(heros, [])
        if skill.get("gameId") and slot_de_game_id(skill["gameId"]) == slot
    ]


def desaccords(envois):
    par_couple = {}
    for envoi in envois:
        par_couple.setdefault((envoi["hero"], envoi["slot"]), []).append(envoi)
    signales = []
    for couple, liste in par_couple.items():
        valeurs = [float(envoi["seconds"]) for envoi in liste]
        if len(valeurs) < 2:
            continue
        if (max(valeurs) - min(valeurs)) / min(valeurs) > ECART_TOLERE:
            signales.append((couple, liste))
    return signales


def appliquer(mesures, catalogue, heros, slot, secondes):
    for game_id in game_ids_du_couple(catalogue, heros, slot):
        mesures["animations"][game_id] = secondes
    return mesures


def _charge_js(chemin):
    with open(chemin, encoding="utf-8") as fichier:
        source = fichier.read()
    return json.loads(source[source.index("{"):].rstrip().rstrip(";"))


def _config():
    with open(CONFIG, encoding="utf-8") as fichier:
        source = fichier.read()
    valeurs = {}
    for cle in ("SB_URL", "SB_KEY"):
        valeurs[cle] = source[source.index(cle) + len(cle):].split('"')[1]
    return valeurs


def _envois():
    config = _config()
    url = config["SB_URL"] + "/rest/v1/animation_measures?select=*&order=created_at"
    requete = urllib.request.Request(url, headers={
        "apikey": config["SB_KEY"],
        "Authorization": "Bearer " + config["SB_KEY"],
    })
    with urllib.request.urlopen(requete, timeout=30) as reponse:
        return json.loads(reponse.read().decode("utf-8"))


def main():
    catalogue = _charge_js(CATALOGUE)
    with open(MESURES, encoding="utf-8") as fichier:
        mesures = json.load(fichier)

    envois = _envois()

    for couple, liste in desaccords(envois):
        print("DESACCORD sur %s / %s :" % couple)
        for envoi in liste:
            print("   %-12s %s s (%s)" % (
                envoi.get("pseudo") or "?", envoi["seconds"], envoi["mode"]))
        print("   -> tranche a la main, ce script ne choisira pas pour toi.\n")

    deja = set(mesures["animations"])
    nouveaux = [
        envoi for envoi in envois
        if not set(game_ids_du_couple(catalogue, envoi["hero"], envoi["slot"])) & deja
    ]
    if not nouveaux:
        print("Rien de nouveau.")
        return 0

    for envoi in nouveaux:
        cibles = game_ids_du_couple(catalogue, envoi["hero"], envoi["slot"])
        reponse = input("%s / %s = %s s (%s) -> ecrire sur %d gameId ? [o/N] " % (
            envoi["hero"], envoi["slot"], envoi["seconds"],
            envoi.get("pseudo") or "?", len(cibles)))
        if reponse.strip().lower() == "o":
            appliquer(mesures, catalogue, envoi["hero"], envoi["slot"],
                      float(envoi["seconds"]))

    with open(MESURES, "w", encoding="utf-8") as fichier:
        json.dump(mesures, fichier, ensure_ascii=False, indent=2)
        fichier.write("\n")
    print("\nEcrit. Relance maintenant : python scripts/lister-chronometrage.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
