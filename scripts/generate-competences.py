# -*- coding: utf-8 -*-
"""Aspire les competences de 7dsorigin.app -> data/competences.js.

Toutes les competences non passives restent au catalogue, y compris celles que
la description ne permet pas de chiffrer. SevenCodex precise leurs recharges
combat : 7dsorigin les arrondit et omet celle de certaines variantes.

Le catalogue est fige et commite : le site est une PWA et ne doit aucun appel
reseau au rendu. `--check` verifie la presence du fichier commite - il ne
re-aspire pas, sous peine de rendre `npm test` dependant d'un site tiers.
La coherence du contenu est l'affaire de tests/competences-catalogue.test.js.
"""
import argparse
import html
import importlib.util
import json
import re
from decimal import Decimal
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent

# Le nom du fichier contient un tiret : import par chemin, pas par `import`.
_spec = importlib.util.spec_from_file_location(
    "generate_stats", RACINE / "scripts" / "generate-stats.py"
)
_gen = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_gen)

FICHE = "https://7dsorigin.app/en/characters/{slug}"
FICHE_SEVEN_CODEX = "https://sevencodex.com/characters/{slug}/"
POURCENT = re.compile(r"(-?\d+(?:[.,]\d+)?)\s*%")

# Les balises de couleur dont la source enrobe chaque nombre, et leur
# fermeture. On lit le texte nu : la couleur n'est pas de l'information.
BALISE = re.compile(r"\[#[0-9A-Fa-f]{6}\]|\[-\]")
# Une phrase s'arrete au retour a la ligne, ou au point SUIVI d'un blanc. Le
# point de « 0.5 sec » est colle a un chiffre, il ne coupe donc rien.
PHRASE = re.compile(r"\.\s+|\n")

DIRECT = re.compile(
    r"(?:^|then )Inflicts damage equal to (-?\d+(?:\.\d+)?)% of Attack",
    re.IGNORECASE,
)
CHARGE = re.compile(
    r"damage equal to (-?\d+(?:\.\d+)?)%\s*/\s*"
    r"(-?\d+(?:\.\d+)?)% of Attack based on the charge level",
    re.IGNORECASE,
)
INTERVALLE = re.compile(r"every (\d+(?:\.\d+)?) sec")
DUREE = re.compile(r"(?:for|lasts) (\d+(?:\.\d+)?) sec", re.IGNORECASE)
POSTURE_DUREE = re.compile(
    r"Maintains stance for up to (\d+(?:\.\d+)?) sec", re.IGNORECASE
)
# Une composante de degats. Ce motif ne se cherche JAMAIS au fil du texte : il
# s'ancre en tete de ce qui reste a lire apres « damage equal to ». Voir
# groupes_de_degats(), qui porte la raison.
COMPOSANTE = re.compile(
    r"(-?\d+(?:\.\d+)?)% of "
    r"(?:(?:the )?(?:hero's|caster's) )?"
    r"(remaining HP|Max HP|Defense|Attack)",
    re.IGNORECASE,
)
DEGATS_EGAUX = re.compile(r"damage equal to\s+", re.IGNORECASE)
# Deux composantes d'un MEME coup se lient par « + ». Une virgule, un « then »
# ou un « and » ouvrent autre chose : un buff, une jauge, une seconde frappe.
CONNECTEUR = re.compile(r"\s*\+\s*")
BASES = {
    "attack": "atk",
    "defense": "def",
    "max hp": "maxHp",
    "remaining hp": "remainingHp",
}
NOM_SEVEN_CODEX = re.compile(
    r'<h4 class="skill__name">(.*?)</h4>', re.DOTALL
)
RECHARGE_SEVEN_CODEX = re.compile(
    r'<span class="kpi__l">CD</span>\s*'
    r'<span class="kpi__v">(\d+(?:\.\d+)?)\s*s</span>',
    re.DOTALL,
)
SEVEN_CODEX_ALIASES = {
    "dreydrin": "dredrin",
    "gil-thunder": "gilthunder",
    "klotho": "clotho",
    "manny": "mannie",
    "slader": "slater",
}

