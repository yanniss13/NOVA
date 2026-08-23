# Potentiels : le site et le jeu ne disent pas la meme chose

Confrontation de `7ds-stats/personnages.json` au texte francais du client
(`Localization/Game/fr`, build `1.8.1.2`), sur les 341 paliers dont le jeu
publie une description. **301 concordent.** Les 31 ci-dessous non.

Le recouvrement est la part de mots communs entre les deux textes. A zero,
les deux phrases ne partagent aucun mot significatif : ce ne peut pas etre
une reformulation.

> Ces textes ne sont pas decoratifs : `data/effets-dps.js` en tire les regles
> du moteur de degats. La colonne « modelise » dit si le palier fait
> effectivement bouger un chiffre.

## Aucun mot commun — divergence de fond (9)

### Daisy / Wand p9

- **site** : Renforce la puissance de la compétence normale de 120%.
- **jeu** : Inflige des dégâts égaux à {1} de l'attaque aux ennemis à portée de l'attaque ultime toutes les {0} s.
- recouvrement 0 % — **modelise** (bonus-degats)
- cle : `local_skill_daisy_wand_potential_9_desc`

### Diane / Gauntlets p7

- **site** : La dernière frappe de l'attaque ultime inflige des dégâts supplémentaires égaux à 270% de l'attaque.
- **jeu** : Octroie Combativité au héros pendant {1} s lorsqu'il utilise la compétence de relève.
- recouvrement 0 % — **modelise** (degats-additionnels)
- cle : `local_skill_diane_gauntlets_potential_7_desc`

### Dreydrin / Axe p9

- **site** : Renforce la puissance de la compétence normale de 50%.
- **jeu** : Porte la défense obtenue grâce à l'attaque ultime à {0}.
- recouvrement 0 % — **modelise** (bonus-degats)
- cle : `local_skill_dreydrin_axe_potential_9_desc`

### Gilthunder / Lance p9

- **site** : Renforce la puissance de l'attaque ultime de 30%.
- **jeu** : Porte l'augmentation de la jauge de Déluge obtenue en réussissant des attaques ultimes à {0}.
- recouvrement 0 % — **modelise** (bonus-degats)
- cle : `local_skill_gilthunder_lance_potential_9_desc`

### Gilthunder / Shield p4

- **site** : Renforce la puissance de la compétence normale de 20%.
- **jeu** : Porte la défense obtenue grâce à l'attaque spéciale à {0}.
- recouvrement 0 % — **modelise** (bonus-degats)
- cle : `local_skill_gilthunder_shield_potential_4_desc`

### Mannie / Sword1h p2

- **site** : Renforce la puissance de l'attaque normale de 20%.
- **jeu** : Augmente la durée de Givre de {0} s.
- recouvrement 0 % — **modelise** (bonus-degats)
- cle : `local_skill_manny_sword1h_potential_2_desc`

### Mannie / SwordDual p4

- **site** : Renforce la puissance de l'attaque spéciale de 35%.
- **jeu** : Porte la réduction de résistance crit. issue du passif à {0}.
- recouvrement 0 % — **modelise** (bonus-degats)
- cle : `local_skill_manny_sworddual_potential_4_desc`

### Slader / Axe p3

- **site** : Augmente l'attaque de 6%, la défense de 5% et les PV max de 2%.
- **jeu** : Réduit le délai de déclenchement de Saignement infligé par le héros de {0} s.
- recouvrement 0 % — non modelise
- cle : `local_skill_slader_axe_potential_3_desc`

### Slader / Axe p6

- **site** : Renforce la puissance de la compétence normale de 30%.
- **jeu** : Augmente les dégâts infligés avec l'attaque spéciale aux ennemis souffrant de Saignement de {0}.
- recouvrement 0 % — **modelise** (bonus-degats)
- cle : `local_skill_slader_axe_potential_6_desc`

## Recouvrement partiel — a trancher a la main (22)

### Slader / Axe p5

