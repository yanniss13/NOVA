"""Rapatrie les mesures envoyees par les membres dans animations-mesurees.json.

Supabase est une boite de reception, pas la source de verite : ce script
montre ce qui est arrive, signale les desaccords, et n'ecrit que ce qu'un
humain a valide. Les chiffres qu'il produit determinent tout le calcul de DPS
de la confrerie — une valeur fausse qui passe inapercue vaut moins que pas de
valeur du tout.

Une mesure vaut pour UN gameId : un heros, une arme, un emplacement. Un heros
n'a pas le meme moveset selon l'arme equipee — Meliodas a la hache et Meliodas
a l'epee longue sont deux animations distinctes, avec des degats differents.

La table est en ajout seul, par choix : une mesure envoyee est un fait date,
pas un brouillon. C'est donc ICI que se fait l'arbitrage. Les envois sont
regroupes par animation, un seul par auteur — le plus recent, puisqu'un membre
qui reenvoie corrige sa mesure au lieu de voter deux fois — et le script
propose leur MEDIANE. Une question par animation, pas une par ligne recue.

    python scripts/rapatrier-mesures.py
"""

import getpass
import importlib.util
import json
import math
import os
import sys
import tempfile
import urllib.error
import urllib.request

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MESURES = os.path.join(RACINE, "data", "animations-mesurees.json")
CONFIG = os.path.join(RACINE, "supabase-config.js")

ECART_TOLERE = 0.10
MESURE_MAX = 30.0


def ecart_significatif(ecart):
    """Vrai uniquement au-dela du seuil, sans faux positif d'arrondi."""
    return ecart > ECART_TOLERE and not math.isclose(
        ecart, ECART_TOLERE, rel_tol=1e-12, abs_tol=1e-12
    )


def normaliser_mesure(valeur):
    """Convertit une saisie en secondes, ou refuse une valeur non plausible."""
    try:
        texte = valeur.replace(",", ".") if isinstance(valeur, str) else valeur
        secondes = float(texte)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(secondes) or secondes <= 0 or secondes > MESURE_MAX:
        return None
    return secondes


def protocole_mesure_valide(envoi):
    mode = envoi.get("mode")
    reps = envoi.get("reps")
    fps = envoi.get("fps")
    if mode == "unique":
        if reps is not None:
            return False
    elif mode == "rafale":
        if isinstance(reps, bool) or not isinstance(reps, int) or reps < 2:
            return False
    else:
        return False
    if fps is None:
        return True
    try:
        fps = float(fps)
    except (TypeError, ValueError):
        return False
    return math.isfinite(fps) and 10 <= fps <= 240


def trier_envois(envois, game_ids_connus):
    """Separe les lignes exploitables des identifiants et valeurs a verifier."""
    valides, inconnus, invalides = [], [], []
    # Choisir d'abord la correction courante de chaque auteur. Filtrer avant
    # ferait ressurgir son ancienne valeur lorsqu'un nouvel envoi est invalide.
    courants = [
        envoi
        for liste in grouper(envois).values()
        for envoi in liste
    ]
    for envoi in courants:
        if envoi.get("game_id") not in game_ids_connus:
            inconnus.append(envoi)
        elif (normaliser_mesure(envoi.get("seconds")) is None
              or not protocole_mesure_valide(envoi)):
            invalides.append(envoi)
        else:
            valides.append(envoi)
    return valides, inconnus, invalides


def detail_envoi(envoi):
    # La valeur seule ne permet pas de verifier comment elle a ete relevee.
    protocole = [str(envoi.get("mode") or "mode inconnu")]
    if envoi.get("reps") is not None:
        protocole.append("%s repetitions" % envoi["reps"])
    if envoi.get("fps") is not None:
        protocole.append("%s fps" % envoi["fps"])
    else:
        protocole.append("fps inconnu")
    return "%s %s s (%s)" % (
        envoi.get("pseudo") or "?", envoi.get("seconds"), ", ".join(protocole)
    )


def _generateur():
    """Le generateur porte deja les libelles francais d'armes et de categories,
    et sait lire le wiki. Les redupliquer ici les ferait diverger un jour."""
    chemin = os.path.join(RACINE, "scripts", "lister-chronometrage.py")
    spec = importlib.util.spec_from_file_location("lister_chronometrage", chemin)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def libelles():
    """gameId -> « heros, arme, nom de la competence », en francais.

    Un identifiant comme bug_sworddual_jumpatk ne dit rien a personne. Ce qui
    permet de trancher, c'est le nom que le membre a vu dans l'outil.
    """
    generateur = _generateur()
    noms = generateur.noms_francais()
    table = {}
    for heros, skill in generateur.competences():
        game_id = skill.get("gameId")
        if not game_id:
            continue
        arme = generateur.LIBELLES_ARMES.get(
            skill.get("weaponType"), skill.get("weaponType") or "?"
        )
        nom = noms.get(game_id) or skill.get("nom") or game_id
        table[game_id] = "%s, %s — %s" % (heros, arme, nom)
    return table