# Le coup saute vaut 25 % chez tous les heros, sans exception relevee. La
# source le range en tete de `hitDamages` et l'omet de la description.
SAUT = 25.0

# Ces attaques restent hors calcul tant que leur durée maximale ou leur nombre
# réel de coups maintenus n'a pas été mesuré en jeu. Les répartitions publiées
# ne suffisent pas à borner ce que le joueur peut réellement exécuter.
MAINTIENS_NON_BORNES = frozenset({
    "elaine_wand_skill_rmb_ready",
    "howzer_cudgel3c_skill_e_ready",
    "klotho_rapier_skill_rmb_ready",
    "tioreh_book_skill_e",
    "tristan_sword2h_skill_rmb_ready",
})


def est_maintien_non_borne(skill):
    identifiant = skill.get("gameId") or skill.get("id")
    return identifiant in MAINTIENS_NON_BORNES


def nombre(texte):
    """« 189% ATK » -> 189.0 ; rien d'exploitable -> None (jamais 0)."""
    if not isinstance(texte, str):
        return None
    trouve = POURCENT.search(texte)
    return float(trouve.group(1).replace(",", ".")) if trouve else None


def nombre_brut(valeur):
    """Normalise un nombre JSON ou textuel, sans convertir une absence en zero."""
    if isinstance(valeur, bool) or valeur is None:
        return None
    try:
        return float(str(valeur).replace(",", "."))
    except ValueError:
        return None


def premiere_phrase(description):
    """Le texte nu de la premiere phrase, balises retirees.

    Tout ce qui suit est conditionnel ou accessoire : une suite de combo a
    declencher, un effet lie a une marque, un buff. Le calcul ne retient que
    ce qu'un joueur obtient a coup sur en lancant la competence.
    """
    nu = BALISE.sub("", description or "").strip()
    return PHRASE.split(nu)[0] if nu else ""


def groupes_de_degats(phrase):
    """Les composantes rattachees a chaque « damage equal to », et leur place.

    Un pourcentage ne compte comme degat que s'il SUIT « damage equal to » et
    reste dans la chaine de « + » qui la prolonge. Chercher le motif au fil du
    texte, comme le faisait ce module, comptait comme degats tout pourcentage
    indexe sur une statistique du heros :

    - « Increases all allied heroes' Fire Attack by 30% of the hero's Attack,
      then inflicts damage equal to 114% of Attack » ajoutait le BUFF de 30 %
      aux degats, et Rending Slam frappait pour 144 % ;
    - « inflicts damage equal to 157% of Attack, then additionally increases
      the Burst Gauge by 3% of Attack » ajoutait le remplissage de JAUGE.

    La position de chaque groupe est rendue avec lui : c'est elle qui dit
    laquelle de plusieurs frappes porte le « every N sec » d'un degat
    periodique.
    """
    groupes = []
    for tete in DEGATS_EGAUX.finditer(phrase):
        reste = phrase[tete.end():]
        composantes = []
        while True:
            trouve = COMPOSANTE.match(reste)
            if not trouve:
                break
            composantes.append({
                "base": BASES[trouve.group(2).lower()],
                "pourcentage": float(trouve.group(1)),
            })
            reste = reste[trouve.end():]
            suite = CONNECTEUR.match(reste)
            if not suite:
                break
            reste = reste[suite.end():]
        if composantes:
            groupes.append((tete.start(), composantes))
    return groupes


