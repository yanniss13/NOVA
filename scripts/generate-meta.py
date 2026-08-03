# =============================================================================
#  generate-meta.py
#  Récupère, pour chaque personnage, son élément / rôle / rareté depuis la page
#  team-builder de 7dsorigin.app, et regénère personnages-meta.js (index.html).
#
#  Usage :   python generate-meta.py     (connexion internet requise)
#  Données 100% texte — aucune image téléchargée.
# =============================================================================
import os, re, json, sys, urllib.request

sys.stdout.reconfigure(encoding='utf-8')
# Ce script vit dans scripts/ ; les donnees qu'il lit et ecrit sont a la
# racine du depot, d'ou le second .parent.
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'https://7dsorigin.app/fr/team-builder/create'
OUT = os.path.join(HERE, 'personnages-meta.js')

def fetch():
    req = urllib.request.Request(URL, headers={'User-Agent': 'Mozilla/5.0'})
    print('Téléchargement de', URL, '...')
    return urllib.request.urlopen(req, timeout=60).read().decode('utf-8', 'ignore')

def main():
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

    content = ("// Genere par generate-meta.py depuis 7dsorigin.app (team-builder).\n"
               "// Cle = id/slug personnage. element (FIRE/WIND/DARK/EARTH/HOLY/ICE/THUNDER),\n"
               "// role (ATTACKER/DEFENDER/SUPPORT), rarity (SR/SSR),\n"
               "// weapons = 3 slots {weapon, role, element} = armes equipables du perso.\n"
               "window.SEVEN_DS_META = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n")
    open(OUT, 'w', encoding='utf-8').write(content)
    print('OK -> personnages-meta.js généré')
    print('  Personnages :', len(data))
    from collections import Counter
    print('  Éléments :', dict(Counter(v['element'] for v in data.values())))
    print('  Rôles    :', dict(Counter(v['role'] for v in data.values())))

if __name__ == '__main__':
    main()
