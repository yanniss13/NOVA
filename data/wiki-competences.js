// Genere par generate-wiki.py depuis les pages FR de 7dsorigin.app.
// Catalogue de LECTURE du wiki : noms et descriptions francais,
// PASSIFS INCLUS. Ne pas confondre avec data/competences.js, qui
// est le catalogue de calcul du comparateur de degats.
// Cle = slug personnage. recharge = secondes, ou null si la source
// ne la publie pas. Le balisage [#RRGGBB]texte[-] est rendu par
// renderBonus() ; il est conserve tel quel ici.
window.SEVEN_DS_WIKI_COMPETENCES = {
 "bug": [
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]160%[-] de l'attaque.\n1er coup : 24%\n2e coup : 26%\n3e coup : 41%\n4e coup : 69%",
   "gameId": "bug_axe_jumpatk",
   "icone": "common_Axe_normalAttack.webp",
   "nomFr": "Fendoir des ombres",
   "recharge": null,
   "weaponType": "Axe"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]188%[-] de l'attaque à l'ennemi et l'attire au centre.",
   "gameId": "bug_axe_skill_e",
   "icone": "Bug_Axe_NormalSkill.webp",
   "nomFr": "Rossée des ténèbres",
   "recharge": 14.0,
   "weaponType": "Axe"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]166%[-] / [#1A7331]237%[-] de l'attaque en fonction du niveau de charge. Inflige des dégâts égaux à [#1A7331]100%[-] de l'attaque en cas de surcharge.\nPorte un coup critique en attaquant lorsque l'arme brille pendant la charge.",
   "gameId": "bug_axe_skill_rmb_ready",
   "icone": "Bug_Axe_ActiveThird.webp",
   "nomFr": "Pulvérisation des abysses",
   "recharge": 16.0,
   "weaponType": "Axe"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]129%[-] de l'attaque.",
   "gameId": "bug_axe_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Taillade de hache des ténèbres",
   "recharge": null,
   "weaponType": "Axe"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Augmente les dégâts des Ténèbres du héros de [#1A7331]30%[-] pendant [#1A7331]20s[-], puis inflige des dégâts égaux à [#1A7331]380%[-] de l'attaque.",
   "gameId": "bug_axe_skill_q",
   "icone": "Bug_Axe_UltimateSKill.webp",
   "nomFr": "Essaim de la mort",
   "recharge": 10.0,
   "weaponType": "Axe"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Attaquer un ennemi sous l'effet de [#0F5CD8]Déluge des Ténèbres[-] augmente les dégâts crit. de [#1A7331]45%[-].",
   "gameId": "bug_axe_passive",
   "icone": "Bug_Axe_Passive.webp",
   "nomFr": "Trublion",
   "recharge": 0.0,
   "weaponType": "Axe"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]74%[-] de l'attaque.\n1er coup : 11%\n2e coup : 12%\n3e coup : 19%\n4e coup : 32%",
   "gameId": "bug_book_normalatk_1_enchant",
   "icone": "common_Book_normalAttack.webp",
   "nomFr": "Poing des Ténèbres",
   "recharge": null,
   "weaponType": "Book"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Crée un [#0F5CD8]Leurre[-] à l'emplacement du héros qui provoque les ennemis à portée pendant [#1A7331]5s[-] et octroie [#0F5CD8]Furtivité[-] pendant [#1A7331]10s[-]. Lorsque le [#0F5CD8]Leurre[-] disparaît, il explose et inflige [#0F5CD8]Étourdissement[-] aux ennemis pendant [#1A7331]3s[-].",
   "gameId": "bug_book_skill_e",
   "icone": "Bug_Book_NormalSkill.webp",
   "nomFr": "La fripouille",
   "recharge": 20.0,
   "weaponType": "Book"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Améliore les attaques normales pendant [#1A7331]10s[-], infligeant des dégâts égaux à [#1A7331]111%[-] de l'attaque.\nRéduit de [#1A7331]15%[-] pendant [#1A7331]40s[-] la résistance aux Ténèbres des ennemis touchés [#1A7331]4 fois[-] par les attaques normales améliorées en [#1A7331]10s[-].\n1er coup : 17%\n2e coup : 18%\n3e coup : 28%\n4e coup : 48%",
   "gameId": "bug_book_skill_rmb",
   "icone": "Bug_Book_ActiveThird.webp",
   "nomFr": "Déclenchement de Déluge Obscur",
   "recharge": 15.0,
   "weaponType": "Book"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]56%[-] de l'attaque.",
   "gameId": "bug_book_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Flamboiement des ténèbres",
   "recharge": null,
   "weaponType": "Book"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]191%[-] de l'attaque aux ennemis à portée pendant [#1A7331]10s[-].\nChaque coup avec cette attaque inflige [#0F5CD8]Malédiction[-] pendant [#1A7331]15s[-] et augmente la durée de [#0F5CD8]Déluge des Ténèbres[-] sur l'ennemi de [#1A7331]1s[-].\n\n※ [#0F5CD8]Malédiction[-] : inflige des dégâts des Ténèbres égaux à [#1A7331]15%[-] de l'attaque toutes les [#1A7331]3s[-]. Réduit la résistance aux Ténèbres de [#1A7331]15%[-].",
   "gameId": "bug_book_skill_q",
   "icone": "Bug_Book_UltimateSKill.webp",
   "nomFr": "Seul en scène",
   "recharge": 10.0,
   "weaponType": "Book"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Lorsqu'un héros allié attaque un ennemi qui souffre de [#0F5CD8]Malédiction[-], augmente ses dégâts des Ténèbres de [#1A7331]20%[-].",
   "gameId": "bug_book_passive",
   "icone": "Bug_Book_Passive.webp",
   "nomFr": "Dérision",
   "recharge": 0.0,
   "weaponType": "Book"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]162%[-] de l'attaque.\n1er coup : 24%\n2e coup : 26%\n3e coup : 42%\n4e coup : 70%",
   "gameId": "bug_sworddual_jumpatk",
   "icone": "common_SwordDual_normalAttack.webp",
   "nomFr": "Double taillade des ombres",
   "recharge": null,
   "weaponType": "SwordDual"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]263%[-] de l'attaque. Réinitialise le temps de recharge de l'attaque spéciale en attaquant des ennemis dans le dos.",
   "gameId": "bug_sworddual_skill_e",
   "icone": "Bug_SwordDual_NormalSkill.webp",
   "nomFr": "Extermination",
   "recharge": 20.0,
   "weaponType": "SwordDual"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Augmente l'attaque des Ténèbres du héros de [#1A7331]10%[-] pendant [#1A7331]20s[-] (Max : [#1A7331]3 fois[-]), puis se téléporte derrière l'ennemi et inflige des dégâts égaux à [#1A7331]165%[-] de l'attaque.",
   "gameId": "bug_sworddual_skill_rmb",
   "icone": "Bug_SwordDual_ActiveThird.webp",
   "nomFr": "Double taillade des abysses",
   "recharge": 14.0,
   "weaponType": "SwordDual"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]120%[-] de l'attaque.",
   "gameId": "bug_sworddual_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Danse tranchante",
   "recharge": null,
   "weaponType": "SwordDual"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]326%[-] de l'attaque. Chaque coup inflige des dégâts supplémentaires égaux à [#1A7331]32%[-] de l'attaque aux ennemis sous l'effet de [#0F5CD8]Déluge des Ténèbres[-].\nLa dernière frappe retire le [#0F5CD8]Déluge des Ténèbres[-] de la cible.",
   "gameId": "bug_sworddual_skill_q",
   "icone": "Bug_SwordDual_UltimateSKill.webp",
   "nomFr": "Fin",
   "recharge": 10.0,
   "weaponType": "SwordDual"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Augmente les dégâts de [#1A7331]35%[-] en attaquant des ennemis dans le dos.",
   "gameId": "bug_sworddual_passive",
   "icone": "Bug_SwordDual_Passive.webp",
   "nomFr": "Blitz",
   "recharge": 0.0,
   "weaponType": "SwordDual"
  }
 ],
 "daisy": [
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]75%[-] de l'attaque.\n1er coup : 11%\n2e coup : 12%\n3e coup : 19%\n4e coup : 33%",
   "gameId": "daisy_book_jumpatk",
   "icone": "common_Book_normalAttack.webp",
   "nomFr": "Bombe fruitée",
   "recharge": null,
   "weaponType": "Book"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Invoque une [#3C22D6]Compétence normale : Lampadaire électrifié[-] pendant [#1A7331]20s[-] qui inflige des dégâts égaux à [#1A7331]6%[-] de l'attaque toutes les [#1A7331]1s[-].\n\nTous les [#1A7331]5 coups(s)[-] portés par le \n[#3C22D6]Lampadaire électrifié[-], celui-ci octroie [#0F5CD8]Charge électrique[-] aux alliés à portée pendant [#1A7331]40s[-]. (Max : [#1A7331]20 fois[-])\n\n※ [#0F5CD8]Charge électrique[-] : augmente les dégâts crit. des héros d'attribut Foudre de [#1A7331]2%[-] et leurs chances crit. de [#1A7331]1.5%[-].",
   "gameId": "daisy_book_skill_e",
   "icone": "Daisy_Book_NormalSkill.webp",
   "nomFr": "Invocation de Lampadaire électrifié",
   "recharge": 12.0,
   "weaponType": "Book"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Augmente les dégâts crit. des alliés de [#1A7331]15%[-] pendant [#1A7331]40s[-].\nUtiliser la compétence sur un [#0F5CD8]Lampadaire électrifié[-] augmente sa vitesse d'attaque pendant [#1A7331]20s[-].",
   "gameId": "daisy_book_skill_rmb",
   "icone": "Daisy_Book_ActiveThird.webp",
   "nomFr": "Réveil électrisant !",
   "recharge": 8.0,
   "weaponType": "Book"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]54%[-] de l'attaque.",
   "gameId": "daisy_book_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Et voilà Daisy",
   "recharge": null,
   "weaponType": "Book"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]178%[-] de l'attaque aux ennemis à portée et réduit leur défense crit. de [#1A7331]50%[-] pendant [#1A7331]10s[-].",
   "gameId": "daisy_book_skill_q",
   "icone": "Daisy_Book_UltimateSKill.webp",
   "nomFr": "Salve de fruits",
   "recharge": 10.0,
   "weaponType": "Book"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Faire mouche avec l'attaque normale inflige [#0F5CD8]Électroaimant[-] à l'ennemi pendant [#1A7331]40s[-].\nAugmente les dégâts de [#1A7331]20%[-] lorsqu'un [#0F5CD8]Lampadaire électrifié[-] attaque des ennemis affectés par [#0F5CD8]Électroaimant[-].\n\n※ [#0F5CD8]Électroaimant[-] : réduit la résistance crit. de [#1A7331]20%[-].",
   "gameId": "daisy_book_passive",
   "icone": "Daisy_Book_Passive.webp",
   "nomFr": "Charge statique",
   "recharge": 0.0,
   "weaponType": "Book"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]156%[-] de l'attaque.\n1er coup : 23%\n2e coup : 25%\n3e coup : 41%\n4e coup : 67%\n\n[#0F5CD8][Daisy et Domby][-]\nInflige des dégâts égaux à [#1A7331]198%[-] de l'attaque, et chaque coup porté réduit le temps de recharge de l'attaque spéciale de [#1A7331]2s[-].\n1er coup : 29%\n2e coup : 31%\n3e coup : 51%\n4e coup : 87%",
   "gameId": "daisy_shield_jumpatk",
   "icone": "common_Shield_normalAttack.webp",
   "nomFr": "Technique secrète des fées : Coups déchaînés",
   "recharge": null,
   "weaponType": "Shield"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Active l'état [#0F5CD8][Daisy et Domby][-].\n\n[#0F5CD8][Daisy et Domby][-]\nInflige des dégâts égaux à [#1A7331]253%[-] de l'attaque, puis retire l'état [#0F5CD8][Daisy et Domby][-].",
   "gameId": "daisy_shield_skill_e",
   "icone": "Daisy_Shield_NormalSkill.webp",
   "nomFr": "Domby, à moi",
   "recharge": 15.0,
   "weaponType": "Shield"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Réduit les dégâts subis de [#1A7331]90%[-] et octroie [#0F5CD8]Impulsion énergétique[-] pendant [#1A7331]20s[-] en subissant une attaque tant que la posture est maintenue.\nMaintenir la posture pendant [#1A7331]3s[-] octroie [#1A7331]5[-] cumuls d'[#0F5CD8]Impulsion énergétique[-] au héros, et restaure la jauge de magie de [#1A7331]500[-] pendant [#1A7331]20s[-].\n\n[#0F5CD8][Daisy et Domby][-]\nInflige des dégâts égaux à [#1A7331]98%[-] / [#1A7331]270%[-] de l'attaque et octroie [#1A7331]2[-] / [#1A7331]4[-] cumul(s) d'[#0F5CD8]Impulsion énergétique[-] pendant [#1A7331]20s[-] en fonction du niveau de charge.\nConsomme [#1A7331]100[-] de la jauge de magie toutes les [#1A7331]0.4s[-] pour augmenter les dégâts de [#1A7331]10%[-] tant que la posture est maintenue.\n\n※ [#0F5CD8]Impulsion énergétique[-] : augmente les dégâts d'attaque ultime de [#1A7331]2%[-] lorsque l'état [#0F5CD8][Daisy et Domby][-] est actif. (Max : [#1A7331]30 fois[-])",
   "gameId": "daisy_shield_skill_rmb_ready",
   "icone": "Daisy_Shield_ActiveThird.webp",
   "nomFr": "Défends-moi, Domby",
   "recharge": 12.0,
   "weaponType": "Shield"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]160%[-] de l'attaque.",
   "gameId": "daisy_shield_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Et voilà Daisy",
   "recharge": null,
   "weaponType": "Shield"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]319%[-] de l'attaque, inflige [#0F5CD8]Fée terrestre[-] à l'ennemi pendant [#1A7331]20s[-], puis octroie [#1A7331]5[-] cumul(s) d'[#0F5CD8]Impulsion énergétique[-] pendant [#1A7331]20s[-].\n\n[#0F5CD8][Daisy et Domby][-]\nInflige des dégâts égaux à [#1A7331]150%[-] de l'attaque. Lorsque les cumuls d'[#0F5CD8]Impulsion énergétique[-] sont au maximum, chaque coup porté sur l'ennemi sous l'effet de Déluge de Terre inflige des dégâts égaux à [#1A7331]75%[-] de l'attaque, puis retire [#0F5CD8]Impulsion énergétique[-].\nChaque coup consomme [#1A7331]100[-] de la jauge de magie pour augmenter les dégâts de [#1A7331]10%[-].\n\n※ [#0F5CD8]Fée terrestre[-] : augmente les dégâts infligés par l'utilisateur de [#1A7331]30%[-].\n※ [#0F5CD8]Impulsion énergétique[-] : augmente les dégâts d'attaque ultime de [#1A7331]2%[-] lorsque l'état [#0F5CD8][Daisy et Domby][-] est actif. (Max : [#1A7331]30 fois[-])",
   "gameId": "daisy_shield_skill_q",
   "icone": "Daisy_Shield_UltimateSKill.webp",
   "nomFr": "Va-t'en",
   "recharge": 10.0,
   "weaponType": "Shield"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Augmente l'efficacité de recharge de la magie du héros de [#1A7331]50%[-].\n\n[#0F5CD8][Daisy et Domby][-]\nImmunise contre les réactions. Octroie [#0F5CD8]Impulsion énergétique[-] pendant [#1A7331]20s[-] en consommant [#1A7331]50[-] de la jauge de magie toutes les [#1A7331]0.5s[-].\n\n※ [#0F5CD8]Impulsion énergétique[-] : augmente les dégâts d'attaque ultime de [#1A7331]2%[-] lorsque l'effet [#0F5CD8][Daisy et Domby][-] est actif. (Max : [#1A7331]30 fois[-])",
   "gameId": "daisy_shield_passive",
   "icone": "Daisy_Shield_Passive.webp",
   "nomFr": "Mon ami Domby",
   "recharge": 0.0,
   "weaponType": "Shield"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]77%[-] de l'attaque.\n1er coup : 11%\n2e coup : 12%\n3e coup : 20%\n4e coup : 34%",
   "gameId": "daisy_wand_jumpatk",
   "icone": "common_Wand_normalAttack.webp",
   "nomFr": "Ordre de fée",
   "recharge": null,
   "weaponType": "Wand"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]106%[-] de l'attaque, et chaque coup porté réduit la résistance crit. de l'ennemi de [#1A7331]6%[-] pendant [#1A7331]40s[-]. (Max : [#1A7331]4 fois[-])\nPorte un coup critique si l'ennemi est affecté par [#0F5CD8]Étourdissement[-].",
   "gameId": "daisy_wand_skill_e",
   "icone": "Daisy_Wand_NormalSkill.webp",
   "nomFr": "Bombe de graine",
   "recharge": 18.0,
   "weaponType": "Wand"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]11%[-] de l'attaque aux ennemis proches toutes les [#1A7331]0.8s[-] et augmente les chances crit. de tous les héros alliés de [#1A7331]5%[-] pendant [#1A7331]40s[-] tant que la posture est maintenue. (Max : [#1A7331]4 fois[-])\nMaintient la posture pendant un maximum de [#1A7331]5s[-]. Lorsque la posture est maintenue pendant la durée maximale, elle est retirée pour infliger des dégâts égaux à [#1A7331]32%[-] de l'attaque et [#0F5CD8]Étourdissement[-] pendant [#1A7331]4s[-].",
   "gameId": "daisy_wand_skill_rmb_ready",
   "icone": "Daisy_Wand_ActiveThird.webp",
   "nomFr": "Flash fruité",
   "recharge": 16.0,
   "weaponType": "Wand"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]59%[-] de l'attaque.",
   "gameId": "daisy_wand_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Et voilà Daisy",
   "recharge": null,
   "weaponType": "Wand"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Réduit la résistance au Vent des ennemis à portée de [#1A7331]20%[-] et leur taux de parade de [#1A7331]30%[-] pendant [#1A7331]10s[-]. Inflige [#0F5CD8]Graine du vent[-] pendant [#1A7331]20s[-] [#1A7331]toutes les secondes[-], et inflige des dégâts égaux à [#1A7331]19%[-] de l'attaque.\nChaque coup critique infligé à un ennemi à portée réduit le temps de recharge de [#0F5CD8]Graine du vent[-] de [#1A7331]1s[-].\n\n※ [#0F5CD8]Graine du vent[-] : réduit la résistance au Vent de [#1A7331]5%[-] pendant [#1A7331]20s[-] après avoir subi un coup critique. (Max : [#1A7331]4 fois[-])\nInflige des dégâts de Vent égaux à [#1A7331]80%[-] de l'attaque après avoir subi un coup critique. (Temps de recharge : [#1A7331]3s[-])",
   "gameId": "daisy_wand_skill_q",
   "icone": "Daisy_Wand_UltimateSKill.webp",
   "nomFr": "Encensoir sinistre d'énergumène",
   "recharge": 10.0,
   "weaponType": "Wand"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Inflige [#0F5CD8]Graine du vent[-] pendant [#1A7331]20s[-] chaque fois que l'attaque d'un héros allié inflige un coup critique.\n\n※ [#0F5CD8]Graine du vent[-] : réduit la résistance au Vent de [#1A7331]5%[-] pendant [#1A7331]20s[-] après avoir subi un coup critique. (Max : [#1A7331]4 fois[-])\nInflige des dégâts de Vent égaux à [#1A7331]80%[-] de l'attaque après avoir subi un coup critique. (Temps de recharge : [#1A7331]3s[-])",
   "gameId": "daisy_wand_passive",
   "icone": "Daisy_Wand_Passive.webp",
   "nomFr": "Fille excentrique",
   "recharge": 0.0,
   "weaponType": "Wand"
  }
 ],
 "derieri": [
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]69%[-] de l'attaque.\n1er coup : 10%\n2e coup : 12%\n3e coup : 18%\n4e coup : 29%",
   "gameId": "derieri_axe_jumpatk",
   "icone": "common_Axe_normalAttack.webp",
   "nomFr": "Assaut obscur",
   "recharge": null,
   "weaponType": "Axe"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]206%[-] de l'attaque, puis inflige [#0F5CD8]Floraison nocturne[-] à l'ennemi pendant [#1A7331]20s[-].\n\n※ [#0F5CD8]Floraison nocturne[-] : dégâts des Ténèbres supplémentaires égaux à [#1A7331]30%[-] de l'attaque de Derrierie lorsqu'un héros de l'équipe du lanceur reçoit un coup d'une compétence normale d'attribut Ténèbres.",
   "gameId": "derieri_axe_skill_e",
   "icone": "Derieri_Axe_NormalSkill.webp",
   "nomFr": "Croix ascendante",
   "recharge": 21.0,
   "weaponType": "Axe"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]142%[-] de l'attaque. Augmente les dégâts de compétence normale des héros alliés d'attribut Ténèbres de [#1A7331]50%[-] pendant [#1A7331]15s[-] en attaquant un ennemi sous l'effet de [#0F5CD8]Déluge des Ténèbres[-].",
   "gameId": "derieri_axe_skill_q",
   "icone": "Derieri_Axe_ActiveThird.webp",
   "nomFr": "Lancer de hache",
   "recharge": 10.0,
   "weaponType": "Axe"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]56%[-] de l'attaque.",
   "gameId": "derieri_axe_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Perforation abyssale",
   "recharge": null,
   "weaponType": "Axe"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]313%[-] de l'attaque. Attaquer des ennemis sous l'effet de [#0F5CD8]Déluge des Ténèbres[-] augmente les dégâts crit. de [#1A7331]60%[-].\nLa dernière frappe retire le [#0F5CD8]Déluge des Ténèbres[-] de la cible.",
   "gameId": "derieri_axe_skill_r",
   "icone": "Derieri_Axe_UltimateSkill.webp",
   "nomFr": "Entaille crépusculaire",
   "recharge": 10.0,
   "weaponType": "Axe"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Réduit la résistance aux Ténèbres de l'ennemi de [#1A7331]3%[-] pendant [#1A7331]30s[-] pour chaque attaque normale qui fait mouche. (Max : [#1A7331]10 fois[-])\nLorsqu'un héros allié active un [#0F5CD8]Déluge des Ténèbres[-], augmente les dégâts crit. des héros alliés d'attribut Ténèbres de [#1A7331]40%[-] pendant [#1A7331]30s[-].",
   "gameId": "derieri_axe_passive",
   "icone": "Derieri_Axe_Passive.webp",
   "nomFr": "Charge ténébreuse",
   "recharge": 0.0,
   "weaponType": "Axe"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]139%[-] de l'attaque.\n1er coup : 21%\n2e coup : 22%\n3e coup : 37%\n4e coup : 59%",
   "gameId": "derieri_gauntlets_jumpatk",
   "icone": "common_Gauntlets_normalAttack.webp",
   "nomFr": "Rafale de coups",
   "recharge": null,
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]501%[-] de l'attaque. La dernière frappe inflige [#0F5CD8]Duel[-] pendant [#1A7331]15s[-].\n1er coup : 186%\n2e coup : 315%\n\n※ [#0F5CD8]Duel[-] : augmente les dégâts infligés par l'utilisateur de [#1A7331]30%[-]. Inflige des dégâts égaux à [#1A7331]10%[-] de l'attaque du lanceur en subissant des attaques du lanceur.",
   "gameId": "derieri_gauntlets_skill_e_1",
   "icone": "Derieri_Gauntlets_NormalSkill_1.webp",
   "nomFr": "Assaut fulgurant",
   "recharge": 25.0,
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Immunise contre les réactions pendant l'utilisation de l'attaque spéciale.\nInflige des dégâts égaux à [#1A7331]574%[-] de l'attaque. Si tous les coups font mouche, réduit la consommation en magie de l'attaque ultime du héros de [#1A7331]50%[-] pendant [#1A7331]7s[-].\n1er coup : 93%\n2e coup : 118%\n3e coup : 157%\n4e coup : 206%",
   "gameId": "derieri_gauntlets_skill_q_1",
   "icone": "Derieri_Gauntlets_ActiveThird_1.webp",
   "nomFr": "Ruée sauvage",
   "recharge": 17.0,
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]120%[-] de l'attaque.",
   "gameId": "derieri_gauntlets_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Smash fracassant",
   "recharge": null,
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]1150%[-] de l'attaque.\nLa première frappe inflige [#0F5CD8]Étourdissement[-] pendant [#1A7331]3s[-].\n1er coup : 350%\n2e coup : 380%\n3e coup : 420%\nNe consomme pas de magie. [#3C22D6]Attaque ultime : Dévastation[-] devient disponible lorsque l'effet [#0F5CD8]Combo de coups[-] atteint le nombre de cumuls max.\n\n[#3C22D6]Dévastation[-]\nInflige des dégâts égaux à [#1A7331]650%[-] de l’attaque, puis retire [#0F5CD8]Combo de coups[-].",
   "gameId": "derieri_gauntlets_skill_r_enchant",
   "icone": "Derieri_Gauntlets_UltimateSkill_1.webp",
   "nomFr": "« Étoile combo »",
   "recharge": 10.0,
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Octroie [#0F5CD8]Combo de coups[-] au héros pendant [#1A7331]5s[-] pour chaque coup porté à l'ennemi.\nSi le héros effectue une action différente pendant l'utilisation consécutive de l'attaque spéciale, de la compétence normale et de l'attaque ultime, l'action précédente est annulée.\n\n※ [#0F5CD8]Combo de coups[-] : augmente les dégâts de [#0F5CD8]Duel[-] de [#1A7331]10%[-]. (Max : [#1A7331]50 fois[-])",
   "gameId": "derieri_gauntlets_passive",
   "icone": "Derieri_Gauntlets_Passive.webp",
   "nomFr": "Amplification de combo",
   "recharge": 0.0,
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]65%[-] de l'attaque.\n1er coup : 10%\n2e coup : 10%\n3e coup : 17%\n4e coup : 28%",
   "gameId": "derieri_sword2h_jumpatk",
   "icone": "common_Sword2H_normalAttack.webp",
   "nomFr": "Lame furieuse",
   "recharge": null,
   "weaponType": "Sword2h"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Augmente l'attaque de Feu de tous les héros alliés à hauteur de [#1A7331]30%[-] de l'attaque du héros (Max : [#1A7331]3000[-]) pendant [#1A7331]40s[-], puis inflige des dégâts égaux à [#1A7331]114%[-] de l'attaque + [#1A7331]13%[-] des PV restants de toute l'équipe.",
   "gameId": "derieri_sword2h_skill_e",
   "icone": "Derieri_Sword2h_NormalSkill.webp",
   "nomFr": "Taillade fracassante",
   "recharge": 27.0,
   "weaponType": "Sword2h"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]66%[-] de l'attaque + [#1A7331]7%[-] des PV restants de toute l'équipe, puis réduit la défense de Feu à hauteur de [#1A7331]20%[-] de la défense pendant [#1A7331]40s[-].",
   "gameId": "derieri_sword2h_skill_q",
   "icone": "Derieri_Sword2h_ActiveThird.webp",
   "nomFr": "Entaille en croix",
   "recharge": 16.0,
   "weaponType": "Sword2h"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]56%[-] de l'attaque.",
   "gameId": "derieri_sword2h_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Griffe ascendante",
   "recharge": null,
   "weaponType": "Sword2h"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "La première frappe inflige des dégâts égaux à [#1A7331]203%[-] de l'attaque + [#1A7331]21%[-] des PV restants, puis inflige des dégâts égaux à [#1A7331]20%[-] de l'attaque + [#1A7331]3%[-] des PV restants de toute l'équipe toutes les [#1A7331]1s[-] aux ennemis à portée pendant [#1A7331]10s[-].\nChaque coup de l'attaque augmente les dégâts d'attaque ultime ou d'attaque combinée subis par les ennemis de [#1A7331]30%[-] pendant [#1A7331]20s[-].",
   "gameId": "derieri_sword2h_skill_r",
   "icone": "Derieri_Sword2h_UltimateSkill.webp",
   "nomFr": "Secousse infernale",
   "recharge": 10.0,
   "weaponType": "Sword2h"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Lorsqu'un héros allié attaque un ennemi dont la défense de Feu est réduite, augmente les dégâts crit. d'attaque ultime et d'attaque combinée des héros d'attribut Feu de [#1A7331]60%[-].\nL'utilisation de l'attaque spéciale augmente les PV max du héros [#1A7331]20%[-] pendant [#1A7331]30s[-].",
   "gameId": "derieri_sword2h_passive",
   "icone": "Derieri_Sword2h_Passive.webp",
   "nomFr": "Marque ardente",
   "recharge": 0.0,
   "weaponType": "Sword2h"
  }
 ],
 "diane": [
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]109%[-] de l'attaque.\n1er coup : 26%\n2e coup : 31%\n3e coup : 52%",
   "gameId": "diane_axe_jumpatk",
   "icone": "common_Axe_normalAttack.webp",
   "nomFr": "Fendoir terrestre",
   "recharge": null,
   "weaponType": "Axe"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]205%[-] de l'attaque. Chaque attaque portée sur un ennemi sous l'effet de [#0F5CD8]Déluge de Terre[-] augmente les dégâts crit. du héros de [#1A7331]50%[-] pendant [#1A7331]20s[-].",
   "gameId": "diane_axe_skill_e",
   "icone": "Diane_Axe_NormalSkill.webp",
   "nomFr": "Taillade chargée",
   "recharge": 20.0,
   "weaponType": "Axe"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]100%[-] / [#1A7331]307%[-] de l'attaque en fonction du niveau de charge. Une attaque complètement chargée réinitialise le temps de recharge lorsque la dernière frappe fait mouche sur un ennemi affecté par [#0F5CD8]Brise-tout[-].",
   "gameId": "diane_axe_skill_rmb_ready",
   "icone": "Diane_Axe_ActiveThird.webp",
   "nomFr": "Écrasement sismique",
   "recharge": 25.0,
   "weaponType": "Axe"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]143%[-] de l'attaque. Porte un coup critique si l'ennemi est affecté par [#0F5CD8]Pétrification[-].",
   "gameId": "diane_axe_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Écrasement",
   "recharge": null,
   "weaponType": "Axe"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]371%[-] de l'attaque et inflige [#0F5CD8]Brise-tout[-] pendant [#1A7331]10s[-].\nUtiliser une attaque combinée avec l'attaque ultime du héros en tant que base augmente la défense de [#1A7331]30%[-] et les dégâts de compétence normale de [#1A7331]30%[-] pendant [#1A7331]20s[-].\n\n※ [#0F5CD8]Brise-tout[-] : inflige [#0F5CD8]Étourdissement[-] pendant [#1A7331]4s[-] la première fois que l'effet est infligé. Inflige des dégâts égaux à [#1A7331]150%[-] de la défense. Augmente les dégâts infligés par l'utilisateur de [#1A7331]30%[-].",
   "gameId": "diane_axe_skill_q",
   "icone": "Diane_Axe_UltimateSKill.webp",
   "nomFr": "Éclatement rocheux",
   "recharge": 10.0,
   "weaponType": "Axe"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Augmente les dégâts infligés aux ennemis sous l'effet de [#0F5CD8]Déluge de Terre[-] de [#1A7331]25%[-], et inflige [#0F5CD8]Brise-tout[-] pendant [#1A7331]10s[-] en les attaquant [#1A7331]5 fois[-].\n\n※ [#0F5CD8]Brise-tout[-] : inflige [#0F5CD8]Étourdissement[-] pendant [#1A7331]4s[-] la première fois que l'effet est infligé. Inflige des dégâts égaux à [#1A7331]150%[-] de la défense. Augmente les dégâts infligés par l'utilisateur de [#1A7331]30%[-].",
   "gameId": "diane_axe_passive",
   "icone": "Diane_Axe_Passive.webp",
   "nomFr": "Fille géante",
   "recharge": 0.0,
   "weaponType": "Axe"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]87%[-] de l'attaque.\n1er coup : 13%\n2e coup : 14%\n3e coup : 23%\n4e coup : 37%",
   "gameId": "diane_cudgel3c_jumpatk",
   "icone": "common_Cudgel3c_normalAttack.webp",
   "nomFr": "Frappe de Terre",
   "recharge": null,
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Pendant [#1A7331]10s[-], réduit la vitesse de déplacement des ennemis à portée de [#1A7331]40%[-] et inflige des dégâts égaux à [#1A7331]16%[-] de l'attaque toutes les [#1A7331]1s[-].\nInflige [#0F5CD8]Pétrification[-] pendant [#1A7331]6s[-] aux ennemis touchés [#1A7331]5 fois[-].\n\n※ [#0F5CD8]Pétrification[-] : immobilisation. Augmente les dégâts physiques et les dégâts de Terre subis de [#1A7331]50%[-]. Réduit les dégâts subis des éléments autres que physique et Terre de [#1A7331]75%[-].",
   "gameId": "diane_cudgel3c_skill_e",
   "icone": "Diane_Cudgel3c_NormalSkill.webp",
   "nomFr": "Sables du désert",
   "recharge": 30.0,
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]96%[-] de l'attaque. Si le héros bénéficie de l'effet [#0F5CD8]Cœur de la Terre[-], réduit l'attaque de l'ennemi de [#1A7331]30%[-] pendant [#1A7331]40s[-].",
   "gameId": "diane_cudgel3c_skill_rmb",
   "icone": "Diane_Cudgel3c_ActiveThird.webp",
   "nomFr": "Tir terrestre",
   "recharge": 20.0,
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]72%[-] de l'attaque.",
   "gameId": "diane_cudgel3c_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Fracas artistique",
   "recharge": null,
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]219%[-] de l'attaque. Réduit la résistance à la Terre de [#1A7331]20%[-] pendant [#1A7331]40s[-] lorsque la vitesse de déplacement de l'ennemi est réduite.",
   "gameId": "diane_cudgel3c_skill_q",
   "icone": "Diane_Cudgel3c_UltimateSKill.webp",
   "nomFr": "Soulèvement terrestre",
   "recharge": 10.0,
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Octroie [#0F5CD8]Cœur de la Terre[-] à tous les héros alliés pendant [#1A7331]20s[-] lorsque le héros fait mouche avec [#1A7331]20[-] attaque(s).\n\n※ [#0F5CD8]Cœur de la Terre[-] : [#0F5CD8]provoque[-] les ennemis proches pendant [#1A7331]5s[-] la première fois que l'effet est octroyé. Octroie une barrière égale à [#1A7331]15%[-] des PV max et restaure les PV à hauteur de [#1A7331]10%[-] de la défense toutes les [#1A7331]0.5s[-].",
   "gameId": "diane_cudgel3c_passive",
   "icone": "Diane_Cudgel3c_Passive.webp",
   "nomFr": "Souffle des géants",
   "recharge": 0.0,
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]103%[-] de l'attaque. Chaque coup augmente la jauge de Déluge de [#1A7331]20[-] lorsque l'effet [#0F5CD8]Heavy Métal[-] est actif.\n1er coup : 15%\n2e coup : 17%\n3e coup : 27%\n4e coup : 44%",
   "gameId": "diane_gauntlets_jumpatk",
   "icone": "common_Gauntlets_normalAttack.webp",
   "nomFr": "Coup de poing terrestre",
   "recharge": null,
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]181%[-] de l'attaque et augmente la défense du héros de [#1A7331]30%[-] pendant [#1A7331]30s[-].",
   "gameId": "diane_gauntlets_skill_e",
   "icone": "Diane_Gauntlets_NormalSkill.webp",
   "nomFr": "Ferveur martiale",
   "recharge": 15.0,
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]145%[-] de l'attaque. Chaque coup augmente la jauge de Déluge de [#1A7331]30[-] lorsque l'effet [#0F5CD8]Heavy Métal[-] est actif.\n1er coup : 30%\n2e coup : 45%\n3e coup : 70%",
   "gameId": "diane_gauntlets_skill_rmb_1",
   "icone": "Diane_Gauntlets_ActiveThird.webp",
   "nomFr": "Combinaison de coups de pied",
   "recharge": 5.0,
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]88%[-] de l'attaque et inflige [#0F5CD8]Provocation[-] pendant [#1A7331]3s[-].",
   "gameId": "diane_gauntlets_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Chute de pierres",
   "recharge": null,
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Octroie [#0F5CD8]Heavy Métal[-] pendant [#1A7331]15s[-], puis inflige des dégâts égaux à [#1A7331]278%[-] de l'attaque.\n\n※ [#0F5CD8]Heavy Métal[-] : devient immunisé à toutes les réactions. Augmente la jauge de Déluge de l'ennemi de [#1A7331]50[-] et augmente la résistance au percement du héros de [#1A7331]3%[-] pendant [#1A7331]20s[-] en subissant une attaque. (Max : [#1A7331]10 fois[-])",
   "gameId": "diane_gauntlets_skill_q",
   "icone": "Diane_Gauntlets_UltimateSKill.webp",
   "nomFr": "Plongeon métallique",
   "recharge": 10.0,
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Inflige des dégâts supplémentaires égaux à [#1A7331]10%[-] de la défense à chaque coup porté sur l'ennemi et octroie [#0F5CD8]Passion[-] pendant [#1A7331]10s[-] en alternant entre l'attaque normale et l'attaque spéciale.\n\n※ [#0F5CD8]Passion[-] : chaque coup augmente la jauge de Déluge de [#1A7331]20[-]. (Max : [#1A7331]5 fois[-])",
   "gameId": "diane_gauntlets_passive",
   "icone": "Diane_Gauntlets_Passive.webp",
   "nomFr": "Art secret des géants",
   "recharge": 0.0,
   "weaponType": "Gauntlets"
  }
 ],
 "drake": [
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]84%[-] de l'attaque.\n1er coup : 13%\n2e coup : 14%\n3e coup : 22%\n4e coup : 35%",
   "gameId": "drake_staff_jumpatk",
   "icone": "common_Staff_normalAttack.webp",
   "nomFr": "Paratonnerre",
   "recharge": null,
   "weaponType": "Staff"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]114%[-] de l'attaque. Inflige [#0F5CD8]Électrocution[-] pendant [#1A7331]10s[-] en attaquant un ennemi avec [#1A7331]3[-] cumuls ou plus de [#0F5CD8]Courant électrique[-].\n\n※ [#0F5CD8]Électrocution[-] : inflige des dégâts de Foudre égaux à [#1A7331]15%[-] de l'attaque toutes les [#1A7331]2s[-]. Inflige [#0F5CD8]Électrocution[-] aux ennemis proches pendant [#1A7331]10s[-] en subissant une attaque.",
   "gameId": "drake_staff_skill_e",
   "icone": "Drake_Staff_NormalSkill.webp",
   "nomFr": "Lance foudroyante",
   "recharge": 13.0,
   "weaponType": "Staff"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]61%[-] de l'attaque.\nLa dernière frappe inflige [#1A7331]2[-] cumul(s) de [#0F5CD8]Courant électrique[-] pendant [#1A7331]40s[-]. (Max : [#1A7331]5 fois[-]). Inflige [#0F5CD8]Paralysie[-] si l'ennemi est affecté par [#0F5CD8]Électrocution[-].\n\n※ [#0F5CD8]Courant électrique[-] : réduit la défense crit. de [#1A7331]8%[-].\n※ [#0F5CD8]Paralysie[-] : immobilisation. Réduit la résistance à la Foudre de [#1A7331]15%[-]. L'effet perdure si la cible est [#0F5CD8]Électrocutée[-].",
   "gameId": "drake_staff_skill_rmb",
   "icone": "Drake_Staff_ActiveThird.webp",
   "nomFr": "Tempête de Foudre",
   "recharge": 8.0,
   "weaponType": "Staff"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]62%[-] de l'attaque. La dernière frappe inflige [#0F5CD8]Électrocution[-] pendant [#1A7331]10s[-].\n\n※ [#0F5CD8]Électrocution[-] : inflige des dégâts de Foudre égaux à [#1A7331]15%[-] de l'attaque toutes les [#1A7331]2s[-]. Inflige [#0F5CD8]Électrocution[-] aux ennemis proches pendant [#1A7331]10s[-] en subissant une attaque.",
   "gameId": "drake_staff_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Frappe du bâton foudroyant",
   "recharge": null,
   "weaponType": "Staff"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]191%[-] de l'attaque. Chaque coup augmente les dégâts de [#1A7331]6%[-] en attaquant un ennemi avec [#1A7331]5[-] cumuls ou plus de [#0F5CD8]Courant électrique[-].\nPorte un coup critique si l'ennemi est [#0F5CD8]Paralysé[-].",
   "gameId": "drake_staff_skill_q",
   "icone": "Drake_Staff_UltimateSKill.webp",
   "nomFr": "Surcharge foudroyante",
   "recharge": 10.0,
   "weaponType": "Staff"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Inflige [#0F5CD8]Courant électrique[-] pendant [#1A7331]40s[-] après avoir réussi l'attaque normale. (Max : [#1A7331]5 fois[-])\nAugmente l'attaque de Foudre de [#1A7331]5%[-] pour chaque tranche de [#1A7331]1[-] cumul(s) lorsqu'un héros allié attaque un ennemi affecté par [#0F5CD8]Courant électrique[-], et augmente les chances crit. de [#1A7331]15%[-] lorsque l'ennemi est [#0F5CD8]paralysé[-].\n\n※ [#0F5CD8]Courant électrique[-] : réduit la défense crit. de [#1A7331]8%[-].",
   "gameId": "drake_staff_passive",
   "icone": "Drake_Staff_Passive.webp",
   "nomFr": "Autorité de roi",
   "recharge": 0.0,
   "weaponType": "Staff"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]101%[-] de l'attaque.\n1er coup : 15%\n2e coup : 16%\n3e coup : 26%\n4e coup : 44%",
   "gameId": "drake_sword1h_jumpatk",
   "icone": "common_Sword1H_normalAttack.webp",
   "nomFr": "Taillade foudroyante",
   "recharge": null,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Octroie [#0F5CD8]Pulsion[-] à tous les héros alliés pendant [#1A7331]20s[-].\n\n※ [#0F5CD8]Pulsion[-] : inflige des dégâts égaux à [#1A7331]3%[-] de l'attaque aux ennemis proches toutes les [#1A7331]0.3s[-]. Augmente la jauge de Déluge de [#1A7331]30[-] en subissant une attaque [#1A7331]5 fois[-].",
   "gameId": "drake_sword1h_skill_e",
   "icone": "Drake_Sword1h_NormalSkill.webp",
   "nomFr": "Pulsion",
   "recharge": 20.0,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]105%[-] de l'attaque. Augmente la jauge de Déluge de [#1A7331]20[-] tous les [#1A7331]3[-] coup(s) lorsque l'effet [#0F5CD8]Pulsion[-] est actif sur le héros.",
   "gameId": "drake_sword1h_skill_rmb",
   "icone": "Drake_Sword1h_ActiveThird.webp",
   "nomFr": "Taillade éclair",
   "recharge": 10.0,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]88%[-] de l'attaque.",
   "gameId": "drake_sword1h_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Taillade du tonnerre",
   "recharge": null,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]239%[-] de l'attaque, puis réduit la résistance au Déluge de Foudre de [#1A7331]30%[-] pendant [#1A7331]30s[-].",
   "gameId": "drake_sword1h_skill_q",
   "icone": "Drake_Sword1h_UltimateSKill.webp",
   "nomFr": "Lame fantomatique",
   "recharge": 10.0,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Augmente l'efficacité de Déluge de Foudre du héros de [#1A7331]30%[-] lorsque l'effet [#0F5CD8]Pulsion[-] est actif.",
   "gameId": "drake_sword1h_passive",
   "icone": "Drake_Sword1h_Passive.webp",
   "nomFr": "Roi belliqueux",
   "recharge": 0.0,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]181%[-] de l'attaque.\n1er coup : 17%\n2e coup : 20%\n3e coup : 30%\n4e coup : 50%\n5e coup : 64%",
   "gameId": "drake_sword2h_jumpatk",
   "icone": "common_Sword2H_normalAttack.webp",
   "nomFr": "Lame foudroyante",
   "recharge": null,
   "weaponType": "Sword2h"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]276%[-] de l'attaque. Octroie au héros [#0F5CD8]Magie du roi[-] pendant [#1A7331]20s[-] lors de la première frappe. (Max : [#1A7331]3[-])\n\n※ [#0F5CD8]Magie du roi[-] : augmente l'attaque de Foudre de [#1A7331]10%[-] et les chances crit. de [#1A7331]5%[-] pour chaque tranche de [#1A7331]1[-] cumul(s).",
   "gameId": "drake_sword2h_skill_e_1",
   "icone": "Drake_Sword2h_NormalSkill.webp",
   "nomFr": "Torrent de foudre",
   "recharge": 18.0,
   "weaponType": "Sword2h"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]177%[-] de l'attaque.\nRéduit le temps de recharge de la compétence normale de [#1A7331]1s[-] pour chaque coup, et le réduit de [#1A7331]2s[-] supplémentaires si l'ennemi est sous l'effet d'un [#0F5CD8]Déluge de Foudre[-].",
   "gameId": "drake_sword2h_skill_rmb_1",
   "icone": "Drake_Sword2h_ActiveThird.webp",
   "nomFr": "Taillade perforante",
   "recharge": 7.0,
   "weaponType": "Sword2h"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]129%[-] de l'attaque.",
   "gameId": "drake_sword2h_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Frappe du dragon foudroyant",
   "recharge": null,
   "weaponType": "Sword2h"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]461%[-] de l'attaque. Augmente les dégâts infligés de [#1A7331]30%[-] pour [#1A7331]chaque[-] effet de [#0F5CD8]Magie du roi[-] présent sur le héros.\nLa première frappe réduit le temps de recharge de la compétence normale de [#1A7331]50%[-].",
   "gameId": "drake_sword2h_skill_q",
   "icone": "Drake_Sword2h_UltimateSKill.webp",
   "nomFr": "Courroux du dragon foudroyant",
   "recharge": 10.0,
   "weaponType": "Sword2h"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "L'utilisation de la compétence normale octroie au héros un boost de réduction du temps de recharge de [#1A7331]10%[-] pendant [#1A7331]10s[-]. (Max : [#1A7331]3 fois[-])",
   "gameId": "drake_sword2h_passive",
   "icone": "Drake_Sword2h_Passive.webp",
   "nomFr": "Roi des dragons",
   "recharge": 0.0,
   "weaponType": "Sword2h"
  }
 ],
 "dreydrin": [
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]83%[-] de l'attaque.\n1er coup : 9%\n2e coup : 10%\n3e coup : 14%\n4e coup : 21%\n5e coup : 29%",
   "gameId": "dreydrin_axe_jumpatk",
   "icone": "common_Axe_normalAttack.webp",
   "nomFr": "Taillade intégrale",
   "recharge": null,
   "weaponType": "Axe"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]121%[-] de l'attaque. Restaure la jauge de relève de [#1A7331]300[-] en attaquant un ennemi affecté par [#0F5CD8]Pétrification[-], [#0F5CD8]Gel[-], [#0F5CD8]Étourdissement[-] ou [#0F5CD8]Paralysie[-].",
   "gameId": "dreydrin_axe_skill_e",
   "icone": "Dreydrin_Axe_NormalSkill.webp",
   "nomFr": "Cri de guerre",
   "recharge": 17.0,
   "weaponType": "Axe"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]71%[-] / [#1A7331]119%[-] de l'attaque en fonction du niveau de charge. Une attaque complètement chargée inflige [#0F5CD8]Étourdissement[-] à l'ennemi pendant [#1A7331]5s[-].",
   "gameId": "dreydrin_axe_skill_rmb_ready",
   "icone": "Dreydrin_Axe_ActiveThird.webp",
   "nomFr": "Écrasement puissant",
   "recharge": 7.0,
   "weaponType": "Axe"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]63%[-] de l'attaque.",
   "gameId": "dreydrin_axe_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Hache ascendante",
   "recharge": null,
   "weaponType": "Axe"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]186%[-] de l'attaque. Augmente de [#1A7331]30%[-] les dégâts infligés en attaquant un ennemi affecté par [#0F5CD8]Pétrification[-], [#0F5CD8]Gel[-], [#0F5CD8]Étourdissement[-] ou [#0F5CD8]Paralysie[-].",
   "gameId": "dreydrin_axe_skill_q",
   "icone": "Dreydrin_Axe_UltimateSkill.webp",
   "nomFr": "Cri de géant",
   "recharge": 10.0,
   "weaponType": "Axe"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Attaquer un ennemi affecté par [#0F5CD8]Pétrification[-], [#0F5CD8]Gel[-], [#0F5CD8]Étourdissement[-] ou [#0F5CD8]Paralysie[-] réduit sa défense de [#1A7331]10%[-] pendant [#1A7331]30s[-].",
   "gameId": "dreydrin_axe_passive",
   "icone": "Dreydrin_Axe_Passive.webp",
   "nomFr": "Sens du combat",
   "recharge": 0.0,
   "weaponType": "Axe"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]61%[-] de l'attaque.\n1er coup : 9%\n2e coup : 10%\n3e coup : 15%\n4e coup : 27%",
   "gameId": "dreydrin_rapier_jumpatk",
   "icone": "common_Rapier_normalAttack.webp",
   "nomFr": "Baïonnette divine",
   "recharge": null,
   "weaponType": "Rapier"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]136%[-] de l'attaque. Chaque coup restaure la jauge de magie de [#1A7331]50[-].",
   "gameId": "dreydrin_rapier_skill_e",
   "icone": "Dreydrin_Rapier_NormalSkill.webp",
   "nomFr": "Volonté divine",
   "recharge": 17.0,
   "weaponType": "Rapier"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]76%[-] de l'attaque. Augmente l'efficacité de recharge de la magie du héros de [#1A7331]10%[-] pendant [#1A7331]40s[-].",
   "gameId": "dreydrin_rapier_skill_rmb",
   "icone": "Dreydrin_Rapier_ActiveThird.webp",
   "nomFr": "Pulsation lumineuse",
   "recharge": 8.0,
   "weaponType": "Rapier"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]73%[-] de l'attaque.",
   "gameId": "dreydrin_rapier_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Lance de lumière",
   "recharge": null,
   "weaponType": "Rapier"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Augmente l'attaque des alliés à portée de [#1A7331]10%[-] pendant [#1A7331]15s[-].",
   "gameId": "dreydrin_rapier_skill_q",
   "icone": "Dreydrin_Rapier_UltimateSKill.webp",
   "nomFr": "Combat divin",
   "recharge": 10.0,
   "weaponType": "Rapier"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Augmente l'efficacité de recharge de la magie du héros de [#1A7331]15%[-] lorsqu'il possède [#1A7331]3[-] points de magie ou moins.",
   "gameId": "dreydrin_rapier_passive",
   "icone": "Dreydrin_Rapier_Passive.webp",
   "nomFr": "Esprit divisé",
   "recharge": 0.0,
   "weaponType": "Rapier"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]115%[-] de l'attaque.\n1er coup : 11%\n2e coup : 13%\n3e coup : 20%\n4e coup : 31%\n5e coup : 40%",
   "gameId": "dreydrin_shield_jumpatk",
   "icone": "common_Shield_normalAttack.webp",
   "nomFr": "Taillade de garde",
   "recharge": null,
   "weaponType": "Shield"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]70%[-] de l'attaque. Chaque coup inflige des dégâts supplémentaires égaux à [#1A7331]30%[-] de la défense.",
   "gameId": "dreydrin_shield_skill_e",
   "icone": "Dreydrin_Shield_NormalSkill.webp",
   "nomFr": "Bouclier fracassant",
   "recharge": 16.0,
   "weaponType": "Shield"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Octroie une [#0F5CD8]barrière[-] égale à [#1A7331]50%[-] de la défense et immunise contre les réactions tant que la posture est maintenue.\nLa posture dure jusqu'à [#1A7331]10s[-], et elle est retirée lorsque la [#0F5CD8]barrière[-] est retirée.\nLorsque le héros est touché alors qu'il maintient la posture, augmente la défense de tous les héros alliés de [#1A7331]5%[-] pendant [#1A7331]40s[-]. (Max : [#1A7331]5 fois[-])",
   "gameId": "dreydrin_shield_skill_rmb_ready",
   "icone": "Dreydrin_Shield_ActiveThird.webp",
   "nomFr": "Champ de boucliers",
   "recharge": 20.0,
   "weaponType": "Shield"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]72%[-] de l'attaque.",
   "gameId": "dreydrin_shield_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Descente d'épée",
   "recharge": null,
   "weaponType": "Shield"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Augmente la défense de tous les héros alliés de [#1A7331]20%[-] et les PV max à hauteur de [#1A7331]100%[-] de la défense du héros pendant [#1A7331]20s[-].",
   "gameId": "dreydrin_shield_skill_q",
   "icone": "Dreydrin_Shield_UltimateSkill.webp",
   "nomFr": "Jardin pur",
   "recharge": 10.0,
   "weaponType": "Shield"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Chaque fois que le héros subit une attaque tandis que ses PV sont inférieurs ou égaux à [#1A7331]30%[-], octroie à tous les héros alliés des [#0F5CD8]barrières[-] égales à [#1A7331]18%[-] des PV max pendant [#1A7331]20s[-]. (Temps de recharge : [#1A7331]60s[-])",
   "gameId": "dreydrin_shield_passive",
   "icone": "Dreydrin_Shield_Passive.webp",
   "nomFr": "Volonté inébranlable",
   "recharge": 0.0,
   "weaponType": "Shield"
  }
 ],
 "dreyfus": [
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]148%[-] de l'attaque. [#1A7331]63%[-] de chances d'octroyer [#1A7331]1[-] effet(s) [#0F5CD8]Déferlement[-] pendant [#1A7331]10s[-].\n1er coup : 23%\n2e coup : 25%\n3e coup : 37%\n4e coup : 63%\n\n※ [#0F5CD8]Déferlement[-] : augmente les dégâts crit. de [#1A7331]8%[-] (Max : [#1A7331]5 fois[-]). Une fois atteint le nombre maximal de cumuls, se transforme en [#0F5CD8]Déferlement amélioré[-] qui augmente les dégâts crit. de [#1A7331]40%[-].",
   "gameId": "dreyfus_lance_jumpatk",
   "icone": "common_Lance_normalAttack.webp",
   "nomFr": "Poignard du Sacré",
   "recharge": null,
   "weaponType": "Lance"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]287%[-] de l'attaque. Inflige [#0F5CD8]Étourdissement[-] aux ennemis pendant [#1A7331]5s[-] lorsque l'effet [#0F5CD8]Déferlement[-] est présent sur le héros.",
   "gameId": "dreyfus_lance_skill_e",
   "icone": "Dreyfus_Lance_NormalSkill.webp",
   "nomFr": "Pilier de lumière",
   "recharge": 18.0,
   "weaponType": "Lance"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]180%[-] de l'attaque et octroie [#1A7331]1[-] cumul(s) [#0F5CD8]Déferlement[-] pendant [#1A7331]10s[-]. Un coup porté sur un ennemi sous l'effet d'un Déluge octroie également [#1A7331]1[-] cumul(s) supplémentaire(s) de [#0F5CD8]Déferlement[-].\n\n※ [#0F5CD8]Déferlement[-] : augmente les dégâts crit. de [#1A7331]8%[-] (Max : [#1A7331]5[-]) Une fois atteint le nombre maximal de cumuls, se transforme en [#0F5CD8]Déferlement amélioré[-] qui augmente les dégâts crit. de [#1A7331]40%[-].",
   "gameId": "dreyfus_lance_skill_rmb",
   "icone": "Dreyfus_Lance_ActiveThird.webp",
   "nomFr": "Brisure sacrée",
   "recharge": 7.0,
   "weaponType": "Lance"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]110%[-] de l'attaque.",
   "gameId": "dreyfus_lance_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Impact de lance",
   "recharge": null,
   "weaponType": "Lance"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]424%[-] de l'attaque.\nPorte un coup critique si le héros bénéficie de [#0F5CD8]Déferlement amélioré[-]. Retire ensuite [#0F5CD8]Déferlement amélioré[-] du héros.",
   "gameId": "dreyfus_lance_skill_q",
   "icone": "Dreyfus_Lance_UltimateSKill.webp",
   "nomFr": "Lance lumineuse",
   "recharge": 10.0,
   "weaponType": "Lance"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Augmente les dégâts de [#1A7331]30%[-] en attaquant un ennemi qui bénéficie d'une [#0F5CD8]barrière[-].",
   "gameId": "dreyfus_lance_passive",
   "icone": "Dreyfus_Lance_Passive.webp",
   "nomFr": "Collision de barrière",
   "recharge": 0.0,
   "weaponType": "Lance"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]62%[-] de l'attaque.\n1er coup : 9%\n2e coup : 10%\n3e coup : 16%\n4e coup : 27%",
   "gameId": "dreyfus_rapier_jumpatk",
   "icone": "common_Rapier_normalAttack.webp",
   "nomFr": "Piqûre perçante",
   "recharge": null,
   "weaponType": "Rapier"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]140%[-] de l'attaque. Restaure la jauge de relève de [#1A7331]150[-] pour tous les [#1A7331]1[-] cumul(s) [#0F5CD8]Affaiblissement[-] présent(s) sur l'ennemi.",
   "gameId": "dreyfus_rapier_skill_e",
   "icone": "Dreyfus_Rapier_NormalSkill.webp",
   "nomFr": "Foudre perçante",
   "recharge": 18.0,
   "weaponType": "Rapier"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]83%[-] de l'attaque. La dernière frappe inflige [#1A7331]1[-] cumul(s) d'[#0F5CD8]Affaiblissement[-] pendant [#1A7331]40s[-].\n\n[#0F5CD8]※ Affaiblissement[-] : augmente les dégâts sur la durée subis de [#1A7331]5%[-]. (Max : [#1A7331]5 fois[-])",
   "gameId": "dreyfus_rapier_skill_rmb_1",
   "icone": "Dreyfus_Rapier_ActiveThird.webp",
   "nomFr": "Brise-dard",
   "recharge": 7.0,
   "weaponType": "Rapier"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]73%[-] de l'attaque. Chaque coup inflige [#1A7331]2[-] cumul(s) d'[#0F5CD8]Affaiblissement[-] pendant [#1A7331]40s[-] en attaquant un ennemi affecté par [#0F5CD8]Électrocution[-] ou [#0F5CD8]Saignement[-].\n\n※ [#0F5CD8]Affaiblissement[-] : augmente les dégâts sur la durée subis de [#1A7331]5%[-]. (Max : [#1A7331]5 fois[-])",
   "gameId": "dreyfus_rapier_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Plongeon fulgurant",
   "recharge": null,
   "weaponType": "Rapier"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]161%[-] de l'attaque. Lorsque l'effet [#0F5CD8]Affaiblissement[-] atteint le nombre de cumuls max sur l'ennemi, inflige [#0F5CD8]Étourdissement[-] pendant [#1A7331]8s[-].",
   "gameId": "dreyfus_rapier_skill_q",
   "icone": "Dreyfus_Rapier_UltimateSKill.webp",
   "nomFr": "Bombardier de lumière",
   "recharge": 10.0,
   "weaponType": "Rapier"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Augmente les dégâts sur la durée de tous les héros alliés de [#1A7331]15%[-].\nRéduit le délai d'infliction des dégâts sur la durée de [#1A7331]20%[-] pendant [#1A7331]15s[-] en attaquant un ennemi affecté par [#0F5CD8]Électrocution[-] ou [#0F5CD8]Saignement[-].",
   "gameId": "dreyfus_rapier_passive",
   "icone": "Dreyfus_Rapier_Passive.webp",
   "nomFr": "Estoc lacérant",
   "recharge": 0.0,
   "weaponType": "Rapier"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]110%[-] de l'attaque.\n1er coup : 26%\n2e coup : 31%\n3e coup : 53%",
   "gameId": "dreyfus_sword1h_jumpatk",
   "icone": "common_Sword1H_normalAttack.webp",
   "nomFr": "Taillade de Terre",
   "recharge": null,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]256%[-] de l'attaque. Réduit le temps de recharge de [#1A7331]50%[-] en attaquant un ennemi affecté par [#0F5CD8]Arrogance[-].",
   "gameId": "dreyfus_sword1h_skill_e",
   "icone": "Dreyfus_Sword1H_NormalSkill.webp",
   "nomFr": "Lame de Terre",
   "recharge": 17.0,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]162%[-] de l'attaque et inflige [#0F5CD8]Arrogance[-] pendant [#1A7331]10s[-].\n\n※ [#0F5CD8]Arrogance[-] : augmente les dégâts infligés par l'utilisateur de [#1A7331]20%[-].",
   "gameId": "dreyfus_sword1h_skill_rmb",
   "icone": "Dreyfus_Sword1H_ActiveThird.webp",
   "nomFr": "Taillade terrestre",
   "recharge": 15.0,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]131%[-] de l'attaque.",
   "gameId": "dreyfus_sword1h_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Entaille terrestre oblique",
   "recharge": null,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]400%[-] de l'attaque. Augmente les dégâts infligés aux ennemis affectés par [#0F5CD8]Pétrification[-] de [#1A7331]50%[-].",
   "gameId": "dreyfus_sword1h_skill_q",
   "icone": "Dreyfus_Sword1H_UltimateSKill.webp",
   "nomFr": "Fracture terrestre",
   "recharge": 10.0,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Chaque attaque portée sur un ennemi sous l'effet de [#0F5CD8]Déluge de Terre[-] augmente les dégâts de [#1A7331]20%[-].",
   "gameId": "dreyfus_sword1h_passive",
   "icone": "Dreyfus_Sword1h_Passive.webp",
   "nomFr": "Honneur de capitaine",
   "recharge": 0.0,
   "weaponType": "Sword1h"
  }
 ],
 "elaine": [
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]89%[-] de l'attaque.\n1er coup : 13%\n2e coup : 14%\n3e coup : 23%\n4e coup : 39%",
   "gameId": "elaine_book_jumpatk",
   "icone": "common_Book_normalAttack.webp",
   "nomFr": "Fleur de Vent",
   "recharge": null,
   "weaponType": "Book"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]126%[-] de l'attaque.\nOctroie des [#0F5CD8]barrières[-] aux alliés égales à [#1A7331]135%[-] de la défense pendant [#1A7331]20s[-]. Réduit les dégâts subis par les alliés de [#1A7331]10%[-] lorsque les [#0F5CD8]barrières[-] sont actives.",
   "gameId": "elaine_book_skill_e",
   "icone": "Elaine_Book_NormalSkill.webp",
   "nomFr": "Fleur de la gardienne",
   "recharge": 35.0,
   "weaponType": "Book"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]79%[-] de l'attaque, puis applique [#0F5CD8]Marque de la sainte[-] aux alliés et ennemis proches pendant [#1A7331]20s[-].\n\n※ [#0F5CD8]Marque de la sainte[-] : les effets diffèrent en fonction de la cible.\nAlliés : restaure la jauge de relève de [#1A7331]50[-] toutes les [#1A7331]1s[-].\nEnnemis : réduit la résistance au Déluge de Terre de [#1A7331]20%[-].",
   "gameId": "elaine_book_skill_rmb",
   "icone": "Elaine_Book_ActiveThird.webp",
   "nomFr": "Domaine de la sainte",
   "recharge": 12.0,
   "weaponType": "Book"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]66%[-] de l'attaque.",
   "gameId": "elaine_book_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Sauveuse de la forêt",
   "recharge": null,
   "weaponType": "Book"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]206%[-] de l'attaque et inflige [#0F5CD8]Pétrification[-] pendant [#1A7331]6s[-].\n\n※ [#0F5CD8]Pétrification[-] : immobilisation. Augmente les dégâts physiques et les dégâts de Terre subis de [#1A7331]50%[-], et réduit les dégâts subis des éléments autres que physique et Terre de [#1A7331]75%[-].",
   "gameId": "elaine_book_skill_q",
   "icone": "Elaine_Book_UltimateSKill.webp",
   "nomFr": "Sceau de poussière",
   "recharge": 10.0,
   "weaponType": "Book"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Augmente les dégâts de Terre de [#1A7331]30%[-] et les dégâts de compétence de relève de [#1A7331]50%[-] lorsqu'un héros allié bénéficie d'une [#0F5CD8]barrière[-].",
   "gameId": "elaine_book_passive",
   "icone": "Elaine_Book_Passive.webp",
   "nomFr": "Protection de la sainte",
   "recharge": 0.0,
   "weaponType": "Book"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]109%[-] de l'attaque.\n1er coup : 16%\n2e coup : 18%\n3e coup : 27%\n4e coup : 48%",
   "gameId": "elaine_staff_jumpatk",
   "icone": "common_Staff_normalAttack.webp",
   "nomFr": "Graine de lumière",
   "recharge": null,
   "weaponType": "Staff"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]33%[-] de l'attaque aux ennemis à portée toutes les [#1A7331]1.5s[-] pendant [#1A7331]8s[-].",
   "gameId": "elaine_staff_skill_e",
   "icone": "Elaine_Staff_NormalSkill.webp",
   "nomFr": "Nuée de la forêt divine",
   "recharge": 12.0,
   "weaponType": "Staff"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Augmente l'efficacité de Déluge de tous les éléments des alliés à portée de [#1A7331]30%[-] pendant [#1A7331]10s[-].",
   "gameId": "elaine_staff_skill_rmb",
   "icone": "Elaine_Staff_ActiveThird.webp",
   "nomFr": "Onde lumineuse",
   "recharge": 13.0,
   "weaponType": "Staff"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]88%[-] de l'attaque.",
   "gameId": "elaine_staff_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Éclat sacré",
   "recharge": null,
   "weaponType": "Staff"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Réduit les dégâts subis par les alliés proches de [#1A7331]15%[-] et la résistance au Déluge de tous les éléments des ennemis de [#1A7331]25%[-] pendant [#1A7331]20s[-].",
   "gameId": "elaine_staff_skill_q",
   "icone": "Elaine_Staff_UltimateSKill.webp",
   "nomFr": "Bénédiction de la forêt",
   "recharge": 10.0,
   "weaponType": "Staff"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Augmente l'efficacité de Déluge de tous les éléments du héros de [#1A7331]20%[-]. Restaure [#1A7331]2[-] point(s) de magie en activant un [#0F5CD8]Déluge[-]. (Temps de recharge : [#1A7331]20s[-])",
   "gameId": "elaine_staff_passive",
   "icone": "Elaine_Staff_Passive.webp",
   "nomFr": "Assistance de la sainte",
   "recharge": 0.0,
   "weaponType": "Staff"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]154%[-] de l'attaque. La dernière frappe réduit le temps de recharge de la compétence normale de [#1A7331]1s[-].\n1er coup : 25%\n2e coup : 27%\n3e coup : 43%\n4e coup : 59%",
   "gameId": "elaine_wand_jumpatk",
   "icone": "common_Wand_normalAttack.webp",
   "nomFr": "Perle de Vent",
   "recharge": null,
   "weaponType": "Wand"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]202%[-] de l'attaque. Chaque coup critique augmente les dégâts crit. du héros de [#1A7331]20%[-] pendant [#1A7331]5s[-]. (Max : [#1A7331]3 fois[-])",
   "gameId": "elaine_wand_skill_e",
   "icone": "Elaine_Wand_NormalSkill.webp",
   "nomFr": "Vents tranchants",
   "recharge": 17.0,
   "weaponType": "Wand"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]66%[-] de l'attaque toutes les [#1A7331]1s[-] tant que la posture est maintenue. Réduit le temps de recharge de la compétence normale du héros de [#1A7331]3s[-] pour chaque coup porté.",
   "gameId": "elaine_wand_skill_rmb_ready",
   "icone": "Elaine_Wand_ActiveThird.webp",
   "nomFr": "Voile tourbillonnant",
   "recharge": 10.0,
   "weaponType": "Wand"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]138%[-] de l'attaque. Chaque coup critique restaure la jauge de relève de [#1A7331]35[-].",
   "gameId": "elaine_wand_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Tornade de la forêt",
   "recharge": null,
   "weaponType": "Wand"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]402%[-] de l'attaque et réduit le temps de recharge de la compétence normale du héros de [#1A7331]15s[-].",
   "gameId": "elaine_wand_skill_q",
   "icone": "Elaine_Wand_UltimateSKill.webp",
   "nomFr": "Rafale de vent",
   "recharge": 10.0,
   "weaponType": "Wand"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Chaque attaque portée sur un ennemi sous l'effet de [#0F5CD8]Déluge de Vent[-] augmente les chances crit. de [#1A7331]33%[-] pendant [#1A7331]5s[-].",
   "gameId": "elaine_wand_passive",
   "icone": "Elaine_Wand_Passive.webp",
   "nomFr": "Jugement de la sainte",
   "recharge": 0.0,
   "weaponType": "Wand"
  }
 ],
 "elizabeth": [
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]89%[-] de la défense.\n1er coup : 13%\n2e coup : 14%\n3e coup : 24%\n4e coup : 38%",
   "gameId": "elizabeth_book_jumpatk",
   "icone": "common_Book_normalAttack.webp",
   "nomFr": "Gouttelettes illuminées par l'été",
   "recharge": null,
   "weaponType": "Book"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Toutes les [#1A7331]1s[-] pendant [#1A7331]20s[-], restaure les PV de tous les alliés à portée à hauteur de [#1A7331]0.4%[-] des PV max + [#1A7331]4.5%[-] de la défense.\nSi les PV restants sont inférieurs ou égaux à [#1A7331]30%[-], restaure en plus les PV de tous les alliés à hauteur de [#1A7331]10%[-] des PV max + [#1A7331]80%[-] de la défense.",
   "gameId": "elizabeth_book_skill_e",
   "icone": "Elizabeth_Book_NormalSkill.webp",
   "nomFr": "Bouchée rafraîchissante",
   "recharge": 31.0,
   "weaponType": "Book"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]82%[-] de la défense et inflige [#0F5CD8]Éclaboussures[-] à l'ennemi pendant [#1A7331]40s[-].\n\n※ [#0F5CD8]Éclaboussures[-] : réduit la défense de [#1A7331]20%[-].",
   "gameId": "elizabeth_book_skill_q",
   "icone": "Elizabeth_Book_ActiveThird.webp",
   "nomFr": "Canon à eau de la princesse",
   "recharge": 22.0,
   "weaponType": "Book"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]71%[-] de la défense.",
   "gameId": "elizabeth_book_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "C'est comme ça qu'on tire ?",
   "recharge": null,
   "weaponType": "Book"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Toutes les [#1A7331]0.8s[-] pendant [#1A7331]11s[-], restaure les PV des alliés à portée à hauteur de [#1A7331]1.5%[-] des PV max + [#1A7331]22%[-] de la défense.\nLes héros à portée sont immunisés aux réactions, et si les PV restants des alliés sont inférieurs ou égaux à [#1A7331]30%[-], réduit les dégâts subis de [#1A7331]30%[-].",
   "gameId": "elizabeth_book_skill_r",
   "icone": "Elizabeth_Book_UltimateSKill.webp",
   "nomFr": "Jouons ensemble !",
   "recharge": 10.0,
   "weaponType": "Book"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Réduit les dégâts causés aux alliés par les ennemis affectés par [#0F5CD8]Éclaboussures[-] de [#1A7331]15%[-].\nLorsque le héros attaque un ennemi avec son attaque spéciale, augmente les dégâts de faiblesse de ce dernier de [#1A7331]10%[-] pendant [#1A7331]20s[-].\nChaque fois qu'un allié touche un ennemi affecté par [#0F5CD8]Éclaboussures[-], augmente la défense de tous les alliés de [#1A7331]2%[-] pendant [#1A7331]20s[-]. (Max : [#1A7331]20 fois[-])",
   "gameId": "elizabeth_book_passive",
   "icone": "Elizabeth_Book_Passive.webp",
   "nomFr": "Princesse de la plage",
   "recharge": 0.0,
   "weaponType": "Book"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]76%[-] de l'attaque.\n1er coup : 11%\n2e coup : 12%\n3e coup : 20%\n4e coup : 33%",
   "gameId": "elizabeth_staff_jumpatk",
   "icone": "common_Staff_normalAttack.webp",
   "nomFr": "Coup maladroit",
   "recharge": null,
   "weaponType": "Staff"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Augmente l'attaque de Vent de tous les héros alliés à hauteur de [#1A7331]30%[-] de l'attaque du héros pendant [#1A7331]40s[-]. (Max : [#1A7331]3000[-])\nInflige des dégâts égaux à [#1A7331]103%[-] de l'attaque et inflige [#0F5CD8]Altération[-] pendant [#1A7331]30s[-] aux ennemis à portée.\n\n※ [#0F5CD8]Altération[-] : réduit la défense de Vent à hauteur de [#1A7331]0.5%[-] la défense pendant [#1A7331]30s[-] en subissant des dégâts de Vent. (Max : [#1A7331]60 fois[-])",
   "gameId": "elizabeth_staff_skill_e",
   "icone": "Elizabeth_Staff_NormalSkill.webp",
   "nomFr": "Vague sacrée",
   "recharge": 23.0,
   "weaponType": "Staff"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Réduit la consommation en magie du héros de [#1A7331]10%[-] pendant [#1A7331]15s[-] en utilisant les attaques ultimes des héros alliés d'attribut Vent à portée ou les attaques combinées avec l'attaque ultime du héros en tant que base, et augmente les dégâts crit. des attaques normales des alliés à portée de [#1A7331]50%[-] pendant [#1A7331]40s[-].",
   "gameId": "elizabeth_staff_skill_q",
   "icone": "Elizabeth_Staff_ActiveThird.webp",
   "nomFr": "Guide sacré",
   "recharge": 17.0,
   "weaponType": "Staff"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]60%[-] de l'attaque.",
   "gameId": "elizabeth_staff_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Volonté inflexible",
   "recharge": null,
   "weaponType": "Staff"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Toutes les [#1A7331]1s[-] pendant [#1A7331]10s[-], inflige des dégâts égaux à [#1A7331]20%[-] de l'attaque aux ennemis à portée.\nChaque coup de l'attaque inflige [#0F5CD8]Rupture[-] aux ennemis pendant [#1A7331]20s[-].\n\n※ [#0F5CD8]Rupture[-] : inflige des dégâts de Vent supplémentaires égaux à [#1A7331]10%[-] de l'attaque d'Elizabeth et réduit la défense crit. de [#1A7331]0.8%[-] pendant [#1A7331]30s[-] en subissant des attaques de Vent. (Max : [#1A7331]50 fois[-])",
   "gameId": "elizabeth_staff_skill_r",
   "icone": "Elizabeth_Staff_UltimateSKill.webp",
   "nomFr": "Tourbillon divin",
   "recharge": 10.0,
   "weaponType": "Staff"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Augmente la perforation de tous les héros alliés d'attribut Vent de [#1A7331]0.3%[-] de l'attaque du héros. (Max : [#1A7331]80[-])\nLorsqu'un héros allié attaque un ennemi affecté par [#0F5CD8]Altération[-], augmente les dégâts d'attaque normale de [#1A7331]60%[-].",
   "gameId": "elizabeth_staff_passive",
   "icone": "Elizabeth_Staff_Passive.webp",
   "nomFr": "Vent favorable de la déesse",
   "recharge": 0.0,
   "weaponType": "Staff"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]106%[-] de l'attaque.\n1er coup : 15%\n2e coup : 17%\n3e coup : 27%\n4e coup : 47%",
   "gameId": "elizabeth_wand_jumpatk",
   "icone": "common_Wand_normalAttack.webp",
   "nomFr": "Attaque jambon qui roule",
   "recharge": null,
   "weaponType": "Wand"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]157%[-] de l'attaque, puis augmente en outre la jauge de Déluge à hauteur de [#1A7331]3%[-] de l'attaque. (Max : [#1A7331]500[-])\nUn coup porté sur un ennemi sous l'effet de [#0F5CD8]Déluge de Terre[-] augmente les dégâts de Terre des alliés de [#1A7331]50%[-] des dégâts crit. du héros pendant [#1A7331]40s[-]. (Max : [#1A7331]50%[-])",
   "gameId": "elizabeth_wand_skill_e",
   "icone": "Elizabeth_Wand_NormalSkill.webp",
   "nomFr": "Impact de Hawk",
   "recharge": 17.0,
   "weaponType": "Wand"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Augmente l'efficacité de Déluge de Terre du héros à hauteur de [#1A7331]40%[-] des dégâts crit. pendant [#1A7331]20s[-], puis inflige des dégâts égaux à [#1A7331]102%[-] de l'attaque.",
   "gameId": "elizabeth_wand_skill_q",
   "icone": "Elizabeth_Wand_ActiveThird.webp",
   "nomFr": "Trajectoire des restes",
   "recharge": 11.0,
   "weaponType": "Wand"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]78%[-] de l'attaque.",
   "gameId": "elizabeth_wand_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Châtiment de la sainte",
   "recharge": null,
   "weaponType": "Wand"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]276%[-] de l'attaque. Chaque coup de l'attaque augmente les dégâts de [#1A7331]5%[-]. (Max : [#1A7331]50 fois[-])",
   "gameId": "elizabeth_wand_skill_r",
   "icone": "Elizabeth_Wand_UltimateSKill.webp",
   "nomFr": "Super explosion jambonique",
   "recharge": 10.0,
   "weaponType": "Wand"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Lorsque le héros active un [#0F5CD8]Déluge de Terre[-], réinitialise le temps de recharge de la compétence normale de tous les héros alliés et augmente les chances crit. de tous les héros alliés d'attribut Terre de [#1A7331]20%[-] et leur perforation de [#1A7331]10%[-] pendant [#1A7331]40s[-].",
   "gameId": "elizabeth_wand_passive",
   "icone": "Elizabeth_Wand_Passive.webp",
   "nomFr": "Prière de sainte",
   "recharge": 0.0,
   "weaponType": "Wand"
  }
 ],
 "escanor": [
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]202%[-] de l'attaque.\n1er coup : 20%\n2e coup : 23%\n3e coup : 35%\n4e coup : 54%\n5e coup : 70%",
   "gameId": "escanor_axe_jumpatk",
   "icone": "common_Axe_normalAttack.webp",
   "nomFr": "Entaille impitoyable",
   "recharge": null,
   "weaponType": "Axe"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]279%[-] de l'attaque, puis octroie [#1A7331]2[-] cumul(s) de [#0F5CD8]Tache solaire[-] pendant [#1A7331]20s[-]. (Max : [#1A7331]10 fois[-])\n\n※ [#0F5CD8]Tache solaire[-] : augmente les dégâts de Feu de [#1A7331]3%[-] et les PV max du héros de [#1A7331]1.5%[-] pour chaque tranche de [#1A7331]1[-] cumul(s). Une fois atteint le nombre maximal de cumuls, retire l'effet [#0F5CD8]Tache solaire[-] et octroie [#0F5CD8]Flamboiement[-] pendant [#1A7331]15s[-].\n※ [#0F5CD8]Flamboiement[-] : restaure [#1A7331]10%[-] des PV max la première fois que l'effet est octroyé. Augmente les dégâts de Feu de [#1A7331]50%[-] et les PV max du héros de [#1A7331]35%[-], réduit les dégâts subis de [#1A7331]20%[-], et augmente la perforation de [#1A7331]20%[-]. Octroie [#0F5CD8]Soleil couchant[-] pendant [#1A7331]10s[-] lorsque l'effet [#0F5CD8]Flamboiement[-] est retiré.\n※ [#0F5CD8]Soleil couchant[-] : réduit les PV max du héros de [#1A7331]25%[-] sans toucher aux PV restants.",
   "gameId": "escanor_axe_skill_e",
   "icone": "Escanor_Axe_NormalSkill.webp",
   "nomFr": "Lignée orgueilleuse",
   "recharge": 15.0,
   "weaponType": "Axe"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Immunise contre les réactions et réduit les dégâts subis de [#1A7331]30%[-] tant que la posture est maintenue.\nInflige des dégâts égaux à [#1A7331]150%[-] / [#1A7331]170%[-] / [#1A7331]202%[-] de l'attaque en fonction du niveau de charge.\nUne attaque complètement chargée sur un ennemi sous l'effet de [#0F5CD8]Déluge de Feu[-] inflige des dégâts supplémentaires égaux à [#1A7331]17%[-] des PV restants du héros.",
   "gameId": "escanor_axe_skill_rmb_ready",
   "icone": "Escanor_Axe_ActiveThird.webp",
   "nomFr": "Soleil condensé",
   "recharge": 13.0,
   "weaponType": "Axe"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]138%[-] de l'attaque.",
   "gameId": "escanor_axe_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Arrivée du soleil",
   "recharge": null,
   "weaponType": "Axe"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Le premier coup inflige des dégâts égaux à [#1A7331]397%[-] de l'attaque et des dégâts supplémentaires égaux à [#1A7331]30%[-] des PV restants du héros en attaquant un ennemi sous l'effet de [#0F5CD8]Déluge de Feu[-].\nL'attaque consomme tous les points de magie, ce qui augmente les dégâts de [#1A7331]100%[-] à [#1A7331]500%[-] selon les points utilisés.\nInflige ensuite des dégâts égaux à [#1A7331]2%[-] de l'attaque aux ennemis à portée toutes les [#1A7331]0.2s[-] pendant 2s.\nUtiliser une attaque combinée avec l'attaque ultime du héros en tant que base augmente les PV max du héros de [#1A7331]30%[-] pendant [#1A7331]20s[-].",
   "gameId": "escanor_axe_skill_q",
   "icone": "Escanor_Axe_UltimateSkill.webp",
   "nomFr": "Feu purificateur",
   "recharge": 10.0,
   "weaponType": "Axe"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Octroie [#1A7331]1[-] cumul(s) de [#0F5CD8]Tache solaire[-] pendant [#1A7331]20s[-] en attaquant un ennemi qui n'est pas sous l'effet de [#0F5CD8]Flamboiement[-] ou [#0F5CD8]Soleil couchant[-]. (Max : [#1A7331]10 fois[-])\n\n※ [#0F5CD8]Tache solaire[-] : augmente les dégâts de Feu de [#1A7331]3%[-] et les PV max de [#1A7331]1.5%[-] pour chaque tranche de [#1A7331]1[-] cumul(s). Une fois atteint le nombre maximal de cumuls, retire l'effet [#0F5CD8]Tache solaire[-] et octroie [#0F5CD8]Flamboiement[-] pendant [#1A7331]15s[-].\n※ [#0F5CD8]Flamboiement[-] : restaure [#1A7331]10%[-] des PV max la première fois que l'effet est octroyé. Augmente les dégâts de Feu de [#1A7331]50%[-] et les PV max du héros de [#1A7331]35%[-], réduit les dégâts subis de [#1A7331]20%[-], et augmente la perforation de [#1A7331]20%[-]. Octroie [#0F5CD8]Soleil couchant[-] pendant [#1A7331]10s[-] lorsque l'effet [#0F5CD8]Flamboiement[-] est retiré.\n※ [#0F5CD8]Soleil couchant[-] : réduit les PV max du héros de [#1A7331]25%[-] sans toucher aux PV restants.",
   "gameId": "escanor_axe_passive",
   "icone": "Escanor_Axe_Passive.webp",
   "nomFr": "Éruption solaire",
   "recharge": 0.0,
   "weaponType": "Axe"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]86%[-] de la défense.\n1er coup : 13%\n2e coup : 15%\n3e coup : 22%\n4e coup : 36%\n\n[#0F5CD8][Surchauffe][-]\nInflige des dégâts égaux à [#1A7331]100%[-] de la défense.\n1er coup : 15%\n2e coup : 17%\n3e coup : 26%\n4e coup : 42%",
   "gameId": "escanor_shield_jumpatk",
   "icone": "common_Shield_normalAttack.webp",
   "nomFr": "Marque du soleil",
   "recharge": null,
   "weaponType": "Shield"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]145%[-] de la défense, puis [#0F5CD8]provoque[-] les ennemis pendant [#1A7331]10s[-].\n\n[#0F5CD8][Surchauffe][-]\nInflige des dégâts égaux à [#1A7331]170%[-] de la défense, retire [#1A7331]3[-] cumul(s) de [#0F5CD8]Préchauffage[-], puis réduit la résistance au Feu de [#1A7331]30%[-] pendant [#1A7331]20s[-].",
   "gameId": "escanor_shield_skill_e",
   "icone": "Escanor_Shield_NormalSkill.webp",
   "nomFr": "Flammes oppressantes",
   "recharge": 19.0,
   "weaponType": "Shield"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Octroie des [#0F5CD8]barrières de Feu[-] à tous les héros alliés égales à [#1A7331]210%[-] de leur défense pendant [#1A7331]20s[-], puis inflige des dégâts égaux à [#1A7331]110%[-] de la défense.\n\n[#0F5CD8][Surchauffe][-]\nInflige des dégâts égaux à [#1A7331]125%[-] de la défense, retire [#1A7331]2[-] cumul(s) de [#0F5CD8]Préchauffage[-], puis augmente les dégâts de Feu de tous les héros alliés de [#1A7331]25%[-] pendant [#1A7331]20s[-].\n\n※ [#0F5CD8]Barrière de Feu[-] : inflige des dégâts égaux à [#1A7331]15%[-] de la défense aux ennemis proches toutes les [#1A7331]0.5s[-].",
   "gameId": "escanor_shield_skill_rmb",
   "icone": "Escanor_Shield_ActiveThird.webp",
   "nomFr": "Assaut solaire",
   "recharge": 25.0,
   "weaponType": "Shield"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]65%[-] de la défense.",
   "gameId": "escanor_shield_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Frappe majestueuse",
   "recharge": null,
   "weaponType": "Shield"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Octroie [#0F5CD8]Surchauffe[-] pendant [#1A7331]20s[-] et inflige des dégâts égaux à [#1A7331]210%[-] de la défense.\n\n[#0F5CD8][Surchauffe][-]\nInflige des dégâts égaux à [#1A7331]240%[-] de la défense, retire [#1A7331]5[-] cumul(s) de [#0F5CD8]Préchauffage[-], inflige des dégâts supplémentaires égaux à [#1A7331]300%[-] de la défense, puis retire [#0F5CD8]Surchauffe[-].",
   "gameId": "escanor_shield_skill_q",
   "icone": "Escanor_Shield_UltimateSkill.webp",
   "nomFr": "Jugement céleste - Surchauffe",
   "recharge": 10.0,
   "weaponType": "Shield"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Octroie [#1A7331]1[-] cumul(s) de [#0F5CD8]Préchauffage[-] toutes les [#1A7331]1s[-] lorsqu'une [#0F5CD8]barrière[-] est active. (Max : [#1A7331]10 fois[-])\n\n※ [#0F5CD8]Préchauffage[-] : augmente la défense de [#1A7331]10%[-]. Augmente les dégâts de Feu de [#1A7331]10%[-] tant que l'effet [#0F5CD8][Surchauffe][-] est actif.",
   "gameId": "escanor_shield_passive",
   "icone": "Escanor_Shield_Passive.webp",
   "nomFr": "Protection du soleil",
   "recharge": 0.0,
   "weaponType": "Shield"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]168%[-] de l'attaque. [#1A7331]50%[-] de chances d'infliger [#0F5CD8]Inflammation[-] pendant [#1A7331]20s[-]. (Max : [#1A7331]5 fois[-])\n1er coup : 26%\n2e coup : 28%\n3e coup : 40%\n4e coup : 74%\n\n※ [#0F5CD8]Inflammation[-] : inflige des dégâts de Feu égaux à [#1A7331]3%[-] de l'attaque toutes les [#1A7331]1s[-]. Réduit la défense de [#1A7331]0.15%[-] à chaque fois que des dégâts d'Inflammation sont infligés. (Max : [#1A7331]100 fois[-])",
   "gameId": "escanor_sword2h_jumpatk",
   "icone": "common_Sword2H_normalAttack.webp",
   "nomFr": "Orbite solaire",
   "recharge": null,
   "weaponType": "Sword2h"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]289%[-] de l'attaque, puis réduit le délai de déclenchement des dégâts d'[#0F5CD8]Inflammation[-] de [#1A7331]50%[-] pendant [#1A7331]15s[-].",
   "gameId": "escanor_sword2h_skill_e",
   "icone": "Escanor_Sword2h_NormalSkill.webp",
   "nomFr": "« Soleil cruel »",
   "recharge": 19.0,
   "weaponType": "Sword2h"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]173%[-] de l'attaque.\nEn attaquant un ennemi affecté par [#0F5CD8]Inflammation[-], inflige [#1A7331]1[-] cumul d'[#0F5CD8]Affaiblissement[-] pour [#0F5CD8]chaque[-] cumul d'[#0F5CD8]Inflammation[-] présent sur la cible pendant [#1A7331]40s[-]. (Max : [#1A7331]5 fois[-])\n\n※ [#0F5CD8]Affaiblissement[-] : augmente les dégâts sur la durée subis de [#1A7331]5%[-]. (Max : [#1A7331]5 fois[-])",
   "gameId": "escanor_sword2h_skill_rmb",
   "icone": "Escanor_Sword2h_ActiveThird.webp",
   "nomFr": "Impact solaire",
   "recharge": 13.0,
   "weaponType": "Sword2h"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]143%[-] de l'attaque.",
   "gameId": "escanor_sword2h_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Rayon solaire",
   "recharge": null,
   "weaponType": "Sword2h"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]390%[-] de l'attaque. En attaquant un ennemi affecté par [#0F5CD8]Inflammation[-], augmente les dégâts de [#1A7331]3%[-] pour chaque tranche de [#1A7331]1[-] cumul(s) de réduction de la défense d'[#0F5CD8]Inflammation[-].",
   "gameId": "escanor_sword2h_skill_q",
   "icone": "Escanor_Sword2h_UltimateSkill.webp",
   "nomFr": "Soleil levant",
   "recharge": 10.0,
   "weaponType": "Sword2h"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Augmente les dégâts sur la durée de tous les héros alliés de [#1A7331]150%[-].\nEn attaquant un ennemi affecté par [#0F5CD8]Inflammation[-], augmente les dégâts de [#1A7331]30%[-] pour chaque tranche de [#1A7331]1 cumul(s)[-].\nRéduit les dégâts infligés par les ennemis affectés par [#0F5CD8]Inflammation[-] de [#1A7331]15%[-].",
   "gameId": "escanor_sword2h_passive",
   "icone": "Escanor_Sword2h_Passive.webp",
   "nomFr": "Lumière directrice",
   "recharge": 0.0,
   "weaponType": "Sword2h"
  }
 ],
 "gil-thunder": [
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts physiques égaux à 63% de l’attaque à l’ennemi.\n - 1er coup : dégâts physiques égaux à 9% de l’attaque\n - 2e coup : dégâts physiques égaux à 12% de l’attaque\n - 3e coup : dégâts physiques égaux à 15% de l’attaque\n - 4e coup : dégâts physiques égaux à 27% de l’attaque",
   "gameId": "gil_thunder_lance_jumpatk",
   "icone": "common_Lance_normalAttack.webp",
   "nomFr": "Percée foudroyante",
   "recharge": null,
   "weaponType": "Lance"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]208%[-] de l'attaque et inflige [#0F5CD8]Électrocution[-] pendant [#1A7331]10s[-].\n\n※ [#0F5CD8]Électrocution[-] : inflige des dégâts de Foudre égaux à [#1A7331]15%[-] de l'attaque toutes les [#1A7331]2s[-]. Inflige [#0F5CD8]Électrocution[-] aux ennemis proches pendant [#1A7331]10s[-] en subissant une attaque.",
   "gameId": "gil_thunder_lance_skill_e",
   "icone": "Gil_Lance_NormalSkill.webp",
   "nomFr": "Charge électrique",
   "recharge": 13.0,
   "weaponType": "Lance"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]135%[-] de l'attaque. Inflige [#0F5CD8]Paralysie[-] à l'ennemi s'il est [#0F5CD8]Électrocuté[-].\n\n※ [#0F5CD8]Paralysie[-] : immobilisation. Réduit la résistance à la Foudre de [#1A7331]15%[-]. L'effet perdure si la cible est [#0F5CD8]Électrocutée[-].",
   "gameId": "gil_thunder_lance_skill_rmb",
   "icone": "Gil_Lance_ActiveThird.webp",
   "nomFr": "Déferlement foudroyant",
   "recharge": 7.0,
   "weaponType": "Lance"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]96%[-] de l'attaque.",
   "gameId": "gil_thunder_lance_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Lance foudroyante",
   "recharge": null,
   "weaponType": "Lance"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]343%[-] de l'attaque. Attaquer un ennemi sous l'effet de [#0F5CD8]Déluge de Foudre[-] réduit le temps de recharge de l'attaque spéciale de [#1A7331]50%[-].",
   "gameId": "gil_thunder_lance_skill_q",
   "icone": "Gil_Lance_UltimateSKill.webp",
   "nomFr": "Éclair",
   "recharge": 10.0,
   "weaponType": "Lance"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Augmente les dégâts de [#1A7331]25%[-] en attaquant un ennemi [#0F5CD8]paralysé[-].",
   "gameId": "gilthunder_lance_passive",
   "icone": "Gil_Thunder_Lance_Passive.webp",
   "nomFr": "Foudre ardente",
   "recharge": 0.0,
   "weaponType": "Lance"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]79%[-] de l'attaque.\n1er coup : 12%\n2e coup : 13%\n3e coup : 20%\n4e coup : 34%",
   "gameId": "gil_thunder_shield_jumpatk",
   "icone": "common_Shield_normalAttack.webp",
   "nomFr": "Frappe de barrière de Foudre",
   "recharge": null,
   "weaponType": "Shield"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]170%[-] de l'attaque, puis octroie des [#0F5CD8]barrières[-] à tous les héros alliés égales à [#1A7331]10%[-] de leurs PV max pendant [#1A7331]20s[-].\nOctroie des [#0F5CD8]barrières de Foudre[-] à tous les héros alliés égales à [#1A7331]15%[-] de leurs PV max pendant [#1A7331]20s[-] si l'ennemi est [#0F5CD8]Étreint[-].\n\n※ [#0F5CD8]Barrière de Foudre[-] : renvoie [#1A7331]15%[-] des dégâts subis.",
   "gameId": "gil_thunder_shield_skill_e",
   "icone": "Gil_Shield_NormalSkill.webp",
   "nomFr": "Jugement",
   "recharge": 35.0,
   "weaponType": "Shield"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Immunise contre les réactions et réduit les dégâts subis de [#1A7331]40%[-] tant que la posture est maintenue.\n[#0F5CD8]Provoque[-] les ennemis proches tant que la posture est maintenue.\nMaintient la posture pendant un maximum de [#1A7331]10s[-]. Après avoir subi des attaques [#1A7331]5 fois[-] lorsque la posture est maintenue, la posture est retirée, ce qui inflige des dégâts égaux à [#1A7331]84%[-] de l'attaque.",
   "gameId": "gil_thunder_shield_skill_rmb_ready",
   "icone": "Gil_Shield_ActiveThird.webp",
   "nomFr": "Barrière de Foudre",
   "recharge": 15.0,
   "weaponType": "Shield"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]72%[-] de l'attaque.",
   "gameId": "gil_thunder_shield_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Foudre azurée",
   "recharge": null,
   "weaponType": "Shield"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]214%[-] de l'attaque à l'ennemi, l'[#0F5CD8]Étreint[-] pendant [#1A7331]8s[-], puis l'attire vers le héros.",
   "gameId": "gil_thunder_shield_skill_q",
   "icone": "Gil_Shield_UltimateSkill.webp",
   "nomFr": "Entraves du roi de la Foudre",
   "recharge": 10.0,
   "weaponType": "Shield"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Réduit les dégâts subis par le héros de [#1A7331]10%[-] lorsqu'une [#0F5CD8]barrière[-] est active.\nLorsque la [#0F5CD8]barrière de Foudre[-] de la compétence normale est retirée, réduit la résistance à la Foudre des ennemis proches de [#1A7331]15%[-] pendant [#1A7331]30s[-].",
   "gameId": "gilthunder_shield_passive",
   "icone": "Gil_Thunder_Shield_Passive.webp",
   "nomFr": "Avatar foudroyant",
   "recharge": 0.0,
   "weaponType": "Shield"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]108%[-] de l'attaque.\n1er coup : 16%\n2e coup : 17%\n3e coup : 28%\n4e coup : 47%",
   "gameId": "gil_thunder_sword1h_jumpatk",
   "icone": "common_Sword1H_normalAttack.webp",
   "nomFr": "Frappe foudroyante",
   "recharge": null,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]176%[-] de l'attaque. Réduit le temps de recharge de l'attaque spéciale de [#1A7331]1s[-] chaque fois qu'un ennemi affecté par [#0F5CD8]Électrocution[-] est touché.",
   "gameId": "gil_thunder_sword1h_skill_e",
   "icone": "Gil_Sword1h_NormalSkill.webp",
   "nomFr": "Épée foudroyante",
   "recharge": 15.0,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]109%[-] de l'attaque. La première frappe augmente la durée d'[#0F5CD8]Électrocution[-] de l'ennemi de [#1A7331]3s[-].",
   "gameId": "gil_thunder_sword1h_skill_rmb",
   "icone": "Gil_Sword1h_ActiveThird.webp",
   "nomFr": "Division foudroyante",
   "recharge": 10.0,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]86%[-] de l'attaque et inflige [#0F5CD8]Électrocution[-] pendant [#1A7331]10s[-].\n\n※ [#0F5CD8]Électrocution[-] : inflige des dégâts de Foudre égaux à [#1A7331]15%[-] de l'attaque toutes les [#1A7331]2s[-]. Inflige [#0F5CD8]Électrocution[-] aux ennemis proches pendant [#1A7331]10s[-] en subissant une attaque.",
   "gameId": "gil_thunder_sword1h_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Attaque foudroyante",
   "recharge": null,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]259%[-] de l'attaque.\nRéduit la résistance au Déluge de Foudre des ennemis à portée de [#1A7331]20%[-] pendant [#1A7331]5s[-].",
   "gameId": "gil_thunder_sword1h_skill_q",
   "icone": "Gil_Sword1h_UltimateSkill.webp",
   "nomFr": "Éclair foudroyant",
   "recharge": 10.0,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Augmente la jauge de Déluge de [#1A7331]20[-] pour chaque coup infligé à un ennemi affecté par [#0F5CD8]Électrocution[-]. Lorsque le héros active [#0F5CD8]Déluge de Foudre[-], réduit la résistance à la Foudre de l'ennemi de [#1A7331]15%[-] pendant [#1A7331]20s[-].",
   "gameId": "gilthunder_sword1h_passive",
   "icone": "Gil_Sword1h_Passive.webp",
   "nomFr": "Frappe du roi de la Foudre",
   "recharge": 0.0,
   "weaponType": "Sword1h"
  }
 ],
 "gowther": [
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]74%[-] de l'attaque.\n1er coup : 11%\n2e coup : 12%\n3e coup : 19%\n4e coup : 32%",
   "gameId": "gowther_book_jumpatk",
   "icone": "common_Book_normalAttack.webp",
   "nomFr": "Pointe d'intrusion",
   "recharge": null,
   "weaponType": "Book"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]117%[-] de l'attaque, puis inflige [#0F5CD8]Lien[-] pendant [#1A7331]30s[-].\n\n※ [#0F5CD8]Lien[-] : réduit le taux de parade de [#1A7331]10%[-]. Lorsqu'un héros allié frappe un ennemi affecté par [#0F5CD8]Lien[-], inflige des dégâts supplémentaires égaux à [#1A7331]100%[-] de l'attaque de Gowther à tous les ennemis affectés par [#0F5CD8]Lien[-] dans un rayon de [#1A7331]30 m[-] autour du lanceur. (Temps de recharge : [#1A7331]5s[-]) Retire l'effet si l'ennemi se déplace à [#1A7331]30 m[-] ou plus du lanceur.",
   "gameId": "gowther_book_skill_e",
   "icone": "Gowther_Book_NormalSkill.webp",
   "nomFr": "Lien cauchemardesque",
   "recharge": 27.0,
   "weaponType": "Book"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]67%[-] de l'attaque, attire l'ennemi vers le héros et réduit sa défense de [#1A7331]20%[-] pendant [#1A7331]30s[-].",
   "gameId": "gowther_book_skill_q",
   "icone": "Gowther_Book_ActiveThird.webp",
   "nomFr": "Dissonance mémorielle",
   "recharge": 11.0,
   "weaponType": "Book"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]55%[-] de l'attaque.",
   "gameId": "gowther_book_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Explosion ténébreuse",
   "recharge": null,
   "weaponType": "Book"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]250%[-] de l'attaque, puis inflige [#0F5CD8]Extinction[-] pendant [#1A7331]5s[-].\n\n※ [#0F5CD8]Extinction[-] : Empêche les ennemis non immunisés d'effectuer certaines actions. Augmente les dégâts subis de [#1A7331]100%[-]. (Délai de réapplication : [#1A7331]60s[-])",
   "gameId": "gowther_book_skill_r",
   "icone": "Gowther_Book_UltimateSkill.webp",
   "nomFr": "Champ d'évanouissement",
   "recharge": 60.0,
   "weaponType": "Book"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Chaque fois qu'un héros allié frappe un ennemi affecté par [#0F5CD8]Lien[-], octroie [#0F5CD8]Synchronisation[-] pendant [#1A7331]15s[-]. (Max : [#1A7331]25 fois[-])\n\n※ [#0F5CD8]Synchronisation[-] : augmente l'attaque de [#1A7331]1%[-].",
   "gameId": "gowther_book_passive",
   "icone": "Gowther_Book_Passive.webp",
   "nomFr": "Alter ego",
   "recharge": 0.0,
   "weaponType": "Book"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]71%[-] de l'attaque.\n1er coup : 11%\n2e coup : 12%\n3e coup : 19%\n4e coup : 29%",
   "gameId": "gowther_staff_jumpatk",
   "icone": "common_Staff_normalAttack.webp",
   "nomFr": "Impulsion de l'esprit",
   "recharge": null,
   "weaponType": "Staff"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]110%[-] de l'attaque, puis octroie [#0F5CD8]Charge[-] à tous les héros alliés pendant [#1A7331]30s[-].\n\n※ [#0F5CD8]Charge[-] : augmente l'efficacité de durée des bonus des héros d'attribut Foudre de [#1A7331]35%[-] et les dégâts de Foudre de [#1A7331]25%[-].",
   "gameId": "gowther_staff_skill_e",
   "icone": "Gowther_Staff_NormalSkill.webp",
   "nomFr": "Impact circulaire",
   "recharge": 19.0,
   "weaponType": "Staff"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]3%[-] de l'attaque aux ennemis à portée toutes les [#1A7331]0.2s[-] pendant [#1A7331]6s[-], puis réduit la résistance à la Foudre de [#1A7331]40%[-] pendant [#1A7331]30s[-].",
   "gameId": "gowther_staff_skill_q",
   "icone": "Gowther_Staff_ActiveThird.webp",
   "nomFr": "Champ d'intrusion",
   "recharge": 16.0,
   "weaponType": "Staff"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]62%[-] de l'attaque.",
   "gameId": "gowther_staff_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Taillade douloureuse",
   "recharge": null,
   "weaponType": "Staff"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]205%[-] de l'attaque.\nUtiliser une attaque combinée avec l'attaque ultime du héros en tant que base augmente l'efficacité de recharge de la magie de tous les héros alliés d'attribut Foudre de [#1A7331]35%[-] pendant [#1A7331]20s[-].",
   "gameId": "gowther_staff_skill_r",
   "icone": "Gowther_Staff_UltimateSkill.webp",
   "nomFr": "Rayon prismatique",
   "recharge": 10.0,
   "weaponType": "Staff"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Augmente la perforation de tous les héros alliés d'attribut Foudre à hauteur de [#1A7331]0.3%[-] de l'attaque du héros. (Max : [#1A7331]80[-])\nLorsqu'un héros allié déclenche une attaque combinée, augmente l'efficacité de la durée des malus de tous les héros alliés d'attribut Foudre de [#1A7331]30%[-] pendant [#1A7331]30s[-].",
   "gameId": "gowther_staff_passive",
   "icone": "Gowther_Staff_Passive.webp",
   "nomFr": "Sens d'intrusion",
   "recharge": 0.0,
   "weaponType": "Staff"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]97%[-] de l'attaque.\n1er coup : 14%\n2e coup : 16%\n3e coup : 26%\n4e coup : 41%",
   "gameId": "gowther_wand_jumpatk",
   "icone": "common_Wand_normalAttack.webp",
   "nomFr": "Frappe brutale",
   "recharge": null,
   "weaponType": "Wand"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]122%[-] de l'attaque. Chaque coup augmente la jauge de Déluge de [#1A7331]20[-] + [#1A7331]0.5%[-] de l'attaque. (Max : [#1A7331]100[-])\nCette attaque réduit la défense de Foudre de l'ennemi à hauteur de [#1A7331]6%[-] de la défense pendant [#1A7331]30s[-]. (Max : [#1A7331]4 fois[-])",
   "gameId": "gowther_wand_skill_e",
   "icone": "Gowther_Wand_NormalSkill.webp",
   "nomFr": "Salve de flèches",
   "recharge": 28.0,
   "weaponType": "Wand"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Immunise contre les réactions et réduit les dégâts subis de [#1A7331]30%[-] tant que la posture est maintenue.\nInflige des dégâts égaux à [#1A7331]90%[-] / [#1A7331]350%[-] de l'attaque en fonction du niveau de charge, infligeant [#1A7331]100%[-] de dégâts crit. supplémentaires aux ennemis sous l'effet d'un [#0F5CD8]Déluge de Foudre[-].\nLorsque l'attaque est complètement chargée et que l'ennemi possède une [#0F5CD8]barrière[-], augmente le percement de défense de [#1A7331]25%[-].",
   "gameId": "gowther_wand_skill_q_ready",
   "icone": "Gowther_Wand_ActiveThird.webp",
   "nomFr": "Flèche sauvage",
   "recharge": 24.0,
   "weaponType": "Wand"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]85%[-] de l'attaque.",
   "gameId": "gowther_wand_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Chute brutale",
   "recharge": null,
   "weaponType": "Wand"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]275%[-] de l'attaque. Attaquer un ennemi sous l'effet d'un [#0F5CD8]Déluge de Foudre[-] inflige des dégâts supplémentaires égaux à [#1A7331]40%[-] de l'attaque. ([#1A7331]240%[-] max.)",
   "gameId": "gowther_wand_skill_r",
   "icone": "Gowther_Wand_UltimateSkill.webp",
   "nomFr": "Flèche de l'éclipse",
   "recharge": 10.0,
   "weaponType": "Wand"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Augmente l'attaque de Foudre à hauteur de [#1A7331]10%[-] de l'attaque du héros pendant [#1A7331]30s[-] lorsqu'un héros allié active un [#0F5CD8]Déluge de Foudre[-]. (Max : [#1A7331]3000[-])",
   "gameId": "gowther_wand_passive",
   "icone": "Gowther_Wand_Passive.webp",
   "nomFr": "Confusion des sens",
   "recharge": 0.0,
   "weaponType": "Wand"
  }
 ],
 "griamore": [
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]148%[-] de l'attaque.\n1er coup : 22%\n2e coup : 24%\n3e coup : 38%\n4e coup : 64%",
   "gameId": "griamore_cudgel3c_jumpatk",
   "icone": "common_Cudgel3c_normalAttack.webp",
   "nomFr": "Pulvérisation murale",
   "recharge": null,
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]284%[-] de l'attaque. Réduit le temps de recharge de l'attaque spéciale de [#1A7331]75%[-] lorsque le héros bénéficie d'une [#0F5CD8]barrière[-].",
   "gameId": "griamore_cudgel3c_skill_e",
   "icone": "Griamore_Cudgel3c_NormalSkill.webp",
   "nomFr": "Pression murale",
   "recharge": 13.0,
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Supprime la [#0F5CD8]barrière[-] du héros pour augmenter son attaque de [#1A7331]15%[-] pendant [#1A7331]20s[-].\nInflige des dégâts égaux à [#1A7331]186%[-] de l'attaque, puis octroie une [#0F5CD8]barrière[-] égale à [#1A7331]50%[-] de l'attaque pendant [#1A7331]5s[-].",
   "gameId": "griamore_cudgel3c_skill_rmb",
   "icone": "Griamore_Cudgel3c_ActiveThird.webp",
   "nomFr": "Sphère murale",
   "recharge": 15.0,
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]113%[-] de l'attaque.",
   "gameId": "griamore_cudgel3c_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Mur ascendant",
   "recharge": null,
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]425%[-] de l'attaque. Supprime la [#0F5CD8]barrière[-] du héros pour augmenter ses dégâts d'attaque ultime de [#1A7331]50%[-] et inflige [#0F5CD8]Étourdissement[-] à l'ennemi pendant [#1A7331]8s[-].",
   "gameId": "griamore_cudgel3c_skill_q",
   "icone": "Griamore_Cudgel3c_UltimateSKill.webp",
   "nomFr": "Écrasement mural",
   "recharge": 10.0,
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Restaure la jauge de relève de [#1A7331]250[-] lorsque l'attaque spéciale du héros octroie une [#0F5CD8]barrière[-].",
   "gameId": "griamore_cudgel3c_passive",
   "icone": "Griamore_Cudgel3c_Passive.webp",
   "nomFr": "Prouesse physique",
   "recharge": 0.0,
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]61%[-] de l'attaque.\n1er coup : 9%\n2e coup : 10%\n3e coup : 16%\n4e coup : 26%",
   "gameId": "griamore_gauntlets_jumpatk",
   "icone": "common_Gauntlets_normalAttack.webp",
   "nomFr": "Coup de poing gravitationnel",
   "recharge": null,
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]128%[-] de l'attaque. Restaure la jauge de relève de [#1A7331]300[-] si l'ennemi souffre de l'effet [#0F5CD8]Étourdissement[-].",
   "gameId": "griamore_gauntlets_skill_e",
   "icone": "Griamore_Gauntlets_NormalSkill.webp",
   "nomFr": "Charge de bouclier",
   "recharge": 17.0,
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]83%[-] de l'attaque et inflige [#0F5CD8]Étourdissement[-] pendant [#1A7331]5s[-].",
   "gameId": "griamore_gauntlets_skill_rmb",
   "icone": "Griamore_Gauntlets_ActiveThird.webp",
   "nomFr": "Poing de puissance",
   "recharge": 10.0,
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]59%[-] de l'attaque.",
   "gameId": "griamore_gauntlets_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Poing bouclier",
   "recharge": null,
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]179%[-] de l'attaque. Augmente les dégâts infligés aux ennemis [#0F5CD8]Étourdis[-] de [#1A7331]30%[-].",
   "gameId": "griamore_gauntlets_skill_q",
   "icone": "Griamore_Gauntlets_UltimateSKill.webp",
   "nomFr": "Bouclier d'émission",
   "recharge": 10.0,
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Un coup porté avec la compétence normale sur un ennemi [#0F5CD8]Étourdi[-] augmente l'attaque de tous les héros alliés de [#1A7331]10%[-] pendant [#1A7331]40s[-].",
   "gameId": "griamore_gauntlets_passive",
   "icone": "Griamore_Gauntlets_Passive.webp",
   "nomFr": "Mémoire musculaire",
   "recharge": 0.0,
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]77%[-] de l'attaque.\n1er coup : 11%\n2e coup : 12%\n3e coup : 20%\n4e coup : 34%",
   "gameId": "griamore_shield_jumpatk",
   "icone": "common_Shield_normalAttack.webp",
   "nomFr": "Frappe de bouclier",
   "recharge": null,
   "weaponType": "Shield"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]168%[-] de l'attaque et des dégâts supplémentaires égaux à [#1A7331]45%[-] de la défense.",
   "gameId": "griamore_shield_skill_e",
   "icone": "Griamore_shield_NormalSkill.webp",
   "nomFr": "Attaque plongeante",
   "recharge": 14.0,
   "weaponType": "Shield"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Immunise contre les réactions et réduit les dégâts subis de [#1A7331]40%[-] tant que la posture est maintenue.\nRestaure la jauge de relève du héros de [#1A7331]100[-] en subissant une attaque lorsque la posture est maintenue.\nLa posture dure jusqu'à [#1A7331]10s[-], et elle est retirée après avoir subi [#1A7331]5 coup(s)[-] pendant que la posture est maintenue.",
   "gameId": "griamore_shield_skill_rmb_ready",
   "icone": "Griamore_shield_ActiveThird.webp",
   "nomFr": "Impact de bouclier",
   "recharge": 10.0,
   "weaponType": "Shield"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]85%[-] de l'attaque et octroie des [#0F5CD8]barrières[-] à tous les héros alliés égales à [#1A7331]150%[-] de leur défense pendant [#1A7331]20s[-].",
   "gameId": "griamore_shield_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Que s'abatte la coquille",
   "recharge": null,
   "weaponType": "Shield"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]221%[-] de l'attaque et réduit la résistance au percement de l'ennemi de [#1A7331]5%[-] pendant [#1A7331]40s[-].",
   "gameId": "griamore_shield_skill_q",
   "icone": "Griamore_shield_UltimateSKill.webp",
   "nomFr": "Chute de mur",
   "recharge": 10.0,
   "weaponType": "Shield"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Lorsqu'un héros allié bénéficie d'une [#0F5CD8]barrière[-], augmente sa défense de [#1A7331]15%[-].",
   "gameId": "griamore_shield_passive",
   "icone": "Griamore_Shield_Passive.webp",
   "nomFr": "Maîtrise des murs",
   "recharge": 0.0,
   "weaponType": "Shield"
  }
 ],
 "guila": [
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]159%[-] de l'attaque.\n1er coup : 23%\n2e coup : 25%\n3e coup : 42%\n4e coup : 69%\n\n[#0F5CD8][Forme démoniaque][-]\nInflige des dégâts égaux à [#1A7331]188%[-] de l'attaque.\n1er coup : 27%\n2e coup : 29%\n3e coup : 48%\n4e coup : 84%",
   "gameId": "guila_lance_jumpatk",
   "icone": "common_Lance_normalAttack.webp",
   "nomFr": "Tir enflammé",
   "recharge": null,
   "weaponType": "Lance"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]246%[-] de l'attaque, puis octroie [#1A7331]2[-] cumul(s) d'[#0F5CD8]Impulsion[-].\n\n[#0F5CD8][Forme démoniaque][-]\nInflige des dégâts égaux à [#1A7331]276%[-] de l'attaque et augmente les dégâts infligés aux ennemis sous l'effet de [#0F5CD8]Déluge de Feu[-] de [#1A7331]30%[-].",
   "gameId": "guila_lance_skill_e",
   "icone": "Guila_Lance_NormalSkill.webp",
   "nomFr": "Tir de bombe",
   "recharge": 15.0,
   "weaponType": "Lance"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]183%[-] de l'attaque, puis octroie [#1A7331]2[-] cumul(s) d'[#0F5CD8]Impulsion[-].\n\n[#0F5CD8][Forme démoniaque][-]\nInflige des dégâts égaux à [#1A7331]215%[-] de l'attaque et réduit le temps de recharge de la compétence normale de [#1A7331]50%[-] après avoir réussi un coup critique.",
   "gameId": "guila_lance_skill_rmb",
   "icone": "Guila_Lance_ActiveThird.webp",
   "nomFr": "Canon de flamme",
   "recharge": 7.0,
   "weaponType": "Lance"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]104%[-] de l'attaque.",
   "gameId": "guila_lance_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Que s'abatte le feu",
   "recharge": null,
   "weaponType": "Lance"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Entre en [#0F5CD8]Forme démoniaque[-] pendant [#1A7331]30s[-].",
   "gameId": "guila_lance_skill_q",
   "icone": "Guila_Lance_UltimateSKill.webp",
   "nomFr": "Forme démoniaque",
   "recharge": 40.0,
   "weaponType": "Lance"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "[#0F5CD8][État de base][-]\nOctroie [#0F5CD8]Impulsion[-] pendant [#1A7331]30s[-] quand le héros attaque un ennemi. (Max : [#1A7331]10[-])\n\n※ [#0F5CD8]Impulsion[-] : augmente les chances crit. de [#1A7331]3%[-] par tranche de [#1A7331]1[-] effet(s) [#0F5CD8]en Forme démoniaque[-]. Lorsque le héros possède le nombre maximal d'effets d'Impulsion, réduit le temps de recharge de la compétence normale de [#1A7331]1s[-] en attaquant un ennemi sous l'effet de [#0F5CD8]Déluge de feu[-].",
   "gameId": "guila_lance_passive",
   "icone": "Guila_Lance_Passive.webp",
   "nomFr": "Démon ardent",
   "recharge": 0.0,
   "weaponType": "Lance"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]92%[-] de l'attaque.\n1er coup : 13%\n2e coup : 14%\n3e coup : 24%\n4e coup : 41%\n\n[#0F5CD8][Forme démoniaque][-]\nInflige des dégâts égaux à [#1A7331]151%[-] de l'attaque.\n1er coup : 22%\n2e coup : 25%\n3e coup : 38%\n4e coup : 66%",
   "gameId": "guila_rapier_jumpatk",
   "icone": "common_Rapier_normalAttack.webp",
   "nomFr": "Transpercement flamboyant",
   "recharge": null,
   "weaponType": "Rapier"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]187%[-] de l'attaque. Inflige [#0F5CD8]Inflammation[-] pendant [#1A7331]20s[-]. (Max : [#1A7331]5 fois[-])\n\n[#0F5CD8][Forme démoniaque][-]\nInflige des dégâts égaux à [#1A7331]223%[-] de l'attaque. Inflige des dégâts supplémentaires égaux à [#1A7331]150%[-] de l'attaque en attaquant un ennemi dont la réduction de la défense causée par [#0F5CD8]Inflammation[-] est au maximum.\n\n※ [#0F5CD8]Inflammation[-] : inflige des dégâts de Feu égaux à [#1A7331]3%[-] de l'attaque toutes les [#1A7331]1s[-]. Réduit la défense de [#1A7331]0.15%[-] à chaque fois que des dégâts d'Inflammation sont infligés. (Max : [#1A7331]100 fois[-])",
   "gameId": "guila_rapier_skill_e",
   "icone": "Guila_Rapier_NormalSkill.webp",
   "nomFr": "Déluge ardent",
   "recharge": 15.0,
   "weaponType": "Rapier"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]122%[-] de l'attaque. Augmente la jauge de Déluge de [#1A7331]150[-] en attaquant un ennemi qui souffre de l'effet [#0F5CD8]Inflammation[-].\n\n[#0F5CD8][Forme démoniaque][-]\nInflige des dégâts égaux à [#1A7331]160%[-] de l'attaque. En attaquant des ennemis affectés par [#1A7331]3[-] cumuls d'[#0F5CD8]Inflammation[-] ou moins, augmente la durée de l'effet [#0F5CD8]Inflammation[-] de [#1A7331]5s[-].",
   "gameId": "guila_rapier_skill_rmb",
   "icone": "Guila_Rapier_ActiveThird.webp",
   "nomFr": "Perforation ardente",
   "recharge": 11.0,
   "weaponType": "Rapier"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]87%[-] de l'attaque.",
   "gameId": "guila_rapier_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Taillade flamboyante",
   "recharge": null,
   "weaponType": "Rapier"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Entre en [#0F5CD8]Forme démoniaque[-] pendant [#1A7331]30s[-].",
   "gameId": "guila_rapier_skill_q",
   "icone": "Guila_Rapier_UltimateSKill.webp",
   "nomFr": "Forme démoniaque",
   "recharge": 40.0,
   "weaponType": "Rapier"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "[#0F5CD8][État de base][-]\nAugmente la jauge de Déluge de [#1A7331]30[-] lorsqu'une attaque normale touche un ennemi affecté par [#0F5CD8]Inflammation[-]. Inflige [#1A7331]2[-] effet(s) d'[#0F5CD8]Inflammation[-] pendant [#1A7331]20s[-] lorsque le héros active [#0F5CD8]Déluge de Feu[-]. (Max : [#1A7331]5 fois[-])\n\n[#0F5CD8][Forme démoniaque][-]\nLorsque le héros attaque un ennemi dont la défense est réduite par [#0F5CD8]Inflammation[-], augmente les dégâts de [#1A7331]1%[-] pour chaque tranche de [#1A7331]1[-] effet(s) de réduction de la défense présent(s) sur l'ennemi.\n\n※ [#0F5CD8]Inflammation[-] : inflige des dégâts de Feu égaux à [#1A7331]3%[-] de l'attaque toutes les [#1A7331]1s[-]. Réduit la défense de [#1A7331]0.15%[-] à chaque fois que des dégâts d'[#0F5CD8]Inflammation[-] sont infligés. (Max : [#1A7331]100 fois[-])",
   "gameId": "guila_rapier_passive",
   "icone": "Guila_Rapier_Passive.webp",
   "nomFr": "Notoriété",
   "recharge": 0.0,
   "weaponType": "Rapier"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]89%[-] de l'attaque.\n1er coup : 13%\n2e coup : 14%\n3e coup : 23%\n4e coup : 39%",
   "gameId": "guila_shield_jumpatk",
   "icone": "common_Shield_normalAttack.webp",
   "nomFr": "Taillade de garde enflammée",
   "recharge": null,
   "weaponType": "Shield"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Octroie une [#0F5CD8]barrière[-] à tous les héros alliés égale à [#1A7331]20%[-] des PV max pendant [#1A7331]20s[-]. Inflige des dégâts égaux à [#1A7331]164%[-] de l'attaque.",
   "gameId": "guila_shield_skill_e",
   "icone": "Guila_Shield_NormalSkill.webp",
   "nomFr": "Déflagration terrestre",
   "recharge": 32.0,
   "weaponType": "Shield"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Immunise contre les Réactions et réduit les dégâts subis de [#1A7331]65%[-] tant que la posture est maintenue.\n[#0F5CD8]Provoque[-] les ennemis proches tant que la posture est maintenue.\nRenvoie [#1A7331]45%[-] de l'attaque en subissant une attaque lorsque la posture est maintenue.\nMaintient la posture pendant un maximum de [#1A7331]10s[-]. Après avoir subi des attaques [#1A7331]5 fois[-] lorsque la posture est maintenue, la posture est retirée, ce qui inflige des dégâts égaux à [#1A7331]65%[-] de l'attaque.",
   "gameId": "guila_shield_skill_rmb_ready",
   "icone": "Guila_Shield_ActiveThird.webp",
   "nomFr": "Rempart de flammes",
   "recharge": 10.0,
   "weaponType": "Shield"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]72%[-] de l'attaque.",
   "gameId": "guila_shield_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Que s'abatte le bouclier",
   "recharge": null,
   "weaponType": "Shield"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Augmente les dégâts de Feu subis par les ennemis à portée de [#1A7331]20%[-] et inflige des dégâts égaux à [#1A7331]8%[-] de l'attaque toutes les [#1A7331]0.4s[-] pendant [#1A7331]10s[-].",
   "gameId": "guila_shield_skill_q",
   "icone": "Guila_Shield_UltimateSKill.webp",
   "nomFr": "Explosion resplendissante",
   "recharge": 10.0,
   "weaponType": "Shield"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Augmente les dégâts de Feu de tous les héros alliés de [#1A7331]30%[-] lorsqu'une [#0F5CD8]barrière[-] appliquée par le héros est active sur lui.",
   "gameId": "guila_shield_passive",
   "icone": "Guila_Shield_Passive.webp",
   "nomFr": "Protection ardente",
   "recharge": 0.0,
   "weaponType": "Shield"
  }
 ],
 "hendrickson": [
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]110%[-] de l'attaque.\n1er coup : 26%\n2e coup : 31%\n3e coup : 53%",
   "gameId": "hendrickson_lance_jumpatk",
   "icone": "common_Lance_normalAttack.webp",
   "nomFr": "Lance abyssale",
   "recharge": null,
   "weaponType": "Lance"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]273%[-] de l'attaque. Augmente les dégâts de [#1A7331]30%[-] lorsque l'effet [#0F5CD8]Berserk[-] est présent sur le héros.",
   "gameId": "hendrickson_lance_skill_e",
   "icone": "Hendrickson_Lance_NormalSkill.webp",
   "nomFr": "« Tour d'acide »",
   "recharge": 15.0,
   "weaponType": "Lance"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]161%[-] de l'attaque et octroie [#0F5CD8]Berserk[-] au héros pendant [#1A7331]10s[-].\n\n※ [#0F5CD8]Berserk[-] : augmente les chances crit. de [#1A7331]15%[-] et les dégâts crit. de [#1A7331]30%[-]. Réduit les PV du héros à hauteur de [#1A7331]2%[-] de ses PV max. toutes les [#1A7331]1s[-]. Lorsque les PV du héros sont inférieurs ou égaux à [#1A7331]5%[-], il ne perd pas de PV.",
   "gameId": "hendrickson_lance_skill_rmb",
   "icone": "Hendrickson_Lance_ActiveThird.webp",
   "nomFr": "Brise-lance abyssal",
   "recharge": 15.0,
   "weaponType": "Lance"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]130%[-] de l'attaque.",
   "gameId": "hendrickson_lance_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Transpercement ténébreux",
   "recharge": null,
   "weaponType": "Lance"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]387%[-] de l'attaque et augmente les chances crit. de [#1A7331]25%[-] face aux ennemis sous l'effet de [#0F5CD8]Déluge des Ténèbres[-].\nLa dernière frappe retire le [#0F5CD8]Déluge des Ténèbres[-] de la cible.",
   "gameId": "hendrickson_lance_skill_q",
   "icone": "Hendrickson_Lance_UltimateSKill.webp",
   "nomFr": "« Corruption de toute vie »",
   "recharge": 10.0,
   "weaponType": "Lance"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]12%[-] de l'attaque en attaquant un ennemi sous l'effet de [#0F5CD8]Déluge des Ténèbres[-].",
   "gameId": "hendrickson_lance_passive",
   "icone": "Hendrickson_Lance_Passive.webp",
   "nomFr": "Chevalier sacré vétéran",
   "recharge": 0.0,
   "weaponType": "Lance"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]75%[-] de l'attaque.\n1er coup : 11%\n2e coup : 12%\n3e coup : 19%\n4e coup : 33%",
   "gameId": "hendrickson_sword1h_jumpatk",
   "icone": "common_Sword1H_normalAttack.webp",
   "nomFr": "Taillade resplendissante",
   "recharge": null,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Augmente la défense de tous les héros alliés de [#1A7331]20%[-] pendant [#1A7331]40s[-].",
   "gameId": "hendrickson_sword1h_skill_e",
   "icone": "Hendrickson_Sword1H_NormalSkill.webp",
   "nomFr": "Sort défensif",
   "recharge": 14.0,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]99%[-] de l'attaque. Augmente l'efficacité de guérison du héros de [#1A7331]10%[-] pendant [#1A7331]30s[-].",
   "gameId": "hendrickson_sword1h_skill_rmb",
   "icone": "Hendrickson_Sword1H_ActiveThird.webp",
   "nomFr": "Perforation divine",
   "recharge": 7.0,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]85%[-] de l'attaque.",
   "gameId": "hendrickson_sword1h_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Taillade d'estoc",
   "recharge": null,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Restaure les PV des alliés à portée de [#1A7331]0.5%[-] des PV max + [#1A7331]25%[-] de l'attaque toutes les [#1A7331]1s[-] pendant [#1A7331]10s[-].",
   "gameId": "hendrickson_sword1h_skill_q",
   "icone": "Hendrickson_Sword1H_UltimateSKill.webp",
   "nomFr": "Déferlante magique",
   "recharge": 10.0,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "L'utilisation de la compétence de relève restaure la jauge de magie de [#1A7331]500[-] en ayant [#1A7331]3[-] points de magie ou moins.",
   "gameId": "hendrickson_sword1h_passive",
   "icone": "Hendrickson_Sword1h_Passive.webp",
   "nomFr": "Ralliement de capitaine",
   "recharge": 0.0,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]143%[-] de l'attaque. [#1A7331]15%[-] de chances de réduire le temps de recharge de l'attaque spéciale de [#1A7331]1s[-].\n1er coup : 21%\n2e coup : 22%\n3e coup : 37%\n4e coup : 63%",
   "gameId": "hendrickson_sworddual_jumpatk",
   "icone": "common_SwordDual_normalAttack.webp",
   "nomFr": "Double frappe",
   "recharge": null,
   "weaponType": "SwordDual"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]281%[-] de l'attaque. Augmente les dégâts crit. de [#1A7331]30%[-] en attaquant des ennemis dans le dos.",
   "gameId": "hendrickson_sworddual_skill_e",
   "icone": "Hendrickson_SwordDual_NormalSkill.webp",
   "nomFr": "Tranchant rapide",
   "recharge": 12.0,
   "weaponType": "SwordDual"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Se téléporte derrière l'ennemi et inflige des dégâts égaux à [#1A7331]178%[-] de l'attaque.\nAttaquer un ennemi dont la vitesse de déplacement est réduite [#0F5CD8]l'étourdit[-] pendant [#1A7331]5s[-] et augmente les chances crit. du héros de [#1A7331]10%[-] pendant [#1A7331]20s[-].",
   "gameId": "hendrickson_sworddual_skill_rmb",
   "icone": "Hendrickson_SwordDual_ActiveThird.webp",
   "nomFr": "Épée éclair",
   "recharge": 11.0,
   "weaponType": "SwordDual"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]127%[-] de l'attaque.",
   "gameId": "hendrickson_sworddual_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Double taillade",
   "recharge": null,
   "weaponType": "SwordDual"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]421%[-] de l'attaque et réduit la vitesse de déplacement de [#1A7331]30%[-] pendant [#1A7331]20s[-].",
   "gameId": "hendrickson_sworddual_skill_q",
   "icone": "Hendrickson_SwordDual_UltimateSKill.webp",
   "nomFr": "Épée de chevalier",
   "recharge": 10.0,
   "weaponType": "SwordDual"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Lorsqu'un héros allié attaque un ennemi dont la vitesse de déplacement est réduite, augmente ses chances crit. de [#1A7331]10%[-].",
   "gameId": "hendrickson_sworddual_passive",
   "icone": "Hendrickson_SwordDual_Passive.webp",
   "nomFr": "Regain de moral",
   "recharge": 0.0,
   "weaponType": "SwordDual"
  }
 ],
 "howzer": [
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]87%[-] de l'attaque.\n1er coup : 13%\n2e coup : 14%\n3e coup : 23%\n4e coup : 37%",
   "gameId": "howzer_cudgel3c_jumpatk",
   "icone": "common_Cudgel3c_normalAttack.webp",
   "nomFr": "Vent pulvérisant",
   "recharge": null,
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]4%[-] de l'attaque aux ennemis proches tant que la posture est maintenue, et octroie une [#0F5CD8]barrière[-] égale à [#1A7331]75%[-] de l'attaque pendant [#1A7331]15s[-] à tous les héros alliés lorsque l'attaque fait mouche [#1A7331]10 fois[-].\nLa dernière frappe inflige des dégâts égaux à [#1A7331]74%[-] de l'attaque et restaure la jauge de relève de [#1A7331]200[-].",
   "gameId": "howzer_cudgel3c_skill_e_ready",
   "icone": "Howzer_Cudgel3c_NormalSkill.webp",
   "nomFr": "Brise-tempête",
   "recharge": 30.0,
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]80%[-] de l'attaque et attire l'ennemi vers le héros, avant de l'[#0F5CD8]Étourdir[-] pendant [#1A7331]4s[-].",
   "gameId": "howzer_cudgel3c_skill_rmb",
   "icone": "Howzer_Cudgel3c_ActiveThird.webp",
   "nomFr": "Poignard précis",
   "recharge": 12.0,
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]73%[-] de l'attaque.",
   "gameId": "howzer_cudgel3c_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Enchaînement d'uppercuts",
   "recharge": null,
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]214%[-] de l'attaque. Si le héros bénéficie d'une [#0F5CD8]barrière[-], réduit la résistance crit. de l'ennemi de [#1A7331]15%[-] pendant [#1A7331]40s[-].",
   "gameId": "howzer_cudgel3c_skill_q",
   "icone": "Howzer_Cudgel3c_UltimateSKill.webp",
   "nomFr": "Rafale",
   "recharge": 10.0,
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Chaque attaque portée sur un ennemi sous l'effet de [#0F5CD8]Déluge de Vent[-] réduit sa résistance au Vent de [#1A7331]15%[-] pendant [#1A7331]20s[-].",
   "gameId": "howzer_cudgel3c_passive",
   "icone": "Howzer_Cudgel3c_Passive.webp",
   "nomFr": "Œil du cyclone",
   "recharge": 0.0,
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]75%[-] de l'attaque. [#1A7331]50%[-] de chances de réinitialiser le temps de recharge de l'attaque spéciale lors de la dernière frappe.\n1er coup : 11%\n2e coup : 12%\n3e coup : 19%\n4e coup : 33%",
   "gameId": "howzer_gauntlets_jumpatk",
   "icone": "common_Gauntlets_normalAttack.webp",
   "nomFr": "Coup de poing du Vent",
   "recharge": null,
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]107%[-] de l'attaque. [#1A7331]50%[-] de chances de réinitialiser le temps de recharge de l'attaque spéciale.",
   "gameId": "howzer_gauntlets_skill_e",
   "icone": "Howzer_Gauntlets_NormalSkill.webp",
   "nomFr": "Combo",
   "recharge": 18.0,
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]75%[-] de l'attaque. La deuxième frappe réduit la résistance crit. de [#1A7331]5%[-] pendant [#1A7331]40s[-] si l'ennemi souffre de [#0F5CD8]Saignement[-]. (Max : [#1A7331]3 fois[-])\n1er coup : 25%\n2e coup : 50%",
   "gameId": "howzer_gauntlets_skill_rmb_1",
   "icone": "Howzer_Gauntlets_ActiveThird.webp",
   "nomFr": "Impact cyclonique",
   "recharge": 10.0,
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]62%[-] de l'attaque.",
   "gameId": "howzer_gauntlets_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Poing ascendant",
   "recharge": null,
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Augmente les dégâts crit. de tous les héros alliés d'attribut Vent de [#1A7331]30%[-], puis inflige des dégâts égaux à [#1A7331]212%[-] de l'attaque pendant [#1A7331]40s[-].",
   "gameId": "howzer_gauntlets_skill_q",
   "icone": "Howzer_Gauntlets_UltimateSKill.webp",
   "nomFr": "Choc tournoyant",
   "recharge": 10.0,
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Lorsqu'un héros allié attaque un ennemi qui souffre de [#0F5CD8]Saignement[-], augmente ses dégâts de Vent de [#1A7331]20%[-].",
   "gameId": "howzer_gauntlets_passive",
   "icone": "Howzer_Gauntlets_Passive.webp",
   "nomFr": "Rugissement de la tempête",
   "recharge": 0.0,
   "weaponType": "Gauntlets"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]158%[-] de l'attaque.\n1er coup : 22%\n2e coup : 24%\n3e coup : 42%\n4e coup : 70%",
   "gameId": "howzer_lance_jumpatk",
   "icone": "common_Lance_normalAttack.webp",
   "nomFr": "Coup de lance",
   "recharge": null,
   "weaponType": "Lance"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]276%[-] de l'attaque. Inflige [#0F5CD8]Saignement[-] pendant [#1A7331]20s[-] si le héros est sous l'effet de [#0F5CD8]Rafale[-].\n\n※ [#0F5CD8]Saignement[-] : inflige des dégâts de Vent égaux à [#1A7331]10%[-] des dégâts infligés toutes les [#1A7331]1s[-]. Réduit l'efficacité de guérison de [#1A7331]20%[-]. Réduit en outre l'efficacité de guérison de [#1A7331]6%[-] après avoir réussi un coup critique. (Max : [#1A7331]10 fois[-])",
   "gameId": "howzer_lance_skill_e",
   "icone": "Howzer_Lance_NormalSkill.webp",
   "nomFr": "Rafale aspirante",
   "recharge": 15.0,
   "weaponType": "Lance"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]147%[-] de l'attaque et octroie [#0F5CD8]Rafale[-] au héros pendant [#1A7331]20s[-].\n\n※ [#0F5CD8]Rafale[-] : inflige des dégâts supplémentaires égaux à [#1A7331]15%[-] des dégâts infligés avec la compétence normale ou l'attaque ultime.",
   "gameId": "howzer_lance_skill_rmb",
   "icone": "Howzer_Lance_ActiveThird.webp",
   "nomFr": "Déluge de lance tempétueuse",
   "recharge": 18.0,
   "weaponType": "Lance"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]135%[-] de l'attaque.",
   "gameId": "howzer_lance_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Que s'abatte le vent",
   "recharge": null,
   "weaponType": "Lance"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]406%[-] de l'attaque à l'ennemi et l'attire vers le centre.\nAugmente les chances crit. de [#1A7331]50%[-] en attaquant un ennemi affecté par [#0F5CD8]Saignement[-].",
   "gameId": "howzer_lance_skill_q",
   "icone": "Howzer_Lance_UltimateSKill.webp",
   "nomFr": "Super cyclone",
   "recharge": 10.0,
   "weaponType": "Lance"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Chaque attaque portée sur un ennemi sous l'effet de [#0F5CD8]Déluge de Vent[-] augmente les dégâts de Vent de [#1A7331]3%[-] pendant [#1A7331]20s[-]. (Max : [#1A7331]8 fois[-])",
   "gameId": "howzer_lance_passive",
   "icone": "Howzer_Lance_Passive.webp",
   "nomFr": "Cœur de la tempête",
   "recharge": 0.0,
   "weaponType": "Lance"
  }
 ],
 "jericho": [
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]89%[-] de l'attaque.\n1er coup : 13%\n2e coup : 14%\n3e coup : 23%\n4e coup : 39%",
   "gameId": "jericho_lance_jumpatk",
   "icone": "common_Lance_normalAttack.webp",
   "nomFr": "Poignard de glace",
   "recharge": null,
   "weaponType": "Lance"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]148%[-] de l'attaque. La dernière frappe octroie des [#0F5CD8]barrières[-] à tous les héros alliés égales à [#1A7331]20%[-] des PV max pendant [#1A7331]20s[-].\nAugmente les dégâts de Froid tous les héros alliés de [#1A7331]20%[-] pendant [#1A7331]40s[-] lorsque le héros bénéficie déjà d'une [#0F5CD8]barrière[-].",
   "gameId": "jericho_lance_skill_e",
   "icone": "Jericho_Lance_NormalSkill.webp",
   "nomFr": "Roche de glace",
   "recharge": 35.0,
   "weaponType": "Lance"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]86%[-] de l'attaque.",
   "gameId": "jericho_lance_skill_rmb",
   "icone": "Jericho_Lance_ActiveThird.webp",
   "nomFr": "Vague de froid",
   "recharge": 12.0,
   "weaponType": "Lance"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]72%[-] de l'attaque. La dernière frappe octroie des [#0F5CD8]barrières[-] à tous les héros alliés égales à [#1A7331]12%[-] des PV max et [#1A7331]2[-] cumul(s) de [#0F5CD8]Souffle gelé[-] supplémentaire(s) pendant [#1A7331]10s[-].\n\n※ [#0F5CD8]Souffle gelé[-] : augmente la défense de [#1A7331]3%[-], la défense de Feu de [#1A7331]5%[-] et la défense de Terre de [#1A7331]5%[-].",
   "gameId": "jericho_lance_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Entaille glaciale",
   "recharge": null,
   "weaponType": "Lance"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]214%[-] de l'attaque et inflige [#0F5CD8]Gel[-]. Augmente les dégâts infligés de [#1A7331]10%[-] pour chaque tranche de [#1A7331]1[-] effet(s) [#0F5CD8]Souffle gelé[-] présent(s) sur le héros.\n\n※ [#0F5CD8]Gel[-] : immobilisation. En subissant l'attaque d'une compétence, inflige [#1A7331]80%[-] des dégâts subis et retire Gel.",
   "gameId": "jericho_lance_skill_q",
   "icone": "Jericho_Lance_UltimateSKill.webp",
   "nomFr": "Glacier",
   "recharge": 10.0,
   "weaponType": "Lance"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Octroie [#0F5CD8]Souffle gelé[-] à tous les héros alliés pendant [#1A7331]20s[-] à chaque coup lorsque le héros bénéficie d'une [#0F5CD8]barrière[-]. (Max : [#1A7331]10 fois[-])\nAugmente les dégâts de Froid de [#1A7331]20%[-] lorsque les cumuls de [#0F5CD8]Souffle gelé[-] sont au maximum.\n\n※ [#0F5CD8]Souffle gelé[-] : augmente la défense de [#1A7331]3%[-], la défense de Feu de [#1A7331]5%[-] et la défense de Terre de [#1A7331]5%[-].",
   "gameId": "jericho_lance_passive",
   "icone": "Jericho_Lance_Passive.webp",
   "nomFr": "Protection glaciale",
   "recharge": 0.0,
   "weaponType": "Lance"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]136%[-] de l'attaque.\n1er coup : 19%\n2e coup : 21%\n3e coup : 35%\n4e coup : 61%",
   "gameId": "jericho_rapier_jumpatk",
   "icone": "common_Rapier_normalAttack.webp",
   "nomFr": "Entaille glaciale",
   "recharge": null,
   "weaponType": "Rapier"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Augmente les dégâts de Froid du héros de [#1A7331]20%[-] pendant [#1A7331]10s[-], puis inflige des dégâts égaux à [#1A7331]201%[-] de l'attaque.\nAttaquer un ennemi affecté par [#0F5CD8]Refroidissement[-] ou [#0F5CD8]Gel[-] augmente les chances crit. de [#1A7331]50%[-].",
   "gameId": "jericho_rapier_skill_e",
   "icone": "Jericho_Rapier_NormalSkill.webp",
   "nomFr": "Danse de la lame de givre",
   "recharge": 22.0,
   "weaponType": "Rapier"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]160%[-] de l'attaque.\nAttaquer un ennemi affecté par [#0F5CD8]Refroidissement[-] ou [#0F5CD8]Gel[-] augmente les chances crit. de [#1A7331]50%[-], et chaque coup porté réduit le temps de recharge de la compétence normale de [#1A7331]2s[-].",
   "gameId": "jericho_rapier_skill_rmb",
   "icone": "Jericho_Rapier_ActiveThird.webp",
   "nomFr": "Poignard croc-de-givre",
   "recharge": 17.0,
   "weaponType": "Rapier"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]132%[-] de l'attaque.",
   "gameId": "jericho_rapier_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Frappe glaciale",
   "recharge": null,
   "weaponType": "Rapier"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]451%[-] de l'attaque.\nAttaquer un ennemi affecté par [#0F5CD8]Refroidissement[-] ou [#0F5CD8]Gel[-] augmente les chances crit. de [#1A7331]50%[-], et chaque coup porté réduit le temps de recharge de l'attaque spéciale et de la compétence normale de [#1A7331]2s[-].",
   "gameId": "jericho_rapier_skill_q",
   "icone": "Jericho_Rapier_UltimateSKill.webp",
   "nomFr": "Bombardement glacial",
   "recharge": 10.0,
   "weaponType": "Rapier"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Augmente les dégâts crit. de [#1A7331]3%[-] pendant [#1A7331]5s[-] en attaquant un ennemi affecté par [#0F5CD8]Refroidissement[-] ou [#0F5CD8]Gel[-]. (Max : [#1A7331]25 fois[-])",
   "gameId": "jericho_rapier_passive",
   "icone": "Jericho_Rapier_Passive.webp",
   "nomFr": "Barrage glacial",
   "recharge": 0.0,
   "weaponType": "Rapier"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]87%[-] de l'attaque.\n1er coup : 16%\n2e coup : 17%\n3e coup : 22%\n4e coup : 32%",
   "gameId": "jericho_sworddual_normalatk_1_enchant",
   "icone": "common_SwordDual_normalAttack.webp",
   "nomFr": "Double entaille glacée",
   "recharge": null,
   "weaponType": "SwordDual"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Octroie [#0F5CD8]Sabre de glace[-] pendant [#1A7331]10s[-] et inflige des dégâts égaux à [#1A7331]161%[-] de l'attaque.\n\n※ [#0F5CD8]Sabre de glace[-] : utiliser une attaque normale téléporte le héros derrière l'ennemi pour infliger des dégâts supplémentaires égaux à [#1A7331]15%[-] de l'attaque et augmenter sa jauge de Déluge de [#1A7331]20[-].",
   "gameId": "jericho_sworddual_skill_e",
   "icone": "Jericho_SwordDual_NormalSkill.webp",
   "nomFr": "Enchantement d'arme",
   "recharge": 30.0,
   "weaponType": "SwordDual"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]101%[-] de l'attaque. La dernière frappe augmente la jauge de Déluge de [#1A7331]300[-] lorsque l'effet [#0F5CD8]Sabre de glace[-] est actif.",
   "gameId": "jericho_sworddual_skill_rmb",
   "icone": "Jericho_SwordDual_ActiveThird.webp",
   "nomFr": "Danse jumelle de glace",
   "recharge": 13.0,
   "weaponType": "SwordDual"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]87%[-] de l'attaque.",
   "gameId": "jericho_sworddual_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Taillade glaciale",
   "recharge": null,
   "weaponType": "SwordDual"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]246%[-] de l'attaque. Chaque coup inflige des dégâts égaux à [#1A7331]40%[-] des dégâts infligés lorsque l'effet [#0F5CD8]Sabre de glace[-] est actif.",
   "gameId": "jericho_sworddual_skill_q",
   "icone": "Jericho_SwordDual_UltimateSKill.webp",
   "nomFr": "Aiguille de glace",
   "recharge": 10.0,
   "weaponType": "SwordDual"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "L'activation du [#0F5CD8]Déluge de Froid[-] du héros réduit la résistance au Froid de l'ennemi de [#1A7331]25%[-] pendant [#1A7331]30s[-] et restaure [#1A7331]1[-] point(s) de relève.",
   "gameId": "jericho_sworddual_passive",
   "icone": "Jericho_SwordDual_Passive.webp",
   "nomFr": "Givre tranchant",
   "recharge": 0.0,
   "weaponType": "SwordDual"
  }
 ],
 "king": [
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]72%[-] de l'attaque. [#1A7331]20%[-] de chances d'infliger [#0F5CD8]Marque de la forêt[-] pendant [#1A7331]40s[-]. (Max : [#1A7331]10 fois[-])\n1er coup : 11%\n2e coup : 12%\n3e coup : 18%\n4e coup : 31%\n\n※ [#0F5CD8]Marque de la forêt[-] : augmente les dégâts subis de [#1A7331]2%[-].",
   "gameId": "king_book_jumpatk",
   "icone": "common_Book_normalAttack.webp",
   "nomFr": "Coup de poing de gardien",
   "recharge": null,
   "weaponType": "Book"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]151%[-] de l'attaque, puis inflige [#1A7331]3[-] cumul(s) de [#0F5CD8]Marque de la forêt[-] pendant [#1A7331]40s[-]. (Max : [#1A7331]10 fois[-])\n\n※ [#0F5CD8]Marque de la forêt[-] : augmente les dégâts subis de [#1A7331]2%[-].",
   "gameId": "king_book_skill_e",
   "icone": "King_Book_NormalSkill.webp",
   "nomFr": "Protecteur de la forêt",
   "recharge": 16.0,
   "weaponType": "Book"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Immunise contre les réactions et réduit les dégâts subis de [#1A7331]65%[-] tant que la posture est maintenue. Inflige [#0F5CD8]Marque de la forêt[-] aux ennemis proches pendant [#1A7331]40s[-] toutes les [#1A7331]1s[-] tant que la posture est maintenue. (Max : [#1A7331]10 fois[-])\nMaintient la posture pendant un maximum de [#1A7331]5s[-]. Lorsque la posture est maintenue pendant la durée maximale, la posture est retirée, ce qui inflige des dégâts égaux à [#1A7331]97%[-] de l'attaque et restaure les PV à hauteur de [#1A7331]15%[-] des PV max + [#1A7331]150%[-] de l'attaque.\nAugmente les dégâts infligés par cette attaque de [#1A7331]5%[-] pour [#1A7331]chaque[-] cumul de [#0F5CD8]Marque de la forêt[-] présent sur l'ennemi.\n\n※ [#0F5CD8]Marque de la forêt[-] : augmente les dégâts subis de [#1A7331]2%[-].",
   "gameId": "king_book_skill_rmb_ready",
   "icone": "King_Book_ActiveThird.webp",
   "nomFr": "Bouclier gardien",
   "recharge": 12.0,
   "weaponType": "Book"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]70%[-] de l'attaque.",
   "gameId": "king_book_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Arc supérieur",
   "recharge": null,
   "weaponType": "Book"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Octroie [#0F5CD8]Protection de la forêt[-] à tous les héros alliés pendant [#1A7331]20s[-].\n\n※ [#0F5CD8]Protection de la forêt[-] : octroie une [#0F5CD8]barrière[-] égale à [#1A7331]18%[-] des PV max. Restaure les PV à hauteur de [#1A7331]0.8%[-] des PV max + [#1A7331]25%[-] de l'attaque toutes les [#1A7331]2s[-].",
   "gameId": "king_book_skill_q",
   "icone": "King_Book_UltimateSKill.webp",
   "nomFr": "Protection de la forêt",
   "recharge": 10.0,
   "weaponType": "Book"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Réduit les dégâts subis par tous les héros alliés de [#1A7331]20%[-] et augmente l'efficacité de guérison de [#1A7331]30%[-] si les PV restants sont inférieurs ou égaux à [#1A7331]30%[-].",
   "gameId": "king_book_passive",
   "icone": "King_Book_Passive.webp",
   "nomFr": "Protection de l'Arbre sacré",
   "recharge": 0.0,
   "weaponType": "Book"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]140%[-] de l'attaque.\n1er coup : 20%\n2e coup : 22%\n3e coup : 36%\n4e coup : 62%",
   "gameId": "king_staff_jumpatk",
   "icone": "common_Staff_normalAttack.webp",
   "nomFr": "Bâton perforant",
   "recharge": null,
   "weaponType": "Staff"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]245%[-] de l'attaque, puis octroie un nombre de cumuls de [#0F5CD8]Floraison[-] égal au nombre d'ennemis touchés par la première frappe pendant [#1A7331]20s[-]. (Max : [#1A7331]15[-])\nAugmente les dégâts infligés de [#1A7331]2%[-] pour [#1A7331]chaque[-] effet de [#0F5CD8]Floraison[-] sur le héros. Si le héros bénéficie de l'effet de [#0F5CD8]Floraison totale[-], augmente les dégâts infligés de [#1A7331]40%[-].\n\n※ [#0F5CD8]Floraison[-] : augmente l'attaque de [#1A7331]1%[-] pour chaque tranche de [#1A7331]1 cumul(s)[-]. Lorsque [#0F5CD8]Floraison[-] atteint le nombre maximal de cumuls, retire tous les effets de [#0F5CD8]Floraison[-] et octroie [#0F5CD8]Floraison totale[-] au héros pendant [#1A7331]20s[-].\n※ [#0F5CD8]Floraison totale[-] : augmente l'attaque de [#1A7331]25%[-] et le percement de défense de [#1A7331]10%[-].",
   "gameId": "king_staff_skill_e",
   "icone": "King_Staff_NormalSkill.webp",
   "nomFr": "Essaim sacré",
   "recharge": 12.0,
   "weaponType": "Staff"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Octroie [#1A7331]1[-] cumul(s) de [#0F5CD8]Floraison[-] pendant [#1A7331]20s[-] (Max : [#1A7331]15[-]), puis inflige des dégâts égaux à [#1A7331]166%[-] de l'attaque.\n\n※ [#0F5CD8]Floraison[-] : augmente l'attaque de [#1A7331]1%[-] par tranche de [#1A7331]1 cumul(s)[-]. Lorsque [#0F5CD8]Floraison[-] atteint le nombre maximal de cumuls, retire tous les effets de [#0F5CD8]Floraison[-] et octroie [#0F5CD8]Floraison totale[-] au héros pendant [#1A7331]20s[-].\n※ [#0F5CD8]Floraison totale[-] : augmente l'attaque de [#1A7331]25%[-] et le percement de défense de [#1A7331]10%[-].",
   "gameId": "king_staff_skill_rmb",
   "icone": "King_Staff_ActiveThird.webp",
   "nomFr": "Bâton de tempête",
   "recharge": 7.0,
   "weaponType": "Staff"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]114%[-] de l'attaque. Augmente les chances crit. du héros de [#1A7331]15%[-] pendant [#1A7331]20s[-].",
   "gameId": "king_staff_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Abeilles traqueuses",
   "recharge": null,
   "weaponType": "Staff"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]433%[-] de l'attaque.\nAugmente les dégâts infligés de [#1A7331]2%[-] pour [#1A7331]chaque[-] effet [#0F5CD8]Floraison[-] sur le héros. Si le héros bénéficie de l'effet de [#0F5CD8]Floraison totale[-], augmente les dégâts infligés de [#1A7331]50%[-] et les chances crit. de [#1A7331]50%[-].\nUtiliser une attaque combinée avec l'attaque ultime du héros en tant que base augmente l'efficacité de recharge de la magie de tous les héros alliés de [#1A7331]30%[-] pendant [#1A7331]40s[-]. Lorsque [#0F5CD8]Floraison[-] atteint le nombre maximal de cumuls, retire tous les cumuls et octroie [#0F5CD8]Floraison totale[-] au héros pendant [#1A7331]20s[-].\n\n※ [#0F5CD8]Floraison totale[-] : augmente l'attaque de [#1A7331]25%[-] et le percement de défense de [#1A7331]10%[-].",
   "gameId": "king_staff_skill_q",
   "icone": "King_Staff_UltimateSKill.webp",
   "nomFr": "Flambée resplendissante",
   "recharge": 10.0,
   "weaponType": "Staff"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Octroie [#0F5CD8]Floraison[-] pendant [#1A7331]20s[-] après avoir réussi un coup critique.\nOctroie [#0F5CD8]Floraison[-] pendant [#1A7331]20s[-] en attaquant un ennemi sous l'effet d'un [#0F5CD8]Déluge[-]. (Max : [#1A7331]15[-])\n\n[#0F5CD8]※ Floraison[-] : augmente l'attaque de [#1A7331]1%[-] par tranche de [#1A7331]1 cumul(s)[-]. Lorsque [#0F5CD8]Floraison[-] atteint le nombre maximal de cumuls, retire tous les cumuls de [#0F5CD8]Floraison[-] et octroie [#0F5CD8]Floraison totale[-] au héros pendant [#1A7331]20s[-].\n※ [#0F5CD8]Floraison totale[-] : augmente l'attaque de [#1A7331]25%[-] et le percement de défense de [#1A7331]10%[-].",
   "gameId": "king_staff_passive",
   "icone": "King_Staff_Passive.webp",
   "nomFr": "Roi des fées",
   "recharge": 0.0,
   "weaponType": "Staff"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]52%[-] de l'attaque.\n1er coup : 12%\n2e coup : 15%\n3e coup : 25%",
   "gameId": "king_wand_jumpatk",
   "icone": "common_Wand_normalAttack.webp",
   "nomFr": "Tir terrestre",
   "recharge": null,
   "weaponType": "Wand"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]130%[-] de l'attaque, puis octroie [#0F5CD8]Fée de la forêt[-] à tous les héros alliés pendant [#1A7331]40s[-].\n\n※ [#0F5CD8]Fée de la forêt[-] : augmente les dégâts de Terre de [#1A7331]20%[-].",
   "gameId": "king_wand_skill_e",
   "icone": "King_Wand_NormalSkill.webp",
   "nomFr": "Pouvoir des fées",
   "recharge": 20.0,
   "weaponType": "Wand"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Restaure la jauge de magie de [#1A7331]80[-] toutes les [#1A7331]1s[-] et augmente la défense de tous les héros alliés de [#1A7331]6%[-] pendant [#1A7331]20s[-] tant que la posture est maintenue. (Max : [#1A7331]5 fois[-])",
   "gameId": "king_wand_skill_rmb_ready",
   "icone": "King_Wand_ActiveThird.webp",
   "nomFr": "Posture de guérison",
   "recharge": 20.0,
   "weaponType": "Wand"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]62%[-] de l'attaque. Restaure la jauge de magie de [#1A7331]200[-].",
   "gameId": "king_wand_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Impact terrestre",
   "recharge": null,
   "weaponType": "Wand"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]167%[-] de l'attaque. Chaque coup porté restaure la jauge de magie de [#1A7331]100[-].",
   "gameId": "king_wand_skill_q",
   "icone": "King_Wand_UltimateSKill.webp",
   "nomFr": "Taillade tranchante",
   "recharge": 15.0,
   "weaponType": "Wand"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Augmente l'attaque et la défense de tous les héros alliés d'attribut Terre de [#1A7331]5%[-] par tranche de [#1A7331]1[-] point(s) de magie. (Max : [#1A7331]7 fois[-])",
   "gameId": "king_wand_passive",
   "icone": "King_Wand_Passive.webp",
   "nomFr": "Protection de la fée",
   "recharge": 0.0,
   "weaponType": "Wand"
  }
 ],
 "klotho": [
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]81%[-] de l'attaque et octroie [#1A7331]1[-] cumul(s) de [#0F5CD8]Pierre runique[-] à tous les héros alliés pendant [#1A7331]30s[-] tous les [#1A7331]5[-] coup(s). (Max : [#1A7331]3 fois[-])\n1er coup : 12%\n2e coup : 13%\n3e coup : 21%\n4e coup : 35%\n\n※ [#0F5CD8]Pierre runique[-] : en subissant une attaque, retire [#1A7331]1 cumul(s)[-] et restaure les PV à hauteur de [#1A7331]10%[-] des PV max de l'utilisateur + [#1A7331]60%[-] de son attaque (Temps de recharge : [#1A7331]5s[-]). Une fois atteint le nombre maximal de cumuls, augmente les dégâts de Froid de [#1A7331]10%[-], et augmente l'attaque de Froid à hauteur de [#1A7331]1.5%[-] des PV max de l'utilisateur. (Max : [#1A7331]1000[-])",
   "gameId": "klotho_book_jumpatk",
   "icone": "common_Book_normalAttack.webp",
   "nomFr": "Projection runique",
   "recharge": null,
   "weaponType": "Book"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]76%[-] de l'attaque.\nLorsque le héros bénéficie d'[#0F5CD8]Éveil runique[-], la compétence est améliorée pour durer [#1A7331]2.5s[-] et pour infliger des dégâts égaux à [#1A7331]45%[-] de l'attaque aux ennemis à portée toutes les [#1A7331]0.5s[-]. Inflige [#0F5CD8]Gel[-] pendant [#1A7331]6s[-] aux ennemis touchés [#1A7331]5 fois[-].\n\n※ [#0F5CD8]Gel[-] : immobilisation. En subissant l'attaque d'une compétence, inflige [#1A7331]80%[-] des dégâts subis et retire Gel.",
   "gameId": "klotho_book_skill_e_a",
   "icone": "Klotho_Book_NormalSkill.webp",
   "nomFr": "Rune de givre : Déploiement",
   "recharge": 18.0,
   "weaponType": "Book"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Immunise contre les réactions pendant l'utilisation de la compétence. Octroie le nombre maximal de cumuls de [#1A7331]Pierre runique[-] à tous les héros alliés pendant [#1A7331]30s[-]. (Max : [#0F5CD8]3 fois[-])\n\n※ [#0F5CD8]Pierre runique[-] : en subissant une attaque, retire [#1A7331]1 cumul(s)[-] et restaure les PV à hauteur de [#1A7331]10%[-] des PV max de l'utilisateur + [#1A7331]60%[-] de son attaque (Temps de recharge : [#1A7331]5s[-]). Une fois atteint le nombre maximal de cumuls, augmente les dégâts de Froid de [#1A7331]10%[-], et augmente l'attaque de Froid à hauteur de [#1A7331]1.5%[-] des PV max de l'utilisateur. (Max : [#1A7331]1000[-])",
   "gameId": "klotho_book_skill_rmb",
   "icone": "Klotho_Book_ActiveThird.webp",
   "nomFr": "Rune de givre : Rituel de concentration",
   "recharge": 29.0,
   "weaponType": "Book"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]74%[-] de l'attaque.",
   "gameId": "klotho_book_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Rune de givre : Impact écrasant",
   "recharge": null,
   "weaponType": "Book"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Octroie [#0F5CD8]Éveil runique[-] pendant [#1A7331]30s[-].\n\n※ [#0F5CD8]Éveil runique[-] : octroie le nombre maximal de cumuls de [#0F5CD8]Barrière runique[-] pendant [#1A7331]30s[-] la première fois que l'effet est octroyé. (Max : [#1A7331]5 fois[-]) Convertit l'effet [#0F5CD8]Pierre runique[-] du héros en [#0F5CD8]Barrière runique[-]. Retire tous les cumuls de [#0F5CD8]Barrière runique[-] lorsque l'effet est retiré.\n※ [#0F5CD8]Barrière runique[-] : en subissant une attaque, retire [#1A7331]1 cumul(s)[-] et restaure les PV à hauteur de [#1A7331]25%[-] des PV max de l'utilisateur + [#1A7331]150%[-] de son attaque (Temps de recharge : [#1A7331]5s[-]). Une fois atteint le nombre maximal de cumuls, augmente les dégâts de Froid de [#1A7331]40%[-], et augmente l'attaque de Froid à hauteur de [#1A7331]6%[-] des PV max de l'utilisateur. (Max : [#1A7331]4000[-])",
   "gameId": "klotho_book_skill_q_a",
   "icone": "Klotho_Book_UltimateSKill.webp",
   "nomFr": "Rune de givre : Forme parfaite",
   "recharge": 10.0,
   "weaponType": "Book"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Augmente les dégâts de Froid de tous les héros alliés de [#1A7331]6%[-] et réduit les dégâts subis de [#1A7331]3%[-] pour chaque tranche de [#1A7331]1[-] cumul(s) de Pierre runique ou Barrière runique.",
   "gameId": "klotho_book_passive",
   "icone": "Klotho_Book_Passive.webp",
   "nomFr": "Résonance de rune de givre",
   "recharge": 0.0,
   "weaponType": "Book"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]138%[-] de l'attaque.\n1er coup : 14%\n2e coup : 16%\n3e coup : 24%\n4e coup : 37%\n5e coup : 47%",
   "gameId": "klotho_rapier_jumpatk",
   "icone": "common_Rapier_normalAttack.webp",
   "nomFr": "Salve d'inscriptions",
   "recharge": null,
   "weaponType": "Rapier"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]151%[-] de l'attaque. Attaquer un ennemi affecté par [#0F5CD8]Faille dimensionnelle[-] retire le cumul. Pour chaque cumul retiré, inflige des dégâts supplémentaires égaux à [#1A7331]50%[-] de l'attaque [#1A7331]3 fois[-] sous forme de coups critiques.",
   "gameId": "klotho_rapier_skill_e",
   "icone": "Klotho_Rapier_NormalSkill.webp",
   "nomFr": "Tempête d'entailles",
   "recharge": 17.0,
   "weaponType": "Rapier"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Immunise contre les réactions et inflige des dégâts égaux à [#1A7331]10%[-] de l'attaque tant que la posture est maintenue, et augmente la jauge de Déluge à hauteur de [#1A7331]10[-] + [#1A7331]0.3%[-] de l'attaque (Max : [#1A7331]60[-]) tous les [#1A7331]3 coup(s)[-].\nLa dernière frappe inflige des dégâts égaux à [#1A7331]46%[-] de l'attaque, et face aux ennemis affectés par [#0F5CD8]Faille spatiale[-], augmente la jauge de Déluge à hauteur de [#1A7331]50[-] + [#1A7331]1%[-] de l'attaque. (Max : [#1A7331]200[-])",
   "gameId": "klotho_rapier_skill_rmb_ready",
   "icone": "Klotho_Rapier_ActiveThird.webp",
   "nomFr": "Traque des inscriptions : Chaîne perçante",
   "recharge": 23.0,
   "weaponType": "Rapier"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]89%[-] de l'attaque.",
   "gameId": "klotho_rapier_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Rafale d'inscriptions",
   "recharge": null,
   "weaponType": "Rapier"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]342%[-] de l'attaque.\nFace aux ennemis affectés par [#0F5CD8]Faille spatiale[-], l'attaque augmente la jauge de Déluge à hauteur de [#1A7331]10[-] + [#1A7331]0.2%[-] de l'attaque. (Max : [#1A7331]40[-]) Face aux ennemis affectés par [#0F5CD8]Faille dimensionnelle[-], elle inflige un coup critique et augmente les dégâts de Vent subis par la cible de [#1A7331]20%[-] pendant [#1A7331]30s[-].",
   "gameId": "klotho_rapier_skill_q",
   "icone": "Klotho_Rapier_UltimateSKill.webp",
   "nomFr": "Inscription runique : Affaissement",
   "recharge": 10.0,
   "weaponType": "Rapier"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Attaquer un ennemi qui n'est pas affecté par [#0F5CD8]Faille spatiale[-] [#1A7331]5 fois[-] lui inflige [#0F5CD8]Faille spatiale[-] pendant [#1A7331]20s[-].\nL'activation d'un [#0F5CD8]Déluge de Vent[-] sur un ennemi affecté par [#0F5CD8]Faille spatiale[-] retire l'effet et inflige [#0F5CD8]Faille dimensionnelle[-] pendant [#1A7331]15s[-].\n\n※[#0F5CD8]Faille spatiale[-] : réduit la résistance au Déluge de Vent de [#1A7331]20%[-].\n※[#0F5CD8]Faille dimensionnelle[-] : Inflige des dégâts de Vent égaux à [#1A7331]10%[-] de l'attaque sous forme de coup critique toutes les [#1A7331]2s[-]. Inflige des dégâts de Vent égaux à [#1A7331]105%[-] de l'attaque sous forme de coup critique lorsque l'effet est retiré.",
   "gameId": "klotho_rapier_passive",
   "icone": "Klotho_Rapier_Passive.webp",
   "nomFr": "Inscription de faille",
   "recharge": 0.0,
   "weaponType": "Rapier"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]149%[-] de l'attaque.\n1er coup : 22%\n2e coup : 24%\n3e coup : 39%\n4e coup : 64%",
   "gameId": "klotho_staff_normalatk_enchant_ready",
   "icone": "common_Staff_normalAttack.webp",
   "nomFr": "Projection dimensionnelle",
   "recharge": null,
   "weaponType": "Staff"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Crée une zone pendant [#1A7331]7.5s[-] qui inflige des dégâts égaux à [#1A7331]5%[-] de l'attaque aux ennemis à portée toutes les [#1A7331]0.5s[-] et qui les attire vers son centre.\nActive [#3C22D6]Compétence normale : Déchirure dimensionnelle[-] lorsque [#1A7331]2[-] occurrences de [#3C22D6]Compétence normale : Onde dimensionnelle[-] se chevauchent.\n\n[#3C22D6]Déchirure dimensionnelle[-]\nCrée une zone pendant [#1A7331]10s[-] qui inflige des dégâts égaux à [#1A7331]9%[-] de l'attaque aux ennemis à portée toutes les [#1A7331]0.3s[-] en les attirant vers le centre et qui inflige [#0F5CD8]Érosion dimensionnelle[-] pendant [#1A7331]10s[-].\n\n※ [#0F5CD8]Érosion dimensionnelle[-] : réduit la défense crit. de [#1A7331]10%[-].",
   "gameId": "klotho_staff_skill_e",
   "icone": "Klotho_Staff_NormalSkill.webp",
   "nomFr": "Onde dimensionnelle",
   "recharge": 21.0,
   "weaponType": "Staff"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Crée une zone pendant [#1A7331]15s[-]. Augmente les chances crit. du héros de [#1A7331]20%[-] et ses dégâts crit. de [#1A7331]40%[-] tant qu'il se tient dans la zone.\nUtiliser à nouveau la compétence tandis qu'une zone est active supprime cette dernière et en crée une nouvelle à l'endroit où le héros se trouve pendant [#1A7331]15s[-].",
   "gameId": "klotho_staff_skill_rmb",
   "icone": "Klotho_Staff_ActiveThird.webp",
   "nomFr": "Amélioration dimensionnelle",
   "recharge": 25.0,
   "weaponType": "Staff"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]139%[-] de l'attaque.",
   "gameId": "klotho_staff_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Brèche dimensionnelle",
   "recharge": null,
   "weaponType": "Staff"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Octroie l'état [#0F5CD8]Éveil dimensionnel[-] pendant [#1A7331]12s[-].\n\n[#0F5CD8][Éveil dimensionnel][-]\nAméliore les attaques normales pour infliger des dégâts égaux à [#1A7331]14%[-] de l'attaque ([#1A7331]1176%[-] max) tant que la posture est maintenue, et la dernière frappe inflige des dégâts égaux à [#1A7331]72%[-] de l'attaque.\nChaque coup de cette attaque réduit le temps de recharge de la compétence normale du héros de [#1A7331]0.5s[-] et augmente les dégâts crit. des attaques normales améliorées de [#1A7331]1%[-]. (Max : [#1A7331]50 fois[-])\nAugmente les chances crit. des attaques normales améliorées de [#1A7331]20%[-] face aux ennemis affectés par [#0F5CD8]Érosion dimensionnelle[-].",
   "gameId": "klotho_staff_skill_q",
   "icone": "Klotho_Staff_UltimateSKill.webp",
   "nomFr": "Domination dimensionnelle",
   "recharge": 10.0,
   "weaponType": "Staff"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Augmente les dégâts de Vent de [#1A7331]25%[-] pendant [#1A7331]20s[-] chaque fois que le héros active [#3C22D6]Compétence normale : Onde dimensionnelle[-] ou [#3C22D6]Compétence normale : Déchirure dimensionnelle[-]. (Max : [#1A7331]75%[-])",
   "gameId": "klotho_staff_passive",
   "icone": "Klotho_Staff_Passive.webp",
   "nomFr": "Résonance de rune dimensionnelle",
   "recharge": 0.0,
   "weaponType": "Staff"
  }
 ],
 "manny": [
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]83%[-] de l'attaque.\n1er coup : 11%\n2e coup : 13%\n3e coup : 21%\n4e coup : 38%",
   "gameId": "manny_staff_jumpatk",
   "icone": "common_Staff_normalAttack.webp",
   "nomFr": "Lumière de la prêtresse",
   "recharge": null,
   "weaponType": "Staff"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]168%[-] de l'attaque et inflige [#0F5CD8]Châtiment[-] pendant [#1A7331]15s[-].\nPorte un coup critique en attaquant des ennemis souffrant de [#0F5CD8]Châtiment[-].\n\n※ [#0F5CD8]Châtiment[-] : inflige des dégâts du Sacré égaux à [#1A7331]3%[-] des dégâts infligés toutes les [#1A7331]0.4s[-].",
   "gameId": "manny_staff_skill_e",
   "icone": "Manny_Staff_NormalSkill.webp",
   "nomFr": "Jugement Sacré",
   "recharge": 21.0,
   "weaponType": "Staff"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Octroie l'effet de [#0F5CD8]Prêtresse draco[-] aux alliés à portée pendant [#1A7331]15s[-].\n\n※ [#0F5CD8]Prêtresse draco[-] : augmente les dégâts crit. de [#1A7331]30%[-] et l'efficacité de recharge de la magie de [#1A7331]25%[-].",
   "gameId": "manny_staff_skill_rmb",
   "icone": "Manny_Staff_ActiveThird.webp",
   "nomFr": "Bénédiction de la prêtresse",
   "recharge": 15.0,
   "weaponType": "Staff"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]87%[-] de l'attaque.",
   "gameId": "manny_staff_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Lumière sacrée",
   "recharge": null,
   "weaponType": "Staff"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Réinitialise le temps de recharge de la compétence normale de tous les héros alliés.\nLa première frappe inflige des dégâts égaux à [#1A7331]93%[-] de l'attaque et inflige [#0F5CD8]Traînée stellaire[-] pendant [#1A7331]30s[-].\nInflige des dégâts égaux à [#1A7331]20%[-] de l'attaque aux ennemis touchés toutes les [#1A7331]1s[-] pendant [#1A7331]5s[-].\n\n※ [#0F5CD8]Traînée stellaire[-] : réduit la résistance à tous les éléments de [#1A7331]20%[-].",
   "gameId": "manny_staff_skill_q",
   "icone": "Manny_Staff_UltimateSkill.webp",
   "nomFr": "Explosion éclair",
   "recharge": 10.0,
   "weaponType": "Staff"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Augmente les dégâts d'attaque ultime de [#1A7331]30%[-] lorsqu'un héros allié attaque un ennemi affecté par [#0F5CD8]Châtiment[-]. Faire mouche avec une attaque normale restaure la jauge de magie de [#1A7331]15[-].\nAugmente les dégâts d'attaque combinée de tous les héros alliés de [#1A7331]30%[-] pendant [#1A7331]10s[-] lorsque le héros utilise l'attaque ultime.",
   "gameId": "manny_staff_passive",
   "icone": "Manny_Staff_Passive.webp",
   "nomFr": "Prêtresse des dragons",
   "recharge": 0.0,
   "weaponType": "Staff"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]126%[-] de l'attaque.\n1er coup : 15%\n2e coup : 18%\n3e coup : 35%\n4e coup : 58%",
   "gameId": "manny_sword1h_normalatk_1_enchant",
   "icone": "common_Sword1H_normalAttack.webp",
   "nomFr": "Danse de l'épée",
   "recharge": null,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]120%[-] de l'attaque, puis octroie [#0F5CD8]Givre[-] pendant [#1A7331]20s[-].\n\n※ [#0F5CD8]Givre[-] : ajoute des attaques d'épée aux attaques normales qui infligent des dégâts égaux à [#1A7331]45%[-] de l'attaque. Lorsque des attaques normales font mouche [#1A7331]15 fois[-], permet l'utilisation de [#3C22D6]Compétence normale : Frappe de givre[-].\n\n[#3C22D6]Frappe de givre[-]\nImmunise contre les réactions pendant le lancement. Inflige des dégâts égaux à [#1A7331]350%[-] de l'attaque aux ennemis.",
   "gameId": "manny_sword1h_skill_e",
   "icone": "Manny_Sword1h_NormalSkill.webp",
   "nomFr": "Éruption de givre",
   "recharge": 31.0,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]158%[-] de l'attaque.",
   "gameId": "manny_sword1h_skill_rmb",
   "icone": "Manny_Sword1h_ActiveThird.webp",
   "nomFr": "Lame de givre tournoyante",
   "recharge": 11.0,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]104%[-] de l'attaque.",
   "gameId": "manny_sword1h_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Lame de givre",
   "recharge": null,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Crée une zone pendant [#1A7331]10s[-] qui augmente les dégâts de Froid du héros de [#1A7331]40%[-] et qui inflige des dégâts égaux à [#1A7331]33%[-] de l'attaque aux ennemis toutes les [#1A7331]1s[-].",
   "gameId": "manny_sword1h_skill_q",
   "icone": "Manny_Sword1h_UltimateSkill.webp",
   "nomFr": "Barrière de la prêtresse",
   "recharge": 10.0,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Attaquer un ennemi sous l'effet de [#0F5CD8]Déluge de Froid[-] augmente les chances crit. de [#1A7331]18%[-] et les dégâts crit. de [#1A7331]45%[-].",
   "gameId": "manny_sword1h_passive",
   "icone": "Manny_Sword1h_Passive.webp",
   "nomFr": "Prêtresse à l'épée",
   "recharge": 0.0,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]71%[-] de l'attaque. [#1A7331]25%[-] de chances d'infliger [#0F5CD8]Gelure[-] pendant [#1A7331]20s[-].\n1er coup : 11%\n2e coup : 11%\n3e coup : 18%\n4e coup : 31%\n\n※ [#0F5CD8]Gelure[-] : réduit la défense crit. de [#1A7331]2%[-] (max : [#1A7331]10 fois[-]) et inflige des dégâts de Froid égaux à [#1A7331]20%[-] de l'attaque sous forme de coup critique toutes les [#1A7331]1s[-] lorsque les cumuls sont au maximum.",
   "gameId": "manny_sworddual_jumpatk",
   "icone": "common_SwordDual_normalAttack.webp",
   "nomFr": "Lames volantes",
   "recharge": null,
   "weaponType": "SwordDual"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]113%[-] de l'attaque. Chaque coup porté inflige [#0F5CD8]Gelure[-] pendant [#1A7331]20s[-].\nAugmente les dégâts infligés de [#1A7331]10%[-] pour chaque tranche de [#1A7331]1 cumul(s)[-] lorsque l'ennemi est affecté par [#0F5CD8]Gelure[-].\n\n※ [#0F5CD8]Gelure[-] : réduit la défense crit. de [#1A7331]2%[-] (Max : [#1A7331]10 fois[-]). Inflige des dégâts de Froid égaux à [#1A7331]20%[-] de l'attaque sous forme de coup critique toutes les [#1A7331]1s[-] lorsque les cumuls sont au maximum.",
   "gameId": "manny_sworddual_skill_e",
   "icone": "Manny_SwordDual_NormalSkill.webp",
   "nomFr": "Rupture d'âme gelée",
   "recharge": 26.0,
   "weaponType": "SwordDual"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]73%[-] de l'attaque. Réduit la résistance au Froid de [#1A7331]15%[-] pendant [#1A7331]40s[-]. (Max : [#1A7331]2 fois[-])",
   "gameId": "manny_sworddual_skill_rmb",
   "icone": "Manny_SwordDual_ActiveThird.webp",
   "nomFr": "Ruée du pic de givre",
   "recharge": 13.0,
   "weaponType": "SwordDual"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]61%[-] de l'attaque.",
   "gameId": "manny_sworddual_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Neige blanche",
   "recharge": null,
   "weaponType": "SwordDual"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]225%[-] de l'attaque. Chaque coup porté inflige [#0F5CD8]Gelure[-] à l'ennemi pendant [#1A7331]20s[-], puis augmente l'attaque de Froid des alliés de [#1A7331]15%[-] pendant [#1A7331]40s[-].\n\n※ [#0F5CD8]Gelure[-] : réduit la défense crit. de [#1A7331]2%[-] (Max : [#1A7331]10 fois[-]) et inflige des dégâts de Froid égaux à [#1A7331]20%[-] sous forme de coup critique toutes les [#1A7331]1s[-] lorsque les cumuls sont au maximum.",
   "gameId": "manny_sworddual_skill_q",
   "icone": "Manny_SwordDual_UltimateSkill.webp",
   "nomFr": "Champ de neige du vide",
   "recharge": 10.0,
   "weaponType": "SwordDual"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Lorsqu'un héros allié attaque un ennemi avec le nombre maximal de cumuls de [#0F5CD8]Gelure[-], augmente ses dégâts de Froid de [#1A7331]35%[-].",
   "gameId": "manny_sworddual_passive",
   "icone": "Manny_SwordDual_Passive.webp",
   "nomFr": "Prêtresse du givre",
   "recharge": 0.0,
   "weaponType": "SwordDual"
  }
 ],
 "meliodas": [
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]164%[-] de l'attaque.\n1er coup : 24%\n2e coup : 27%\n3e coup : 42%\n4e coup : 71%",
   "gameId": "meliodas_axe_jumpatk",
   "icone": "common_Axe_normalAttack.webp",
   "nomFr": "Hache des Ténèbres",
   "recharge": null,
   "weaponType": "Axe"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Se téléporte derrière un ennemi affecté par [#0F5CD8]Énergie démoniaque[-] à [#1A7331]24 m[-] ou moins, et inflige des dégâts égaux à [#1A7331]184%[-] de l'attaque. Attaquer un ennemi affecté par [#0F5CD8]Énergie démoniaque[-] réinitialise le temps de recharge de la compétence normale du héros et retire l'effet [#0F5CD8]Énergie démoniaque[-] sur l'ennemi.",
   "gameId": "meliodas_axe_skill_e",
   "icone": "Meliodas_Axe_NormalSkill.webp",
   "nomFr": "Taillade circulaire",
   "recharge": 22.0,
   "weaponType": "Axe"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]140%[-] / [#1A7331]302%[-] de l'attaque en fonction du niveau de charge. Chaque projectile de Ténèbres inflige [#0F5CD8]Énergie démoniaque[-] pendant [#1A7331]10s[-].\n\n※ [#0F5CD8]Énergie démoniaque[-] : inflige des dégâts égaux à [#1A7331]120%[-] de l'attaque lorsque l'effet est retiré.",
   "gameId": "meliodas_axe_skill_rmb_ready",
   "icone": "Meliodas_Axe_ActiveThird.webp",
   "nomFr": "Pulvérisation des abysses",
   "recharge": 25.0,
   "weaponType": "Axe"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]134%[-] de l'attaque, puis inflige [#0F5CD8]Énergie démoniaque[-].\n\n※ [#0F5CD8]Énergie démoniaque[-] : inflige des dégâts égaux à [#1A7331]120%[-] de l'attaque lorsque l'effet est retiré.",
   "gameId": "meliodas_axe_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Arc de puissance",
   "recharge": null,
   "weaponType": "Axe"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]407%[-] de l'attaque.\nRéinitialise le temps de recharge de toutes les compétences lorsque le héros possède [#1A7331]3[-] cumuls ou plus de [#0F5CD8]Libération infernale[-].",
   "gameId": "meliodas_axe_skill_q",
   "icone": "Meliodas_Axe_UltimateSkill.webp",
   "nomFr": "Esprit combatif de démon",
   "recharge": 10.0,
   "weaponType": "Axe"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Infliger [#0F5CD8]Énergie démoniaque[-] à un ennemi déjà affecté par [#0F5CD8]Énergie démoniaque[-] retire immédiatement l'effet d'[#0F5CD8]Énergie démoniaque[-] existant.\nOctroie [#0F5CD8]Libération infernale[-] pendant [#1A7331]10s[-] chaque fois que l'effet [#0F5CD8]Énergie démoniaque[-] est retiré de l'ennemi. (Max : [#1A7331]3 fois[-])\n\n※ [#0F5CD8]Énergie démoniaque[-] : inflige des dégâts égaux à [#1A7331]120%[-] de l'attaque lorsque l'effet est retiré.\n※ [#0F5CD8]Libération infernale[-] : augmente les dégâts des Ténèbres de [#1A7331]30%[-].",
   "gameId": "meliodas_axe_passive",
   "icone": "Meliodas_Axe_Passive.webp",
   "nomFr": "Maître des coups",
   "recharge": 0.0,
   "weaponType": "Axe"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]160%[-] de l'attaque.\n1er coup : 24%\n2e coup : 26%\n3e coup : 42%\n4e coup : 68%",
   "gameId": "meliodas_sword1h_jumpatk",
   "icone": "common_Sword1H_normalAttack.webp",
   "nomFr": "Taillade obscure",
   "recharge": null,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]286%[-] de l'attaque. Chaque coup porté sur un ennemi sous l'effet de [#0F5CD8]Déluge des Ténèbres[-] réduit le temps de recharge de [#1A7331]2s[-] pour chaque tranche de [#1A7331]1[-] cumul(s) de [#0F5CD8]Hâte[-].",
   "gameId": "meliodas_sword1h_skill_e",
   "icone": "Meliodas_Sword1H_NormalSkill.webp",
   "nomFr": "Attaque enchaînée",
   "recharge": 27.0,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Octroie [#0F5CD8]Hâte[-] pendant [#1A7331]7s[-] et inflige des dégâts égaux à [#1A7331]93%[-] de l'attaque.\nRéinitialise le temps de recharge en attaquant un ennemi sous l'effet de [#0F5CD8]Déluge des Ténèbres[-].\n\n※ [#0F5CD8]Hâte[-] : dégâts de Maître de la vitesse [#1A7331]+25%[-], attaque des Ténèbres [#1A7331]+15%[-] (Max : [#1A7331]2 fois[-])",
   "gameId": "meliodas_sword1h_skill_rmb",
   "icone": "Meliodas_Sword1H_ActiveThird.webp",
   "nomFr": "Ruée abyssale",
   "recharge": 17.0,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]133%[-] de l'attaque.",
   "gameId": "meliodas_sword1h_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Force ténébreuse",
   "recharge": null,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]449%[-] de l'attaque et augmente les dégâts infligés aux ennemis sous l'effet de [#0F5CD8]Déluge des Ténèbres[-] de [#1A7331]100%[-]. La dernière frappe retire le [#0F5CD8]Déluge des Ténèbres[-] de la cible.",
   "gameId": "meliodas_sword1h_skill_q",
   "icone": "Meliodas_Sword1H_UltimateSkill.webp",
   "nomFr": "Croix flamboyante",
   "recharge": 10.0,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Réduit la durée de [#0F5CD8]Déluge des Ténèbres[-] de [#1A7331]2s[-] et inflige des dégâts supplémentaires égaux à [#1A7331]200%[-] de l'attaque en touchant un ennemi sous l'effet de [#0F5CD8]Déluge des Ténèbres[-] avec la compétence normale.",
   "gameId": "meliodas_sword1h_passive",
   "icone": "Meliodas_Sword1h_Passive.webp",
   "nomFr": "Maître de la vitesse",
   "recharge": 0.0,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]162%[-] de l'attaque. Chaque coup réduit le temps de recharge de la compétence normale de [#1A7331]1s[-] lorsque l'effet [#0F5CD8]Pouvoir démoniaque[-] est actif sur le héros.\n1er coup : 24%\n2e coup : 26%\n3e coup : 43%\n4e coup : 69%",
   "gameId": "meliodas_sworddual_jumpatk",
   "icone": "common_SwordDual_normalAttack.webp",
   "nomFr": "Double taillade des Ténèbres",
   "recharge": null,
   "weaponType": "SwordDual"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]267%[-] de l'attaque. Inflige également des dégâts égaux à [#1A7331]200%[-] de l'attaque aux ennemis proches lors de la dernière frappe, et restaure les PV à hauteur de [#1A7331]90%[-] de l'attaque lorsque l'effet [#0F5CD8]Pouvoir démoniaque[-] est actif.",
   "gameId": "meliodas_sworddual_skill_e",
   "icone": "Meliodas_SwordDual_NormalSkill.webp",
   "nomFr": "Taillade brûlante",
   "recharge": 32.0,
   "weaponType": "SwordDual"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]160%[-] de l'attaque. Si [#0F5CD8]Pouvoir démoniaque[-] est actif, augmente la durée de [#0F5CD8]Déluge des Ténèbres[-] de [#1A7331]3s[-] par coup porté.",
   "gameId": "meliodas_sworddual_skill_rmb",
   "icone": "Meliodas_SwordDual_ActiveThird.webp",
   "nomFr": "Taillade rapide des Ténèbres",
   "recharge": 20.0,
   "weaponType": "SwordDual"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]132%[-] de l'attaque.",
   "gameId": "meliodas_sworddual_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Taillade en croix",
   "recharge": null,
   "weaponType": "SwordDual"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]411%[-] de l'attaque.\nChaque coup porté sur un ennemi affecté par [#0F5CD8]Flamme infernale[-] retire [#1A7331]1[-] cumul(s) de [#0F5CD8]Flamme infernale[-] et augmente les dégâts de [#1A7331]15%[-]. Lorsque la dernière frappe fait mouche, porte un coup critique si au moins [#1A7331]1[-] cumul(s) de [#0F5CD8]Flamme infernale[-] sont retirés.\nUtiliser une attaque combinée avec l'attaque ultime du héros en tant que base consomme tous les points de magie. [#1A7331]Chaque[-] point de magie consommé augmente les dégâts de l'attaque combinée de [#1A7331]30%[-] pendant [#1A7331]10s[-].",
   "gameId": "meliodas_sworddual_skill_q",
   "icone": "Meliodas_SwordDual_UltimateSkill.webp",
   "nomFr": "Taillade en croix - Enchaînement",
   "recharge": 10.0,
   "weaponType": "SwordDual"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Octroie [#0F5CD8]Pouvoir démoniaque[-] pendant [#1A7331]20s[-] après avoir réussi des attaques [#1A7331]5 fois[-] sur un ennemi sous l'effet de [#0F5CD8]Déluge des Ténèbres[-] sans que [#0F5CD8]Pouvoir démoniaque[-] ne soit actif.\n\n※ [#0F5CD8]Pouvoir démoniaque[-] : inflige des dégâts égaux à [#1A7331]20%[-] de l'attaque toutes les [#1A7331]0.5s[-] dans une zone autour du héros et inflige [#0F5CD8]Flamme infernale[-] pendant [#1A7331]10s[-]. Augmente les dégâts infligés par [#0F5CD8]Pouvoir démoniaque[-] de [#0F5CD8]100%[-] lorsque la cible a le nombre maximal de cumuls de [#0F5CD8]Flamme infernale[-].\n※ [#0F5CD8]Flamme infernale[-] : réduit la résistance crit. contre les attaques de Meliodas de [#1A7331]3%[-]. Réduit en outre la défense crit. de [#1A7331]50%[-] une fois le nombre maximal de cumuls atteint. (Max : [#1A7331]10 fois[-])",
   "gameId": "meliodas_sworddual_passive",
   "icone": "Meliodas_SwordDual_Passive.webp",
   "nomFr": "Maître de l'esprit",
   "recharge": 0.0,
   "weaponType": "SwordDual"
  }
 ],
 "merlin": [
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]150%[-] de l'attaque.\n1er coup : 21%\n2e coup : 25%\n3e coup : 39%\n4e coup : 65%",
   "gameId": "merlin_book_jumpatk",
   "icone": "common_Book_normalAttack.webp",
   "nomFr": "Gel spatial",
   "recharge": null,
   "weaponType": "Book"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]22%[-] de l'attaque toutes les [#1A7331]0.5s[-] aux ennemis à portée pendant [#1A7331]5s[-], et inflige des effets [#0F5CD8]Marque de Givre[-] pendant [#1A7331]10s[-].\nAttaquer un ennemi avec le nombre maximal de cumuls de [#0F5CD8]Marque de Givre[-] augmente l'attaque de Froid du héros à hauteur de [#1A7331]10%[-] de l'attaque pendant [#1A7331]20s[-].\n\n※ [#0F5CD8]Marque de Givre[-] : restaure la jauge de relève de l'utilisateur de [#1A7331]150[-] en subissant une attaque. (Temps de recharge : [#1A7331]3s[-]) En subissant une compétence de relève tandis que cet effet est au maximum, inflige des dégâts supplémentaires égaux à [#1A7331]300%[-] de l'attaque de Merlin, puis retire l'effet.",
   "gameId": "merlin_book_skill_e",
   "icone": "Merlin_Book_NormalSkill.webp",
   "nomFr": "Graine de givre",
   "recharge": 25.0,
   "weaponType": "Book"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]150%[-] de l'attaque.\n1er coup : 21%\n2e coup : 25%\n3e coup : 39%\n4e coup : 65%",
   "gameId": "merlin_book_normalatk_enchant_ready",
   "icone": "Merlin_Book_ActiveThird.webp",
   "nomFr": "Gel spatial",
   "recharge": null,
   "weaponType": "Book"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]50%[-] de l'attaque.\nRemplace l'attaque normale par [#3C22D6]Attaque spéciale : Percée glaciale[-] pendant [#1A7331]6s[-].\n\n[#3C22D6]Percée glaciale[-]\nInflige des dégâts égaux à [#1A7331]6%[-] de l'attaque jusqu'à [#1A7331]312%[-], tant que la posture est maintenue. Attaquer le même ennemi [#1A7331]15 fois[-] lui inflige [#0F5CD8]Gel[-] pendant [#1A7331]6s[-]. Attaquer un ennemi affecté par [#0F5CD8]Marque de Givre[-] [#1A7331]8 fois[-] inflige [#1A7331]1[-] effets [#0F5CD8]Marque de Givre[-] supplémentaires pendant [#1A7331]10s[-]. (Max : [#1A7331]4 fois[-])\n\n※ [#0F5CD8]Gel[-] : immobilisation. En subissant une compétence, inflige [#1A7331]80%[-] des dégâts subis et retire Gel.\n※ [#0F5CD8]Marque de Givre[-] : restaure la jauge de relève de l'utilisateur de [#1A7331]150[-] en subissant une attaque. (Temps de recharge : [#1A7331]3s[-]) En subissant une compétence de relève tandis que cet effet est au maximum, inflige des dégâts supplémentaires égaux à [#1A7331]300%[-] de l'attaque de Merlin, puis retire l'effet.",
   "gameId": "merlin_book_skill_q",
   "icone": "Merlin_Book_ActiveThird.webp",
   "nomFr": "Esprit glacial",
   "recharge": 8.0,
   "weaponType": "Book"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]150%[-] de l'attaque.\nAugmente les dégâts de [#1A7331]30%[-] pour chaque tranche de [#1A7331]1[-] effets [#0F5CD8]Marque de Givre[-] présents sur l'ennemi.",
   "gameId": "merlin_book_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Balayage glacial",
   "recharge": null,
   "weaponType": "Book"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Augmente les dégâts crit. du héros de [#1A7331]50%[-] pendant [#1A7331]15s[-], puis inflige des dégâts égaux à [#1A7331]394%[-] de l'attaque.\nLors de l'utilisation d'une attaque combinée avec l'attaque ultime du héros en tant que base, chaque coup porté d'un élément autre que physique inflige des dégâts supplémentaires égaux à [#1A7331]10%[-] de l'attaque, augmente les dégâts crit. du héros de [#1A7331]50%[-] pendant [#1A7331]15s[-] et restaure [#1A7331]1[-] point(s) de relève.",
   "gameId": "merlin_book_skill_r",
   "icone": "Merlin_Book_UltimateSkill.webp",
   "nomFr": "Chute de glace",
   "recharge": 10.0,
   "weaponType": "Book"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Lorsque les héros alliés réussissent des attaques normales [#1A7331]3 fois[-] sur un ennemi sans [#0F5CD8]Marque de Givre[-], inflige [#0F5CD8]Marque de Givre[-] à l'ennemi en question pendant [#1A7331]10s[-]. (Max : [#1A7331]4 fois[-])\nLorsqu'un effet [#0F5CD8]Marque de Givre[-] est appliqué sur un ennemi qui n'en possède aucun, augmente l'attaque de Froid du héros de [#1A7331]40%[-] pendant [#1A7331]15s[-], et augmente les dégâts de [#1A7331]50%[-] en attaquant un ennemi affecté par [#0F5CD8]Marque de Givre[-].\n\n※ [#0F5CD8]Marque de Givre[-] : restaure la jauge de relève de l'utilisateur de [#1A7331]150[-] en subissant une attaque. (Temps de recharge : [#1A7331]3s[-]) En subissant une compétence de relève tandis que cet effet est au maximum, inflige des dégâts supplémentaires égaux à [#1A7331]300%[-] de l'attaque de Merlin, puis retire l'effet.",
   "gameId": "merlin_book_passive",
   "icone": "Merlin_Book_Passive.webp",
   "nomFr": "Givre infini",
   "recharge": 0.0,
   "weaponType": "Book"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]96%[-] de l'attaque.\n1er coup : 15%\n2e coup : 16%\n3e coup : 26%\n4e coup : 39%",
   "gameId": "merlin_staff_jumpatk",
   "icone": "common_Staff_normalAttack.webp",
   "nomFr": "Calcul de combustion",
   "recharge": null,
   "weaponType": "Staff"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Crée une zone qui traque les ennemis pendant [#1A7331]12s[-] afin d'infliger des dégâts égaux à [#1A7331]5%[-] de l'attaque toutes les [#1A7331]0.3s[-].\nChaque coup de l'attaque réduit la résistance au Feu de [#1A7331]1%[-] pendant [#1A7331]30s[-] (Max : [#1A7331]30 fois[-]) et augmente la jauge de Déluge de [#1A7331]1[-] + [#1A7331]0.1%[-] de l'attaque. (Max : [#1A7331]20[-])",
   "gameId": "merlin_staff_skill_e",
   "icone": "Merlin_Staff_NormalSkill.webp",
   "nomFr": "Poursuite pourpre",
   "recharge": 16.0,
   "weaponType": "Staff"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Crée un [#0F5CD8]Leurre[-] à l'emplacement du héros pendant [#1A7331]5 sec[-] qui [#0F5CD8]provoque[-] les ennemis à portée pendant [#1A7331]5s[-] et réduit la résistance au Déluge de Feu de l'ennemi de [#1A7331]20%[-] pendant [#1A7331]30s[-] toutes les [#1A7331]1s[-].\nLorsque le [#0F5CD8]Leurre[-] expire, il explose pour infliger des dégâts égaux à [#1A7331]100%[-] de l'attaque.",
   "gameId": "merlin_staff_skill_q",
   "icone": "Merlin_Staff_ActiveThird.webp",
   "nomFr": "Chaleur illusoire",
   "recharge": 9.0,
   "weaponType": "Staff"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]86%[-] de l'attaque.",
   "gameId": "merlin_staff_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Déploiement infini",
   "recharge": null,
   "weaponType": "Staff"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Le premier coup inflige des dégâts égaux à [#1A7331]196%[-] de l'attaque. Inflige des dégâts égaux à [#1A7331]8%[-] de l'attaque aux ennemis à portée toutes les [#1A7331]1s[-] pendant [#1A7331]10s[-].\nFace aux ennemis sous l'effet d'un [#0F5CD8]Déluge de Feu[-], cette attaque augmente leurs dégâts de faiblesse au Feu de [#1A7331]10%[-] pour la durée du [#0F5CD8]Déluge de Feu[-].\nUtiliser une attaque combinée avec l'attaque ultime du héros en tant que base restaure la jauge de magie de [#1A7331]100[-] toutes les [#1A7331]1s[-] pendant [#1A7331]10s[-]. Chaque coup porté d'un élément autre que physique inflige des dégâts supplémentaires égaux à [#1A7331]10%[-] de l'attaque.",
   "gameId": "merlin_staff_skill_r",
   "icone": "Merlin_Staff_UltimateSkill.webp",
   "nomFr": "Effondrement céleste",
   "recharge": 10.0,
   "weaponType": "Staff"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Lorsque le héros déclenche un [#0F5CD8]Déluge de Feu[-], remplace l'attaque spéciale et la compétence normale par l'attaque ultime, qui ne consomme pas de points de magie pendant [#1A7331]10s[-]. (Temps de recharge : [#1A7331]10s[-])\nL'attaque ultime ne peut être utilisée [#1A7331]qu'une seule fois[-], ne déclenche pas d'attaques combinées et inflige [#1A7331]100%[-] de dégâts augmentés face aux ennemis [#0F5CD8]sous l'effet d'un Déluge de Feu[-].",
   "gameId": "merlin_staff_passive",
   "icone": "Merlin_Staff_Passive.webp",
   "nomFr": "Noyau ardent",
   "recharge": 0.0,
   "weaponType": "Staff"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]154%[-] de l'attaque. Chaque coup porté sur un ennemi sous l'effet de [#0F5CD8]Déluge de Foudre[-] réduit le temps de recharge de la compétence normale de [#1A7331]1s[-].\n1er coup : 23%\n2e coup : 25%\n3e coup : 39%\n4e coup : 67%",
   "gameId": "merlin_wand_jumpatk",
   "icone": "common_Wand_normalAttack.webp",
   "nomFr": "Flux électrique",
   "recharge": null,
   "weaponType": "Wand"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]159%[-] de l'attaque.\nUtiliser cette attaque [#1A7331]2 fois[-] en [#1A7331]7s[-] permet l'utilisation de [#3C22D6]Compétence normale : Jugement divin[-] pendant [#1A7331]5s[-].\n\n[#3C22D6]Jugement divin[-]\nInflige des dégâts égaux à [#1A7331]329%[-] de l'attaque. La dernière frappe réduit le temps de recharge de [#1A7331]5[-].",
   "gameId": "merlin_wand_skill_e_enchant",
   "icone": "Merlin_Wand_NormalSkill.webp",
   "nomFr": "Jugement foudroyant",
   "recharge": null,
   "weaponType": "Wand"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Immunise contre les réactions pendant le lancement de la compétence, et inflige des dégâts égaux à [#1A7331]16%[-] de l'attaque aux ennemis à portée toutes les [#1A7331]0.5s[-] pendant [#1A7331]5s[-].\nChaque coup de cette attaque réduit le temps de recharge de la compétence normale du héros de [#1A7331]1s[-] et augmente les dégâts de compétence normale de [#1A7331]10%[-] pendant [#1A7331]20s[-]. (Max : [#1A7331]5 fois[-])",
   "gameId": "merlin_wand_skill_q",
   "icone": "Merlin_Wand_ActiveThird.webp",
   "nomFr": "Champ électromagnétique",
   "recharge": 16.0,
   "weaponType": "Wand"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]124%[-] de l'attaque.",
   "gameId": "merlin_wand_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Faisceau électrique",
   "recharge": null,
   "weaponType": "Wand"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]406%[-] de l'attaque.\nUtiliser une attaque combinée avec l'attaque ultime du héros en tant que base augmente toutes les attaques élémentaires du héros de [#1A7331]20%[-] de l'attaque (Max : [#1A7331]5000[-]) pendant [#1A7331]10s[-]. Chaque coup porté d'un élément autre que physique inflige des dégâts supplémentaires égaux à [#1A7331]10%[-] de l'attaque.",
   "gameId": "merlin_wand_skill_r",
   "icone": "Merlin_Wand_UltimateSkill.webp",
   "nomFr": "Dôme de plasma : Surcharge",
   "recharge": 10.0,
   "weaponType": "Wand"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Utiliser une attaque combinée avec l'attaque ultime du héros en tant que base octroie [#0F5CD8]Surcharge[-] pendant [#1A7331]25s[-].\nTant que [#0F5CD8]Surcharge[-] est actif, [#3C22D6]Compétence normale : Jugement foudroyant[-] inflige [#0F5CD8]Vulnérable[-] à l'ennemi pendant [#1A7331]10s[-].\n\n※[#0F5CD8]Surcharge[-] : augmente les dégâts de Foudre de [#1A7331]50%[-].\n※[#0F5CD8]Vulnérable[-] : augmente le percement de défense de l'attaque de l'utilisateur [#1A7331]30%[-].",
   "gameId": "merlin_wand_passive",
   "icone": "Merlin_Wand_Passive.webp",
   "nomFr": "Court-circuit",
   "recharge": 0.0,
   "weaponType": "Wand"
  }
 ],
 "slader": [
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]51%[-] de l'attaque.\n1er coup : 12%\n2e coup : 15%\n3e coup : 24%",
   "gameId": "slader_axe_jumpatk",
   "icone": "common_Axe_normalAttack.webp",
   "nomFr": "Coup de hache",
   "recharge": null,
   "weaponType": "Axe"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]121%[-] de l'attaque et octroie [#0F5CD8]Saignement amélioré[-] au héros pendant [#1A7331]20s[-].\n\n※ [#0F5CD8]Saignement amélioré[-] : augmente les dégâts de [#0F5CD8]Saignement[-] infligés par le héros de [#1A7331]20%[-].",
   "gameId": "slader_axe_skill_e",
   "icone": "Slader_Axe_NormalSkill.webp",
   "nomFr": "Charge de hache",
   "recharge": 12.0,
   "weaponType": "Axe"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]64%[-] / [#1A7331]110%[-] de l'attaque en fonction du niveau de charge et inflige [#0F5CD8]Saignement[-] pendant [#1A7331]20s[-].\nUne attaque complètement chargée réduit la résistance crit. de l'ennemi de [#1A7331]20%[-] pendant [#1A7331]30s[-].\n\n※ [#0F5CD8]Saignement[-] : inflige des dégâts de Vent égaux à [#1A7331]10%[-] des dégâts infligés toutes les [#1A7331]1s[-]. Réduit l'efficacité de guérison de [#1A7331]20%[-]. Réduit en outre l'efficacité de guérison de [#1A7331]6%[-] après avoir réussi un coup critique. (Max : [#1A7331]10 fois[-])",
   "gameId": "slader_axe_skill_rmb_ready",
   "icone": "Slader_Axe_ActiveThird.webp",
   "nomFr": "Frappe chargée",
   "recharge": 9.0,
   "weaponType": "Axe"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]63%[-] de l'attaque.",
   "gameId": "slader_axe_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Taillade de hache",
   "recharge": null,
   "weaponType": "Axe"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]190%[-] de l'attaque.\nLa dernière frappe porte un coup critique et inflige [#0F5CD8]Blessure profonde[-] pendant [#1A7331]15s[-] si l'ennemi souffre de [#0F5CD8]Saignement[-].\n\n※ [#0F5CD8]Blessure profonde[-] : augmente les dégâts subis de [#1A7331]25%[-].",
   "gameId": "slader_axe_skill_q",
   "icone": "Slader_Axe_UltimateSKill.webp",
   "nomFr": "Arc sanglant",
   "recharge": 10.0,
   "weaponType": "Axe"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Lorsqu'un héros allié attaque un ennemi qui souffre de [#0F5CD8]Saignement[-], ses dégâts crit. augmentent de [#1A7331]30%[-].",
   "gameId": "slader_axe_passive",
   "icone": "Slader_Axe_Passive.webp",
   "nomFr": "Tache de sang",
   "recharge": 0.0,
   "weaponType": "Axe"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]102%[-] de l'attaque.\n1er coup : 15%\n2e coup : 16%\n3e coup : 26%\n4e coup : 45%",
   "gameId": "slader_cudgel3c_jumpatk",
   "icone": "common_Cudgel3c_normalAttack.webp",
   "nomFr": "Triple coup",
   "recharge": null,
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]171%[-] de l'attaque. Augmente en outre la jauge de Déluge de [#1A7331]30[-] chaque fois qu'un ennemi [#0F5CD8]étourdi[-] est touché.",
   "gameId": "slader_cudgel3c_skill_e",
   "icone": "Slader_Cudgel3c_NormalSkill.webp",
   "nomFr": "Chaîne perforante",
   "recharge": 16.0,
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]93%[-] de l'attaque et inflige [#0F5CD8]Étourdissement[-] pendant [#1A7331]5s[-].",
   "gameId": "slader_cudgel3c_skill_rmb",
   "icone": "Slader_Cudgel3c_ActiveThird.webp",
   "nomFr": "Perforation en chaîne",
   "recharge": 10.0,
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]86%[-] de l'attaque. Augmente la jauge de Déluge de [#1A7331]100[-] en attaquant un ennemi [#0F5CD8]étourdi[-].",
   "gameId": "slader_cudgel3c_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Onde tranchante",
   "recharge": null,
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Augmente les dégâts de compétence de relève de tous les héros alliés de [#1A7331]40%[-] pendant [#1A7331]30s[-], puis inflige des dégâts égaux à [#1A7331]252%[-] de l'attaque.",
   "gameId": "slader_cudgel3c_skill_q",
   "icone": "Slader_Cudgel3c_UltimateSKill.webp",
   "nomFr": "Fureur de fer",
   "recharge": 10.0,
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Restaure [#1A7331]2[-] point(s) de relève lorsque le héros active un [#0F5CD8]Déluge[-].",
   "gameId": "slader_cudgel3c_passive",
   "icone": "Slader_Cudgel3c_Passive.webp",
   "nomFr": "Masque rugissant",
   "recharge": 0.0,
   "weaponType": "Cudgel3c"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]143%[-] de l'attaque.\n1er coup : 21%\n2e coup : 23%\n3e coup : 36%\n4e coup : 63%",
   "gameId": "slader_sword2h_jumpatk",
   "icone": "common_Sword2H_normalAttack.webp",
   "nomFr": "Épée géante",
   "recharge": null,
   "weaponType": "Sword2h"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]278%[-] de l'attaque. Augmente les dégâts infligés aux ennemis [#0F5CD8]Étourdis[-] de [#1A7331]20%[-].",
   "gameId": "slader_sword2h_skill_e",
   "icone": "Slader_Sword2h_NormalSkill.webp",
   "nomFr": "Chute de puissance",
   "recharge": 12.0,
   "weaponType": "Sword2h"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]186%[-] de l'attaque.",
   "gameId": "slader_sword2h_skill_rmb_1",
   "icone": "Slader_Sword2h_ActiveThird.webp",
   "nomFr": "Frappe finale",
   "recharge": 7.0,
   "weaponType": "Sword2h"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]118%[-] de l'attaque.",
   "gameId": "slader_sword2h_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Frappe",
   "recharge": null,
   "weaponType": "Sword2h"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]416%[-] de l'attaque. Si l'ennemi est sous l'effet de [#0F5CD8]Déluge de Feu[-], il est [#0F5CD8]Étourdi[-] pendant [#1A7331]5s[-].",
   "gameId": "slader_sword2h_skill_q",
   "icone": "Slader_Sword2h_UltimateSKill.webp",
   "nomFr": "Frappe de puissance",
   "recharge": 10.0,
   "weaponType": "Sword2h"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Attaquer un ennemi sous l'effet de [#0F5CD8]Déluge de Feu[-] augmente les dégâts de [#1A7331]15%[-] et améliore l'attaque spéciale pendant [#1A7331]10s[-] pour infliger des dégâts égaux à [#1A7331]242%[-] de l'attaque.",
   "gameId": "slader_sword2h_passive",
   "icone": "Slader_Sword2h_Passive.webp",
   "nomFr": "Flamme ardente",
   "recharge": 0.0,
   "weaponType": "Sword2h"
  }
 ],
 "tioreh": [
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]62%[-] de l'attaque.\n1er coup : 10%\n2e coup : 11%\n3e coup : 16%\n4e coup : 25%",
   "gameId": "tioreh_book_normalatk_1_enchant",
   "icone": "common_Book_normalAttack.webp",
   "nomFr": "Trait de feu",
   "recharge": null,
   "weaponType": "Book"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]350%[-] de l'attaque tant que la posture est maintenue. Réduit la résistance au Feu de l'ennemi de [#1A7331]15%[-] pendant [#1A7331]40s[-].\nRéutiliser la compétence retire la posture et inflige des dégâts égaux à [#1A7331]86%[-] de l'attaque.\nAugmente les dégâts infligés de [#1A7331]10%[-] tous les [#1A7331]5[-] coups si l'ennemi souffre de [#0F5CD8]Combustion[-]. (Max : [#1A7331]15 fois[-])",
   "gameId": "tioreh_book_skill_e",
   "icone": "Tioreh_Book_NormalSkill.webp",
   "nomFr": "Éjection ardente",
   "recharge": 20.0,
   "weaponType": "Book"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Améliore les attaques normales pendant [#1A7331]10s[-], infligeant des dégâts égaux à [#1A7331]233%[-] de l'attaque.\n1er coup : 34%\n2e coup : 37%\n3e coup : 61%\n4e coup : 101%\n\nInflige [#0F5CD8]Combustion[-] pendant [#1A7331]20s[-] avec chaque coup.\n\n※ [#0F5CD8]Combustion[-] : réduit l'attaque de [#1A7331]20%[-].",
   "gameId": "tioreh_book_skill_rmb",
   "icone": "Tioreh_Book_ActiveThird.webp",
   "nomFr": "Rayon du lion",
   "recharge": 15.0,
   "weaponType": "Book"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]65%[-] de l'attaque.",
   "gameId": "tioreh_book_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Frappe ardente",
   "recharge": null,
   "weaponType": "Book"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]180%[-] de l'attaque. Augmente les dégâts infligés aux ennemis affectés par [#0F5CD8]Combustion[-] de [#1A7331]20%[-].",
   "gameId": "tioreh_book_skill_q",
   "icone": "Tioreh_Book_UltimateSkill.webp",
   "nomFr": "Souffle de dragon",
   "recharge": 10.0,
   "weaponType": "Book"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Lorsqu'un héros allié attaque un ennemi dont la résistance au Feu est réduite, augmente ses chances crit. de [#1A7331]8%[-].",
   "gameId": "tioreh_book_passive",
   "icone": "Tioreh_Book_Passive.webp",
   "nomFr": "Bénédiction des esprits : dragon",
   "recharge": 0.0,
   "weaponType": "Book"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]74%[-] de l'attaque.\n1er coup : 11%\n2e coup : 12%\n3e coup : 20%\n4e coup : 31%",
   "gameId": "tioreh_staff_jumpatk",
   "icone": "common_Staff_normalAttack.webp",
   "nomFr": "Étoile filante",
   "recharge": null,
   "weaponType": "Staff"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]138%[-] de l'attaque et crée [#1A7331]5[-] unité(s) de Laine dans les environs.\nAugmente la jauge de Déluge des ennemis qui marchent sur de la Laine de [#1A7331]100[-] et inflige des dégâts égaux à [#1A7331]20%[-] de la défense.",
   "gameId": "tioreh_staff_skill_e",
   "icone": "Tioreh_Staff_NormalSkill.webp",
   "nomFr": "Invocation : mouton",
   "recharge": 25.0,
   "weaponType": "Staff"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Pendant [#1A7331]5s[-] toutes les [#1A7331]1s[-], augmente les dégâts de Terre des alliés à portée de [#1A7331]3%[-] pendant [#1A7331]40s[-]. (Max : [#1A7331]5 fois[-])",
   "gameId": "tioreh_staff_skill_rmb",
   "icone": "Tioreh_Staff_ActiveThird.webp",
   "nomFr": "Éclosion céleste",
   "recharge": 10.0,
   "weaponType": "Staff"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]62%[-] de l'attaque.",
   "gameId": "tioreh_staff_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Cercle terrestre",
   "recharge": null,
   "weaponType": "Staff"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]161%[-] de l'attaque. Attaquer un ennemi sous l'effet de Déluge de Terre inflige des dégâts supplémentaires égaux à [#1A7331]80%[-] de la défense.",
   "gameId": "tioreh_staff_skill_q",
   "icone": "Tioreh_Staff_UltimateSKill.webp",
   "nomFr": "Descente d'ours",
   "recharge": 10.0,
   "weaponType": "Staff"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Augmente la défense de tous les héros alliés de [#1A7331]25%[-] pendant [#1A7331]40s[-] lorsqu'un héros allié active un [#0F5CD8]Déluge de Terre[-].",
   "gameId": "tioreh_staff_passive",
   "icone": "Tioreh_Staff_Passive.webp",
   "nomFr": "Bénédiction des esprits : ours",
   "recharge": 0.0,
   "weaponType": "Staff"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]110%[-] de l'attaque.\n1er coup : 11%\n2e coup : 12%\n3e coup : 19%\n4e coup : 28%\n5e coup : 40%",
   "gameId": "tioreh_wand_jumpatk",
   "icone": "common_Wand_normalAttack.webp",
   "nomFr": "Flamme féérique",
   "recharge": null,
   "weaponType": "Wand"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Restaure les PV des alliés à portée de [#1A7331]0.35%[-] des PV max + [#1A7331]14%[-] de l'attaque toutes les [#1A7331]0.7s[-] pendant [#1A7331]10s[-].",
   "gameId": "tioreh_wand_skill_e",
   "icone": "Tioreh_Wand_NormalSkill.webp",
   "nomFr": "Renard de guérison",
   "recharge": 28.0,
   "weaponType": "Wand"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Toutes les [#1A7331]1s[-] où le héros maintient la posture, augmente la défense de tous les héros alliés de [#1A7331]5%[-] pendant [#1A7331]40s[-]. (Max : [#1A7331]3 fois[-])",
   "gameId": "tioreh_wand_skill_rmb_ready",
   "icone": "Tioreh_Wand_ActiveThird.webp",
   "nomFr": "Étreinte de l'ours",
   "recharge": 8.0,
   "weaponType": "Wand"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]72%[-] de l'attaque.",
   "gameId": "tioreh_wand_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Brume de feu",
   "recharge": null,
   "weaponType": "Wand"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]227%[-] de l'attaque et inflige [#0F5CD8]Inflammation[-] pendant [#1A7331]20s[-]. (Max : [#1A7331]5 fois[-])\n\n※ [#0F5CD8]Inflammation[-] : inflige des dégâts de Feu égaux à [#1A7331]3%[-] de l'attaque toutes les [#1A7331]1s[-]. Réduit la défense de [#1A7331]0.15%[-] à chaque fois que des dégâts d'[#0F5CD8]Inflammation[-] sont infligés. (Max : [#1A7331]100 fois[-])",
   "gameId": "tioreh_wand_skill_q",
   "icone": "Tioreh_Wand_UltimateSkill.webp",
   "nomFr": "Lion ardent",
   "recharge": 10.0,
   "weaponType": "Wand"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "L'utilisation de la compétence de relève restaure les PV de [#1A7331]15%[-] si les PV restants sont inférieurs ou égaux à [#1A7331]30%[-]. (Temps de recharge : [#1A7331]60s[-])",
   "gameId": "tioreh_wand_passive",
   "icone": "Tioreh_Wand_Passive.webp",
   "nomFr": "Bénédiction des esprits : renard",
   "recharge": 0.0,
   "weaponType": "Wand"
  }
 ],
 "tristan": [
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]106%[-] de l'attaque.\n1er coup : 16%\n2e coup : 17%\n3e coup : 27%\n4e coup : 46%",
   "gameId": "tristan_sword1h_jumpatk",
   "icone": "common_Sword1H_normalAttack.webp",
   "nomFr": "Épée de Vent",
   "recharge": null,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]173%[-] de l'attaque. Augmente également la jauge de Déluge de [#1A7331]200[-] si l'ennemi souffre de [#0F5CD8]Saignement[-].",
   "gameId": "tristan_sword1h_skill_e",
   "icone": "Tristan_Sword1H_NormalSkill.webp",
   "nomFr": "Vent perforant",
   "recharge": 17.0,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]103%[-] de l'attaque, puis inflige [#0F5CD8]Saignement[-] pendant [#1A7331]20s[-].\n\n※ [#0F5CD8]Saignement[-] : inflige des dégâts de Vent égaux à [#1A7331]10%[-] des dégâts infligés toutes les [#1A7331]1s[-]. Réduit l'efficacité de guérison de [#1A7331]20%[-]. Réduit en outre l'efficacité de guérison de [#1A7331]6%[-] après avoir réussi un coup critique. (Max : [#1A7331]10 fois[-])",
   "gameId": "tristan_sword1h_skill_rmb",
   "icone": "Tristan_Sword1H_ActiveThird.webp",
   "nomFr": "Épée de tempête",
   "recharge": 9.0,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]88%[-] de l'attaque.",
   "gameId": "tristan_sword1h_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Frappe venteuse",
   "recharge": null,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Augmente l'efficacité de Déluge de Vent du héros de [#1A7331]30%[-] pendant [#1A7331]20s[-], puis inflige des dégâts égaux à [#1A7331]263%[-] de l'attaque.",
   "gameId": "tristan_sword1h_skill_q",
   "icone": "Tristan_Sword1H_UltimateSKill.webp",
   "nomFr": "Tempête de lames",
   "recharge": 10.0,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Lorsque le héros active un [#0F5CD8]Déluge de Vent[-], augmente les dégâts de Vent de tous les héros alliés [#1A7331]15%[-] pendant [#1A7331]30s[-].",
   "gameId": "tristan_sword1h_passive",
   "icone": "Tristan_Sword1h_Passive.webp",
   "nomFr": "Esprit aiguisé",
   "recharge": 0.0,
   "weaponType": "Sword1h"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]162%[-] de l'attaque.\n1er coup : 24%\n2e coup : 26%\n3e coup : 42%\n4e coup : 70%",
   "gameId": "tristan_sword2h_jumpatk",
   "icone": "common_Sword2H_normalAttack.webp",
   "nomFr": "Épée de flamme",
   "recharge": null,
   "weaponType": "Sword2h"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]275%[-] de l’attaque, puis supprime [#0F5CD8]Braise[-] du héros.",
   "gameId": "tristan_sword2h_skill_e",
   "icone": "Tristan_Sword2H_NormalSkill.webp",
   "nomFr": "Punisseur",
   "recharge": 12.0,
   "weaponType": "Sword2h"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]8%[-] de l'attaque aux ennemis proches tant que la posture est maintenue, et inflige des dégâts égaux à [#1A7331]81%[-] de l'attaque avec la dernière frappe.\n[#1A7331]50%[-] de chances de gagner [#1A7331]1[-] cumul(s) de [#0F5CD8]Braise[-] pendant [#1A7331]10s[-] avec chaque coup. (Max : [#1A7331]10 fois[-])\n\n※ [#0F5CD8]Braise[-] : augmente les dégâts de compétence normale de [#1A7331]2%[-] et les dégâts d'attaque ultime de [#1A7331]3%[-].",
   "gameId": "tristan_sword2h_skill_rmb_ready",
   "icone": "Tristan_Sword2H_ActiveThird.webp",
   "nomFr": "Taillade de Feu infinie",
   "recharge": 8.0,
   "weaponType": "Sword2h"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]137%[-] de l'attaque.",
   "gameId": "tristan_sword2h_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Attaque-surprise",
   "recharge": null,
   "weaponType": "Sword2h"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]405%[-] / [#1A7331]435%[-] / [#1A7331]467%[-] de l'attaque en fonction du niveau de charge, puis supprime [#0F5CD8]Braise[-] du héros.",
   "gameId": "tristan_sword2h_skill_q_ready",
   "icone": "Tristan_Sword2H_UltimateSKill.webp",
   "nomFr": "Entaille d'amputation",
   "recharge": 10.0,
   "weaponType": "Sword2h"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Chaque fois que l'attaque spéciale fait mouche, augmente les chances crit. du héros de [#1A7331]1%[-] pendant [#1A7331]10s[-]. (Max : [#1A7331]20 fois[-])",
   "gameId": "tristan_sword2h_passive",
   "icone": "Tristan_Sword2H_Passive.webp",
   "nomFr": "Sens de la justice",
   "recharge": 0.0,
   "weaponType": "Sword2h"
  },
  {
   "categorie": "NORMAL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]111%[-] de l'attaque.\n1er coup : 18%\n2e coup : 19%\n3e coup : 29%\n4e coup : 45%",
   "gameId": "tristan_sworddual_jumpatk",
   "icone": "common_SwordDual_normalAttack.webp",
   "nomFr": "Double taillade enflammée",
   "recharge": null,
   "weaponType": "SwordDual"
  },
  {
   "categorie": "NORMAL_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]200%[-] de l'attaque. Si la résistance au Feu de l'ennemi est réduite, augmente la jauge de Déluge de [#1A7331]200[-].",
   "gameId": "tristan_sworddual_skill_e",
   "icone": "Tristan_SwordDual_NormalSkill.webp",
   "nomFr": "Taillade verticale",
   "recharge": 16.0,
   "weaponType": "SwordDual"
  },
  {
   "categorie": "ACTIVE_THIRD",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]91%[-] de l'attaque. Réduit la résistance au Feu de l'ennemi de [#1A7331]10%[-] pendant [#1A7331]30s[-].",
   "gameId": "tristan_sworddual_skill_rmb",
   "icone": "Tristan_SwordDual_ActiveThird.webp",
   "nomFr": "Double taillade infernale",
   "recharge": 7.0,
   "weaponType": "SwordDual"
  },
  {
   "categorie": "TAG_SKILL",
   "descriptionFr": "Inflige des dégâts égaux à [#1A7331]87%[-] de l'attaque.",
   "gameId": "tristan_sworddual_skill_tag",
   "icone": "Icon_TagSkill.webp",
   "nomFr": "Coup ardent",
   "recharge": null,
   "weaponType": "SwordDual"
  },
  {
   "categorie": "ULTIMATE",
   "descriptionFr": "Augmente l'efficacité de Déluge de Feu du héros de [#1A7331]30%[-] pendant [#1A7331]20s[-], puis inflige des dégâts égaux à [#1A7331]241%[-] de l'attaque.",
   "gameId": "tristan_sworddual_skill_q",
   "icone": "Tristan_SwordDual_UltimateSKill.webp",
   "nomFr": "Pluie de flammes",
   "recharge": 10.0,
   "weaponType": "SwordDual"
  },
  {
   "categorie": "PASSIVE",
   "descriptionFr": "Augmente les dégâts de Feu de tous les héros alliés de [#1A7331]5%[-] pendant [#1A7331]30s[-] lorsqu'un héros allié active un [#0F5CD8]Déluge de Feu[-]. (Max : [#1A7331]5 fois[-])",
   "gameId": "tristan_sworddual_passive",
   "icone": "Tristan_SwordDual_Passive.webp",
   "nomFr": "Esprit vigoureux",
   "recharge": 0.0,
   "weaponType": "SwordDual"
  }
 ]
};
