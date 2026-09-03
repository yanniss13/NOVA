# -*- coding: utf-8 -*-
"""Génère le catalogue local des passifs et interactions du DPS 60 s."""
import argparse
import importlib.util
import json
import re
from pathlib import Path


RACINE = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location(
    "effets_dps_regles", RACINE / "scripts" / "effets-dps-regles.py"
)
_regles = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_regles)

_spec_competences = importlib.util.spec_from_file_location(
    "generate_competences", RACINE / "scripts" / "generate-competences.py"
)
_competences = importlib.util.module_from_spec(_spec_competences)
_spec_competences.loader.exec_module(_competences)

# La resolution des renvois de texte vit dans le generateur du wiki. La
# reecrire ici ferait deux lectures du meme flux, libres de diverger.
_spec_wiki = importlib.util.spec_from_file_location(
    "generate_wiki", RACINE / "scripts" / "generate-wiki.py"
)
_wiki = importlib.util.module_from_spec(_spec_wiki)
_spec_wiki.loader.exec_module(_wiki)

fetch = _competences._gen.fetch
flight_payload = _competences._gen.flight_payload
# La fiche francaise porte a la fois `descriptionFr` et `descriptionEn`.
# L'URL anglaise ne publie que `descriptionEn` : tenter d'y resoudre le champ
# francais laisse silencieusement toutes les descriptions a vide.
FICHE = _wiki.FICHE

TYPES_REGLES = _regles.TYPES_REGLES
CLASSIFICATIONS = _regles.CLASSIFICATIONS
REGLES_SPECIFIQUES = _regles.REGLES_SPECIFIQUES
NON_INCLUS_SPECIFIQUES = _regles.NON_INCLUS_SPECIFIQUES
SANS_IMPACT_SPECIFIQUES = _regles.SANS_IMPACT_SPECIFIQUES

CATEGORIES = {
    "normal skill": "normal-skill",
    "special attack": "special",
    "ultimate move": "ultimate",
    "ultimate attack": "ultimate",
    "normal attack": "normal-attack",
    "tag skill": "tag-skill",
}

BONUS_CATEGORIE_MAX = re.compile(
    r"(?:increases|amplifies) (Normal Skill|Special Attack|Ultimate Move|"
    r"Ultimate Attack|Normal Attack|Tag Skill) (?:damage|power) by "
    r"\d+(?:\.\d+)?%.*?\(Max:\s*(\d+(?:\.\d+)?)%\)",
    re.IGNORECASE,
)

RECHARGE_PERIODIQUE = re.compile(
    r"While ([^.]+?) is active, decreases the hero's (Normal Skill|"
    r"Special Attack|Ultimate Move) cooldown by (\d+(?:\.\d+)?) sec "
    r"every (\d+(?:\.\d+)?) sec",
    re.IGNORECASE,
)

SANS_IMPACT = re.compile(
    r"healing|shield|damage taken|movement speed|stamina|hp recovery|"
    r"reaction|immun|taunt|block|accuracy|gauge|magic points?|restores? hp|"
    r"barrier|burst efficiency|burst resistance|energy charge|stun|"
    r"perseverance|range",
    re.IGNORECASE,
)
RESSOURCES_ILLIMITEES = re.compile(
    r"Restores? (?:the )?(?:Magic|Tag) Gauge|Tag Gauge",
    re.IGNORECASE,
)
EFFET_EFFICACITE_DELUGE_SEUL = re.compile(
    r"^Attacking an enemy without a Burst activated increases "
    r"All Elemental Burst Efficiency by \d+(?:\.\d+)?% for "
    r"\d+(?:\.\d+)? sec\. \(Cooldown: \d+(?:\.\d+)? sec\)$",
    re.IGNORECASE,
)
EFFET_RESISTANCE_DELUGE_SEUL = re.compile(
    r"^Attacking an Incapacitated enemy decreases their "
    r"All Elemental Burst Resistance by \d+(?:\.\d+)?% for "
    r"\d+(?:\.\d+)? sec\. \(Cooldown: \d+(?:\.\d+)? sec\)$",
    re.IGNORECASE,
)

MOTS_DPS = re.compile(
    r"damage|attack|defense|max hp|crit|cooldown|resistance|weakness|"
    r"defense shatter",
    re.IGNORECASE,
)

STAT_DEJA_CALCULEE = re.compile(
    r"(?:increases?\s+)?(?:(?:the )?hero[’']s\s+)?"
    r"(?:(?:Attack|Defense|Max HP)\s+by\s+\d+(?:\.\d+)?%|"
    r"[A-Za-z][A-Za-z ]*\s+\+\s*\d+(?:\.\d+)?%)",
    re.IGNORECASE,
)

BALISE = re.compile(r"\[#[0-9A-Fa-f]{6}\]|\[-\]")