def decrire(table, game_id):
    return table.get(game_id, game_id)


def _horodatage(envoi):
    """La date d'un envoi, comparable telle quelle : Supabase rend de l'ISO
    8601, dont l'ordre lexicographique est l'ordre chronologique."""
    return str(envoi.get("created_at") or "")


def _ordre_envoi(envoi):
    return _horodatage(envoi), str(envoi.get("id") or "")


def grouper(envois):
    """Les envois rassembles par animation, un seul par auteur.

    La table est volontairement en ajout seul et peut donc porter plusieurs
    lignes du meme membre. Le plus recent gagne : un membre qui reenvoie
    corrige sa mesure, il ne vote pas deux fois."""
    par_animation = {}
    for envoi in envois:
        auteurs = par_animation.setdefault(envoi["game_id"], {})
        cle = envoi.get("owner") or envoi.get("pseudo") or id(envoi)
        # Comparer les dates plutot que se fier a l'ordre d'arrivee. La requete
        # trie deja par created_at, mais une fonction qui ne tient que sous
        # cette condition finit par etre appelee autrement, et elle retiendrait
        # alors la mesure corrigee AVANT la correction.
        connu = auteurs.get(cle)
        if connu is None or _ordre_envoi(envoi) >= _ordre_envoi(connu):
            auteurs[cle] = envoi
    return {
        game_id: sorted(auteurs.values(), key=_ordre_envoi)
        for game_id, auteurs in par_animation.items()
    }


def mediane(valeurs):
    tries = sorted(valeurs)
    milieu = len(tries) // 2
    if len(tries) % 2:
        return tries[milieu]
    return (tries[milieu - 1] + tries[milieu]) / 2


def consensus(liste):
    """Ce que N auteurs disent d'une meme animation, et s'ils s'accordent.

    La mediane, pas la moyenne : un membre qui se trompe d'un facteur deux
    deplacerait une moyenne, il ne deplace pas une mediane des que deux autres
    l'encadrent. L'ecart est relatif au plus petit releve, comme le seuil de
    dix pour cent qu'il sert a comparer."""
    valeurs = [float(envoi["seconds"]) for envoi in liste]
    minimum = min(valeurs)
    return {
        "valeur": round(mediane(valeurs), 3),
        "auteurs": len(valeurs),
        "valeurs": sorted(valeurs),
        "ecart": (max(valeurs) - minimum) / minimum if minimum else 0.0,
    }


def desaccords(envois):
    signales = []
    for game_id, liste in grouper(envois).items():
        if len(liste) < 2:
            continue
        if ecart_significatif(consensus(liste)["ecart"]):
            signales.append((game_id, liste))
    return signales


def dementis(envois, mesures):
    """Les animations DEJA ecrites que les envois recents contredisent.

    Sans ce controle, une mesure fausse validee une fois est definitive : le
    script ne repropose jamais une animation deja renseignee, et les envois qui
    la contredisent disparaissent en silence."""
    ecrites = (mesures or {}).get("animations") or {}
    signales = []
    for game_id, liste in grouper(envois).items():
        if game_id not in ecrites:
            continue
        ecrite = float(ecrites[game_id])
        accord = consensus(liste)
        if not ecrite:
            continue
        if ecart_significatif(abs(accord["valeur"] - ecrite) / ecrite):
            signales.append((game_id, ecrite, accord))
    return signales


def appliquer(mesures, game_id, secondes):
    mesures["animations"][game_id] = secondes
    return mesures


def ecrire_mesures_atomiquement(chemin, mesures):
    """N'expose jamais un JSON partiellement ecrit en cas d'interruption."""
    chemin = os.fspath(chemin)
    dossier = os.path.dirname(os.path.abspath(chemin))
    temporaire = None
    try:
        with tempfile.NamedTemporaryFile(
            "w", encoding="utf-8", newline="\n", dir=dossier,
            prefix=".animations-mesurees-", suffix=".tmp", delete=False,
        ) as fichier:
            temporaire = fichier.name
            json.dump(
                mesures, fichier, ensure_ascii=False, indent=2, allow_nan=False
            )
            fichier.write("\n")
            fichier.flush()
            os.fsync(fichier.fileno())
        os.replace(temporaire, chemin)
        temporaire = None
    finally:
        if temporaire and os.path.exists(temporaire):
            os.remove(temporaire)


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


