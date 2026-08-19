"""Rapatrie les mesures envoyees par les membres dans animations-mesurees.json.

Supabase est une boite de reception, pas la source de verite : ce script
montre ce qui est arrive, signale les desaccords, et n'ecrit que ce qu'un
humain a valide. Les chiffres qu'il produit determinent tout le calcul de DPS
de la confrerie — une valeur fausse qui passe inapercue vaut moins que pas de
valeur du tout.

Une mesure vaut pour UN gameId : un heros, une arme, un emplacement. Un heros
n'a pas le meme moveset selon l'arme equipee — Meliodas a la hache et Meliodas
a l'epee longue sont deux animations distinctes, avec des degats differents.

    python scripts/rapatrier-mesures.py
"""

import getpass
import json
import os
import sys
import urllib.error
import urllib.request

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MESURES = os.path.join(RACINE, "data", "animations-mesurees.json")
CONFIG = os.path.join(RACINE, "supabase-config.js")

ECART_TOLERE = 0.10


def desaccords(envois):
    par_animation = {}
    for envoi in envois:
        par_animation.setdefault(envoi["game_id"], []).append(envoi)
    signales = []
    for game_id, liste in par_animation.items():
        valeurs = [float(envoi["seconds"]) for envoi in liste]
        if len(valeurs) < 2:
            continue
        if (max(valeurs) - min(valeurs)) / min(valeurs) > ECART_TOLERE:
            signales.append((game_id, liste))
    return signales


def appliquer(mesures, game_id, secondes):
    mesures["animations"][game_id] = secondes
    return mesures


def _config():
    with open(CONFIG, encoding="utf-8") as fichier:
        source = fichier.read()
    valeurs = {}
    for cle in ("SB_URL", "SB_KEY"):
        valeurs[cle] = source[source.index(cle) + len(cle):].split('"')[1]
    return valeurs


def _jeton(config):
    """Ouvre une session Supabase et rend son jeton d'acces.

    La table n'est lisible que par un membre connecte, comme le reste du site.
    Le script s'authentifie donc au lieu d'ouvrir la lecture a tout le monde :
    ces envois portent des pseudos et des identifiants de comptes, et toutes
    les autres tables les protegent deja.

    Les identifiants se donnent au clavier, ou par les variables
    CONFRERIE_EMAIL et CONFRERIE_MOTDEPASSE pour un usage automatise. Rien
    n'est ecrit sur le disque.
    """
    email = os.environ.get("CONFRERIE_EMAIL") or input("Email du compte : ")
    motdepasse = (os.environ.get("CONFRERIE_MOTDEPASSE")
                  or getpass.getpass("Mot de passe : "))
    corps = json.dumps({"email": email, "password": motdepasse}).encode("utf-8")
    requete = urllib.request.Request(
        config["SB_URL"] + "/auth/v1/token?grant_type=password",
        data=corps,
        headers={"apikey": config["SB_KEY"], "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(requete, timeout=30) as reponse:
            return json.loads(reponse.read().decode("utf-8"))["access_token"]
    except urllib.error.HTTPError as erreur:
        if erreur.code in (400, 401):
            raise SystemExit("Connexion refusee : email ou mot de passe incorrect.")
        raise


def _envois():
    config = _config()
    jeton = _jeton(config)
    url = config["SB_URL"] + "/rest/v1/animation_measures?select=*&order=created_at"
    requete = urllib.request.Request(url, headers={
        "apikey": config["SB_KEY"],
        "Authorization": "Bearer " + jeton,
    })
    with urllib.request.urlopen(requete, timeout=30) as reponse:
        return json.loads(reponse.read().decode("utf-8"))


def main():
    with open(MESURES, encoding="utf-8") as fichier:
        mesures = json.load(fichier)

    envois = _envois()

    for game_id, liste in desaccords(envois):
        print("DESACCORD sur %s :" % game_id)
        for envoi in liste:
            print("   %-12s %s s (%s)" % (
                envoi.get("pseudo") or "?", envoi["seconds"], envoi["mode"]))
        print("   -> tranche a la main, ce script ne choisira pas pour toi.")
        print()

    nouveaux = [e for e in envois if e["game_id"] not in mesures["animations"]]
    if not nouveaux:
        print("Rien de nouveau.")
        return 0

    for envoi in nouveaux:
        reponse = input("%s = %s s (%s) -> ecrire ? [o/N] " % (
            envoi["game_id"], envoi["seconds"], envoi.get("pseudo") or "?"))
        if reponse.strip().lower() == "o":
            appliquer(mesures, envoi["game_id"], float(envoi["seconds"]))

    with open(MESURES, "w", encoding="utf-8") as fichier:
        json.dump(mesures, fichier, ensure_ascii=False, indent=2)
        fichier.write("\n")
    print()
    print("Ecrit. Relance maintenant : python scripts/lister-chronometrage.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