LIBELLE_BONUS = (
    r"Attack|Defense|Max HP|Crit Chance|Crit Damage|DoT Efficiency|"
    r"All Elemental Damage|All Elemental Attack|Physical damage|"
    r"Physical Attack|Darkness Attack|Fire Attack|Cold Attack|Lightning Attack|"
    r"Wind Attack|Earth Attack|Holy Attack|"
    r"Darkness damage|Fire damage|Cold damage|Lightning damage|"
    r"Wind damage|Earth damage|Holy damage|Normal Skill damage|"
    r"Normal Skill power|Enhanced Special Attack power|Special Attack damage|"
    r"Special Attack power|"
    r"Ultimate Move damage|Ultimate Move skill power|Ultimate Move power|"
    r"Ultimate Attack damage|"
    r"Ultimate Attack power|"
    r"Normal Attack damage|Normal Attack power|Tag Skill damage|"
    r"Tag Skill skill power|Tag Skill power"
)
BONUS_SIMPLE = re.compile(
    r"(?:increases?|amplifies?)\s+"
    r"(?:(?:the )?hero[’']s\s+|the\s+|its\s+)?("
    + LIBELLE_BONUS + r")\s+by\s+"
    r"(\d+(?:\.\d+)?%\s*(?:or\s*\d+(?:\.\d+)?%)?)",
    re.IGNORECASE,
)
BONUS_INVERSE = re.compile(
    r"(" + LIBELLE_BONUS + r")\s+(?:increases?|is increased)\s+by\s+"
    r"(\d+(?:\.\d+)?%\s*(?:or\s*\d+(?:\.\d+)?%)?)",
    re.IGNORECASE,
)
BONUS_CONJONCTION = re.compile(
    r"\band\s+(" + LIBELLE_BONUS + r")\s+by\s+"
    r"(\d+(?:\.\d+)?%\s*(?:or\s*\d+(?:\.\d+)?%)?)",
    re.IGNORECASE,
)
MAXIMUM = re.compile(r"\(Max:\s*(\d+(?:\.\d+)?)%", re.IGNORECASE)
MAX_CUMULS = re.compile(r"\(Max:\s*(\d+) times\)", re.IGNORECASE)
CONDITION_DYNAMIQUE = re.compile(
    r"\b(?:for \d|while|when|each|after|using|landing|upon)\b",
    re.IGNORECASE,
)
RECHARGE_INTERNE = re.compile(
    r"\(Cooldown:\s*(\d+(?:\.\d+)?)\s*sec", re.IGNORECASE
)
DEGATS_ADDITIONNELS = re.compile(
    r"(?:additional\s+)?(?:\w+\s+)?damage equal to\s+"
    r"(\d+(?:\.\d+)?)% of (?:(?:the )?hero[\u2019']s )?"
    r"(Attack|Defense|Max HP|remaining HP)",
    re.IGNORECASE,
)
DEGATS_ADDITIONNELS_RATIO = re.compile(
    r"additional(?:ly)? (?:inflicts? )?damage equal to "
    r"(\d+(?:\.\d+)?)% of (?:the )?damage dealt"
    r"(?: with the (Normal Skill or Ultimate Move))?",
    re.IGNORECASE,
)
RECHARGE_TAUX = re.compile(
    r"decreases? (?:the )?(?:hero[’']s )?"
    r"(Normal Skill|Special Attack|Ultimate Move)(?:'s)? "
    r"cooldown by (\d+(?:\.\d+)?)%",
    re.IGNORECASE,
)
RECHARGE_PLATE = re.compile(
    r"decreases? (?:the )?(?:hero[’']s )?"
    r"(Normal Skill|Special Attack|Ultimate Move)(?:'s)? "
    r"cooldown by (\d+(?:\.\d+)?)(?: sec)?(?![\d%]|\.\d)",
    re.IGNORECASE,
)
INTERVALLE_DOT = re.compile(
    r"(?:DoT Interval decreases|decreases? (?:Burn|Shock) damage trigger "
    r"interval) by (\d+(?:\.\d+)?)%",
    re.IGNORECASE,
)
RECHARGE_SELF_TAUX = re.compile(
    r"decreases? (?:the )?cooldown by (\d+(?:\.\d+)?)%", re.IGNORECASE
)
RECHARGE_SELF_PLATE = re.compile(
    r"decreases? (?:the )?cooldown by (\d+(?:\.\d+)?) sec", re.IGNORECASE
)
BONUS_RECHARGE = re.compile(
    r"(\d+(?:\.\d+)?)% Cooldown Reduction boost.*?"
    r"\(Max:\s*(\d+) times\)",
    re.IGNORECASE,
)
BONUS_REDUCTION_RECHARGE = re.compile(
    r"increases? the (Normal Skill|Special Attack|Ultimate Move) cooldown "
    r"reduction by (\d+(?:\.\d+)?)%",
    re.IGNORECASE,
)
BONUS_REDUCTION_RECHARGE_PLATE = re.compile(
    r"increases? (?:the (?:Normal Skill|Special Attack|Ultimate Move)'s )?"
    r"(Normal Skill|Special Attack|Ultimate Move) cooldown reduction by "
    r"(\d+(?:\.\d+)?) sec",
    re.IGNORECASE,
)
RESISTANCE_CRITIQUE = re.compile(
    r"decreases? (?:the (?:target|enemy)'s |their )?"
    r"(Crit Resistance|Crit Defense) by (\d+(?:\.\d+)?)%",
    re.IGNORECASE,
)
RESISTANCE_CRITIQUE_REDUCTION = re.compile(
    r"increases? (Crit Resistance|Crit Defense) reduction by "
    r"(\d+(?:\.\d+)?)%",
    re.IGNORECASE,
)
RESISTANCE_ELEMENT = re.compile(
    r"decreases? (?:the (?:target|enemy)'s |their )?"
    r"(All Element|Physical|Darkness|Fire|Cold|Lightning|Wind|Earth|Holy) "
    r"Resistance by (\d+(?:\.\d+)?)%",
    re.IGNORECASE,
)
RESISTANCE_ELEMENT_PASSIVE = re.compile(
    r"(?:have|has) (?:their|its) "
    r"(All Element|Physical|Darkness|Fire|Cold|Lightning|Wind|Earth|Holy) "
    r"Resistance decreased by (\d+(?:\.\d+)?)%",
    re.IGNORECASE,
)
RESISTANCE_ELEMENT_REDUCTION = re.compile(
    r"increases? (?:the (?:Normal Skill|Special Attack|Ultimate Move|"
    r"Passive)'s )?"
    r"(All Element|Physical|Darkness|Fire|Cold|Lightning|Wind|"
    r"Earth|Holy) Resistance reduction by (\d+(?:\.\d+)?)%",
    re.IGNORECASE,
)
UTILISATIONS = re.compile(
    r"Changes the (Normal Skill|Special Attack|Ultimate Move) into a skill "
    r"that can be used (\d+) time\(s\)",
    re.IGNORECASE,
)
EQUIPE = re.compile(
    r"all allied heroes|all allied [A-Za-z]+ heroes|nearby allies|"
    r"\ballies\b",
    re.IGNORECASE,
)
DEGATS_CONDITIONNELS = re.compile(
    r"increases damage dealt to [^.]+? by (\d+(?:\.\d+)?)%",
    re.IGNORECASE,
)
TYPE_COMPETENCE_ALEATOIRE = re.compile(
    r"increase a certain skill type's damage by (\d+(?:\.\d+)?)%",
    re.IGNORECASE,
)
BONUS_GAGNE = re.compile(
    r"Gains? (?:a\(n\) )?(\d+(?:\.\d+)?)% "
    r"(Physical|Darkness|Fire|Cold|Lightning|Wind|Earth|Holy) damage boost",
    re.IGNORECASE,
)
SPECIAL_CHARGEE = re.compile(
    r"Amplifies fully charged Special Attack power by (\d+(?:\.\d+)?)%",
    re.IGNORECASE,
)
BONUS_STAT_COMPETENCE = re.compile(
    r"(?:increases?|amplifies?) the "
    r"(Normal Skill|Special Attack|Ultimate Move)'s "
    r"(Attack|Defense|Max HP) boost by (\d+(?:\.\d+)?)%",
    re.IGNORECASE,
)
BONUS_STAT_GAGNEE = re.compile(
    r"increases? the (Attack|Defense|Max HP) gained from the "
    r"(Normal Skill|Special Attack|Ultimate Move|Passive) by "
    r"(\d+(?:\.\d+)?)%",
    re.IGNORECASE,
)
BONUS_ELEMENT_GAGNE = re.compile(
    r"increases? the (Physical|Darkness|Fire|Cold|Lightning|Wind|Earth|Holy) "
    r"damage boost gained from the (Normal Skill|Special Attack|Ultimate Move) "
    r"by (\d+(?:\.\d+)?)%",
    re.IGNORECASE,
)
BONUS_ELEMENT_COMPETENCE = re.compile(
    r"increases? the (Normal Skill|Special Attack|Ultimate Move)'s "
    r"(Physical|Darkness|Fire|Cold|Lightning|Wind|Earth|Holy) damage boost by "
    r"(\d+(?:\.\d+)?)%",
    re.IGNORECASE,
)
BONUS_LINK = re.compile(
    r"Amplifies the additional damage power of Link by (\d+(?:\.\d+)?)%",
    re.IGNORECASE,
)
BONUS_DEGATS_ADDITIONNELS = re.compile(
    r"(?:increases?|amplifies?) (?:the (?:Normal Skill|Special Attack|"
    r"Ultimate Move)'s )?additional damage by (\d+(?:\.\d+)?)%",
    re.IGNORECASE,
)
BONUS_PASSIF = re.compile(
    r"increases? the Passive's damage boost by (\d+(?:\.\d+)?)%",
    re.IGNORECASE,
)
CUMUL_DOT_PRIS = re.compile(
    r"Increases DoT taken by (\d+(?:\.\d+)?)%\.\s*"
    r"\(Max:\s*(\d+) times\)",
    re.IGNORECASE,
)
RECHARGE_LINK = re.compile(
    r"additional damage power of Link[^.]*decreases the cooldown by "
    r"(\d+(?:\.\d+)?) sec",
    re.IGNORECASE,
)
STATUT_PERIODIQUE = re.compile(
    r"(Shock|Burn): Inflicts "
    r"(Physical|Darkness|Fire|Cold|Lightning|Wind|Earth|Holy) damage equal to "
    r"(\d+(?:\.\d+)?)% of Attack every (\d+(?:\.\d+)?) sec",
    re.IGNORECASE,
)
STATUT_PERIODIQUE_RATIO = re.compile(
    r"(Bleed): Inflicts "
    r"(?:Physical|Darkness|Fire|Cold|Lightning|Wind|Earth|Holy) damage equal "
    r"to (\d+(?:\.\d+)?)% of (?:the )?damage dealt every "
    r"(\d+(?:\.\d+)?) sec",
    re.IGNORECASE,
)
BONUS_GLOBAL = re.compile(
    r"(?:increases?|increase) damage(?: dealt)? by (\d+(?:\.\d+)?)%",
    re.IGNORECASE,
)
BONUS_SELF = re.compile(
    r"its damage dealt is increased by (\d+(?:\.\d+)?)%",
    re.IGNORECASE,
)
DEFENSE_CIBLE = re.compile(
    r"decreases? (?:the (?:target|enemy)'s |their )?Defense by "
    r"(\d+(?:\.\d+)?)%",
    re.IGNORECASE,
)
SHATTER_CIBLE = re.compile(
    r"decreases? (?:the (?:target|enemy)'s |their )?Shatter Resistance by "
    r"(\d+(?:\.\d+)?)%",
    re.IGNORECASE,
)
RESET_RECHARGE = re.compile(
    r"resets? (?:(?:the hero's|the) )?"
    r"(Normal Skill|Special Attack|Ultimate Move) "
    r"cooldown",
    re.IGNORECASE,
)
RESET_SELF = re.compile(r"resets? (?:the )?cooldown", re.IGNORECASE)
RESET_TOUTES = re.compile(r"resets? all skill cooldowns", re.IGNORECASE)
RESET_SELF_PASSIF = re.compile(r"(?:its |the )?cooldown is reset", re.IGNORECASE)
MAX_RESET_CONSECUTIF = re.compile(
    r"Cooldown reset can be triggered up to (\d+) times", re.IGNORECASE
)
INTERACTION_ACTIVE_DPS = re.compile(
    r"cooldown|resistance|critical hit|crit chance|crit damage|"
    r"additional damage|decreases? (?:their |the enemy's )?defense|"
    r"damage trigger interval|shock: inflicts|burn: inflicts|demon energy|"
    r"dot|increases? damage",
    re.IGNORECASE,
)
CRITIQUE_GARANTI = re.compile(
    r"results? in a? ?Critical Hit|results? in a? ?Crit Hit",
    re.IGNORECASE,
)
BONUS_CRITIQUE_EFFET = re.compile(
    r"increases? the (Crit Chance|Crit Damage) boost of [^.]+? by "
    r"(\d+(?:\.\d+)?)%",
    re.IGNORECASE,
)