def _envois(taille_page=500):
    config = _config()
    jeton = _jeton(config)
    url = (config["SB_URL"]
           + "/rest/v1/animation_measures?select=*&order=created_at.asc,id.asc")
    envois = []
    debut = 0
    while True:
        requete = urllib.request.Request(url, headers={
            "apikey": config["SB_KEY"],
            "Authorization": "Bearer " + jeton,
            "Range-Unit": "items",
            "Range": "%d-%d" % (debut, debut + taille_page - 1),
        })
        with urllib.request.urlopen(requete, timeout=30) as reponse:
            page = json.loads(reponse.read().decode("utf-8"))
        if not page:
            return envois
        envois.extend(page)
        # Avancer du nombre effectivement rendu reste correct meme si le
        # plafond PostgREST est plus petit que la taille demandee.
        debut += len(page)


def main():
    with open(MESURES, encoding="utf-8") as fichier:
        mesures = json.load(fichier)

    noms = libelles()
    envois, inconnus, invalides = trier_envois(_envois(), set(noms))

    for envoi in inconnus:
        print("IGNORE : identifiant inconnu %s." % (envoi.get("game_id") or "?"))
    for envoi in invalides:
        print("IGNORE : mesure invalide pour %s (%r s)." % (
            decrire(noms, envoi.get("game_id")), envoi.get("seconds")
        ))
    if inconnus or invalides:
        print()

    for game_id, liste in desaccords(envois):
        print("DESACCORD sur %s :" % decrire(noms, game_id))
        for envoi in liste:
            print("   " + detail_envoi(envoi))
        print("   -> tranche a la main, ce script ne choisira pas pour toi.")
        print()

    for game_id, ecrite, accord in dementis(envois, mesures):
        print("DEMENTI sur %s :" % decrire(noms, game_id))
        print("   deja ecrit %s s, %d envoi(s) donnent %s s" % (
            ecrite, accord["auteurs"], accord["valeur"]))
        print("   -> corrige data/animations-mesurees.json a la main si besoin.")
        print()

    nouvelles = {
        game_id: liste
        for game_id, liste in grouper(envois).items()
        if game_id not in mesures["animations"]
    }
    if not nouvelles:
        print("Rien de nouveau.")
        return 0

    # Une question par ANIMATION, non par ligne recue : avec cinq membres qui
    # chronometrent la meme competence, l'ancienne boucle posait cinq fois la
    # meme question et n'en gardait qu'une reponse au hasard.
    retenus = 0
    for game_id, liste in nouvelles.items():
        accord = consensus(liste)
        detail = ", ".join(detail_envoi(envoi) for envoi in liste)
        alerte = "   ATTENTION : %.0f %% d'ecart entre les envois.%s" % (
            accord["ecart"] * 100, chr(10)
        ) if ecart_significatif(accord["ecart"]) else ""
        question = "%s%s   %d envoi(s) : %s%s   mediane %s s -> ecrire ? [o/N/valeur] " % (
            decrire(noms, game_id), chr(10),
            accord["auteurs"], detail, chr(10) + alerte,
            accord["valeur"])
        reponse = input(question).strip().lower()
        if reponse == "o":
            appliquer(mesures, game_id, accord["valeur"])
            retenus += 1
            continue
        # Une valeur tapee remplace la mediane : c'est l'humain qui tranche,
        # et il peut avoir mesure lui-meme apres avoir vu le desaccord.
        saisie = normaliser_mesure(reponse)
        if saisie is not None:
            appliquer(mesures, game_id, saisie)
            retenus += 1

    # N'ecrire que si quelque chose a ete accepte. Reecrire un fichier
    # inchange en annoncant « Ecrit » fait douter de ce que le script a
    # vraiment fait, et c'est la derniere chose qu'on veut d'un outil qui
    # touche a des mesures saisies a la main.
    print()
    if not retenus:
        print("Rien de retenu, le fichier n'a pas ete touche.")
        return 0

    ecrire_mesures_atomiquement(MESURES, mesures)
    print("%d mesure(s) ecrite(s). Relance maintenant :" % retenus)
    print("    python scripts/lister-chronometrage.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