def groupe_periodique(phrase):
    """Le groupe de degats auquel « every N sec » se rapporte, s'il y en a un.

    C'est le DERNIER groupe qui precede l'intervalle, jamais le premier de la
    phrase. « The first hit inflicts damage equal to 203% of Attack, then
    inflicts damage equal to 20% of Attack every 1 sec for 10 sec » : prendre
    le premier revenait a repeter dix fois la frappe d'ouverture. L'ultime de
    Derieri valait 2030 % au lieu de 403 %, cinq fois trop.
    """
    pas = INTERVALLE.search(phrase)
    if not pas:
        return None
    avant = [groupe for groupe in groupes_de_degats(phrase)
             if groupe[0] < pas.start()]
    return avant[-1] if avant else None


def degats_de(skill):
    """(pourcentage, nature) pour une competence brute.

    `nature` vaut « direct », « duree » ou « non-chiffree ». Les sources
    possibles ne se valent pas, d'ou cet ordre, etabli en les confrontant
    les unes aux autres sur les 320 competences non passives du jeu :

    1. `hitDamages` quand la source le publie : c'est la repartition reelle,
       et sa somme vaut exactement le `damagePercent` affiche (79 cas sur 79).
    2. un degat periodique BORNE : tick x nombre de ticks. Sans fin annoncee
       (« while the stance is maintained »), il n'y a rien a totaliser.
    3. la description. Elle couvre les competences dont le champ chiffre est
       vide - la source le laisse a null des que l'effet sort du coup simple -
       et rattrape les rares cas ou ce champ est absurde : 31,3 % la ou le
       texte annonce 188 %.
    4. `damagePercent` en dernier recours, pour les tournures a paliers
       (« 166% / 237% selon la charge ») qu'aucune phrase ne totalise.

    Le coup saute est un cas a part : la source le compte dans `hitDamages`
    mais l'omet de la description. Quand cette liste est tronquee - dix cas
    sur quarante-neuf - le total est sous-estime, et « 25 + combo » le
    retablit. Les trente-neuf autres verifient l'egalite exactement.
    """
    if est_maintien_non_borne(skill):
        return (None, "non-chiffree")

    phrase = premiere_phrase(skill.get("descriptionEn"))
    trouve = DIRECT.search(phrase)
    direct = float(trouve.group(1)) if trouve else None
    saute = str(skill.get("gameId") or "").endswith("jumpatk")

    coups = [n for n in (nombre(h) for h in skill.get("hitDamages") or [])
             if n is not None]
    if coups:
        total = sum(coups)
        charge = CHARGE.search(phrase)
        if charge:
            # Certains tableaux de coups ne publient que deux sous-coups alors
            # que la phrase donne bien les deux paliers cumules de la charge.
            total = max(total, float(charge.group(1)) + float(charge.group(2)))
        if saute and direct is not None:
            total = max(total, SAUT + direct)
        return (round(total, 2), "direct")

    groupe = groupe_periodique(phrase)
    if groupe:
        # Le compte de ticks vient de periodique_de(), qui divise en decimal.
        # Cette branche le calculait a part, en flottant, et « 10 // 0.4 »
        # rend 24 la ou la division exacte en rend 25 : deux fonctions lisant
        # la meme phrase n'en tiraient pas le meme total.
        periodique = periodique_de(skill)
        if not periodique:
            return (None, "non-chiffree")
        total = periodique["pourcentageParTick"] * periodique["ticks"]
        # Une frappe annoncee AVANT le tick est portee une fois, pas a chaque
        # tick : elle s'ajoute au total au lieu d'etre multipliee par lui.
        total += sum(
            composante["pourcentage"]
            for position, composantes in groupes_de_degats(phrase)
            if position != groupe[0]
            for composante in composantes
            if composante["base"] == "atk"
        )
        return (round(total, 2), "duree")

    if direct is not None:
        return (round(SAUT + direct, 2) if saute else direct, "direct")

    champ = nombre(skill.get("damagePercent"))
    if champ is not None and champ > 0:
        return (champ, "direct")
    return (None, "non-chiffree")


