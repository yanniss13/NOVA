# =============================================================================
#  generate-potentiels.py
#  Récupère les trois types d'armes compatibles et leurs descriptions de
#  bonus T1-T10 pour chaque personnage depuis la page team-builder de
#  7dsorigin.app, puis regénère potentiels.js (consommé par index.html).
#  Le palier choisi dans l'appli est commun au personnage.
#
#  Usage :   python generate-potentiels.py
#  (nécessite une connexion internet ; aucune dépendance tierce)
#
#  A relancer quand le jeu ajoute des personnages / modifie les potentiels.
#  Données 100% texte (descriptions FR) — aucune image téléchargée ici.
# =============================================================================
import os, re, json, sys, urllib.request

sys.stdout.reconfigure(encoding='utf-8')
# Ce script vit dans scripts/ ; les donnees qu'il lit et ecrit sont a la
# racine du depot, d'ou le second .parent.
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'https://7dsorigin.app/fr/team-builder/create'
OUT = os.path.join(HERE, 'potentiels.js')

# enum weaponType du site  ->  nom de dossier d'arme local (segment de chemin)
WT_FOLDER = {
    'Axe': 'Hache', 'Book': 'Livre', 'SwordDual': 'Epees doubles', 'Rapier': 'Rapiere',
    'Shield': 'Bouclier', 'Lance': 'Lance', 'Sword1h': 'Epee 1 main', 'Cudgel3c': 'Nunchaku',
    'Gauntlets': 'Gantelets', 'Sword2h': 'Epee 2 mains', 'Staff': 'Baton', 'Wand': 'Baguette',
}

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

    content = ("// Genere par generate-potentiels.py depuis 7dsorigin.app (team-builder).\n"
               "// Chaque personnage a 3 cles d'armes compatibles, avec leurs bonus T1..T10.\n"
               "// Le palier choisi est commun au heros et reste stocke dans les equipes.\n"
               "// Le balisage [#RRGGBB]texte[-] est un span de couleur (rendu par l'appli).\n"
               "window.SEVEN_DS_POTENTIELS = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n")
    open(OUT, 'w', encoding='utf-8').write(content)
    print('OK -> potentiels.js généré')
    print('  Personnages :', len(data))
    combos = sum(len(v) for v in data.values())
    print('  Jeux de descriptions perso/arme :', combos, '(', combos * 10, 'bonus )')

if __name__ == '__main__':
    main()
