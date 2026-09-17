# =============================================================================
#  generate-meta.py
#  Récupère, pour chaque personnage, son élément / rôle / rareté depuis la page
#  team-builder de 7dsorigin.app, et regénère personnages-meta.js (index.html).
#
#  Les héros absents du site sont lus dans le snapshot local des tables du jeu
#  (7ds-stats/contenu-jeu.json) et fusionnés par client_content.py.
#
#  Usage :   python generate-meta.py     (connexion internet requise)
#            python generate-meta.py --client-only   (sans réseau : remplace
#                   seulement les héros du snapshot dans la sortie commitée)
#            python generate-meta.py --check
#  Données 100% texte — aucune image téléchargée.
# =============================================================================
import argparse, os, re, json, sys, urllib.request

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import client_content  # noqa: E402
# Ce script vit dans scripts/ ; les donnees qu'il lit et ecrit sont a la
# racine du depot, d'ou le second .parent.
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'https://7dsorigin.app/fr/team-builder/create'
OUT = os.path.join(HERE, 'data', 'personnages-meta.js')
NAME = 'SEVEN_DS_META'
HEADER = [
    "// Genere par generate-meta.py depuis 7dsorigin.app (team-builder).",
    "// Heros absents du site : tables du jeu, via 7ds-stats/contenu-jeu.json.",
    "// Cle = id/slug personnage. element (FIRE/WIND/DARK/EARTH/HOLY/ICE/THUNDER),",
    "// role (ATTACKER/DEFENDER/SUPPORT), rarity (SR/SSR),",
    "// weapons = 3 slots {weapon, role, element} = armes equipables du perso.",
]

def fetch():
    req = urllib.request.Request(URL, headers={'User-Agent': 'Mozilla/5.0'})
    print('Téléchargement de', URL, '...')
    return urllib.request.urlopen(req, timeout=60).read().decode('utf-8', 'ignore')

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--client-only', action='store_true')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if args.check:
        client_content.check_mapping_catalog(OUT, NAME, 'meta', HEADER)
        print('personnages-meta.js à jour')
        return
    if args.client_only:
        count, digest = client_content.client_only_mapping_catalog(OUT, NAME, 'meta', HEADER)
        print('OK -> personnages-meta.js : %d personnages' % count)
        print('  Empreinte des héros historiques inchangée :', digest)
        return
    u = fetch().replace('\\"', '"').replace('\\/', '/')
    # objets personnage : slug, nameFr, nameEn, element, rarity, role, puis weaponSlots
    pat = re.compile(
        r'"slug":"([a-z0-9-]+)","nameFr":"[^"]*","nameEn":"[^"]*",'
        r'"element":"([A-Z]+)","rarity":"([A-Z]+)","role":"([A-Z]+)"'
        r'[^\[{]*?"weaponSlots":(\[[^\]]*\])')
    data = {}
    for m in pat.finditer(u):
        slug, element, rarity, role, wsjson = m.groups()
        slots = []
        for sm in re.finditer(
                r'\{"role":"([^"]*)","weapon":"([^"]*)","element":"([^"]*)"\}', wsjson):
            slots.append({"role": sm.group(1), "weapon": sm.group(2), "element": sm.group(3)})
        data[slug] = {"element": element, "rarity": rarity, "role": role, "weapons": slots}

    if len(data) < 10:
        print('ERREUR : seulement %d personnages extraits — format de page changé ?'
              % len(data))
        sys.exit(1)

    data = client_content.merge_mapping(data, 'meta')
    client_content.write_text_atomic(
        OUT, client_content.render_window_assignment(HEADER, NAME, data))
    print('OK -> personnages-meta.js généré')
    print('  Personnages :', len(data))
    from collections import Counter
    print('  Éléments :', dict(Counter(v['element'] for v in data.values())))
    print('  Rôles    :', dict(Counter(v['role'] for v in data.values())))

if __name__ == '__main__':
    main()