def periodique_de(skill):
    """Decrit un degat periodique borne sans perdre son rythme de ticks."""
    if est_maintien_non_borne(skill):
        return None
    description = BALISE.sub("", skill.get("descriptionEn") or "").strip()
    phrase = PHRASE.split(description)[0] if description else ""
    groupe = groupe_periodique(phrase)
    if not groupe:
        return None
    pas = INTERVALLE.search(phrase)
    if "while the stance is maintained" in phrase.lower():
        fin = POSTURE_DUREE.search(description)
    else:
        fin = DUREE.search(phrase)
    if not fin:
        return None
    # Le rythme ne retient que la PREMIERE base de son groupe : la structure
    # n'en porte qu'une, et les douze periodiques du catalogue battent toutes
    # sur l'attaque.
    tick = groupe[1][0]
    intervalle = float(pas.group(1))
    duree = float(fin.group(1))
    ticks = (int(Decimal(fin.group(1)) / Decimal(pas.group(1)))
             if intervalle > 0 else 0)
    if ticks <= 0:
        return None
    return {
        "base": tick["base"],
        "pourcentageParTick": tick["pourcentage"],
        "intervalle": intervalle,
        "duree": duree,
        "ticks": ticks,
    }


def composantes_de(skill):
    """Conserve les bases chiffrées qui composent les dégâts d'un lancement.

    La vue affiche `pourcentage`, le moteur calcule sur `composantes` : quand
    une competence porte l'attaque pour seule base, les deux DOIVENT dire le
    meme nombre. Ce module les faisait diverger en classant ses sources dans
    deux ordres opposes - la repartition publiee d'abord ici, le rythme des
    ticks d'abord la - et Flash Fruit annoncait 43 % en frappant pour 98.
    Le total en attaque vient donc de degats_de(), sans exception.

    Les autres bases - defense, PV - gardent leur propre lecture : un
    pourcentage unique ne saurait porter deux unites.
    """
    if est_maintien_non_borne(skill):
        return []
    if periodique_de(skill):
        pourcentage, _nature = degats_de(skill)
        return ([{"base": "atk", "pourcentage": pourcentage}]
                if pourcentage is not None else [])

    phrase = premiere_phrase(skill.get("descriptionEn"))
    trouvees = [composante
                for _position, composantes in groupes_de_degats(phrase)
                for composante in composantes]
    if len(trouvees) > 1 or (trouvees and trouvees[0]["base"] != "atk"):
        return trouvees

    pourcentage, _nature = degats_de(skill)
    return ([{"base": "atk", "pourcentage": pourcentage}]
            if pourcentage is not None else [])


def repartition_de(skill):
    return [
        n for n in (nombre(h) for h in skill.get("hitDamages") or [])
        if n is not None
    ]


def recharges_sevencodex(page):
    """Lit les CD combat précis sans les propager entre deux blocs de skill."""
    recharges = {}
    for bloc in page.split('<div class="skill skill--')[1:]:
        nom = NOM_SEVEN_CODEX.search(bloc)
        recharge = RECHARGE_SEVEN_CODEX.search(bloc)
        if not (nom and recharge):
            continue
        nom_texte = re.sub(r"<[^>]+>", "", nom.group(1))
        recharges[html.unescape(nom_texte).strip()] = float(recharge.group(1))
    return recharges


def recharges_du(slug):
    """Télécharge les CD combat, plus précis que les valeurs de la fiche RSC."""
    slug_source = SEVEN_CODEX_ALIASES.get(slug, slug)
    page = _gen.fetch(FICHE_SEVEN_CODEX.format(slug=slug_source))
    return recharges_sevencodex(page)


def compacte_competence(skill, recharges_precises=None):
    """Normalise une compétence brute dans le contrat du catalogue local."""
    pourcentage, nature = degats_de(skill)
    recharges_precises = recharges_precises or {}
    recharge = recharges_precises.get(skill.get("nameEn"))
    if recharge is None:
        recharge = nombre_brut(skill.get("cooldown"))
    return {
        "gameId": skill.get("gameId") or skill.get("id"),
        "weaponType": skill.get("weaponType"),
        "categorie": skill.get("skillCategory"),
        "nom": skill.get("nameEn"),
        "pourcentage": pourcentage,
        "nature": nature,
        "composantes": composantes_de(skill),
        "periodique": periodique_de(skill),
        "recharge": recharge,
        "coups": skill.get("hitCount"),
        "repartition": repartition_de(skill),
        "portee": skill.get("damType"),
    }