ELEMENTS = {
    "physical": "physical",
    "darkness": "dark",
    "fire": "fire",
    "cold": "ice",
    "lightning": "thunder",
    "wind": "wind",
    "earth": "earth",
    "holy": "holy",
}

CIBLES_CATEGORIES = {
    "normal skill": "normal-skill",
    "special attack": "special",
    "ultimate move": "ultimate",
    "ultimate attack": "ultimate",
    "normal attack": "normal-attack",
    "tag skill": "tag-skill",
}


def avec_source(regles, source_id):
    return [dict(regle, sourceId=source_id) for regle in regles]


def texte_a_auditer(source, texte):
    """Retire seulement les stats deja couvertes, jamais leurs effets voisins."""
    if not source.get("statsDejaCalculees"):
        return texte
    residuel = STAT_DEJA_CALCULEE.sub("", texte)
    significatif = re.sub(
        r"\b(?:and|or)\b|[\s,.;:]+", "", residuel, flags=re.IGNORECASE
    )
    return residuel if significatif else ""


def _valeur_maximale(valeurs, ligne):
    nombres = [float(n) for n in re.findall(r"\d+(?:\.\d+)?", valeurs)]
    maximums = [float(n) for n in MAXIMUM.findall(ligne)]
    cumuls = [int(n) for n in MAX_CUMULS.findall(ligne)]
    if maximums:
        return max(nombres + maximums)
    if nombres and cumuls:
        return max(nombres) * max(cumuls)
    return max(nombres) if nombres else None


def _regle_bonus(libelle, valeur):
    brut = libelle.lower()
    normalise = (brut.replace("ultimate move skill power", "ultimate move power")
                 .replace("tag skill skill power", "tag skill power")
                 .replace("enhanced ", ""))
    cle = normalise.replace(" power", "").replace(" damage", "")
    taux = round(valeur * 100)
    if cle in {"attack", "defense", "max hp"}:
        return {
            "type": "bonus-stat",
            "stat": {"attack": "atk", "defense": "def", "max hp": "maxHp"}[cle],
            "valeur": taux,
            "mode": "passif-max",
        }
    if brut == "crit damage":
        return {
            "type": "bonus-critique",
            "stat": "critDamage",
            "valeur": taux,
            "mode": "passif-max",
        }
    if cle == "crit chance":
        return {
            "type": "bonus-critique",
            "stat": "critRate",
            "valeur": taux,
            "mode": "passif-max",
        }
    if cle == "all elemental":
        return {
            "type": "bonus-degats",
            "cible": "all-elements",
            "valeur": taux,
            "mode": "passif-max",
        }
    if cle == "all elemental attack":
        return {
            "type": "bonus-stat",
            "stat": "elementalAttack",
            "valeur": taux,
            "mode": "passif-max",
        }
    for nom, element in ELEMENTS.items():
        if brut == nom + " attack":
            return {
                "type": "bonus-stat",
                "stat": "elementalAttack:" + element,
                "valeur": taux,
                "mode": "passif-max",
            }
    if cle == "dot efficiency":
        return {
            "type": "bonus-degats",
            "cible": "periodic",
            "valeur": taux,
            "mode": "passif-max",
        }
    if cle in ELEMENTS:
        return {
            "type": "bonus-degats",
            "cible": "element:" + ELEMENTS[cle],
            "valeur": taux,
            "mode": "passif-max",
        }
    if cle in CIBLES_CATEGORIES:
        return {
            "type": "bonus-degats",
            "cible": CIBLES_CATEGORIES[cle],
            "valeur": taux,
            "mode": "passif-max",
        }
    return None


def extraire_bonus_max(source, texte):
    """Réduit les buffs supposés actifs à leur valeur offensive maximale."""
    regles = []
    for ligne in re.split(r"[\r\n]+", texte):
        trouves = sorted(
            list(BONUS_SIMPLE.finditer(ligne))
            + list(BONUS_INVERSE.finditer(ligne))
            + list(BONUS_CONJONCTION.finditer(ligne)),
            key=lambda trouve: trouve.start(),
        )
        for trouve in trouves:
            libelle = trouve.group(1)
            cle = libelle.lower().replace(" power", "").replace(" damage", "")
            if source.get("statsDejaCalculees") and cle in {
                "attack", "defense", "max hp"
            } and not CONDITION_DYNAMIQUE.search(ligne):
                continue
            valeur = _valeur_maximale(
                trouve.group(2), ligne if len(trouves) == 1 else trouve.group(0)
            )
            regle = _regle_bonus(libelle, valeur)
            if regle:
                regles.append(regle)
    return regles


