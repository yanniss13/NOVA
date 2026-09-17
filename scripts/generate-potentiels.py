# =============================================================================
#  generate-potentiels.py
#  Récupère les trois types d'armes compatibles et leurs descriptions de
#  bonus T1-T10 pour chaque personnage depuis la page team-builder de
#  7dsorigin.app, puis regénère potentiels.js (consommé par index.html).
#  Le palier choisi dans l'appli est commun au personnage.
#
#  Les héros absents du site sont lus dans le snapshot local des tables du jeu
#  (7ds-stats/contenu-jeu.json) et fusionnés par client_content.py.
#
#  Usage :   python generate-potentiels.py
#  (nécessite une connexion internet ; aucune dépendance tierce)
#            python generate-potentiels.py --client-only   (sans réseau :
#                   remplace seulement les héros du snapshot dans la sortie)
#            python generate-potentiels.py --check
#
#  A relancer quand le jeu ajoute des personnages / modifie les potentiels.
#  Données 100% texte (descriptions FR) — aucune image téléchargée ici.
# =============================================================================
import argparse, os, re, json, sys, urllib.request

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import client_content  # noqa: E402
# Ce script vit dans scripts/ ; les donnees qu'il lit et ecrit sont a la
# racine du depot, d'ou le second .parent.
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'https://7dsorigin.app/fr/team-builder/create'
OUT = os.path.join(HERE, 'data', 'potentiels.js')
NAME = 'SEVEN_DS_POTENTIELS'
HEADER = [
    "// Genere par generate-potentiels.py depuis 7dsorigin.app (team-builder).",
    "// Heros absents du site : tables du jeu, via 7ds-stats/contenu-jeu.json.",
    "// Chaque personnage a 3 cles d'armes compatibles, avec leurs bonus T1..T10.",
    "// Le palier choisi est commun au heros et reste stocke dans les equipes.",
    "// Le balisage [#RRGGBB]texte[-] est un span de couleur (rendu par l'appli).",
]

# enum weaponType du site  ->  nom de dossier d'arme local (segment de chemin)
WT_FOLDER = client_content.WEAPON_FOLDERS

def fetch():
    req = urllib.request.Request(URL, headers={'User-Agent': 'Mozilla/5.0'})
    print('Téléchargement de', URL, '...')
    return urllib.request.urlopen(req, timeout=60).read().decode('utf-8', 'ignore')

def match_array(u, b):
    depth = 0
    for j in range(b, len(u)):
        if u[j] == '[': depth += 1
        elif u[j] == ']':
            depth -= 1
            if depth == 0:
                return u[b:j + 1]
    return None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--client-only', action='store_true')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if args.check:
        client_content.check_mapping_catalog(OUT, NAME, 'potentials', HEADER)
        print('potentiels.js à jour')
        return
    if args.client_only:
        count, digest = client_content.client_only_mapping_catalog(OUT, NAME, 'potentials', HEADER)
        print('OK -> potentiels.js : %d personnages' % count)
        print('  Empreinte des héros historiques inchangée :', digest)
        return
    raw = fetch()
    u = raw.replace('\\"', '"').replace('\\/', '/')
    heads = [(m.start(), m.group(1)) for m in
             re.finditer(r'"slug":"([a-z0-9-]+)","nameFr":"[^"]+"', u)]

    data = {}
    for m in re.finditer(r'"potentials":\[', u):
        b = u.index('[', m.start())
        arr = match_array(u, b)
        prev = [h for h in heads if h[0] < m.start()]
        slug = prev[-1][1] if prev else '?'
        cid = re.sub(r'-costume-.*$', '', slug)   # escanor-costume-XXXX -> escanor
        pots = {}
        for em in re.finditer(
                r'\{"weaponType":"([^"]+)","tier":(\d+),"bonusFr":"((?:[^"\\]|\\.)*)"', arr):
            wt, tier, fr = em.group(1), int(em.group(2)), em.group(3)
            folder = WT_FOLDER.get(wt, wt)
            fr = re.sub(r'\\+n', '\n', fr)   # sauts de ligne
            fr = fr.replace('\\', '')        # backslash résiduels
            pots.setdefault(folder, {})[tier] = fr
        data[cid] = {folder: [tiers.get(t, '') for t in range(1, 11)]
                     for folder, tiers in pots.items()}

    if len(data) < 10:
        print('ERREUR : seulement %d personnages extraits — le format de la page a '
              'peut-être changé.' % len(data))
        sys.exit(1)

    data = client_content.merge_mapping(data, 'potentials')
    client_content.write_text_atomic(
        OUT, client_content.render_window_assignment(HEADER, NAME, data))
    print('OK -> potentiels.js généré')
    print('  Personnages :', len(data))
    combos = sum(len(v) for v in data.values())
    print('  Jeux de descriptions perso/arme :', combos, '(', combos * 10, 'bonus )')

if __name__ == '__main__':
    main()