def slugs():
    flight = _gen.flight_payload(_gen.fetch(_gen.PAGE))
    return [c["slug"] for c in _gen.collect(flight, "characters") if c.get("slug")]


def ouverture(texte, pos):
    """Remonte jusqu'a l'accolade ouvrant l'objet qui contient `pos`."""
    profondeur = 0
    i = pos
    while i >= 0:
        c = texte[i]
        if c == "}":
            profondeur += 1
        elif c == "{":
            if profondeur == 0:
                return i
            profondeur -= 1
        i -= 1
    return None


def objets_portant(flight, cle):
    """Les objets JSON du payload qui portent `cle`, imbrications comprises.

    Une expression reguliere plate n'y suffit pas : les competences actives
    portent des `buffs` structures, et un motif sans accolades imbriquees ne
    ramenait que les rares passifs sans buff - trois sur dix-huit.
    """
    marque = '"%s"' % cle
    trouves = []
    pos = flight.find(marque)
    while pos != -1:
        debut = ouverture(flight, pos)
        if debut is not None:
            fin = _gen.balanced_end(flight, debut)
            if fin is not None and fin > debut:
                trouves.append(flight[debut:fin + 1])
        pos = flight.find(marque, pos + 1)
    return trouves


def competences_du(slug):
    flight = _gen.flight_payload(_gen.fetch(FICHE.format(slug=slug)))
    recharges_precises = recharges_du(slug)
    retenues = []
    vus = set()
    for brut in objets_portant(flight, "damagePercent"):
        try:
            skill = json.loads(brut)
        except ValueError:
            continue
        if skill.get("skillCategory") == "PASSIVE":
            continue
        if not skill.get("weaponType"):
            continue
        identifiant = skill.get("gameId") or skill.get("id")
        if identifiant in vus:
            continue
        vus.add(identifiant)
        # Une competence qu'on ne sait pas chiffrer RESTE au catalogue, avec
        # un pourcentage nul et sa nature. La vue peut ainsi annoncer combien
        # d'effets echappent au calcul, au lieu de les taire : un cycle ampute
        # en silence donne un classement qu'on croit complet.
        retenues.append(compacte_competence(skill, recharges_precises))
    retenues.sort(key=lambda s: (s["weaponType"] or "", s["gameId"] or ""))
    return retenues


def rendu(catalogue):
    corps = json.dumps(catalogue, ensure_ascii=False, indent=1, sort_keys=True)
    return (
        "// Genere par generate-competences.py depuis 7dsorigin.app ;\n"
        "// recharges combat precisees depuis SevenCodex.\n"
        "// Cle = slug personnage. Les passifs sont exclus ; toute autre\n"
        "// competence figure ici, meme celle qu'on ne sait pas chiffrer.\n"
        "// pourcentage = % de l'ATK pour un lancement, null si non chiffrable.\n"
        "// nature : direct | duree (tick x ticks) | non-chiffree.\n"
        "// repartition = % par coup, quand la source la publie.\n"
        "window.SEVEN_DS_COMPETENCES = " + corps + ";\n"
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    cible = RACINE / "data" / "competences.js"

    if args.check:
        if not cible.exists():
            raise SystemExit("competences.js doit etre genere")
        print("competences.js present")
        return

    catalogue = {}
    for slug in slugs():
        catalogue[slug] = competences_du(slug)
        print(slug, ":", len(catalogue[slug]), "competences")
    cible.write_text(rendu(catalogue), encoding="utf-8", newline="\n")
    print("competences.js genere")


if __name__ == "__main__":
    main()