def extraire_bonus_conditionnels(texte):
    regles = []
    for trouve in BONUS_ELEMENT_COMPETENCE.finditer(texte):
        regles.append({
            "type": "bonus-degats",
            "cible": "element:" + ELEMENTS[trouve.group(2).lower()],
            "valeur": round(float(trouve.group(3)) * 100),
            "condition": CATEGORIES[trouve.group(1).lower()] + "-active",
            "mode": "passif-max",
        })
    for trouve in BONUS_DEGATS_ADDITIONNELS.finditer(texte):
        regles.append({
            "type": "bonus-degats",
            "cible": "additional",
            "valeur": round(float(trouve.group(1)) * 100),
            "condition": "active-max",
            "mode": "passif-max",
        })
    for trouve in BONUS_SELF.finditer(texte):
        regles.append({
            "type": "bonus-degats",
            "cible": "self",
            "valeur": round(float(trouve.group(1)) * 100),
            "condition": "active-max",
            "mode": "passif-max",
        })
    for trouve in BONUS_ELEMENT_GAGNE.finditer(texte):
        regles.append({
            "type": "bonus-degats",
            "cible": "element:" + ELEMENTS[trouve.group(1).lower()],
            "valeur": round(float(trouve.group(3)) * 100),
            "condition": CATEGORIES[trouve.group(2).lower()] + "-active",
            "mode": "passif-max",
        })
    for trouve in BONUS_PASSIF.finditer(texte):
        regles.append({
            "type": "bonus-degats",
            "cible": "global",
            "valeur": round(float(trouve.group(1)) * 100),
            "condition": "passive-active",
            "mode": "passif-max",
        })
    for trouve in BONUS_STAT_GAGNEE.finditer(texte):
        regles.append({
            "type": "bonus-stat",
            "stat": {
                "attack": "atk", "defense": "def", "max hp": "maxHp"
            }[trouve.group(1).lower()],
            "valeur": round(float(trouve.group(3)) * 100),
            "condition": ("passive-active"
                          if trouve.group(2).lower() == "passive"
                          else CATEGORIES[trouve.group(2).lower()] + "-active"),
            "mode": "passif-max",
        })
    for trouve in BONUS_STAT_COMPETENCE.finditer(texte):
        regles.append({
            "type": "bonus-stat",
            "stat": {
                "attack": "atk", "defense": "def", "max hp": "maxHp"
            }[trouve.group(2).lower()],
            "valeur": round(float(trouve.group(3)) * 100),
            "condition": CATEGORIES[trouve.group(1).lower()] + "-active",
            "mode": "passif-max",
        })
    for trouve in DEGATS_CONDITIONNELS.finditer(texte):
        regles.append({
            "type": "bonus-degats",
            "cible": "global",
            "valeur": round(float(trouve.group(1)) * 100),
            "condition": "active-max",
            "mode": "passif-max",
        })
    for trouve in TYPE_COMPETENCE_ALEATOIRE.finditer(texte):
        regles.append({
            "type": "bonus-degats",
            "cible": "any-skill",
            "valeur": round(float(trouve.group(1)) * 100),
            "mode": "passif-max",
        })
    for trouve in BONUS_GAGNE.finditer(texte):
        regles.append({
            "type": "bonus-degats",
            "cible": "element:" + ELEMENTS[trouve.group(2).lower()],
            "valeur": round(float(trouve.group(1)) * 100),
            "condition": "active-max",
            "mode": "passif-max",
        })
    for trouve in SPECIAL_CHARGEE.finditer(texte):
        regles.append({
            "type": "bonus-degats",
            "cible": "special",
            "valeur": round(float(trouve.group(1)) * 100),
            "condition": "fully-charged",
            "mode": "passif-max",
        })
    for trouve in BONUS_LINK.finditer(texte):
        regles.append({
            "type": "bonus-degats",
            "cible": "link",
            "valeur": round(float(trouve.group(1)) * 100),
            "mode": "passif-max",
        })
    for trouve in RECHARGE_LINK.finditer(texte):
        regles.append({
            "type": "recharge-plate",
            "cible": "link",
            "secondes": float(trouve.group(1)),
            "mode": "passif-max",
        })
    for trouve in CUMUL_DOT_PRIS.finditer(texte):
        regles.append({
            "type": "bonus-degats",
            "cible": "periodic",
            "valeur": round(float(trouve.group(1)) * int(trouve.group(2)) * 100),
            "condition": "active-max",
            "mode": "passif-max",
        })
    for trouve in BONUS_GLOBAL.finditer(texte):
        regles.append({
            "type": "bonus-degats",
            "cible": "global",
            "valeur": round(float(trouve.group(1)) * 100),
            "condition": "active-max",
            "mode": "passif-max",
        })
    return regles


CATEGORIE_NOMMEE = (
    ("ultimate", r"Ultimate (?:Move|Attack)"),
    ("special", r"Special Attack"),
    ("normal-skill", r"Normal Skill"),
)


def declencheur_degats(texte):
    """La categorie que le texte NOMME, sinon « hit ».

    Un degat additionnel n'appartient presque jamais a « chaque coup » : il
    est invoque par l'ultime, par la competence normale ou par la speciale, et
    le texte le dit. Le classer `hit` le faisait se declencher a chaque action
    ET a chaque tick - les quatre potentiels du Baton de Merlin frappaient 158
    fois en soixante secondes, sur les ticks d'une competence qui n'etait meme
    pas la leur, pour 99,5 % de son total.

    Deux categories nommees dans la meme phrase, ou aucune : on ne tranche
    pas. `hit` reste alors le classement, et c'est au simulateur de dire ce
    qu'il sait en faire.
    """
    nommees = [declencheur for declencheur, motif in CATEGORIE_NOMMEE
               if re.search(motif, texte, re.IGNORECASE)]
    return nommees[0] if len(nommees) == 1 else "hit"


def extraire_degats_additionnels(source, texte):
    regles = []
    recharge = RECHARGE_INTERNE.search(texte)
    declencheur = declencheur_degats(texte)
    for trouve in DEGATS_ADDITIONNELS.finditer(texte):
        if (source.get("coefficientDejaCalcule")
                and "additional damage equal to" not in trouve.group(0).lower()):
            continue
        base = {
            "attack": "atk",
            "defense": "def",
            "max hp": "maxHp",
            "remaining hp": "remainingHp",
        }[trouve.group(2).lower()]
        regle = {
            "type": "degats-additionnels",
            "composantes": [{
                "base": base,
                "pourcentage": float(trouve.group(1)),
            }],
            "declencheur": declencheur,
            "mode": "passif-max",
        }
        if recharge:
            regle["rechargeInterne"] = float(recharge.group(1))
        regles.append(regle)
    for trouve in DEGATS_ADDITIONNELS_RATIO.finditer(texte):
        regles.append({
            "type": "degats-additionnels",
            "ratioDegats": round(float(trouve.group(1)) * 100),
            "cible": ("normal-skill-or-ultimate" if trouve.group(2) else "self"),
            "declencheur": declencheur,
            "mode": "passif-max",
        })
    return regles


