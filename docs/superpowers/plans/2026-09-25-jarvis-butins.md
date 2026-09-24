# /jarvis — butins (lot 2c, étape 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `ou_trouver` cite les butins ; un outil `butin` dit ce que lâche un monstre, un donjon, un point de minage ou le boss de confrérie.

**Architecture:** `construireCatalogueObjets` reçoit en plus les tables de butin et de sources ; il ajoute des sources aux objets et un tableau `butins`. Le module bot accepte les nouveaux types et ajoute l'outil `butin`.

**Tech Stack:** Node (CommonJS), Deno, Gemini palier gratuit.

**Spec:** `docs/superpowers/specs/2026-09-25-jarvis-butins-design.md`

## Global Constraints

- Aucun pourcentage de butin publié.
- `objets.json` reste en version 1 ; `butins` facultatif.
- Données du jeu jamais dans le dépôt ; `DONNEES_JEU` seulement.
- Pas de push sans accord du propriétaire.

## Review Focus

1. Un groupe de butin qui cite un paquet absent : ignoré, pas d'exception. → Task 1.
2. Un même objet lâché par deux versions d'un monstre : une seule source. → Task 1.
3. Un nom commun à un monstre et à un donjon (« Banakro ») : `butin` liste les deux au lieu d'en choisir un. → Task 2.
4. Taille de `objets.json` après ajout : doit rester sous 1 Mo. → Task 1, extraction réelle.
5. Un ancien `objets.json` sans `butins` : `butin` répond « introuvable » sans planter. → Task 2.

---

### Task 1: Extraction des butins

**Files:** Modify `outils/fabrication/objets-jarvis.js`, `outils/fabrication/extraire-objets.js` ; Test `tests/objets-jarvis.test.js`.

**Interfaces:** `entree` gagne `groupesButin`, `paquetsButin`, `monstres`, `minage`, `donjons`, `groupesDonjon`, `recompensesConfrerie`. La sortie gagne `butins` et des sources `{ type, origine, detail? }`.

- [ ] Step 1: étendre le mini-export et les assertions (sources et `butins`).
- [ ] Step 2: `node tests/objets-jarvis.test.js` — FAIL.
- [ ] Step 3: implémenter (`objetsDuGroupe`, sources par type, fusion par (nom, type, detail)).
- [ ] Step 4: test vert ; `node tests/discord-jarvis-objets.test.js` toujours vert.
- [ ] Step 5: enveloppe : lire les nouvelles tables ; extraction réelle, taille < 1 Mo.
- [ ] Step 6: commit.

### Task 2: Outil `butin` et lignes de `ou_trouver`

**Files:** Modify `supabase/functions/_shared/discord-jarvis-objets.js` ; Test `tests/discord-jarvis-objets.test.js`.

- [ ] Step 1: tests (lignes par type, `butin` exact/ambigu/introuvable/borne/note, validateur).
- [ ] Step 2: FAIL. Step 3: implémenter. Step 4: vert. Step 5: commit.

### Task 3: Branchement, consigne, documentation

**Files:** `discord-jarvis.js`, `tests/discord-jarvis.test.js`, `tests/discord-jarvis-outils.test.js`, `docs/discord-planning.md`, `AGENTS.md`.

- [ ] Step 1: tests (déclaration `butin`, consigne sans pourcentage, recettes non couvertes).
- [ ] Step 2: FAIL. Step 3: implémenter. Step 4: `npm test`, `deno check`. Step 5: commit.