- **site** : La dernière frappe de la compétence normale inflige des dégâts supplémentaires égaux à 55% de l'attaque.
- **jeu** : Augmente les dégâts du dernier coup des compétences normales de {0} lorsque des ennemis affectés par Saignement sont pris pour cible.
- recouvrement 5 % — **modelise** (degats-additionnels)
- cle : `local_skill_slader_axe_potential_5_desc`

### Griamor / Gauntlets p5

- **site** : Change une attaque spéciale en compétence qui peut être utilisée 2 fois.
- **jeu** : Crée une zone de la portée de l'attaque ultime qui inflige des dégâts égaux à {2} de l'attaque toutes les {1} s pendant {0} s.
- recouvrement 6 % — **modelise** (deblocage-competence)
- cle : `local_skill_griamore_gauntlets_potential_5_desc`

### Bug / SwordDual p5

- **site** : Change une attaque spéciale en compétence qui peut être utilisée 2 fois.
- **jeu** : Réinitialise le temps de recharge de l'attaque spéciale lorsque l'attaque normale fait mouche sur un ennemi sous l'effet de Déluge des Ténèbres.
- recouvrement 10 % — **modelise** (deblocage-competence)
- cle : `local_skill_bug_sworddual_potential_5_desc`

### Mannie / SwordDual p2

- **site** : Renforce la puissance de l'attaque normale de 20%.
- **jeu** : Augmente le boost de durée de Déluge issu de l'attaque spéciale de {0} s.
- recouvrement 10 % — **modelise** (bonus-degats)
- cle : `local_skill_manny_sworddual_potential_2_desc`

### Guila / Rapier p2

- **site** : Renforce la puissance de l'attaque normale de 20%, ou de 25% en [Forme démoniaque].
- **jeu** : [État de base] Augmente les dégâts infligés avec les attaques normales de {0}. 1er coup : {1} 2e coup : {2} 3e coup : {3} 4e coup : {4} [Forme démoniaque] Augmente les dégâts infligés avec les attaques normales de {5}. 1er coup : {6} 2e coup : {7} 3e coup : {8} 4e coup : {9}
- recouvrement 13 % — **modelise** (bonus-degats)
- cle : `local_skill_guila_rapier_potential_2_desc`

### Slader / Axe p8

- **site** : Augmente l'attaque de 9%, la défense de 7% et les PV max de 3%.
- **jeu** : Augmente les dégâts de Saignement infligés par le héros de {0}.
- recouvrement 14 % — non modelise
- cle : `local_skill_slader_axe_potential_8_desc`

### Meliodas / Axe p9

- **site** : Renforce la puissance de la compétence normale de 70%.
- **jeu** : Le boost de dégâts de compétence normale de Maître de la vitesse s'applique à toutes les attaques.
- recouvrement 18 % — **modelise** (bonus-degats)
- cle : `local_skill_meliodas_axe_potential_9_desc`

### Bug / Axe p4

- **site** : Renforce la puissance de l'attaque spéciale de 35%.
- **jeu** : Porte les dégâts d'attaque spéciale à {0} / {1} / {2} en fonction du niveau de charge.
- recouvrement 22 % — **modelise** (bonus-degats)
- cle : `local_skill_bug_axe_potential_4_desc`

### Gilthunder / Lance p6

- **site** : Renforce la puissance de la compétence normale de 30%.
- **jeu** : Porte l'efficacité de Déluge obtenue grâce à la compétence normale à {0}.
- recouvrement 22 % — **modelise** (bonus-degats)
- cle : `local_skill_gilthunder_lance_potential_6_desc`

### Hauser / Lance p9

- **site** : Renforce la puissance de l'attaque ultime de 30%.
- **jeu** : Porte les dégâts de la zone extérieure de l’attaque ultime à {0} et les dégâts de sa zone centrale à {1}.
- recouvrement 22 % — **modelise** (bonus-degats)
- cle : `local_skill_howzer_lance_potential_9_desc`

### Drake / Sword1h p6

- **site** : Renforce la puissance de la compétence normale de 30%.
- **jeu** : Augmente les dégâts infligés avec la compétence normale de {0}.
- recouvrement 25 % — **modelise** (bonus-degats)
- cle : `local_skill_drake_sword1h_potential_6_desc`