def extraire_statuts_periodiques(texte):
    regles = []
    for trouve in STATUT_PERIODIQUE.finditer(texte):
        statut = trouve.group(1)
        duree_match = re.search(
            r"(?:Inflicts|Applies) " + re.escape(statut)
            + r" for (\d+(?:\.\d+)?) sec",
            texte,
            re.IGNORECASE,
        )
        if not duree_match:
            continue
        duree = float(duree_match.group(1))
        intervalle = float(trouve.group(4))
        ticks = int(duree / intervalle + 1e-9) if intervalle > 0 else 0
        if ticks <= 0:
            continue
        regles.append({
            "type": "degats-additionnels",
            "composantes": [{
                "base": "atk",
                "pourcentage": float(trouve.group(3)) * ticks,
            }],
            "element": ELEMENTS[trouve.group(2).lower()],
            "declencheur": "skill",
            "periodique": {
                "pourcentageParTick": float(trouve.group(3)),
                "intervalle": intervalle,
                "duree": duree,
                "ticks": ticks,
            },
            "mode": "passif-max",
        })
    for trouve in STATUT_PERIODIQUE_RATIO.finditer(texte):
        statut = trouve.group(1)
        duree_match = re.search(
            r"(?:Inflicts|Applies) " + re.escape(statut)
            + r" for (\d+(?:\.\d+)?) sec",
            texte,
            re.IGNORECASE,
        )
        if not duree_match:
            continue
        duree = float(duree_match.group(1))
        ratio_par_tick = float(trouve.group(2))
        intervalle = float(trouve.group(3))
        ticks = int(duree / intervalle + 1e-9) if intervalle > 0 else 0
        if ticks <= 0:
            continue
        regles.append({
            "type": "degats-additionnels",
            "ratioDegats": round(ratio_par_tick * ticks * 100),
            "cible": "self",
            "declencheur": "statut",
            "statut": statut.lower(),
            "periodique": {
                "ratioParTick": round(ratio_par_tick * 100),
                "intervalle": intervalle,
                "duree": duree,
                "ticks": ticks,
            },
            "mode": "passif-max",
        })
    return regles


def declencheur_recharge(source, texte):
    identifiant = source.get("id") or ""
    if source.get("kind") == "skill" or identifiant.startswith("skill:"):
        return "skill"
    motifs = (
        ("ultimate", r"(?:(?:using|landing|with|of|activates?) (?:a |the )?"
                     r"(?:Ultimate Move|Ultimate Attack)|"
                     r"(?:Ultimate Move|Ultimate Attack).*?hits?)"),
        ("special", r"(?:using|landing|with|of|final strike of|hits? with) "
                    r"(?:a |the )?(?:enhanced )?Special Attack"),
        ("normal-skill", r"(?:(?:using|landing|with|of|hits? with) "
                         r"(?:a |the )?Normal Skill|"
                         r"each hit from (?:a |the )?Normal Skill)"),
    )
    for declencheur, motif in motifs:
        if re.search(motif, texte, re.IGNORECASE):
            return declencheur
    if re.search(r"critical hit|each hit|on hit|when an attack hits|attacking|"
                 r"back attacks?", texte, re.IGNORECASE):
        return "hit"
    return "condition-max"


def temporaliser_recharges(source, texte, regles):
    recharge_interne = RECHARGE_INTERNE.search(texte)
    for regle in regles:
        if regle["type"] not in {"recharge-plate", "recharge-taux"}:
            continue
        if regle.get("application") == "base":
            continue
        if regle.get("mode") == "amplification-reduction":
            continue
        if regle.get("cible") == "periodic" or str(
                regle.get("cible") or "").startswith("status:"):
            continue
        regle["declencheur"] = declencheur_recharge(source, texte)
        if recharge_interne:
            regle["rechargeInterne"] = float(recharge_interne.group(1))
    return regles


def extraire_recharges(source, texte):
    regles = []
    for trouve in BONUS_REDUCTION_RECHARGE_PLATE.finditer(texte):
        regles.append({
            "type": "recharge-plate",
            "cible": CATEGORIES[trouve.group(1).lower()],
            "secondes": float(trouve.group(2)),
            "mode": "amplification-reduction",
        })
    for trouve in BONUS_REDUCTION_RECHARGE.finditer(texte):
        regles.append({
            "type": "recharge-taux",
            "cible": CATEGORIES[trouve.group(1).lower()],
            "valeur": round(float(trouve.group(2)) * 100),
            "mode": "amplification-reduction",
        })
    if RESET_TOUTES.search(texte):
        regles.append({
            "type": "recharge-taux",
            "cible": "all-skills",
            "valeur": 10000,
            "condition": "active-max",
            "mode": "passif-max",
        })
    for trouve in BONUS_RECHARGE.finditer(texte):
        regles.append({
            "type": "recharge-taux",
            "cible": "all-skills",
            "valeur": round(float(trouve.group(1)) * int(trouve.group(2)) * 100),
            "condition": "active-max",
            "mode": "passif-max",
            "application": "base",
        })
    for trouve in RECHARGE_TAUX.finditer(texte):
        regles.append({
            "type": "recharge-taux",
            "cible": CATEGORIES[trouve.group(1).lower()],
            "valeur": round(float(trouve.group(2)) * 100),
            "mode": "passif-max",
        })
    for trouve in RECHARGE_PLATE.finditer(texte):
        regles.append({
            "type": "recharge-plate",
            "cible": CATEGORIES[trouve.group(1).lower()],
            "secondes": float(trouve.group(2)),
            "mode": "passif-max",
        })
    for trouve in INTERVALLE_DOT.finditer(texte):
        regles.append({
            "type": "recharge-taux",
            "cible": "periodic",
            "valeur": round(float(trouve.group(1)) * 100),
            "mode": "passif-max",
        })
    for trouve in RESET_RECHARGE.finditer(texte):
        regles.append({
            "type": "recharge-taux",
            "cible": CATEGORIES[trouve.group(1).lower()],
            "valeur": 10000,
            "mode": "passif-max",
        })
    if not RESET_RECHARGE.search(texte) and RESET_SELF.search(texte):
        regles.append({
            "type": "recharge-taux",
            "cible": "self",
            "valeur": 10000,
            "condition": "active-max",
            "mode": "passif-max",
        })
    if RESET_SELF_PASSIF.search(texte):
        regle = {
            "type": "recharge-taux",
            "cible": "self",
            "valeur": 10000,
            "condition": "active-max",
            "mode": "passif-max",
        }
        maximum = MAX_RESET_CONSECUTIF.search(texte)
        if maximum:
            regle["maxDeclenchementsConsecutifs"] = int(maximum.group(1))
        regles.append(regle)
    if not RECHARGE_TAUX.search(texte):
        for trouve in RECHARGE_SELF_TAUX.finditer(texte):
            regles.append({
                "type": "recharge-taux",
                "cible": "self",
                "valeur": round(float(trouve.group(1)) * 100),
                "mode": "passif-max",
            })
    if not RECHARGE_PLATE.search(texte):
        for trouve in RECHARGE_SELF_PLATE.finditer(texte):
            regles.append({
                "type": "recharge-plate",
                "cible": "self",
                "secondes": float(trouve.group(1)),
                "mode": "passif-max",
            })
    return temporaliser_recharges(source, texte, regles)


