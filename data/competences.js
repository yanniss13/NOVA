// Genere par generate-competences.py depuis 7dsorigin.app ;
// recharges combat precisees depuis SevenCodex.
// Cle = slug personnage. Les passifs sont exclus ; toute autre
// competence figure ici, meme celle qu'on ne sait pas chiffrer.
// pourcentage = % de l'ATK pour un lancement, null si non chiffrable.
// nature : direct | duree (tick x ticks) | non-chiffree.
// repartition = % par coup, quand la source la publie.
window.SEVEN_DS_COMPETENCES = {
 "bug": [
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 185.0
    }
   ],
   "coups": 6,
   "gameId": "bug_axe_jumpatk",
   "nature": "direct",
   "nom": "Shadow Cleaver",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 185.0,
   "recharge": null,
   "repartition": [
    25.0,
    24.0,
    26.0,
    41.0,
    69.0
   ],
   "weaponType": "Axe"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 188.0
    }
   ],
   "coups": 1,
   "gameId": "bug_axe_skill_e",
   "nature": "direct",
   "nom": "Dark Thrash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 188.0,
   "recharge": 14.0,
   "repartition": [],
   "weaponType": "Axe"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 380.0
    }
   ],
   "coups": null,
   "gameId": "bug_axe_skill_q",
   "nature": "direct",
   "nom": "Death Swarm",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 380.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Axe"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 1072.0
    }
   ],
   "coups": 11,
   "gameId": "bug_axe_skill_rmb_ready",
   "nature": "direct",
   "nom": "Abyss Smasher",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 1072.0,
   "recharge": 16.0,
   "repartition": [
    166.0,
    166.0,
    166.0,
    237.0,
    237.0,
    100.0
   ],
   "weaponType": "Axe"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 129.0
    }
   ],
   "coups": 1,
   "gameId": "bug_axe_skill_tag",
   "nature": "direct",
   "nom": "Dark Axe Slash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 129.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Axe"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 111.0
    }
   ],
   "coups": 5,
   "gameId": "bug_book_normalatk_1_enchant",
   "nature": "direct",
   "nom": "Dark Punch",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 111.0,
   "recharge": null,
   "repartition": [
    17.0,
    18.0,
    28.0,
    48.0
   ],
   "weaponType": "Book"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [],
   "coups": null,
   "gameId": "bug_book_skill_e",
   "nature": "non-chiffree",
   "nom": "The Rascal",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": null,
   "recharge": 20.0,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 191.0
    }
   ],
   "coups": null,
   "gameId": "bug_book_skill_q",
   "nature": "direct",
   "nom": "Solo Stage",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 191.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [],
   "coups": null,
   "gameId": "bug_book_skill_rmb",
   "nature": "non-chiffree",
   "nom": "Dark Burst Activation",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": null,
   "recharge": 15.0,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 56.0
    }
   ],
   "coups": 1,
   "gameId": "bug_book_skill_tag",
   "nature": "direct",
   "nom": "Dark Flare",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 56.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 187.0
    }
   ],
   "coups": 13,
   "gameId": "bug_sworddual_jumpatk",
   "nature": "direct",
   "nom": "Dual Shadow Slash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 187.0,
   "recharge": null,
   "repartition": [
    25.0,
    24.0,
    26.0,
    42.0,
    70.0
   ],
   "weaponType": "SwordDual"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 263.0
    }
   ],
   "coups": 2,
   "gameId": "bug_sworddual_skill_e",
   "nature": "direct",
   "nom": "Annihilation",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 263.0,
   "recharge": 20.9,
   "repartition": [],
   "weaponType": "SwordDual"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 326.0
    }
   ],
   "coups": 5,
   "gameId": "bug_sworddual_skill_q",
   "nature": "direct",
   "nom": "The End",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 326.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "SwordDual"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 165.0
    }
   ],
   "coups": 1,
   "gameId": "bug_sworddual_skill_rmb",
   "nature": "direct",
   "nom": "Dual Abyss Slash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 165.0,
   "recharge": 14.0,
   "repartition": [],
   "weaponType": "SwordDual"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 120.0
    }
   ],
   "coups": 4,
   "gameId": "bug_sworddual_skill_tag",
   "nature": "direct",
   "nom": "Blade Dance",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 120.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "SwordDual"
  }
 ],
 "daisy": [
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 100.0
    }
   ],
   "coups": 1,
   "gameId": "daisy_book_jumpatk",
   "nature": "direct",
   "nom": "Fruit Bomb",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 100.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 120.0
    }
   ],
   "coups": null,
   "gameId": "daisy_book_skill_e",
   "nature": "duree",
   "nom": "Summon Shocking Streetlamp",
   "periodique": {
    "base": "atk",
    "duree": 20.0,
    "intervalle": 1.0,
    "pourcentageParTick": 6.0,
    "ticks": 20
   },
   "portee": "Melee",
   "pourcentage": 120.0,
   "recharge": 12.0,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 178.0
    }
   ],
   "coups": null,
   "gameId": "daisy_book_skill_q",
   "nature": "direct",
   "nom": "Fruit Barrage!",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 178.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [],
   "coups": null,
   "gameId": "daisy_book_skill_rmb",
   "nature": "non-chiffree",
   "nom": "Shocking Awakening!",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": null,
   "recharge": 8.4,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 54.0
    }
   ],
   "coups": 1,
   "gameId": "daisy_book_skill_tag",
   "nature": "direct",
   "nom": "Here Comes Daisy",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 54.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 181.0
    }
   ],
   "coups": 5,
   "gameId": "daisy_shield_jumpatk",
   "nature": "direct",
   "nom": "Secret Fairy Technique: Wild Swings",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 181.0,
   "recharge": null,
   "repartition": [
    25.0,
    23.0,
    25.0,
    41.0,
    67.0
   ],
   "weaponType": "Shield"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [],
   "coups": null,
   "gameId": "daisy_shield_skill_e",
   "nature": "non-chiffree",
   "nom": "Help Me, Domby",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": null,
   "recharge": 15.0,
   "repartition": [],
   "weaponType": "Shield"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 319.0
    }
   ],
   "coups": 1,
   "gameId": "daisy_shield_skill_q",
   "nature": "direct",
   "nom": "Go Away",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 319.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Shield"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [],
   "coups": null,
   "gameId": "daisy_shield_skill_rmb_ready",
   "nature": "non-chiffree",
   "nom": "Block It, Domby",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": null,
   "recharge": 12.0,
   "repartition": [],
   "weaponType": "Shield"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 160.0
    }
   ],
   "coups": 1,
   "gameId": "daisy_shield_skill_tag",
   "nature": "direct",
   "nom": "Here Comes Daisy",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 160.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Shield"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 102.0
    }
   ],
   "coups": 1,
   "gameId": "daisy_wand_jumpatk",
   "nature": "direct",
   "nom": "Fairy's Command",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 102.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Wand"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 106.0
    }
   ],
   "coups": null,
   "gameId": "daisy_wand_skill_e",
   "nature": "direct",
   "nom": "Seed Bomb",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 106.0,
   "recharge": 18.2,
   "repartition": [],
   "weaponType": "Wand"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [],
   "coups": null,
   "gameId": "daisy_wand_skill_q",
   "nature": "non-chiffree",
   "nom": "Oddball's Incense Burner",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": null,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Wand"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 98.0
    }
   ],
   "coups": 2,
   "gameId": "daisy_wand_skill_rmb_ready",
   "nature": "direct",
   "nom": "Flash Fruit",
   "periodique": {
    "base": "atk",
    "duree": 5.0,
    "intervalle": 0.8,
    "pourcentageParTick": 11.0,
    "ticks": 6
   },
   "portee": "Melee",
   "pourcentage": 43.0,
   "recharge": 16.0,
   "repartition": [
    11.0,
    32.0
   ],
   "weaponType": "Wand"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 59.0
    }
   ],
   "coups": 1,
   "gameId": "daisy_wand_skill_tag",
   "nature": "direct",
   "nom": "Here Comes Daisy",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 59.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Wand"
  }
 ],
 "derieri": [
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 94.0
    }
   ],
   "coups": null,
   "gameId": "derieri_axe_jumpatk",
   "nature": "direct",
   "nom": "Night Assault",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 94.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Axe"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 206.0
    }
   ],
   "coups": null,
   "gameId": "derieri_axe_skill_e",
   "nature": "direct",
   "nom": "Rising Cross",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 206.0,
   "recharge": 21.0,
   "repartition": [],
   "weaponType": "Axe"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 142.0
    }
   ],
   "coups": null,
   "gameId": "derieri_axe_skill_q",
   "nature": "direct",
   "nom": "Axe Throw",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 142.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Axe"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 313.0
    }
   ],
   "coups": null,
   "gameId": "derieri_axe_skill_r",
   "nature": "direct",
   "nom": "Darkfall Cleave",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 313.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Axe"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 56.0
    }
   ],
   "coups": null,
   "gameId": "derieri_axe_skill_tag",
   "nature": "direct",
   "nom": "Abyssal Stab",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 56.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Axe"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 164.0
    }
   ],
   "coups": null,
   "gameId": "derieri_gauntlets_jumpatk",
   "nature": "direct",
   "nom": "Beat Rush",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 164.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 501.0
    }
   ],
   "coups": null,
   "gameId": "derieri_gauntlets_skill_e_1",
   "nature": "direct",
   "nom": "Chasing Kick",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 501.0,
   "recharge": 25.0,
   "repartition": [],
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [],
   "coups": null,
   "gameId": "derieri_gauntlets_skill_q_1",
   "nature": "non-chiffree",
   "nom": "Wild Rush",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": null,
   "recharge": 17.0,
   "repartition": [],
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 1150.0
    }
   ],
   "coups": null,
   "gameId": "derieri_gauntlets_skill_r_enchant",
   "nature": "direct",
   "nom": "\"Combo Star\"",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 1150.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 120.0
    }
   ],
   "coups": null,
   "gameId": "derieri_gauntlets_skill_tag",
   "nature": "direct",
   "nom": "Drop Slam",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 120.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 90.0
    }
   ],
   "coups": null,
   "gameId": "derieri_sword2h_jumpatk",
   "nature": "direct",
   "nom": "Blade Brawl",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 90.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Sword2h"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 30.0
    },
    {
     "base": "atk",
     "pourcentage": 114.0
    }
   ],
   "coups": null,
   "gameId": "derieri_sword2h_skill_e",
   "nature": "direct",
   "nom": "Rending Slam",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 114.0,
   "recharge": 27.0,
   "repartition": [],
   "weaponType": "Sword2h"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 66.0
    },
    {
     "base": "def",
     "pourcentage": 20.0
    }
   ],
   "coups": null,
   "gameId": "derieri_sword2h_skill_q",
   "nature": "direct",
   "nom": "Cross Cleave",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 66.0,
   "recharge": 16.0,
   "repartition": [],
   "weaponType": "Sword2h"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 2030.0
    }
   ],
   "coups": null,
   "gameId": "derieri_sword2h_skill_r",
   "nature": "duree",
   "nom": "Inferno Quake",
   "periodique": {
    "base": "atk",
    "duree": 10.0,
    "intervalle": 1.0,
    "pourcentageParTick": 203.0,
    "ticks": 10
   },
   "portee": "Melee",
   "pourcentage": 2030.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Sword2h"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 56.0
    }
   ],
   "coups": null,
   "gameId": "derieri_sword2h_skill_tag",
   "nature": "direct",
   "nom": "Rising Claw",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 56.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Sword2h"
  }
 ],
 "diane": [
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 134.0
    }
   ],
   "coups": 5,
   "gameId": "diane_axe_jumpatk",
   "nature": "direct",
   "nom": "Earth Cleaver",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 134.0,
   "recharge": null,
   "repartition": [
    25.0,
    26.0,
    31.0,
    52.0
   ],
   "weaponType": "Axe"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 205.0
    }
   ],
   "coups": 1,
   "gameId": "diane_axe_skill_e",
   "nature": "direct",
   "nom": "Charged Slash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 205.0,
   "recharge": 20.0,
   "repartition": [],
   "weaponType": "Axe"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 371.0
    }
   ],
   "coups": null,
   "gameId": "diane_axe_skill_q",
   "nature": "direct",
   "nom": "Rock Blast",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 371.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Axe"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 407.0
    }
   ],
   "coups": 3,
   "gameId": "diane_axe_skill_rmb_ready",
   "nature": "direct",
   "nom": "Quake Smash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 407.0,
   "recharge": 25.0,
   "repartition": [
    100.0,
    307.0
   ],
   "weaponType": "Axe"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 143.0
    }
   ],
   "coups": 1,
   "gameId": "diane_axe_skill_tag",
   "nature": "direct",
   "nom": "Ground Down",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 143.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Axe"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 112.2
    }
   ],
   "coups": 12,
   "gameId": "diane_cudgel3c_jumpatk",
   "nature": "direct",
   "nom": "Earth Strike",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 112.2,
   "recharge": null,
   "repartition": [
    25.0,
    13.0,
    14.0,
    23.2,
    37.0
   ],
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 160.0
    }
   ],
   "coups": null,
   "gameId": "diane_cudgel3c_skill_e",
   "nature": "duree",
   "nom": "Desert Sands",
   "periodique": {
    "base": "atk",
    "duree": 10.0,
    "intervalle": 1.0,
    "pourcentageParTick": 16.0,
    "ticks": 10
   },
   "portee": "Melee",
   "pourcentage": 160.0,
   "recharge": 30.0,
   "repartition": [],
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 219.0
    }
   ],
   "coups": 1,
   "gameId": "diane_cudgel3c_skill_q",
   "nature": "direct",
   "nom": "Ground Rising",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 219.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 96.0
    }
   ],
   "coups": null,
   "gameId": "diane_cudgel3c_skill_rmb",
   "nature": "direct",
   "nom": "Terra Shot",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 96.0,
   "recharge": 20.0,
   "repartition": [],
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 72.0
    }
   ],
   "coups": 4,
   "gameId": "diane_cudgel3c_skill_tag",
   "nature": "direct",
   "nom": "Crushing Art",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 72.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 188.0
    }
   ],
   "coups": 13,
   "gameId": "diane_gauntlets_jumpatk",
   "nature": "direct",
   "nom": "Terra Punch",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 188.0,
   "recharge": null,
   "repartition": [
    25.0,
    25.0,
    47.0,
    37.0,
    54.0
   ],
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 181.0
    }
   ],
   "coups": 2,
   "gameId": "diane_gauntlets_skill_e",
   "nature": "direct",
   "nom": "Martial Drive",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 181.0,
   "recharge": 15.0,
   "repartition": [],
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 278.0
    }
   ],
   "coups": 2,
   "gameId": "diane_gauntlets_skill_q",
   "nature": "direct",
   "nom": "Metal Drop",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 278.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 185.0
    }
   ],
   "coups": 8,
   "gameId": "diane_gauntlets_skill_rmb_1",
   "nature": "direct",
   "nom": "Combination Kick",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 185.0,
   "recharge": 5.0,
   "repartition": [
    40.0,
    55.0,
    90.0
   ],
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 88.0
    }
   ],
   "coups": 2,
   "gameId": "diane_gauntlets_skill_tag",
   "nature": "direct",
   "nom": "Rock Down",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 88.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Gauntlets"
  }
 ],
 "drake": [
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 109.0
    }
   ],
   "coups": 10,
   "gameId": "drake_staff_jumpatk",
   "nature": "direct",
   "nom": "Lightning Rod",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 109.0,
   "recharge": null,
   "repartition": [
    25.0,
    13.0,
    14.0,
    22.0,
    35.0
   ],
   "weaponType": "Staff"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 114.0
    }
   ],
   "coups": 1,
   "gameId": "drake_staff_skill_e",
   "nature": "direct",
   "nom": "Lightning Spear",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 114.0,
   "recharge": 13.2,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 191.0
    }
   ],
   "coups": 18,
   "gameId": "drake_staff_skill_q",
   "nature": "direct",
   "nom": "Lightning Overdrive",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 191.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 61.0
    }
   ],
   "coups": 4,
   "gameId": "drake_staff_skill_rmb",
   "nature": "direct",
   "nom": "Lightning Tempest",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 61.0,
   "recharge": 8.5,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 62.0
    }
   ],
   "coups": 3,
   "gameId": "drake_staff_skill_tag",
   "nature": "direct",
   "nom": "Lightning Staff Strike",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 62.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 126.0
    }
   ],
   "coups": 5,
   "gameId": "drake_sword1h_jumpatk",
   "nature": "direct",
   "nom": "Lightning Slash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 126.0,
   "recharge": null,
   "repartition": [
    25.0,
    15.0,
    16.0,
    26.0,
    44.0
   ],
   "weaponType": "Sword1h"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [],
   "coups": null,
   "gameId": "drake_sword1h_skill_e",
   "nature": "non-chiffree",
   "nom": "Pulse",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": null,
   "recharge": 20.9,
   "repartition": [],
   "weaponType": "Sword1h"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 239.0
    }
   ],
   "coups": null,
   "gameId": "drake_sword1h_skill_q",
   "nature": "direct",
   "nom": "Phantom Blade",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 239.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Sword1h"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 105.0
    }
   ],
   "coups": 5,
   "gameId": "drake_sword1h_skill_rmb",
   "nature": "direct",
   "nom": "Bolt Slash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 105.0,
   "recharge": 10.4,
   "repartition": [],
   "weaponType": "Sword1h"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 88.0
    }
   ],
   "coups": 1,
   "gameId": "drake_sword1h_skill_tag",
   "nature": "direct",
   "nom": "Thunder Slash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 88.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Sword1h"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 206.0
    }
   ],
   "coups": 8,
   "gameId": "drake_sword2h_jumpatk",
   "nature": "direct",
   "nom": "Lightning Blade",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 206.0,
   "recharge": null,
   "repartition": [
    25.0,
    17.0,
    20.0,
    30.0,
    50.0,
    64.0
   ],
   "weaponType": "Sword2h"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 276.0
    }
   ],
   "coups": null,
   "gameId": "drake_sword2h_skill_e_1",
   "nature": "direct",
   "nom": "Lightning Stream",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 276.0,
   "recharge": 18.0,
   "repartition": [],
   "weaponType": "Sword2h"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 722.0
    }
   ],
   "coups": 2,
   "gameId": "drake_sword2h_skill_q",
   "nature": "direct",
   "nom": "Lightning Dragon's Wrath",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 722.0,
   "recharge": 10.0,
   "repartition": [
    361.0,
    361.0
   ],
   "weaponType": "Sword2h"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 177.0
    }
   ],
   "coups": 1,
   "gameId": "drake_sword2h_skill_rmb_1",
   "nature": "direct",
   "nom": "Piercing Slash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 177.0,
   "recharge": 7.5,
   "repartition": [],
   "weaponType": "Sword2h"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 129.0
    }
   ],
   "coups": 1,
   "gameId": "drake_sword2h_skill_tag",
   "nature": "direct",
   "nom": "Lightning Dragon Strike",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 129.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Sword2h"
  }
 ],
 "dreydrin": [
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 108.0
    }
   ],
   "coups": 8,
   "gameId": "dreydrin_axe_jumpatk",
   "nature": "direct",
   "nom": "Full-body Slash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 108.0,
   "recharge": null,
   "repartition": [
    25.0,
    9.0,
    10.0,
    14.0,
    21.0,
    29.0
   ],
   "weaponType": "Axe"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 121.0
    }
   ],
   "coups": 1,
   "gameId": "dreydrin_axe_skill_e",
   "nature": "direct",
   "nom": "Battle Cry",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 121.0,
   "recharge": 17.3,
   "repartition": [],
   "weaponType": "Axe"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 186.0
    }
   ],
   "coups": 2,
   "gameId": "dreydrin_axe_skill_q",
   "nature": "direct",
   "nom": "Giant's Cry",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 186.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Axe"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 190.0
    }
   ],
   "coups": 3,
   "gameId": "dreydrin_axe_skill_rmb_ready",
   "nature": "direct",
   "nom": "Power Crash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 190.0,
   "recharge": 7.0,
   "repartition": [
    71.0,
    119.0
   ],
   "weaponType": "Axe"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 63.0
    }
   ],
   "coups": 1,
   "gameId": "dreydrin_axe_skill_tag",
   "nature": "direct",
   "nom": "Axe Uppercut",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 63.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Axe"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 86.0
    }
   ],
   "coups": 8,
   "gameId": "dreydrin_rapier_jumpatk",
   "nature": "direct",
   "nom": "Divine Bayonet",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 86.0,
   "recharge": null,
   "repartition": [
    25.0,
    9.0,
    10.0,
    15.0,
    27.0
   ],
   "weaponType": "Rapier"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 136.0
    }
   ],
   "coups": null,
   "gameId": "dreydrin_rapier_skill_e",
   "nature": "direct",
   "nom": "Divine Will",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 136.0,
   "recharge": 17.6,
   "repartition": [],
   "weaponType": "Rapier"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [],
   "coups": null,
   "gameId": "dreydrin_rapier_skill_q",
   "nature": "non-chiffree",
   "nom": "Divine Combat",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": null,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Rapier"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 76.0
    }
   ],
   "coups": 1,
   "gameId": "dreydrin_rapier_skill_rmb",
   "nature": "direct",
   "nom": "Light Pulse",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 76.0,
   "recharge": 8.2,
   "repartition": [],
   "weaponType": "Rapier"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 73.0
    }
   ],
   "coups": null,
   "gameId": "dreydrin_rapier_skill_tag",
   "nature": "direct",
   "nom": "Spear of Light",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 73.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Rapier"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 140.0
    }
   ],
   "coups": 8,
   "gameId": "dreydrin_shield_jumpatk",
   "nature": "direct",
   "nom": "Guard Slash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 140.0,
   "recharge": null,
   "repartition": [
    25.0,
    11.0,
    13.0,
    20.0,
    30.9,
    40.0
   ],
   "weaponType": "Shield"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 70.0
    }
   ],
   "coups": null,
   "gameId": "dreydrin_shield_skill_e",
   "nature": "direct",
   "nom": "Shield Crush",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 70.0,
   "recharge": 16.2,
   "repartition": [],
   "weaponType": "Shield"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [],
   "coups": null,
   "gameId": "dreydrin_shield_skill_q",
   "nature": "non-chiffree",
   "nom": "Pure Garden",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": null,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Shield"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [],
   "coups": null,
   "gameId": "dreydrin_shield_skill_rmb_ready",
   "nature": "non-chiffree",
   "nom": "Shield Field",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": null,
   "recharge": 20.0,
   "repartition": [],
   "weaponType": "Shield"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 72.0
    }
   ],
   "coups": 1,
   "gameId": "dreydrin_shield_skill_tag",
   "nature": "direct",
   "nom": "Sword Landing",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 72.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Shield"
  }
 ],
 "dreyfus": [
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 173.0
    }
   ],
   "coups": 9,
   "gameId": "dreyfus_lance_jumpatk",
   "nature": "direct",
   "nom": "Holy Stab",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 173.0,
   "recharge": null,
   "repartition": [
    25.0,
    23.0,
    25.0,
    37.0,
    63.0
   ],
   "weaponType": "Lance"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 287.0
    }
   ],
   "coups": null,
   "gameId": "dreyfus_lance_skill_e",
   "nature": "direct",
   "nom": "Pillar of Light",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 287.0,
   "recharge": 18.1,
   "repartition": [],
   "weaponType": "Lance"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 424.0
    }
   ],
   "coups": null,
   "gameId": "dreyfus_lance_skill_q",
   "nature": "direct",
   "nom": "Light Spear",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 424.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Lance"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 180.0
    }
   ],
   "coups": 1,
   "gameId": "dreyfus_lance_skill_rmb",
   "nature": "direct",
   "nom": "Sacred Breaker",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 180.0,
   "recharge": 7.9,
   "repartition": [],
   "weaponType": "Lance"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 110.0
    }
   ],
   "coups": 1,
   "gameId": "dreyfus_lance_skill_tag",
   "nature": "direct",
   "nom": "Spear Fall",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 110.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Lance"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 87.0
    }
   ],
   "coups": 6,
   "gameId": "dreyfus_rapier_jumpatk",
   "nature": "direct",
   "nom": "Piercing Sting",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 87.0,
   "recharge": null,
   "repartition": [
    25.0,
    9.0,
    10.0,
    16.0,
    27.0
   ],
   "weaponType": "Rapier"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 140.0
    }
   ],
   "coups": 6,
   "gameId": "dreyfus_rapier_skill_e",
   "nature": "direct",
   "nom": "Piercing Lightning",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 140.0,
   "recharge": 18.2,
   "repartition": [],
   "weaponType": "Rapier"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 161.0
    }
   ],
   "coups": null,
   "gameId": "dreyfus_rapier_skill_q",
   "nature": "direct",
   "nom": "Light Bomber",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 161.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Rapier"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 83.0
    }
   ],
   "coups": 1,
   "gameId": "dreyfus_rapier_skill_rmb_1",
   "nature": "direct",
   "nom": "Sting Breaker",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 83.0,
   "recharge": 7.5,
   "repartition": [],
   "weaponType": "Rapier"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 73.0
    }
   ],
   "coups": 2,
   "gameId": "dreyfus_rapier_skill_tag",
   "nature": "direct",
   "nom": "Flash Drop",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 73.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Rapier"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 135.0
    }
   ],
   "coups": 5,
   "gameId": "dreyfus_sword1h_jumpatk",
   "nature": "direct",
   "nom": "Earth Slash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 135.0,
   "recharge": null,
   "repartition": [
    25.0,
    26.0,
    31.0,
    53.0
   ],
   "weaponType": "Sword1h"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 256.0
    }
   ],
   "coups": 1,
   "gameId": "dreyfus_sword1h_skill_e",
   "nature": "direct",
   "nom": "Earth Blade",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 256.0,
   "recharge": 17.4,
   "repartition": [],
   "weaponType": "Sword1h"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 800.0
    }
   ],
   "coups": 4,
   "gameId": "dreyfus_sword1h_skill_q",
   "nature": "direct",
   "nom": "Earth Break",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 800.0,
   "recharge": 10.0,
   "repartition": [
    400.0,
    400.0
   ],
   "weaponType": "Sword1h"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 162.0
    }
   ],
   "coups": 1,
   "gameId": "dreyfus_sword1h_skill_rmb",
   "nature": "direct",
   "nom": "Terra Slash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 162.0,
   "recharge": 15.0,
   "repartition": [],
   "weaponType": "Sword1h"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 131.0
    }
   ],
   "coups": 1,
   "gameId": "dreyfus_sword1h_skill_tag",
   "nature": "direct",
   "nom": "Angled Earth Slash",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 131.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Sword1h"
  }
 ],
 "elaine": [
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 114.0
    }
   ],
   "coups": 1,
   "gameId": "elaine_book_jumpatk",
   "nature": "direct",
   "nom": "Windflower",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 114.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 126.0
    }
   ],
   "coups": 1,
   "gameId": "elaine_book_skill_e",
   "nature": "direct",
   "nom": "Guardian's Blossom",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 126.0,
   "recharge": 35.0,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 206.0
    }
   ],
   "coups": 1,
   "gameId": "elaine_book_skill_q",
   "nature": "direct",
   "nom": "Dust Seal",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 206.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 79.0
    }
   ],
   "coups": 1,
   "gameId": "elaine_book_skill_rmb",
   "nature": "direct",
   "nom": "Saintess's Domain",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 79.0,
   "recharge": 12.7,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 66.0
    }
   ],
   "coups": 1,
   "gameId": "elaine_book_skill_tag",
   "nature": "direct",
   "nom": "Forest Savior",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 66.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 134.0
    }
   ],
   "coups": 1,
   "gameId": "elaine_staff_jumpatk",
   "nature": "direct",
   "nom": "Light Seed",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 134.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 165.0
    }
   ],
   "coups": null,
   "gameId": "elaine_staff_skill_e",
   "nature": "duree",
   "nom": "Divine Forest Swarm",
   "periodique": {
    "base": "atk",
    "duree": 8.0,
    "intervalle": 1.5,
    "pourcentageParTick": 33.0,
    "ticks": 5
   },
   "portee": "Range",
   "pourcentage": 165.0,
   "recharge": 12.0,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [],
   "coups": null,
   "gameId": "elaine_staff_skill_q",
   "nature": "non-chiffree",
   "nom": "Forest's Blessing",
   "periodique": null,
   "portee": "Range",
   "pourcentage": null,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [],
   "coups": null,
   "gameId": "elaine_staff_skill_rmb",
   "nature": "non-chiffree",
   "nom": "Light Wave",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": null,
   "recharge": 13.3,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 88.0
    }
   ],
   "coups": null,
   "gameId": "elaine_staff_skill_tag",
   "nature": "direct",
   "nom": "Holy Shine",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 88.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 179.0
    }
   ],
   "coups": 4,
   "gameId": "elaine_wand_jumpatk",
   "nature": "direct",
   "nom": "Wind Bead",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 179.0,
   "recharge": null,
   "repartition": [
    25.0,
    59.1
   ],
   "weaponType": "Wand"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 202.0
    }
   ],
   "coups": null,
   "gameId": "elaine_wand_skill_e",
   "nature": "direct",
   "nom": "Razorwind",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 202.0,
   "recharge": 17.3,
   "repartition": [],
   "weaponType": "Wand"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 402.0
    }
   ],
   "coups": null,
   "gameId": "elaine_wand_skill_q",
   "nature": "direct",
   "nom": "Wind Blast",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 402.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Wand"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [],
   "coups": 1,
   "gameId": "elaine_wand_skill_rmb_ready",
   "nature": "non-chiffree",
   "nom": "Whirlwind Veil",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": null,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Wand"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 138.0
    }
   ],
   "coups": null,
   "gameId": "elaine_wand_skill_tag",
   "nature": "direct",
   "nom": "Forest Tornado",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 138.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Wand"
  }
 ],
 "elizabeth": [
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "def",
     "pourcentage": 89.0
    }
   ],
   "coups": 1,
   "gameId": "elizabeth_book_jumpatk",
   "nature": "direct",
   "nom": "Summerlight Droplets",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 25.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [],
   "coups": null,
   "gameId": "elizabeth_book_skill_e",
   "nature": "non-chiffree",
   "nom": "Cool Bite",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": null,
   "recharge": 31.0,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "def",
     "pourcentage": 82.0
    }
   ],
   "coups": 6,
   "gameId": "elizabeth_book_skill_q",
   "nature": "direct",
   "nom": "Princess's Water Cannon",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 82.0,
   "recharge": 22.0,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [],
   "coups": null,
   "gameId": "elizabeth_book_skill_r",
   "nature": "non-chiffree",
   "nom": "Let's Play Together!",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": null,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "def",
     "pourcentage": 71.0
    }
   ],
   "coups": 1,
   "gameId": "elizabeth_book_skill_tag",
   "nature": "direct",
   "nom": "Is This How I Shoot It?",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 71.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 101.0
    }
   ],
   "coups": 5,
   "gameId": "elizabeth_staff_jumpatk",
   "nature": "direct",
   "nom": "Awkward Swing",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 101.0,
   "recharge": null,
   "repartition": [
    25.0,
    11.0,
    12.0,
    20.0,
    33.0
   ],
   "weaponType": "Staff"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [],
   "coups": null,
   "gameId": "elizabeth_staff_skill_e",
   "nature": "non-chiffree",
   "nom": "Holy Wave",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": null,
   "recharge": 23.0,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [],
   "coups": null,
   "gameId": "elizabeth_staff_skill_q",
   "nature": "non-chiffree",
   "nom": "Sacred Guidance",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": null,
   "recharge": 17.0,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [],
   "coups": null,
   "gameId": "elizabeth_staff_skill_r",
   "nature": "non-chiffree",
   "nom": "Heavenly Whirlwind",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": null,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 60.0
    }
   ],
   "coups": 1,
   "gameId": "elizabeth_staff_skill_tag",
   "nature": "direct",
   "nom": "Unyielding Will",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 60.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 131.0
    }
   ],
   "coups": 7,
   "gameId": "elizabeth_wand_jumpatk",
   "nature": "direct",
   "nom": "Rolling Ham Attack",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 131.0,
   "recharge": null,
   "repartition": [
    25.0,
    15.0,
    17.0,
    27.0,
    47.0
   ],
   "weaponType": "Wand"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 157.0
    },
    {
     "base": "atk",
     "pourcentage": 3.0
    }
   ],
   "coups": 1,
   "gameId": "elizabeth_wand_skill_e",
   "nature": "direct",
   "nom": "Hawk Impact",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 157.0,
   "recharge": 17.0,
   "repartition": [],
   "weaponType": "Wand"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 102.0
    }
   ],
   "coups": 3,
   "gameId": "elizabeth_wand_skill_q",
   "nature": "direct",
   "nom": "Trail of Scraps",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 102.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Wand"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 276.0
    }
   ],
   "coups": 10,
   "gameId": "elizabeth_wand_skill_r",
   "nature": "direct",
   "nom": "Super Ham Explosion",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 276.0,
   "recharge": 11.0,
   "repartition": [],
   "weaponType": "Wand"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 78.0
    }
   ],
   "coups": 1,
   "gameId": "elizabeth_wand_skill_tag",
   "nature": "direct",
   "nom": "Saint's Retribution",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 78.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Wand"
  }
 ],
 "escanor": [
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 227.0
    }
   ],
   "coups": 14,
   "gameId": "escanor_axe_jumpatk",
   "nature": "direct",
   "nom": "Merciless Cleave",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 227.0,
   "recharge": null,
   "repartition": [
    25.0,
    20.0,
    23.0,
    35.0,
    54.0,
    70.0
   ],
   "weaponType": "Axe"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 279.0
    }
   ],
   "coups": 1,
   "gameId": "escanor_axe_skill_e",
   "nature": "direct",
   "nom": "Prideful Line",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 279.0,
   "recharge": 15.0,
   "repartition": [],
   "weaponType": "Axe"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 397.0
    },
    {
     "base": "remainingHp",
     "pourcentage": 30.0
    }
   ],
   "coups": null,
   "gameId": "escanor_axe_skill_q",
   "nature": "non-chiffree",
   "nom": "Cleansing Fire",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": null,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Axe"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 522.0
    }
   ],
   "coups": 5,
   "gameId": "escanor_axe_skill_rmb_ready",
   "nature": "direct",
   "nom": "Condensed Sun",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 522.0,
   "recharge": 13.0,
   "repartition": [
    150.0,
    170.0,
    202.0
   ],
   "weaponType": "Axe"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 138.0
    }
   ],
   "coups": 1,
   "gameId": "escanor_axe_skill_tag",
   "nature": "direct",
   "nom": "Sun's Arrival",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 138.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Axe"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "def",
     "pourcentage": 86.0
    }
   ],
   "coups": 11,
   "gameId": "escanor_shield_jumpatk",
   "nature": "direct",
   "nom": "Mark of the Sun",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 211.0,
   "recharge": null,
   "repartition": [
    25.0,
    13.0,
    15.0,
    22.0,
    36.0,
    15.0,
    17.0,
    26.0,
    42.0
   ],
   "weaponType": "Shield"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "def",
     "pourcentage": 145.0
    }
   ],
   "coups": 3,
   "gameId": "escanor_shield_skill_e",
   "nature": "direct",
   "nom": "Oppressing Flames",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 315.0,
   "recharge": 19.0,
   "repartition": [
    145.0,
    170.0
   ],
   "weaponType": "Shield"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "def",
     "pourcentage": 210.0
    }
   ],
   "coups": 2,
   "gameId": "escanor_shield_skill_q",
   "nature": "direct",
   "nom": "Celestial Judgment - Overheat",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 450.0,
   "recharge": 10.0,
   "repartition": [
    210.0,
    240.0
   ],
   "weaponType": "Shield"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "def",
     "pourcentage": 210.0
    },
    {
     "base": "def",
     "pourcentage": 110.0
    }
   ],
   "coups": 5,
   "gameId": "escanor_shield_skill_rmb",
   "nature": "direct",
   "nom": "Solar Onslaught",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 210.0,
   "recharge": 25.0,
   "repartition": [
    100.0,
    110.0
   ],
   "weaponType": "Shield"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "def",
     "pourcentage": 65.0
    }
   ],
   "coups": 1,
   "gameId": "escanor_shield_skill_tag",
   "nature": "direct",
   "nom": "Majestic Strike",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 65.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Shield"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 193.0
    }
   ],
   "coups": 7,
   "gameId": "escanor_sword2h_jumpatk",
   "nature": "direct",
   "nom": "Solar Orbit",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 193.0,
   "recharge": null,
   "repartition": [
    25.0,
    26.0,
    28.0,
    40.0,
    74.0
   ],
   "weaponType": "Sword2h"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 289.0
    }
   ],
   "coups": null,
   "gameId": "escanor_sword2h_skill_e",
   "nature": "direct",
   "nom": "\"Cruel Sun\"",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 289.0,
   "recharge": 19.0,
   "repartition": [],
   "weaponType": "Sword2h"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 390.0
    }
   ],
   "coups": null,
   "gameId": "escanor_sword2h_skill_q",
   "nature": "direct",
   "nom": "Rising Sun",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 390.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Sword2h"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 173.0
    }
   ],
   "coups": 2,
   "gameId": "escanor_sword2h_skill_rmb",
   "nature": "direct",
   "nom": "Solar Impact",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 173.0,
   "recharge": 13.0,
   "repartition": [],
   "weaponType": "Sword2h"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 143.0
    }
   ],
   "coups": null,
   "gameId": "escanor_sword2h_skill_tag",
   "nature": "direct",
   "nom": "Solar Ray",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 143.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Sword2h"
  }
 ],
 "gil-thunder": [
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 163.0
    }
   ],
   "coups": 5,
   "gameId": "gil_thunder_lance_jumpatk",
   "nature": "direct",
   "nom": "Lightning Thrust",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 163.0,
   "recharge": null,
   "repartition": [
    25.0,
    20.0,
    23.0,
    35.0,
    60.0
   ],
   "weaponType": "Lance"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 208.0
    }
   ],
   "coups": 3,
   "gameId": "gil_thunder_lance_skill_e",
   "nature": "direct",
   "nom": "Charge Electricity",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 208.0,
   "recharge": 13.2,
   "repartition": [],
   "weaponType": "Lance"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 343.0
    }
   ],
   "coups": 1,
   "gameId": "gil_thunder_lance_skill_q",
   "nature": "direct",
   "nom": "Lightning Bolt",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 343.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Lance"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 135.0
    }
   ],
   "coups": 1,
   "gameId": "gil_thunder_lance_skill_rmb",
   "nature": "direct",
   "nom": "Lightning Surge",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 135.0,
   "recharge": 7.5,
   "repartition": [],
   "weaponType": "Lance"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 96.0
    }
   ],
   "coups": 1,
   "gameId": "gil_thunder_lance_skill_tag",
   "nature": "direct",
   "nom": "Lightning Lance",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 96.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Lance"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 104.0
    }
   ],
   "coups": 6,
   "gameId": "gil_thunder_shield_jumpatk",
   "nature": "direct",
   "nom": "Lightning Barrier Strike",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 104.0,
   "recharge": null,
   "repartition": [
    25.0,
    12.0,
    13.0,
    20.0,
    34.0
   ],
   "weaponType": "Shield"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 170.0
    },
    {
     "base": "maxHp",
     "pourcentage": 10.0
    }
   ],
   "coups": 1,
   "gameId": "gil_thunder_shield_skill_e",
   "nature": "direct",
   "nom": "Judgment",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 170.0,
   "recharge": 35.0,
   "repartition": [],
   "weaponType": "Shield"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 214.0
    }
   ],
   "coups": 2,
   "gameId": "gil_thunder_shield_skill_q",
   "nature": "direct",
   "nom": "Shackles of the Lightning King",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 214.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Shield"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 84.0
    }
   ],
   "coups": 1,
   "gameId": "gil_thunder_shield_skill_rmb_ready",
   "nature": "direct",
   "nom": "Lightning Barrier",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 84.0,
   "recharge": 15.0,
   "repartition": [],
   "weaponType": "Shield"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 72.0
    }
   ],
   "coups": 1,
   "gameId": "gil_thunder_shield_skill_tag",
   "nature": "direct",
   "nom": "Blue Lightning",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 72.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Shield"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 133.0
    }
   ],
   "coups": 8,
   "gameId": "gil_thunder_sword1h_jumpatk",
   "nature": "direct",
   "nom": "Thunderstrike",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 133.0,
   "recharge": null,
   "repartition": [
    25.0,
    16.0,
    17.0,
    28.0,
    47.0
   ],
   "weaponType": "Sword1h"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 176.0
    }
   ],
   "coups": 4,
   "gameId": "gil_thunder_sword1h_skill_e",
   "nature": "direct",
   "nom": "Lightning Sword",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 176.0,
   "recharge": 15.6,
   "repartition": [],
   "weaponType": "Sword1h"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 259.0
    }
   ],
   "coups": null,
   "gameId": "gil_thunder_sword1h_skill_q",
   "nature": "direct",
   "nom": "Lightning Flash",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 259.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Sword1h"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 109.0
    }
   ],
   "coups": 2,
   "gameId": "gil_thunder_sword1h_skill_rmb",
   "nature": "direct",
   "nom": "Lightning Divide",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 109.0,
   "recharge": 10.4,
   "repartition": [],
   "weaponType": "Sword1h"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 86.0
    }
   ],
   "coups": null,
   "gameId": "gil_thunder_sword1h_skill_tag",
   "nature": "direct",
   "nom": "Lightning Strike",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 86.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Sword1h"
  }
 ],
 "gowther": [
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 99.0
    }
   ],
   "coups": null,
   "gameId": "gowther_book_jumpatk",
   "nature": "direct",
   "nom": "Invasion Edge",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 99.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 117.0
    }
   ],
   "coups": null,
   "gameId": "gowther_book_skill_e",
   "nature": "direct",
   "nom": "Nightmare Link",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 117.0,
   "recharge": 27.7,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 67.0
    }
   ],
   "coups": null,
   "gameId": "gowther_book_skill_q",
   "nature": "direct",
   "nom": "Memory Break",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 67.0,
   "recharge": 11.8,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 250.0
    }
   ],
   "coups": null,
   "gameId": "gowther_book_skill_r",
   "nature": "direct",
   "nom": "Blackout Field",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 250.0,
   "recharge": 60.0,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 55.0
    }
   ],
   "coups": null,
   "gameId": "gowther_book_skill_tag",
   "nature": "direct",
   "nom": "Darkness Boom",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 55.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 96.0
    }
   ],
   "coups": null,
   "gameId": "gowther_staff_jumpatk",
   "nature": "direct",
   "nom": "Mind Impulse",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 96.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 110.0
    }
   ],
   "coups": null,
   "gameId": "gowther_staff_skill_e",
   "nature": "direct",
   "nom": "Circle Impact",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 110.0,
   "recharge": 19.9,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 90.0
    }
   ],
   "coups": null,
   "gameId": "gowther_staff_skill_q",
   "nature": "duree",
   "nom": "Invasion Field",
   "periodique": {
    "base": "atk",
    "duree": 6.0,
    "intervalle": 0.2,
    "pourcentageParTick": 3.0,
    "ticks": 30
   },
   "portee": "Melee",
   "pourcentage": 87.0,
   "recharge": 16.3,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 205.0
    }
   ],
   "coups": null,
   "gameId": "gowther_staff_skill_r",
   "nature": "direct",
   "nom": "Prism Ray",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 205.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 62.0
    }
   ],
   "coups": null,
   "gameId": "gowther_staff_skill_tag",
   "nature": "direct",
   "nom": "Pain Slash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 62.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 122.0
    }
   ],
   "coups": null,
   "gameId": "gowther_wand_jumpatk",
   "nature": "direct",
   "nom": "Brute Strike",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 122.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Wand"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 122.0
    }
   ],
   "coups": null,
   "gameId": "gowther_wand_skill_e",
   "nature": "direct",
   "nom": "Arrow Barrage",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 122.0,
   "recharge": 28.1,
   "repartition": [],
   "weaponType": "Wand"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [],
   "coups": null,
   "gameId": "gowther_wand_skill_q_ready",
   "nature": "non-chiffree",
   "nom": "Savage Arrow",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": null,
   "recharge": 24.0,
   "repartition": [],
   "weaponType": "Wand"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 275.0
    }
   ],
   "coups": null,
   "gameId": "gowther_wand_skill_r",
   "nature": "direct",
   "nom": "Eclipse Arrow",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 275.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Wand"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 85.0
    }
   ],
   "coups": null,
   "gameId": "gowther_wand_skill_tag",
   "nature": "direct",
   "nom": "Brute Drop",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 85.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Wand"
  }
 ],
 "griamore": [
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 173.0
    }
   ],
   "coups": 5,
   "gameId": "griamore_cudgel3c_jumpatk",
   "nature": "direct",
   "nom": "Wall Smash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 173.0,
   "recharge": null,
   "repartition": [
    25.0,
    22.0,
    24.0,
    38.0,
    64.0
   ],
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 284.0
    }
   ],
   "coups": 1,
   "gameId": "griamore_cudgel3c_skill_e",
   "nature": "direct",
   "nom": "Wall Push",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 284.0,
   "recharge": 13.5,
   "repartition": [],
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 425.0
    }
   ],
   "coups": 1,
   "gameId": "griamore_cudgel3c_skill_q",
   "nature": "direct",
   "nom": "Wall Crash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 425.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [],
   "coups": null,
   "gameId": "griamore_cudgel3c_skill_rmb",
   "nature": "non-chiffree",
   "nom": "Wall Sphere",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": null,
   "recharge": 15.1,
   "repartition": [],
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 113.0
    }
   ],
   "coups": 1,
   "gameId": "griamore_cudgel3c_skill_tag",
   "nature": "direct",
   "nom": "Wall Rising",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 113.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 86.0
    }
   ],
   "coups": 5,
   "gameId": "griamore_gauntlets_jumpatk",
   "nature": "direct",
   "nom": "Gravity Punch",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 86.0,
   "recharge": null,
   "repartition": [
    25.0,
    9.0,
    10.0,
    16.0,
    26.0
   ],
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 128.0
    }
   ],
   "coups": 1,
   "gameId": "griamore_gauntlets_skill_e",
   "nature": "direct",
   "nom": "Shield Rush",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 128.0,
   "recharge": 17.0,
   "repartition": [],
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 179.0
    }
   ],
   "coups": 1,
   "gameId": "griamore_gauntlets_skill_q",
   "nature": "direct",
   "nom": "Emission Shield",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 179.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 83.0
    }
   ],
   "coups": 1,
   "gameId": "griamore_gauntlets_skill_rmb",
   "nature": "direct",
   "nom": "Power Punch",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 83.0,
   "recharge": 10.5,
   "repartition": [],
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 59.0
    }
   ],
   "coups": 1,
   "gameId": "griamore_gauntlets_skill_tag",
   "nature": "direct",
   "nom": "Shield Fist",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 59.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 102.0
    }
   ],
   "coups": 5,
   "gameId": "griamore_shield_jumpatk",
   "nature": "direct",
   "nom": "Shield Strike",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 102.0,
   "recharge": null,
   "repartition": [
    25.0,
    11.0,
    12.0,
    20.0,
    34.0
   ],
   "weaponType": "Shield"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 168.0
    },
    {
     "base": "def",
     "pourcentage": 45.0
    }
   ],
   "coups": 2,
   "gameId": "griamore_shield_skill_e",
   "nature": "direct",
   "nom": "Drop Attack",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 168.0,
   "recharge": 14.0,
   "repartition": [],
   "weaponType": "Shield"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 221.0
    }
   ],
   "coups": 1,
   "gameId": "griamore_shield_skill_q",
   "nature": "direct",
   "nom": "Wall Drop Strike",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 221.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Shield"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [],
   "coups": null,
   "gameId": "griamore_shield_skill_rmb_ready",
   "nature": "non-chiffree",
   "nom": "Shield Impact",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": null,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Shield"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 85.0
    }
   ],
   "coups": 1,
   "gameId": "griamore_shield_skill_tag",
   "nature": "direct",
   "nom": "Shell Drop",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 85.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Shield"
  }
 ],
 "guila": [
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 184.0
    }
   ],
   "coups": 1,
   "gameId": "guila_lance_jumpatk",
   "nature": "direct",
   "nom": "Flame Shot",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 184.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Lance"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 246.0
    }
   ],
   "coups": null,
   "gameId": "guila_lance_skill_e",
   "nature": "direct",
   "nom": "Shot Bombs",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 246.0,
   "recharge": 15.0,
   "repartition": [],
   "weaponType": "Lance"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [],
   "coups": null,
   "gameId": "guila_lance_skill_q",
   "nature": "non-chiffree",
   "nom": "Demon Form",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": null,
   "recharge": 40.0,
   "repartition": [],
   "weaponType": "Lance"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 183.0
    }
   ],
   "coups": null,
   "gameId": "guila_lance_skill_rmb",
   "nature": "direct",
   "nom": "Flame Cannon",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 183.0,
   "recharge": 7.5,
   "repartition": [],
   "weaponType": "Lance"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 104.0
    }
   ],
   "coups": null,
   "gameId": "guila_lance_skill_tag",
   "nature": "direct",
   "nom": "Fire Drop",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 104.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Lance"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 117.0
    }
   ],
   "coups": 9,
   "gameId": "guila_rapier_jumpatk",
   "nature": "direct",
   "nom": "Blazing Stab",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 117.0,
   "recharge": null,
   "repartition": [
    25.0,
    13.0,
    14.0,
    24.0,
    41.0
   ],
   "weaponType": "Rapier"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 187.0
    }
   ],
   "coups": 1,
   "gameId": "guila_rapier_skill_e",
   "nature": "direct",
   "nom": "Blazing Burst",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 187.0,
   "recharge": 15.0,
   "repartition": [],
   "weaponType": "Rapier"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [],
   "coups": null,
   "gameId": "guila_rapier_skill_q",
   "nature": "non-chiffree",
   "nom": "Demon Form",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": null,
   "recharge": 40.0,
   "repartition": [],
   "weaponType": "Rapier"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 122.0
    }
   ],
   "coups": 2,
   "gameId": "guila_rapier_skill_rmb",
   "nature": "direct",
   "nom": "Blazing Thrust",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 122.0,
   "recharge": 11.9,
   "repartition": [],
   "weaponType": "Rapier"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 87.0
    }
   ],
   "coups": 1,
   "gameId": "guila_rapier_skill_tag",
   "nature": "direct",
   "nom": "Blazing Slash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 87.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Rapier"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 114.0
    }
   ],
   "coups": 5,
   "gameId": "guila_shield_jumpatk",
   "nature": "direct",
   "nom": "Flame Guard Slash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 114.0,
   "recharge": null,
   "repartition": [
    25.0,
    13.0,
    14.0,
    23.0,
    39.0
   ],
   "weaponType": "Shield"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [],
   "coups": null,
   "gameId": "guila_shield_skill_e",
   "nature": "non-chiffree",
   "nom": "Ground Ignition",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": null,
   "recharge": 32.0,
   "repartition": [],
   "weaponType": "Shield"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 200.0
    }
   ],
   "coups": null,
   "gameId": "guila_shield_skill_q",
   "nature": "duree",
   "nom": "Radiant Explosion",
   "periodique": {
    "base": "atk",
    "duree": 10.0,
    "intervalle": 0.4,
    "pourcentageParTick": 8.0,
    "ticks": 25
   },
   "portee": "Melee",
   "pourcentage": 192.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Shield"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 65.0
    }
   ],
   "coups": 1,
   "gameId": "guila_shield_skill_rmb_ready",
   "nature": "direct",
   "nom": "Flame Rampart",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 65.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Shield"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 72.0
    }
   ],
   "coups": 1,
   "gameId": "guila_shield_skill_tag",
   "nature": "direct",
   "nom": "Shield Drop",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 72.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Shield"
  }
 ],
 "hendrickson": [
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 135.0
    }
   ],
   "coups": 5,
   "gameId": "hendrickson_lance_jumpatk",
   "nature": "direct",
   "nom": "Abyss Lance",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 135.0,
   "recharge": null,
   "repartition": [
    25.0,
    26.0,
    31.0,
    53.0
   ],
   "weaponType": "Lance"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 273.0
    }
   ],
   "coups": null,
   "gameId": "hendrickson_lance_skill_e",
   "nature": "direct",
   "nom": "\"Acid Tower\"",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 273.0,
   "recharge": 15.7,
   "repartition": [],
   "weaponType": "Lance"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 387.0
    }
   ],
   "coups": null,
   "gameId": "hendrickson_lance_skill_q",
   "nature": "direct",
   "nom": "\"Acid Down\"",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 387.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Lance"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 161.0
    }
   ],
   "coups": 1,
   "gameId": "hendrickson_lance_skill_rmb",
   "nature": "direct",
   "nom": "Abyss Lance Breaker",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 161.0,
   "recharge": 15.0,
   "repartition": [],
   "weaponType": "Lance"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 130.0
    }
   ],
   "coups": 1,
   "gameId": "hendrickson_lance_skill_tag",
   "nature": "direct",
   "nom": "Dark Stab",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 130.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Lance"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 100.0
    }
   ],
   "coups": 5,
   "gameId": "hendrickson_sword1h_jumpatk",
   "nature": "direct",
   "nom": "Radiant Slash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 100.0,
   "recharge": null,
   "repartition": [
    25.0,
    11.0,
    12.0,
    19.0,
    33.0
   ],
   "weaponType": "Sword1h"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [],
   "coups": null,
   "gameId": "hendrickson_sword1h_skill_e",
   "nature": "non-chiffree",
   "nom": "Defensive Spell",
   "periodique": null,
   "portee": "Range",
   "pourcentage": null,
   "recharge": 14.0,
   "repartition": [],
   "weaponType": "Sword1h"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [],
   "coups": null,
   "gameId": "hendrickson_sword1h_skill_q",
   "nature": "non-chiffree",
   "nom": "Magic Unleashed",
   "periodique": null,
   "portee": "Range",
   "pourcentage": null,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Sword1h"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 99.0
    }
   ],
   "coups": 1,
   "gameId": "hendrickson_sword1h_skill_rmb",
   "nature": "direct",
   "nom": "Divine Pierce",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 99.0,
   "recharge": 7.5,
   "repartition": [],
   "weaponType": "Sword1h"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 85.0
    }
   ],
   "coups": 1,
   "gameId": "hendrickson_sword1h_skill_tag",
   "nature": "direct",
   "nom": "Thrusting Slash",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 85.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Sword1h"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 168.0
    }
   ],
   "coups": 9,
   "gameId": "hendrickson_sworddual_jumpatk",
   "nature": "direct",
   "nom": "Dual Strike",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 168.0,
   "recharge": null,
   "repartition": [
    25.0,
    21.0,
    22.0,
    37.0,
    63.0
   ],
   "weaponType": "SwordDual"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 281.0
    }
   ],
   "coups": 1,
   "gameId": "hendrickson_sworddual_skill_e",
   "nature": "direct",
   "nom": "Rapid Edge",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 281.0,
   "recharge": 12.0,
   "repartition": [],
   "weaponType": "SwordDual"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 421.0
    }
   ],
   "coups": 1,
   "gameId": "hendrickson_sworddual_skill_q",
   "nature": "direct",
   "nom": "Knight's Sword",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 421.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "SwordDual"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 178.0
    }
   ],
   "coups": 1,
   "gameId": "hendrickson_sworddual_skill_rmb",
   "nature": "direct",
   "nom": "Flash Sword",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 178.0,
   "recharge": 11.6,
   "repartition": [],
   "weaponType": "SwordDual"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 127.0
    }
   ],
   "coups": 2,
   "gameId": "hendrickson_sworddual_skill_tag",
   "nature": "direct",
   "nom": "Double Slash",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 127.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "SwordDual"
  }
 ],
 "howzer": [
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 112.0
    }
   ],
   "coups": 6,
   "gameId": "howzer_cudgel3c_jumpatk",
   "nature": "direct",
   "nom": "Wind Smash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 112.0,
   "recharge": null,
   "repartition": [
    25.0,
    13.0,
    14.0,
    23.0,
    37.0
   ],
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [],
   "coups": 11,
   "gameId": "howzer_cudgel3c_skill_e_ready",
   "nature": "non-chiffree",
   "nom": "Storm Breaker",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": null,
   "recharge": 30.0,
   "repartition": [
    40.0,
    74.0
   ],
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 214.0
    }
   ],
   "coups": 1,
   "gameId": "howzer_cudgel3c_skill_q",
   "nature": "direct",
   "nom": "Gust",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 214.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 80.0
    }
   ],
   "coups": 2,
   "gameId": "howzer_cudgel3c_skill_rmb",
   "nature": "direct",
   "nom": "Precise Stab",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 80.0,
   "recharge": 12.6,
   "repartition": [],
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 73.0
    }
   ],
   "coups": 2,
   "gameId": "howzer_cudgel3c_skill_tag",
   "nature": "direct",
   "nom": "Chain Uppercut",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 73.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 100.0
    }
   ],
   "coups": 7,
   "gameId": "howzer_gauntlets_jumpatk",
   "nature": "direct",
   "nom": "Wind Punch",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 100.0,
   "recharge": null,
   "repartition": [
    25.0,
    11.0,
    12.0,
    19.0,
    33.0
   ],
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 107.0
    }
   ],
   "coups": null,
   "gameId": "howzer_gauntlets_skill_e",
   "nature": "direct",
   "nom": "Combo",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 107.0,
   "recharge": 18.7,
   "repartition": [],
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 212.0
    }
   ],
   "coups": 5,
   "gameId": "howzer_gauntlets_skill_q",
   "nature": "direct",
   "nom": "Whirl Shock",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 212.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 75.0
    }
   ],
   "coups": 2,
   "gameId": "howzer_gauntlets_skill_rmb_1",
   "nature": "direct",
   "nom": "Cyclone Impact",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 75.0,
   "recharge": 10.8,
   "repartition": [
    25.0,
    50.0
   ],
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 62.0
    }
   ],
   "coups": 8,
   "gameId": "howzer_gauntlets_skill_tag",
   "nature": "direct",
   "nom": "Rising Fist",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 62.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 183.0
    }
   ],
   "coups": 3,
   "gameId": "howzer_lance_jumpatk",
   "nature": "direct",
   "nom": "Lance Strike",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 183.0,
   "recharge": null,
   "repartition": [
    25.0,
    22.0,
    24.0
   ],
   "weaponType": "Lance"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 276.0
    }
   ],
   "coups": null,
   "gameId": "howzer_lance_skill_e",
   "nature": "direct",
   "nom": "Pulling Gust",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 276.0,
   "recharge": 15.7,
   "repartition": [],
   "weaponType": "Lance"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 406.0
    }
   ],
   "coups": null,
   "gameId": "howzer_lance_skill_q",
   "nature": "direct",
   "nom": "Super Cyclone",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 406.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Lance"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 147.0
    }
   ],
   "coups": 1,
   "gameId": "howzer_lance_skill_rmb",
   "nature": "direct",
   "nom": "Gale Lance Burst",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 147.0,
   "recharge": 18.0,
   "repartition": [],
   "weaponType": "Lance"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 135.0
    }
   ],
   "coups": 5,
   "gameId": "howzer_lance_skill_tag",
   "nature": "direct",
   "nom": "Wind Drop",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 135.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Lance"
  }
 ],
 "jericho": [
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 114.0
    }
   ],
   "coups": 6,
   "gameId": "jericho_lance_jumpatk",
   "nature": "direct",
   "nom": "Ice Stab",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 114.0,
   "recharge": null,
   "repartition": [
    25.0,
    13.0,
    14.0,
    23.0,
    39.0
   ],
   "weaponType": "Lance"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 148.0
    }
   ],
   "coups": null,
   "gameId": "jericho_lance_skill_e",
   "nature": "direct",
   "nom": "Ice Rock",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 148.0,
   "recharge": 35.4,
   "repartition": [],
   "weaponType": "Lance"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 214.0
    }
   ],
   "coups": 1,
   "gameId": "jericho_lance_skill_q",
   "nature": "direct",
   "nom": "Ice Field",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 214.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Lance"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 86.0
    }
   ],
   "coups": 3,
   "gameId": "jericho_lance_skill_rmb",
   "nature": "direct",
   "nom": "Ice Wave",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 86.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Lance"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 72.0
    }
   ],
   "coups": null,
   "gameId": "jericho_lance_skill_tag",
   "nature": "direct",
   "nom": "Frozen Slicer",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 72.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Lance"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 161.0
    }
   ],
   "coups": 8,
   "gameId": "jericho_rapier_jumpatk",
   "nature": "direct",
   "nom": "Frost Slash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 161.0,
   "recharge": null,
   "repartition": [
    25.0,
    19.0,
    21.0,
    35.0,
    61.0
   ],
   "weaponType": "Rapier"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 201.0
    }
   ],
   "coups": 5,
   "gameId": "jericho_rapier_skill_e",
   "nature": "direct",
   "nom": "Ice Blade Dance",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 201.0,
   "recharge": 22.1,
   "repartition": [],
   "weaponType": "Rapier"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 451.0
    }
   ],
   "coups": 5,
   "gameId": "jericho_rapier_skill_q",
   "nature": "direct",
   "nom": "Glacial Blitz",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 451.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Rapier"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 160.0
    }
   ],
   "coups": 4,
   "gameId": "jericho_rapier_skill_rmb",
   "nature": "direct",
   "nom": "Frostfang Stab",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 160.0,
   "recharge": 17.2,
   "repartition": [],
   "weaponType": "Rapier"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 132.0
    }
   ],
   "coups": 2,
   "gameId": "jericho_rapier_skill_tag",
   "nature": "direct",
   "nom": "Cold Strike",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 132.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Rapier"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 87.0
    }
   ],
   "coups": 4,
   "gameId": "jericho_sworddual_normalatk_1_enchant",
   "nature": "direct",
   "nom": "Dual Ice Cut",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 87.0,
   "recharge": null,
   "repartition": [
    16.0,
    17.0,
    22.0,
    32.0
   ],
   "weaponType": "SwordDual"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 161.0
    }
   ],
   "coups": 1,
   "gameId": "jericho_sworddual_skill_e",
   "nature": "direct",
   "nom": "Weapon Enchantment",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 161.0,
   "recharge": 30.0,
   "repartition": [],
   "weaponType": "SwordDual"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 246.0
    }
   ],
   "coups": 6,
   "gameId": "jericho_sworddual_skill_q",
   "nature": "direct",
   "nom": "Ice Needle",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 246.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "SwordDual"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 101.0
    }
   ],
   "coups": 6,
   "gameId": "jericho_sworddual_skill_rmb",
   "nature": "direct",
   "nom": "Ice Twin Dance",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 101.0,
   "recharge": 13.6,
   "repartition": [],
   "weaponType": "SwordDual"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 87.0
    }
   ],
   "coups": 1,
   "gameId": "jericho_sworddual_skill_tag",
   "nature": "direct",
   "nom": "Frozen Slash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 87.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "SwordDual"
  }
 ],
 "king": [
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 97.0
    }
   ],
   "coups": 5,
   "gameId": "king_book_jumpatk",
   "nature": "direct",
   "nom": "Guardian Punch",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 97.0,
   "recharge": null,
   "repartition": [
    25.0,
    11.0,
    12.0,
    18.0,
    31.0
   ],
   "weaponType": "Book"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 151.0
    }
   ],
   "coups": 1,
   "gameId": "king_book_skill_e",
   "nature": "direct",
   "nom": "Protector of the Forest",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 151.0,
   "recharge": 16.0,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [],
   "coups": null,
   "gameId": "king_book_skill_q",
   "nature": "non-chiffree",
   "nom": "Forest's Protection",
   "periodique": null,
   "portee": "Range",
   "pourcentage": null,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 97.0
    }
   ],
   "coups": 1,
   "gameId": "king_book_skill_rmb_ready",
   "nature": "direct",
   "nom": "Guardian Shield",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 97.0,
   "recharge": 12.0,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 70.0
    }
   ],
   "coups": 1,
   "gameId": "king_book_skill_tag",
   "nature": "direct",
   "nom": "Upper Arc",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 70.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 165.0
    }
   ],
   "coups": 3,
   "gameId": "king_staff_jumpatk",
   "nature": "direct",
   "nom": "Piercing Staff",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 165.0,
   "recharge": null,
   "repartition": [
    25.0,
    20.0,
    22.0
   ],
   "weaponType": "Staff"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 245.0
    }
   ],
   "coups": 1,
   "gameId": "king_staff_skill_e",
   "nature": "direct",
   "nom": "Holy Swarm",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 245.0,
   "recharge": 12.0,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 433.0
    }
   ],
   "coups": null,
   "gameId": "king_staff_skill_q",
   "nature": "direct",
   "nom": "Shining Blaze",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 433.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 166.0
    }
   ],
   "coups": null,
   "gameId": "king_staff_skill_rmb",
   "nature": "direct",
   "nom": "Tempest Staff",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 166.0,
   "recharge": 7.5,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 114.0
    }
   ],
   "coups": 5,
   "gameId": "king_staff_skill_tag",
   "nature": "direct",
   "nom": "Bee Chase",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 114.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 77.0
    }
   ],
   "coups": 1,
   "gameId": "king_wand_jumpatk",
   "nature": "direct",
   "nom": "Earth Shot",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 77.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Wand"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 130.0
    }
   ],
   "coups": 1,
   "gameId": "king_wand_skill_e",
   "nature": "direct",
   "nom": "Fairy Power",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 130.0,
   "recharge": 20.0,
   "repartition": [],
   "weaponType": "Wand"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 167.0
    }
   ],
   "coups": null,
   "gameId": "king_wand_skill_q",
   "nature": "direct",
   "nom": "Sharp Slash",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 167.0,
   "recharge": 15.0,
   "repartition": [],
   "weaponType": "Wand"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [],
   "coups": null,
   "gameId": "king_wand_skill_rmb_ready",
   "nature": "non-chiffree",
   "nom": "Healing Stance",
   "periodique": null,
   "portee": "Range",
   "pourcentage": null,
   "recharge": 20.0,
   "repartition": [],
   "weaponType": "Wand"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 62.0
    }
   ],
   "coups": 1,
   "gameId": "king_wand_skill_tag",
   "nature": "direct",
   "nom": "Earth Impact",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 62.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Wand"
  }
 ],
 "klotho": [
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 106.0
    }
   ],
   "coups": 1,
   "gameId": "klotho_book_jumpatk",
   "nature": "direct",
   "nom": "Rune Projection",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 106.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 76.0
    }
   ],
   "coups": null,
   "gameId": "klotho_book_skill_e_a",
   "nature": "direct",
   "nom": "Frost Rune: Deployment",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 76.0,
   "recharge": 18.0,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [],
   "coups": null,
   "gameId": "klotho_book_skill_q_a",
   "nature": "non-chiffree",
   "nom": "Frost Rune: Perfect Form",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": null,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [],
   "coups": null,
   "gameId": "klotho_book_skill_rmb",
   "nature": "non-chiffree",
   "nom": "Frost Rune: Cluster Ritual",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": null,
   "recharge": 29.1,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 74.0
    }
   ],
   "coups": 6,
   "gameId": "klotho_book_skill_tag",
   "nature": "direct",
   "nom": "Frost Rune: Crushing Impact",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 74.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 163.0
    }
   ],
   "coups": 7,
   "gameId": "klotho_rapier_jumpatk",
   "nature": "direct",
   "nom": "Inscription Barrage",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 163.0,
   "recharge": null,
   "repartition": [
    25.0,
    14.0,
    16.0,
    24.0,
    37.0,
    47.0
   ],
   "weaponType": "Rapier"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 151.0
    }
   ],
   "coups": null,
   "gameId": "klotho_rapier_skill_e",
   "nature": "direct",
   "nom": "Storm Slash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 151.0,
   "recharge": 17.5,
   "repartition": [],
   "weaponType": "Rapier"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 342.0
    }
   ],
   "coups": 10,
   "gameId": "klotho_rapier_skill_q",
   "nature": "direct",
   "nom": "Rune Inscription: Collapse",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 342.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Rapier"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [],
   "coups": 9,
   "gameId": "klotho_rapier_skill_rmb_ready",
   "nature": "non-chiffree",
   "nom": "Inscription Chase: Piercing Chain",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": null,
   "recharge": 23.0,
   "repartition": [
    70.0,
    46.0
   ],
   "weaponType": "Rapier"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 89.0
    }
   ],
   "coups": null,
   "gameId": "klotho_rapier_skill_tag",
   "nature": "direct",
   "nom": "Inscription Flurry",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 89.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Rapier"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 366.0
    }
   ],
   "coups": 25,
   "gameId": "klotho_staff_normalatk_enchant_ready",
   "nature": "direct",
   "nom": "Dimensional Projection",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 366.0,
   "recharge": null,
   "repartition": [
    294.0,
    72.0
   ],
   "weaponType": "Staff"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 75.0
    }
   ],
   "coups": null,
   "gameId": "klotho_staff_skill_e",
   "nature": "duree",
   "nom": "Dimensional Wave",
   "periodique": {
    "base": "atk",
    "duree": 7.5,
    "intervalle": 0.5,
    "pourcentageParTick": 5.0,
    "ticks": 15
   },
   "portee": "Melee",
   "pourcentage": 75.0,
   "recharge": 21.4,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [],
   "coups": null,
   "gameId": "klotho_staff_skill_q",
   "nature": "non-chiffree",
   "nom": "Dimensional Domination",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": null,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [],
   "coups": null,
   "gameId": "klotho_staff_skill_rmb",
   "nature": "non-chiffree",
   "nom": "Dimensional Enhancement",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": null,
   "recharge": 25.8,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 139.0
    }
   ],
   "coups": 1,
   "gameId": "klotho_staff_skill_tag",
   "nature": "direct",
   "nom": "Dimensional Breach",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 139.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Staff"
  }
 ],
 "manny": [
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 108.0
    }
   ],
   "coups": 1,
   "gameId": "manny_staff_jumpatk",
   "nature": "direct",
   "nom": "Priestess's Light",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 108.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 168.0
    }
   ],
   "coups": null,
   "gameId": "manny_staff_skill_e",
   "nature": "direct",
   "nom": "Holy Judgment",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 168.0,
   "recharge": 21.0,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [],
   "coups": null,
   "gameId": "manny_staff_skill_q",
   "nature": "non-chiffree",
   "nom": "Flash Explosion",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": null,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [],
   "coups": null,
   "gameId": "manny_staff_skill_rmb",
   "nature": "non-chiffree",
   "nom": "Priestess's Blessing",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": null,
   "recharge": 15.0,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 87.0
    }
   ],
   "coups": 1,
   "gameId": "manny_staff_skill_tag",
   "nature": "direct",
   "nom": "Holy Light",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 87.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 33.0
    }
   ],
   "coups": 3,
   "gameId": "manny_sword1h_normalatk_1_enchant",
   "nature": "direct",
   "nom": "Sword Dance",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 33.0,
   "recharge": null,
   "repartition": [
    15.0,
    18.0
   ],
   "weaponType": "Sword1h"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 120.0
    }
   ],
   "coups": 1,
   "gameId": "manny_sword1h_skill_e",
   "nature": "direct",
   "nom": "Frost Release",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 120.0,
   "recharge": 31.0,
   "repartition": [],
   "weaponType": "Sword1h"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 330.0
    }
   ],
   "coups": null,
   "gameId": "manny_sword1h_skill_q",
   "nature": "duree",
   "nom": "Priestess's Barrier",
   "periodique": {
    "base": "atk",
    "duree": 10.0,
    "intervalle": 1.0,
    "pourcentageParTick": 33.0,
    "ticks": 10
   },
   "portee": "Melee",
   "pourcentage": 330.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Sword1h"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 158.0
    }
   ],
   "coups": null,
   "gameId": "manny_sword1h_skill_rmb",
   "nature": "direct",
   "nom": "Frost Blade Whirl",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 158.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Sword1h"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 104.0
    }
   ],
   "coups": 2,
   "gameId": "manny_sword1h_skill_tag",
   "nature": "direct",
   "nom": "Frost Blade",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 104.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Sword1h"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 96.0
    }
   ],
   "coups": 12,
   "gameId": "manny_sworddual_jumpatk",
   "nature": "direct",
   "nom": "Flying Blades",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 96.0,
   "recharge": null,
   "repartition": [
    25.0,
    11.0,
    11.0,
    18.0,
    31.0
   ],
   "weaponType": "SwordDual"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 113.0
    }
   ],
   "coups": 5,
   "gameId": "manny_sworddual_skill_e",
   "nature": "direct",
   "nom": "Frozen Soul Shatter",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 113.0,
   "recharge": 26.9,
   "repartition": [],
   "weaponType": "SwordDual"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 225.0
    }
   ],
   "coups": null,
   "gameId": "manny_sworddual_skill_q",
   "nature": "direct",
   "nom": "Snowfield of the Void",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 225.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "SwordDual"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 73.0
    }
   ],
   "coups": null,
   "gameId": "manny_sworddual_skill_rmb",
   "nature": "direct",
   "nom": "Frost Spike Dash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 73.0,
   "recharge": 13.6,
   "repartition": [],
   "weaponType": "SwordDual"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 61.0
    }
   ],
   "coups": null,
   "gameId": "manny_sworddual_skill_tag",
   "nature": "direct",
   "nom": "White Snow",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 61.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "SwordDual"
  }
 ],
 "meliodas": [
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 189.0
    }
   ],
   "coups": 6,
   "gameId": "meliodas_axe_jumpatk",
   "nature": "direct",
   "nom": "Dark Axe",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 189.0,
   "recharge": null,
   "repartition": [
    25.0,
    24.0,
    27.0,
    42.0,
    71.0
   ],
   "weaponType": "Axe"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 368.0
    }
   ],
   "coups": 4,
   "gameId": "meliodas_axe_skill_e",
   "nature": "direct",
   "nom": "Circle Slash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 368.0,
   "recharge": 22.0,
   "repartition": [
    184.0,
    184.0
   ],
   "weaponType": "Axe"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 407.0
    }
   ],
   "coups": 1,
   "gameId": "meliodas_axe_skill_q",
   "nature": "direct",
   "nom": "Demon's Fighting Spirit",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 407.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Axe"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 442.0
    }
   ],
   "coups": 3,
   "gameId": "meliodas_axe_skill_rmb_ready",
   "nature": "direct",
   "nom": "Abyssal Power Smash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 442.0,
   "recharge": 25.0,
   "repartition": [
    30.0,
    82.0
   ],
   "weaponType": "Axe"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 134.0
    }
   ],
   "coups": 5,
   "gameId": "meliodas_axe_skill_tag",
   "nature": "direct",
   "nom": "Power Arc",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 134.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Axe"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 185.1
    }
   ],
   "coups": 9,
   "gameId": "meliodas_sword1h_jumpatk",
   "nature": "direct",
   "nom": "Dark Slash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 185.1,
   "recharge": null,
   "repartition": [
    25.0,
    24.0,
    26.0,
    42.0,
    68.1
   ],
   "weaponType": "Sword1h"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 286.0
    }
   ],
   "coups": 6,
   "gameId": "meliodas_sword1h_skill_e",
   "nature": "direct",
   "nom": "Chain Attack",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 286.0,
   "recharge": 27.0,
   "repartition": [],
   "weaponType": "Sword1h"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 898.4
    }
   ],
   "coups": 4,
   "gameId": "meliodas_sword1h_skill_q",
   "nature": "direct",
   "nom": "Blazing Cross",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 898.4,
   "recharge": 10.0,
   "repartition": [
    449.2,
    449.2
   ],
   "weaponType": "Sword1h"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 93.0
    }
   ],
   "coups": 2,
   "gameId": "meliodas_sword1h_skill_rmb",
   "nature": "direct",
   "nom": "Abyssal Dash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 93.0,
   "recharge": 17.0,
   "repartition": [],
   "weaponType": "Sword1h"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 133.0
    }
   ],
   "coups": 1,
   "gameId": "meliodas_sword1h_skill_tag",
   "nature": "direct",
   "nom": "Dark Force",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 133.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Sword1h"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 187.3
    }
   ],
   "coups": 14,
   "gameId": "meliodas_sworddual_jumpatk",
   "nature": "direct",
   "nom": "Dark Dual Slash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 187.3,
   "recharge": null,
   "repartition": [
    25.0,
    24.0,
    26.1,
    43.2,
    69.0
   ],
   "weaponType": "SwordDual"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 267.0
    }
   ],
   "coups": 7,
   "gameId": "meliodas_sworddual_skill_e",
   "nature": "direct",
   "nom": "Burning Slash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 267.0,
   "recharge": 32.0,
   "repartition": [],
   "weaponType": "SwordDual"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 822.0
    }
   ],
   "coups": 18,
   "gameId": "meliodas_sworddual_skill_q",
   "nature": "direct",
   "nom": "X Slash - Flurry",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 822.0,
   "recharge": 10.0,
   "repartition": [
    411.0,
    411.0
   ],
   "weaponType": "SwordDual"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 160.0
    }
   ],
   "coups": 3,
   "gameId": "meliodas_sworddual_skill_rmb",
   "nature": "direct",
   "nom": "Dark Rapid Slash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 160.0,
   "recharge": 20.0,
   "repartition": [],
   "weaponType": "SwordDual"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 132.0
    }
   ],
   "coups": 2,
   "gameId": "meliodas_sworddual_skill_tag",
   "nature": "direct",
   "nom": "X Slash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 132.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "SwordDual"
  }
 ],
 "merlin": [
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 175.0
    }
   ],
   "coups": 4,
   "gameId": "merlin_book_jumpatk",
   "nature": "direct",
   "nom": "Spatial Freeze",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 175.0,
   "recharge": null,
   "repartition": [
    25.0,
    21.0,
    39.0,
    65.0
   ],
   "weaponType": "Book"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 150.0
    }
   ],
   "coups": 27,
   "gameId": "merlin_book_normalatk_enchant_ready",
   "nature": "direct",
   "nom": "Spatial Freeze",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 150.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 220.0
    }
   ],
   "coups": null,
   "gameId": "merlin_book_skill_e",
   "nature": "duree",
   "nom": "Frost Seed",
   "periodique": {
    "base": "atk",
    "duree": 5.0,
    "intervalle": 0.5,
    "pourcentageParTick": 22.0,
    "ticks": 10
   },
   "portee": "Melee",
   "pourcentage": 220.0,
   "recharge": 25.0,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 50.0
    }
   ],
   "coups": 1,
   "gameId": "merlin_book_skill_q",
   "nature": "direct",
   "nom": "Cold Intellect",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 50.0,
   "recharge": 8.0,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 394.0
    }
   ],
   "coups": null,
   "gameId": "merlin_book_skill_r",
   "nature": "direct",
   "nom": "Iceberg Descent",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 394.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 150.0
    }
   ],
   "coups": 1,
   "gameId": "merlin_book_skill_tag",
   "nature": "direct",
   "nom": "Frost Sweep",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 150.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 121.0
    }
   ],
   "coups": 1,
   "gameId": "merlin_staff_jumpatk",
   "nature": "direct",
   "nom": "Ignition Calculation",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 121.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 200.0
    }
   ],
   "coups": null,
   "gameId": "merlin_staff_skill_e",
   "nature": "duree",
   "nom": "Seeking Crimson",
   "periodique": {
    "base": "atk",
    "duree": 12.0,
    "intervalle": 0.3,
    "pourcentageParTick": 5.0,
    "ticks": 40
   },
   "portee": "Melee",
   "pourcentage": 200.0,
   "recharge": 16.5,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [],
   "coups": null,
   "gameId": "merlin_staff_skill_q",
   "nature": "non-chiffree",
   "nom": "Illusory Heat",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": null,
   "recharge": 9.4,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [],
   "coups": null,
   "gameId": "merlin_staff_skill_r",
   "nature": "non-chiffree",
   "nom": "Celestial Collapse",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": null,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 86.0
    }
   ],
   "coups": null,
   "gameId": "merlin_staff_skill_tag",
   "nature": "direct",
   "nom": "Infinite Deployment",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 86.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 179.0
    }
   ],
   "coups": 6,
   "gameId": "merlin_wand_jumpatk",
   "nature": "direct",
   "nom": "Electrostream",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 179.0,
   "recharge": null,
   "repartition": [
    25.0,
    39.0,
    67.0
   ],
   "weaponType": "Wand"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 159.0
    }
   ],
   "coups": null,
   "gameId": "merlin_wand_skill_e_enchant",
   "nature": "direct",
   "nom": "Judgment of Thunder",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 159.0,
   "recharge": 19.9,
   "repartition": [],
   "weaponType": "Wand"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 160.0
    }
   ],
   "coups": null,
   "gameId": "merlin_wand_skill_q",
   "nature": "duree",
   "nom": "Electromagnetic Field",
   "periodique": {
    "base": "atk",
    "duree": 5.0,
    "intervalle": 0.5,
    "pourcentageParTick": 16.0,
    "ticks": 10
   },
   "portee": "Melee",
   "pourcentage": 160.0,
   "recharge": 16.5,
   "repartition": [],
   "weaponType": "Wand"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 406.0
    }
   ],
   "coups": null,
   "gameId": "merlin_wand_skill_r",
   "nature": "direct",
   "nom": "Plasma Dome: Overload",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 406.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Wand"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 124.0
    }
   ],
   "coups": 1,
   "gameId": "merlin_wand_skill_tag",
   "nature": "direct",
   "nom": "Lightning Ray",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 124.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Wand"
  }
 ],
 "slader": [
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 76.0
    }
   ],
   "coups": 6,
   "gameId": "slader_axe_jumpatk",
   "nature": "direct",
   "nom": "Axe Swing",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 76.0,
   "recharge": null,
   "repartition": [
    25.0,
    12.0,
    15.0,
    24.0
   ],
   "weaponType": "Axe"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 121.0
    }
   ],
   "coups": 2,
   "gameId": "slader_axe_skill_e",
   "nature": "direct",
   "nom": "Axe Charge",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 121.0,
   "recharge": 12.0,
   "repartition": [],
   "weaponType": "Axe"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 190.0
    }
   ],
   "coups": 5,
   "gameId": "slader_axe_skill_q",
   "nature": "direct",
   "nom": "Bloody Arc",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 190.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Axe"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 174.0
    }
   ],
   "coups": 2,
   "gameId": "slader_axe_skill_rmb_ready",
   "nature": "direct",
   "nom": "Charged Strike",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 174.0,
   "recharge": 9.0,
   "repartition": [
    64.0,
    110.0
   ],
   "weaponType": "Axe"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 63.0
    }
   ],
   "coups": 3,
   "gameId": "slader_axe_skill_tag",
   "nature": "direct",
   "nom": "Axe Slash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 63.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Axe"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 127.0
    }
   ],
   "coups": 5,
   "gameId": "slader_cudgel3c_jumpatk",
   "nature": "direct",
   "nom": "Triple Swing",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 127.0,
   "recharge": null,
   "repartition": [
    25.0,
    15.0,
    16.0,
    26.0,
    45.0
   ],
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 171.0
    }
   ],
   "coups": 4,
   "gameId": "slader_cudgel3c_skill_e",
   "nature": "direct",
   "nom": "Chain Thrust",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 171.0,
   "recharge": 16.2,
   "repartition": [],
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 252.0
    }
   ],
   "coups": 1,
   "gameId": "slader_cudgel3c_skill_q",
   "nature": "direct",
   "nom": "Iron Fury",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 252.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 93.0
    }
   ],
   "coups": 1,
   "gameId": "slader_cudgel3c_skill_rmb",
   "nature": "direct",
   "nom": "Chain Stab",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 93.0,
   "recharge": 10.5,
   "repartition": [],
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 86.0
    }
   ],
   "coups": 1,
   "gameId": "slader_cudgel3c_skill_tag",
   "nature": "direct",
   "nom": "Blade Wave",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 86.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 168.0
    }
   ],
   "coups": 8,
   "gameId": "slader_sword2h_jumpatk",
   "nature": "direct",
   "nom": "Giant Sword",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 168.0,
   "recharge": null,
   "repartition": [
    25.0,
    21.0,
    23.0,
    36.0,
    63.0
   ],
   "weaponType": "Sword2h"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 278.0
    }
   ],
   "coups": 5,
   "gameId": "slader_sword2h_skill_e",
   "nature": "direct",
   "nom": "Power Drop",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 278.0,
   "recharge": 12.0,
   "repartition": [],
   "weaponType": "Sword2h"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 416.0
    }
   ],
   "coups": 2,
   "gameId": "slader_sword2h_skill_q",
   "nature": "direct",
   "nom": "Power Smite",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 416.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Sword2h"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 427.8
    }
   ],
   "coups": 3,
   "gameId": "slader_sword2h_skill_rmb_1",
   "nature": "direct",
   "nom": "Finishing Strike",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 427.8,
   "recharge": 7.5,
   "repartition": [
    186.0,
    241.8
   ],
   "weaponType": "Sword2h"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 118.0
    }
   ],
   "coups": 1,
   "gameId": "slader_sword2h_skill_tag",
   "nature": "direct",
   "nom": "Strike",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 118.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Sword2h"
  }
 ],
 "tioreh": [
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 95.0
    }
   ],
   "coups": 4,
   "gameId": "tioreh_book_normalatk_1_enchant",
   "nature": "direct",
   "nom": "Fire Bolt",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 95.0,
   "recharge": null,
   "repartition": [
    14.0,
    15.0,
    24.0,
    42.0
   ],
   "weaponType": "Book"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [],
   "coups": 11,
   "gameId": "tioreh_book_skill_e",
   "nature": "non-chiffree",
   "nom": "Fire Ejection",
   "periodique": null,
   "portee": "Range",
   "pourcentage": null,
   "recharge": 20.8,
   "repartition": [
    35.0,
    86.0
   ],
   "weaponType": "Book"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 180.0
    }
   ],
   "coups": null,
   "gameId": "tioreh_book_skill_q",
   "nature": "direct",
   "nom": "Dragon Breath",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 180.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [],
   "coups": null,
   "gameId": "tioreh_book_skill_rmb",
   "nature": "non-chiffree",
   "nom": "Lion Beam",
   "periodique": null,
   "portee": "Range",
   "pourcentage": null,
   "recharge": 15.0,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 65.0
    }
   ],
   "coups": 1,
   "gameId": "tioreh_book_skill_tag",
   "nature": "direct",
   "nom": "Fire Strike",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 65.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Book"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 99.0
    }
   ],
   "coups": 1,
   "gameId": "tioreh_staff_jumpatk",
   "nature": "direct",
   "nom": "Shooting Star",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 99.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 138.0
    }
   ],
   "coups": null,
   "gameId": "tioreh_staff_skill_e",
   "nature": "direct",
   "nom": "Summon: Sheep",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 138.0,
   "recharge": 25.0,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 161.0
    }
   ],
   "coups": null,
   "gameId": "tioreh_staff_skill_q",
   "nature": "direct",
   "nom": "Bear Landing",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 161.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [],
   "coups": null,
   "gameId": "tioreh_staff_skill_rmb",
   "nature": "non-chiffree",
   "nom": "Celestial Bloom",
   "periodique": null,
   "portee": "Range",
   "pourcentage": null,
   "recharge": 10.2,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 62.0
    }
   ],
   "coups": 1,
   "gameId": "tioreh_staff_skill_tag",
   "nature": "direct",
   "nom": "Earth Circle",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 62.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Staff"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 135.0
    }
   ],
   "coups": 5,
   "gameId": "tioreh_wand_jumpatk",
   "nature": "direct",
   "nom": "Fairy Flame",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 135.0,
   "recharge": null,
   "repartition": [
    25.0,
    11.0,
    12.0,
    19.0,
    28.0
   ],
   "weaponType": "Wand"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [],
   "coups": null,
   "gameId": "tioreh_wand_skill_e",
   "nature": "non-chiffree",
   "nom": "Healing Fox",
   "periodique": null,
   "portee": "Range",
   "pourcentage": null,
   "recharge": 28.0,
   "repartition": [],
   "weaponType": "Wand"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 227.0
    }
   ],
   "coups": null,
   "gameId": "tioreh_wand_skill_q",
   "nature": "direct",
   "nom": "Burning Lion",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 227.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "Wand"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [],
   "coups": null,
   "gameId": "tioreh_wand_skill_rmb_ready",
   "nature": "non-chiffree",
   "nom": "Bear Embrace",
   "periodique": null,
   "portee": "Range",
   "pourcentage": null,
   "recharge": 8.0,
   "repartition": [],
   "weaponType": "Wand"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 72.0
    }
   ],
   "coups": null,
   "gameId": "tioreh_wand_skill_tag",
   "nature": "direct",
   "nom": "Fire Mist",
   "periodique": null,
   "portee": "Range",
   "pourcentage": 72.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Wand"
  }
 ],
 "tristan": [
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 131.0
    }
   ],
   "coups": 6,
   "gameId": "tristan_sword1h_jumpatk",
   "nature": "direct",
   "nom": "Wind Sword",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 131.0,
   "recharge": null,
   "repartition": [
    25.0,
    16.0,
    17.0,
    27.0,
    46.0
   ],
   "weaponType": "Sword1h"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 173.0
    }
   ],
   "coups": null,
   "gameId": "tristan_sword1h_skill_e",
   "nature": "direct",
   "nom": "Wind Thrust",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 173.0,
   "recharge": 17.9,
   "repartition": [],
   "weaponType": "Sword1h"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 526.0
    }
   ],
   "coups": 16,
   "gameId": "tristan_sword1h_skill_q",
   "nature": "direct",
   "nom": "Blade Storm",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 526.0,
   "recharge": 10.0,
   "repartition": [
    263.0,
    263.0
   ],
   "weaponType": "Sword1h"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 103.0
    }
   ],
   "coups": 1,
   "gameId": "tristan_sword1h_skill_rmb",
   "nature": "direct",
   "nom": "Storm Sword",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 103.0,
   "recharge": 9.3,
   "repartition": [],
   "weaponType": "Sword1h"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 88.0
    }
   ],
   "coups": 1,
   "gameId": "tristan_sword1h_skill_tag",
   "nature": "direct",
   "nom": "Wind Strike",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 88.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Sword1h"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 187.0
    }
   ],
   "coups": 6,
   "gameId": "tristan_sword2h_jumpatk",
   "nature": "direct",
   "nom": "Flame Sword",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 187.0,
   "recharge": null,
   "repartition": [
    25.0,
    24.0,
    26.0,
    42.0,
    70.0
   ],
   "weaponType": "Sword2h"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 275.0
    }
   ],
   "coups": null,
   "gameId": "tristan_sword2h_skill_e",
   "nature": "direct",
   "nom": "Punisher",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 275.0,
   "recharge": 12.0,
   "repartition": [],
   "weaponType": "Sword2h"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 1307.0
    }
   ],
   "coups": 3,
   "gameId": "tristan_sword2h_skill_q_ready",
   "nature": "direct",
   "nom": "Severing Cut",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 1307.0,
   "recharge": 10.0,
   "repartition": [
    405.0,
    435.0,
    467.0
   ],
   "weaponType": "Sword2h"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [],
   "coups": 4,
   "gameId": "tristan_sword2h_skill_rmb_ready",
   "nature": "non-chiffree",
   "nom": "Infinite Fire Slash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": null,
   "recharge": 8.0,
   "repartition": [
    24.0,
    81.0
   ],
   "weaponType": "Sword2h"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 137.0
    }
   ],
   "coups": 1,
   "gameId": "tristan_sword2h_skill_tag",
   "nature": "direct",
   "nom": "Surprise Attack",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 137.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "Sword2h"
  },
  {
   "categorie": "NORMAL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 136.0
    }
   ],
   "coups": 10,
   "gameId": "tristan_sworddual_jumpatk",
   "nature": "direct",
   "nom": "Dual Flame Slash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 136.0,
   "recharge": null,
   "repartition": [
    25.0,
    18.0,
    19.0,
    29.0,
    28.1
   ],
   "weaponType": "SwordDual"
  },
  {
   "categorie": "NORMAL_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 200.0
    }
   ],
   "coups": 3,
   "gameId": "tristan_sworddual_skill_e",
   "nature": "direct",
   "nom": "Vertical Slice",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 200.0,
   "recharge": 16.2,
   "repartition": [],
   "weaponType": "SwordDual"
  },
  {
   "categorie": "ULTIMATE",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 241.0
    }
   ],
   "coups": null,
   "gameId": "tristan_sworddual_skill_q",
   "nature": "direct",
   "nom": "Rain of Fire",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 241.0,
   "recharge": 10.0,
   "repartition": [],
   "weaponType": "SwordDual"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 91.0
    }
   ],
   "coups": null,
   "gameId": "tristan_sworddual_skill_rmb",
   "nature": "direct",
   "nom": "Dual Inferno Slash",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 91.0,
   "recharge": 7.8,
   "repartition": [],
   "weaponType": "SwordDual"
  },
  {
   "categorie": "TAG_SKILL",
   "composantes": [
    {
     "base": "atk",
     "pourcentage": 87.0
    }
   ],
   "coups": 2,
   "gameId": "tristan_sworddual_skill_tag",
   "nature": "direct",
   "nom": "Burning Blow",
   "periodique": null,
   "portee": "Melee",
   "pourcentage": 87.0,
   "recharge": null,
   "repartition": [],
   "weaponType": "SwordDual"
  }
 ]
};
