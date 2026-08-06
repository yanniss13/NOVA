# =============================================================================
#  generate-wiki.py
#  Aspire les competences et les passifs des heros depuis les pages francaises
#  de 7dsorigin.app, et ecrit data/wiki-competences.js — le catalogue de
#  LECTURE du wiki.
#
#  A ne pas confondre avec data/competences.js (branche comparateur), qui est
#  un catalogue de CALCUL : noms anglais, pourcentages, passifs exclus. Ici on
#  garde le francais et surtout les passifs, et on ne chiffre rien.
#
#  Usage :   python scripts/generate-wiki.py           (connexion requise)
#            python scripts/generate-wiki.py --check   (verifie la presence)
#
#  Le catalogue est fige et commite : le site est une PWA et ne doit aucun
#  appel reseau au rendu. `--check` ne re-aspire pas, sous peine de rendre
#  `npm test` dependant d'un site tiers.
# =============================================================================
import argparse
import importlib.util
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
RACINE = Path(__file__).resolve().parent.parent

# Le nom du fichier contient un tiret : import par chemin, pas par `import`.
_spec = importlib.util.spec_from_file_location(
    "generate_stats", RACINE / "scripts" / "generate-stats.py"
)
_gen = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_gen)

FICHE = "https://7dsorigin.app/fr/characters/{slug}"
CIBLE = RACINE / "data" / "wiki-competences.js"
# En deca, la page a change de forme : mieux vaut echouer que publier un
# catalogue ampute.
HEROS_MINIMUM = 20


class CatalogueIncomplet(RuntimeError):
    pass


def nombre_ou_none(valeur):
    """Normalise une recharge. Une absence reste une absence, jamais un zero."""
    if isinstance(valeur, bool) or valeur is None:
        return None
    try:
        return float(str(valeur).replace(",", "."))
    except ValueError:
        return None


def _ouverture(texte, position):
    """Remonte a l'accolade qui ouvre l'objet contenant `position`."""
    profondeur = 0
    i = position
    while i >= 0:
        caractere = texte[i]
        if caractere == "}":
            profondeur += 1
        elif caractere == "{":
            if profondeur == 0:
                return i
            profondeur -= 1
        i -= 1
    return None


def _objets_portant(payload, cle):
    """Les objets JSON du payload qui portent `cle`, imbrications comprises.

    Une expression reguliere plate n'y suffirait pas : les competences portent
    des objets imbriques (buffs, degats par coup) qu'un motif sans accolades
    equilibrees tronquerait.
    """
    marque = '"%s"' % cle
    trouves = []
    position = payload.find(marque)
    while position != -1:
        debut = _ouverture(payload, position)
        if debut is not None:
            fin = _gen.balanced_end(payload, debut)
            if fin > debut:
                trouves.append(payload[debut:fin + 1])
        position = payload.find(marque, position + 1)
    return trouves


def competences_du_payload(payload):
    """Les competences d'un heros, dans l'ordre ou la source les publie."""
    retenues = []
    vus = set()
    for brut in _objets_portant(payload, "skillCategory"):
        try:
            skill = json.loads(brut)
        except ValueError:
            continue
        game_id = skill.get("gameId")
        if not game_id or not skill.get("weaponType") or game_id in vus:
            continue
        vus.add(game_id)
        retenues.append({
            "gameId": game_id,
            "weaponType": skill.get("weaponType"),
            "categorie": skill.get("skillCategory"),
            "nomFr": skill.get("nameFr") or "",
            "descriptionFr": skill.get("descriptionFr") or "",
            "recharge": nombre_ou_none(skill.get("cooldown")),
        })
    return retenues


def valide(slug, competences):
    """Leve `CatalogueIncomplet` plutot que de publier une fiche trouee."""
    if not competences:
        raise CatalogueIncomplet("%s : aucune competence extraite" % slug)
    for competence in competences:
        if not competence["nomFr"]:
            raise CatalogueIncomplet(
                "%s : nom francais absent (%s)" % (slug, competence["gameId"]))
        if not competence["descriptionFr"]:
            raise CatalogueIncomplet(
                "%s : description francaise absente (%s)"
                % (slug, competence["gameId"]))
    par_arme = {}
    for competence in competences:
        par_arme.setdefault(competence["weaponType"], []).append(competence)
    for arme, liste in sorted(par_arme.items()):
        if not any(c["categorie"] == "PASSIVE" for c in liste):
            raise CatalogueIncomplet("%s/%s : aucun passif" % (slug, arme))
    return None


def slugs():
    personnages = json.loads(
        (RACINE / "7ds-stats" / "personnages.json").read_text(encoding="utf-8"))
    return [p["slug"] for p in personnages if p.get("slug")]


def rendu(catalogue):
    corps = json.dumps(catalogue, ensure_ascii=False, indent=1, sort_keys=True)
    return (
        "// Genere par generate-wiki.py depuis les pages FR de 7dsorigin.app.\n"
        "// Catalogue de LECTURE du wiki : noms et descriptions francais,\n"
        "// PASSIFS INCLUS. Ne pas confondre avec data/competences.js, qui\n"
        "// est le catalogue de calcul du comparateur de degats.\n"
        "// Cle = slug personnage. recharge = secondes, ou null si la source\n"
        "// ne la publie pas. Le balisage [#RRGGBB]texte[-] est rendu par\n"
        "// renderBonus() ; il est conserve tel quel ici.\n"
        "window.SEVEN_DS_WIKI_COMPETENCES = " + corps + ";\n"
    )


def main():
    parseur = argparse.ArgumentParser()
    parseur.add_argument("--check", action="store_true")
    options = parseur.parse_args()

    if options.check:
        if not CIBLE.exists():
            raise SystemExit("wiki-competences.js doit etre genere")
        print("wiki-competences.js present")
        return

    catalogue = {}
    for slug in slugs():
        payload = _gen.flight_payload(_gen.fetch(FICHE.format(slug=slug)))
        competences = competences_du_payload(payload)
        valide(slug, competences)
        catalogue[slug] = competences
        print("%-16s %2d competences" % (slug, len(competences)))

    if len(catalogue) < HEROS_MINIMUM:
        raise SystemExit(
            "seulement %d heros extraits : la page a change de forme"
            % len(catalogue))

    CIBLE.write_text(rendu(catalogue), encoding="utf-8", newline="\n")
    print()
    print("wiki-competences.js genere : %d heros, %d competences, %.1f Ko"
          % (len(catalogue),
             sum(len(v) for v in catalogue.values()),
             CIBLE.stat().st_size / 1024))


if __name__ == "__main__":
    main()