def extraire_resistances(texte):
    regles = []
    for trouve in RESISTANCE_CRITIQUE_REDUCTION.finditer(texte):
        regles.append({
            "type": "bonus-critique",
            "stat": ("targetCritResist"
                     if trouve.group(1).lower() == "crit resistance"
                     else "targetCritDmgResist"),
            "valeur": -round(float(trouve.group(2)) * 100),
            "mode": "passif-max",
        })
    for trouve in RESISTANCE_ELEMENT_REDUCTION.finditer(texte):
        nom = trouve.group(1).lower()
        regles.append({
            "type": "resistance-elementaire",
            "element": "all" if nom == "all element" else ELEMENTS[nom],
            "valeur": -round(float(trouve.group(2)) * 100),
            "mode": "passif-max",
        })
    for trouve in RESISTANCE_CRITIQUE.finditer(texte):
        regles.append({
            "type": "bonus-critique",
            "stat": ("targetCritResist" if trouve.group(1).lower() == "crit resistance"
                     else "targetCritDmgResist"),
            "valeur": -round(float(trouve.group(2)) * 100),
            "mode": "passif-max",
        })
    for trouve in RESISTANCE_ELEMENT.finditer(texte):
        nom = trouve.group(1).lower()
        regles.append({
            "type": "resistance-elementaire",
            "element": "all" if nom == "all element" else ELEMENTS[nom],
            "valeur": -round(float(trouve.group(2)) * 100),
            "mode": "passif-max",
        })
    for trouve in RESISTANCE_ELEMENT_PASSIVE.finditer(texte):
        nom = trouve.group(1).lower()
        regles.append({
            "type": "resistance-elementaire",
            "element": "all" if nom == "all element" else ELEMENTS[nom],
            "valeur": -round(float(trouve.group(2)) * 100),
            "mode": "passif-max",
        })
    for trouve in DEFENSE_CIBLE.finditer(texte):
        regles.append({
            "type": "bonus-stat",
            "stat": "targetDefRate",
            "valeur": -round(float(trouve.group(1)) * 100),
            "mode": "passif-max",
        })
    for trouve in SHATTER_CIBLE.finditer(texte):
        regles.append({
            "type": "bonus-stat",
            "stat": "targetShatterResist",
            "valeur": -round(float(trouve.group(1)) * 100),
            "mode": "passif-max",
        })
    return regles


def extraire_critiques_garantis(texte):
    regles = []
    for trouve in BONUS_CRITIQUE_EFFET.finditer(texte):
        regles.append({
            "type": "bonus-critique",
            "stat": ("critRate" if trouve.group(1).lower() == "crit chance"
                     else "critDamage"),
            "valeur": round(float(trouve.group(2)) * 100),
            "condition": "active-max",
            "mode": "passif-max",
        })
    if CRITIQUE_GARANTI.search(texte):
        regles.append({
            "type": "bonus-critique",
            "stat": "critGuaranteed",
            "valeur": 10000,
            "condition": "active-max",
            "mode": "passif-max",
        })
    return regles


def extraire_utilisations(texte):
    regles = []
    for trouve in UTILISATIONS.finditer(texte):
        regles.append({
            "type": "deblocage-competence",
            "cible": CATEGORIES[trouve.group(1).lower()],
            "utilisations": int(trouve.group(2)),
            "mode": "passif-max",
        })
    return regles


def normaliser_effet(source):
    """Transforme une prose source en règles fermées ou refuse son ambiguïté."""
    source_id = source["id"]
    texte = BALISE.sub("", source.get("textEn") or "").strip()
    audit_texte = texte_a_auditer(source, texte)
    base = {
        "id": source_id,
        "texteFr": source.get("textFr"),
        "provenance": source.get("provenance"),
    }

    if source_id in NON_INCLUS_SPECIFIQUES:
        return dict(
            base,
            classification="non-inclus",
            regles=[],
            raison=NON_INCLUS_SPECIFIQUES[source_id],
        )

    if source_id in SANS_IMPACT_SPECIFIQUES:
        return dict(
            base,
            classification="sans-impact-dps",
            regles=[],
            raison=SANS_IMPACT_SPECIFIQUES[source_id],
        )

    if source_id in REGLES_SPECIFIQUES:
        return dict(
            base,
            classification="modelise",
            regles=avec_source(REGLES_SPECIFIQUES[source_id], source_id),
        )

    bonus = BONUS_CATEGORIE_MAX.search(texte)
    if bonus:
        regle = {
            "type": "bonus-degats",
            "cible": CATEGORIES[bonus.group(1).lower()],
            "valeur": round(float(bonus.group(2)) * 100),
            "mode": "passif-max",
        }
        return dict(
            base,
            classification="modelise",
            regles=avec_source([regle], source_id),
        )

    recharge = RECHARGE_PERIODIQUE.search(texte)
    if recharge:
        condition = re.sub(r"[^a-z0-9]+", "-", recharge.group(1).lower()).strip("-")
        regle = {
            "type": "recharge-periodique",
            "cible": CATEGORIES[recharge.group(2).lower()],
            "secondes": float(recharge.group(3)),
            "intervalle": float(recharge.group(4)),
            "condition": condition,
        }
        return dict(
            base,
            classification="modelise",
            regles=avec_source([regle], source_id),
        )

    regles_max = extraire_bonus_max(source, texte)
    regles_max.extend(extraire_bonus_conditionnels(texte))
    regles_max.extend(extraire_degats_additionnels(source, texte))
    regles_max.extend(extraire_statuts_periodiques(texte))
    regles_max.extend(extraire_recharges(source, texte))
    regles_max.extend(extraire_resistances(texte))
    regles_max.extend(extraire_critiques_garantis(texte))
    regles_max.extend(extraire_utilisations(texte))
    if regles_max:
        return dict(
            base,
            classification="modelise",
            regles=avec_source(regles_max, source_id),
        )

    if not texte or not audit_texte:
        return dict(base, classification="sans-impact-dps", regles=[])

    if RESSOURCES_ILLIMITEES.search(audit_texte):
        return dict(base, classification="sans-impact-dps", regles=[])

    # L'efficacite de Deluge remplit une jauge de reaction elementaire ; elle
    # ne modifie ni les degats d'une competence ni son temps de recharge.
    if (EFFET_EFFICACITE_DELUGE_SEUL.fullmatch(audit_texte)
            or EFFET_RESISTANCE_DELUGE_SEUL.fullmatch(audit_texte)):
        return dict(base, classification="sans-impact-dps", regles=[])

    if SANS_IMPACT.search(audit_texte):
        residuel_offensif = SANS_IMPACT.sub("", audit_texte)
        # Le temps de recharge interne d'un pur effet utilitaire ne change pas
        # la disponibilite des competences du heros. Cette parenthese porte les
        # metadonnees de l'effet, pas une interaction : elle se presente seule
        # (« (Cooldown: 30 sec) ») ou precedee d'un qualificatif
        # (« (Fixed duration, Cooldown: 30 sec) »). N'en retirer que la premiere
        # forme laissait le mot « cooldown » dans le residuel, et un pur regain
        # d'endurance finissait non classe.
        residuel_offensif = re.sub(
            r"\([^()]*\bCooldown:\s*\d+(?:\.\d+)?\s*sec\)",
            "",
            residuel_offensif,
            flags=re.IGNORECASE,
        )
        if not INTERACTION_ACTIVE_DPS.search(residuel_offensif):
            return dict(base, classification="sans-impact-dps", regles=[])

    if EQUIPE.search(texte):
        return dict(base, classification="non-inclus", regles=[])

    if source.get("coefficientDejaCalcule"):
        if INTERACTION_ACTIVE_DPS.search(texte):
            raise ValueError("effet DPS non classe: %s" % source_id)
        return dict(base, classification="sans-impact-dps", regles=[])

    if MOTS_DPS.search(audit_texte):
        raise ValueError("effet DPS non classe: %s" % source_id)
    return dict(base, classification="sans-impact-dps", regles=[])