### Drake / Sword2h p4

- **site** : Renforce la puissance de l'attaque spéciale de 35%.
- **jeu** : Porte les dégâts d'attaque spéciale à {0} et les dégâts des attaques supplémentaires à {1}.
- recouvrement 25 % — **modelise** (bonus-degats)
- cle : `local_skill_drake_sword2h_potential_4_desc`

### Drake / Sword2h p6

- **site** : Renforce la puissance de la compétence normale de 70%.
- **jeu** : Porte les dégâts de compétence normale à {0} et les dégâts des attaques supplémentaires à {1}.
- recouvrement 25 % — **modelise** (bonus-degats)
- cle : `local_skill_drake_sword2h_potential_6_desc`

### Griamor / Shield p6

- **site** : Renforce la puissance de la compétence normale de 30%.
- **jeu** : Porte la durée de la Provocation issue de la compétence normale à {0} s.
- recouvrement 25 % — **modelise** (bonus-degats)
- cle : `local_skill_griamore_shield_potential_6_desc`

### Hauser / Cudgel3c p6

- **site** : Renforce la puissance de la compétence normale de 30%.
- **jeu** : Augmente les dégâts infligés avec la compétence normale de {0}.
- recouvrement 25 % — **modelise** (bonus-degats)
- cle : `local_skill_howzer_cudgel3c_potential_6_desc`

### Hauser / Cudgel3c p9

- **site** : Renforce la puissance de l'attaque ultime de 30%.
- **jeu** : Augmente les dégâts infligés avec l'attaque ultime de {0}.
- recouvrement 25 % — **modelise** (bonus-degats)
- cle : `local_skill_howzer_cudgel3c_potential_9_desc`

### Hauser / Gauntlets p6

- **site** : Renforce la puissance de la compétence normale de 30%.
- **jeu** : Augmente les dégâts infligés avec la compétence normale de {0}.
- recouvrement 25 % — **modelise** (bonus-degats)
- cle : `local_skill_howzer_gauntlets_potential_6_desc`

### Hauser / Gauntlets p9

- **site** : Renforce la puissance de l'attaque ultime de 30%.
- **jeu** : Augmente les dégâts infligés avec l'attaque ultime de {0}.
- recouvrement 25 % — **modelise** (bonus-degats)
- cle : `local_skill_howzer_gauntlets_potential_9_desc`

### Slader / Axe p9

- **site** : Renforce la puissance de l'attaque spéciale de 70% / 90%.
- **jeu** : Augmente les dégâts infligés avec l'attaque spéciale de {0} / {1}.
- recouvrement 25 % — **modelise** (bonus-degats)
- cle : `local_skill_slader_axe_potential_9_desc`

### Bug / SwordDual p10

- **site** : La dernière frappe de l'attaque spéciale inflige des dégâts supplémentaires égaux à 100% de l'attaque.
- **jeu** : Réussir l'attaque spéciale inflige Étourdissement pendant {0} s.
- recouvrement 27 % — **modelise** (degats-additionnels)
- cle : `local_skill_bug_sworddual_potential_10_desc`

### Guila / Rapier p4

- **site** : Renforce la puissance de l'attaque spéciale de 30%, ou de 40% en [Forme démoniaque].
- **jeu** : [État de base] Augmente les dégâts infligés avec l'attaque spéciale de {0}. [Forme démoniaque] Augmente les dégâts infligés avec l'attaque spéciale de {1}.
- recouvrement 33 % — **modelise** (bonus-degats)
- cle : `local_skill_guila_rapier_potential_4_desc`

### Guila / Rapier p9

- **site** : Renforce la puissance de la compétence normale de 50%, ou 60% en [Forme démoniaque].
- **jeu** : [État de base] Augmente les dégâts infligés avec la compétence normale de {0}. [Forme démoniaque] Augmente les dégâts infligés avec la compétence normale de {1}.
- recouvrement 33 % — **modelise** (bonus-degats)
- cle : `local_skill_guila_rapier_potential_9_desc`