def collecter_sources(characters, weapons, armors, engraved, sets, hero_skills):
    """Collecte chaque niveau textuel avec une identité stable et sa portée."""
    sources = []
    couverture = couverture_des_potentiels()

    for hero in characters:
        slug = hero["slug"]
        for potentiel in hero.get("potentials") or []:
            sources.append({
                "id": "potential:%s:%s:%s" % (
                    slug, potentiel["weaponType"], potentiel["tier"]
                ),
                "kind": "potential",
                "hero": slug,
                "weaponType": potentiel["weaponType"],
                "tier": potentiel["tier"],
                "textEn": potentiel.get("bonusEn") or "",
                "textFr": potentiel.get("bonusFr") or "",
                # La source reste crue quand elle parle ; le catalogue tranche
                # quand elle se tait. Voir couverture_des_potentiels().
                "statsDejaCalculees": bool(potentiel.get("stats")) or (
                    slug, potentiel["weaponType"], potentiel["tier"]
                ) in couverture,
                "provenance": "7ds-stats/personnages.json",
            })

    for weapon in weapons:
        for niveau in weapon.get("passiveLevels") or []:
            sources.append({
                "id": "weapon:%s:%s" % (weapon["slug"], niveau["level"]),
                "kind": "weapon",
                "weapon": weapon["slug"],
                "weaponType": weapon["weaponType"],
                "level": niveau["level"],
                "textEn": niveau.get("descEn") or "",
                "textFr": niveau.get("descFr") or "",
                "provenance": "7ds-stats/armes.json",
            })

    for armor in armors:
        passif = armor.get("equipPassive")
        if not passif:
            continue
        for niveau in passif.get("levels") or []:
            sources.append({
                "id": "armor:%s:%s:%s" % (
                    armor["gameId"], passif["id"], niveau["level"]
                ),
                "kind": "armor",
                "gear": armor["gameId"],
                "slug": armor.get("slug"),
                "passive": passif["id"],
                "level": niveau["level"],
                "textEn": niveau.get("descEn") or "",
                "textFr": niveau.get("descFr") or "",
                "provenance": "7ds-stats/armures.json",
            })

    for item in engraved:
        for passif in item.get("engravingPassives") or []:
            for niveau in passif.get("levels") or []:
                sources.append({
                    "id": "engraving:%s:%s:%s" % (
                        item["gameId"], passif["id"], niveau["level"]
                    ),
                    "kind": "engraving",
                    "gear": item["gameId"],
                    "slug": item.get("costumeSlug"),
                    "passive": passif["id"],
                    "level": niveau["level"],
                    "textEn": niveau.get("descEn") or "",
                    "textFr": niveau.get("descFr") or "",
                    "provenance": "7ds-stats/armures-gravees.json",
                })

    for ensemble in sets:
        for palier, texte_en, texte_fr, stats in (
            ("two", ensemble.get("bonusTwoEn"), ensemble.get("bonusTwoFr"),
             ensemble.get("bonusTwoStats")),
            ("four", ensemble.get("bonusFourEn"), ensemble.get("bonusFourFr"),
             ensemble.get("bonusFourStats")),
            ("seven", ensemble.get("bonusSevenEn"), ensemble.get("bonusSevenFr"),
             ensemble.get("bonusSevenStats")),
        ):
            if texte_en is None and not stats:
                continue
            sources.append({
                "id": "set:%s:%s" % (ensemble["gameId"], palier),
                "kind": "set",
                "set": ensemble["gameId"],
                "threshold": palier,
                "textEn": texte_en or "",
                "textFr": texte_fr or "",
                "statsDejaCalculees": bool(stats),
                "provenance": "7ds-stats/sets.json",
            })

    for skill in hero_skills:
        game_id = skill.get("gameId") or skill.get("id")
        if not game_id:
            continue
        kind = ("hero-passive" if skill.get("skillCategory") == "PASSIVE"
                else "skill")
        sources.append({
            "id": ("hero-passive:" if kind == "hero-passive" else "skill:")
                  + game_id,
            "kind": kind,
            "hero": skill.get("hero"),
            "weaponType": skill.get("weaponType"),
            "gameId": game_id,
            "textEn": skill.get("descriptionEn") or "",
            "textFr": skill.get("descriptionFr") or "",
            "provenance": "7dsorigin.app/characters",
            "coefficientDejaCalcule": kind == "skill",
        })

    return sources


def _range_source(catalogue, source, resultat):
    kind = source["kind"]
    if kind == "potential":
        arme = catalogue["heroes"].setdefault(source["hero"], {}).setdefault(
            source["weaponType"], {"potentials": {}, "passives": {}}
        )
        arme["potentials"][str(source["tier"])] = resultat
    elif kind == "hero-passive":
        arme = catalogue["heroes"].setdefault(source["hero"], {}).setdefault(
            source["weaponType"], {"potentials": {}, "passives": {}}
        )
        arme["passives"][source["gameId"]] = resultat
    elif kind == "skill":
        catalogue["skills"][source["gameId"]] = dict(
            resultat,
            hero=source.get("hero"),
            weaponType=source.get("weaponType"),
        )
    elif kind == "weapon":
        entree = catalogue["weapons"].setdefault(source["weapon"], {"levels": {}})
        entree["levels"][str(source["level"])] = resultat
    elif kind in {"armor", "engraving"}:
        famille = "armors" if kind == "armor" else "engravings"
        entree = catalogue["gear"][famille].setdefault(
            source["gear"], {
                "slug": source.get("slug"),
                "passives": {},
            }
        )
        niveaux = entree["passives"].setdefault(source["passive"], {})
        niveaux[str(source["level"])] = resultat
    elif kind == "set":
        entree = catalogue["sets"].setdefault(source["set"], {"bonuses": {}})
        entree["bonuses"][source["threshold"]] = resultat


def construire_catalogue(sources):
    """Normalise, valide et indexe les sources sans doublon silencieux."""
    catalogue = {
        "version": 1,
        "heroes": {},
        "skills": {},
        "weapons": {},
        "gear": {"armors": {}, "engravings": {}},
        "sets": {},
        "audit": {"total": 0, "inconnus": 0, "sources": []},
    }
    vus = set()
    for source in sources:
        if source["id"] in vus:
            raise ValueError("effet duplique: %s" % source["id"])
        vus.add(source["id"])
        resultat = normaliser_effet(source)
        if resultat["classification"] not in CLASSIFICATIONS:
            raise ValueError("classification inconnue: %s" % source["id"])
        for regle in resultat["regles"]:
            if regle.get("type") not in TYPES_REGLES:
                raise ValueError("type de regle inconnu: %s" % source["id"])
            if regle.get("sourceId") != source["id"]:
                raise ValueError("source de regle absente: %s" % source["id"])
        _range_source(catalogue, source, resultat)
        catalogue["audit"]["sources"].append({
            "id": source["id"],
            "classification": resultat["classification"],
            "regles": resultat["regles"],
        })
    catalogue["audit"]["total"] = len(sources)
    catalogue["skills"]["merlin_wand_divine_judgment"] = {
        "synthetic": True,
        "nom": "Divine Judgment",
        "weaponType": "Wand",
        "categorie": "NORMAL_SKILL",
        "recharge": 19.9,
        "composantes": [{"base": "atk", "pourcentage": 329.0}],
        "periodique": None,
        "regles": avec_source(
            REGLES_SPECIFIQUES["skill:merlin_wand_divine_judgment"],
            "skill:merlin_wand_divine_judgment",
        ),
        "provenance": "description de merlin_wand_skill_e_enchant",
    }
    catalogue["skills"]["merlin_wand_overdrive"] = {
        "synthetic": True,
        "nom": "Overdrive",
        "weaponType": "Wand",
        "categorie": "ACTIVE_THIRD",
        "recharge": 16.5,
        "composantes": [{"base": "atk", "pourcentage": 416.0}],
        "periodique": None,
        "regles": [],
        "provenance": "potential:merlin:Wand:10",
    }
    return catalogue


def extraire_skills_payload(slug, payload):
    """Extrait passifs et actifs d'une fiche, sans doublon de rendu RSC.

    LA DESCRIPTION FRANCAISE SE RESOUT, elle ne se lit pas telle quelle. La
    fiche range ses textes longs a part dans le flux et n'en garde qu'un
    renvoi - « $1a3 ». `generate-wiki.py` le suit depuis toujours ; ce
    generateur-ci ne le faisait pas, et les 393 competences du catalogue
    sortaient avec `texteFr` vide.

    Le classement ne s'en trouve pas fausse : il tourne sur `textEn`. Mais la
    liste des effets NON INCLUS d'une fiche de heros affiche `texteFr` et
    retombe sur l'identifiant quand il manque - un membre y lisait
    « ban_gauntlets_skill_e » au lieu de la phrase du jeu.
    """
    morceaux = _wiki.morceaux_de_texte(payload)
    skills = []
    vus = set()
    for brut in _competences.objets_portant(payload, "skillCategory"):
        try:
            skill = json.loads(brut)
        except ValueError:
            continue
        game_id = skill.get("gameId") or skill.get("id")
        if not game_id or game_id in vus or not skill.get("weaponType"):
            continue
        if not skill.get("skillCategory"):
            continue
        vus.add(game_id)
        skill["hero"] = slug
        skill["descriptionFr"] = _wiki.resout(
            skill.get("descriptionFr"), morceaux
        ) or ""
        # Un renvoi non resolu est pire qu'une absence : il s'afficherait tel
        # quel, « $1a3 », dans la liste des effets non inclus.
        if _wiki.RENVOI.match(skill["descriptionFr"]):
            raise ValueError(
                "renvoi non resolu %s (%s/%s)"
                % (skill["descriptionFr"], slug, game_id)
            )
        skills.append(skill)
    return skills


def charger_hero_skills(characters):
    skills = []
    for hero in characters:
        slug = hero["slug"]
        page = fetch(FICHE.format(slug=slug))
        payload = flight_payload(page)
        trouves = extraire_skills_payload(slug, payload)
        skills.extend(trouves)
        print(slug, ":", len(trouves), "competences et passifs")
    return skills


def charge_json(nom):
    return json.loads((RACINE / "7ds-stats" / nom).read_text(encoding="utf-8"))


# Les trois codes sous lesquels le catalogue de build range la forme de base
# d'un potentiel : « Augmente l'attaque de X%, la défense de Y% et les PV max
# de Z% ». `stats-calcul` les replie sur B_Atk / B_Def / B_MaxHp.
STATS_DE_BASE_DU_CATALOGUE = frozenset(
    ("I_AtkAdd_Rate", "I_DefAdd_Rate", "I_MaxHpAdd_Rate")
)


def couverture_des_potentiels():
    """Ce que `stats-calcul` compte déjà seul, lu dans l'artefact lui-même.

    LE GARDE NE DOIT PAS JUGER SUR UNE AUTRE SOURCE QUE CELLE QUI COMPTE. Il
    se posait sur le champ `stats` de `7ds-stats/personnages.json` ; trois
    héros — ban, derieri, gowther — en sortent avec `stats: []` sur leurs
    trente paliers, et `generate-stats-build.py` reconstruit alors leurs
    chiffres depuis la prose. Le garde jugeait donc sur une source que le
    catalogue avait déjà dépassée : il ne se déclenchait pas, une règle
    `bonus-stat` était émise en plus, et `dps-effets` la réappliquait sur un
    total qui la contenait déjà. L'attaque de ces trois-là ressortait à
    x1,69 au lieu de x1,30 au palier 10.

    On lit désormais `data/stats-build.js`, le fichier que la PWA charge
    vraiment. La question posée devient exactement celle à laquelle
    `stats-calcul` répond, et aucune dérive entre les deux générateurs ne peut
    plus la rendre fausse.
    """
    texte = (RACINE / "data" / "stats-build.js").read_text(encoding="utf-8")
    corps = texte[texte.index("{"):texte.rindex("}") + 1]
    catalogue = json.loads(corps)
    couverture = set()
    for slug, fiche in (catalogue.get("charactersBySlug") or {}).items():
        for arme, paliers in (fiche.get("potentialsByWeapon") or {}).items():
            for palier, entrees in (paliers or {}).items():
                codes = {item["stat"] for item in entrees or []}
                stats_de_base = codes & STATS_DE_BASE_DU_CATALOGUE
                if stats_de_base and stats_de_base != STATS_DE_BASE_DU_CATALOGUE:
                    raise ValueError(
                        "data/stats-build.js porte une couverture partielle "
                        "du potentiel %s/%s palier %s" % (slug, arme, palier)
                    )
                if stats_de_base == STATS_DE_BASE_DU_CATALOGUE:
                    couverture.add((slug, arme, int(palier)))
    if not couverture:
        raise ValueError(
            "data/stats-build.js ne porte aucun potentiel : "
            "le garde anti-double-comptage serait desarme"
        )
    return couverture


def rendu(catalogue):
    corps = json.dumps(catalogue, ensure_ascii=False, separators=(",", ":"))
    return (
        "// Genere par generate-effets-dps.py depuis les references locales\n"
        "// et les fiches personnage publiques de 7dsorigin.app.\n"
        "window.SEVEN_DS_EFFETS_DPS = " + corps + ";\n"
    )


def main(argv=None, cible=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args(argv)
    cible = Path(cible) if cible else RACINE / "data" / "effets-dps.js"

    if args.check:
        if not cible.exists():
            raise SystemExit("effets-dps.js doit etre genere")
        if "window.SEVEN_DS_EFFETS_DPS" not in cible.read_text(encoding="utf-8"):
            raise SystemExit("effets-dps.js invalide")
        print("effets-dps.js present")
        return 0

    characters = charge_json("personnages.json")
    hero_skills = charger_hero_skills(characters)
    sources = collecter_sources(
        characters,
        charge_json("armes.json"),
        charge_json("armures.json"),
        charge_json("armures-gravees.json"),
        charge_json("sets.json"),
        hero_skills,
    )
    catalogue = construire_catalogue(sources)
    cible.write_text(rendu(catalogue), encoding="utf-8", newline="\n")
    print("effets-dps.js genere :", catalogue["audit"]["total"], "sources")
    return 0


if __name__ == "__main__":
    main()
