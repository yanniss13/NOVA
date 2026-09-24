# /jarvis — recettes (lot 2c, étape 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** un outil `recette` et une source « recette » dans `ou_trouver`.

**Architecture:** `construireCatalogueObjets` lit en plus les quatre tables de recettes, `MakingCategory` et `MakingList` ; il ajoute `recettes` et des sources `recette`. Le module bot accepte ce type et ajoute l'outil.

**Tech Stack:** Node (CommonJS), Deno, Gemini palier gratuit.

**Spec:** `docs/superpowers/specs/2026-09-25-jarvis-recettes-design.md`

## Global Constraints

- `MakingRecipe` n'est jamais lue.
- `objets.json` reste en version 1 ; `recettes` facultatif.
- Pas de push sans accord du propriétaire.

## Review Focus

1. Un groupe d'ingrédients vide ou inconnu : l'ingrédient reste, sans alternatives. → Task 1.
2. Une recette sans aucun ingrédient nommé : écartée, pas « x0 ». → Task 1.
3. Un produit fabriqué à deux établis différents : deux recettes, une source par type. → Task 1.
4. Un ancien fichier sans `recettes` : `recette` répond « introuvable ». → Task 2.
5. Taille de `objets.json` : sous 1 Mo. → Task 1.

---

### Task 1: Extraction des recettes

**Files:** `outils/fabrication/objets-jarvis.js`, `outils/fabrication/extraire-objets.js`, `tests/objets-jarvis.test.js`.

- [ ] Tests (mini-export des quatre tables, catégories, groupes) → FAIL → implémentation → vert → extraction réelle → commit.

### Task 2: Outil `recette`

**Files:** `supabase/functions/_shared/discord-jarvis-objets.js`, `tests/discord-jarvis-objets.test.js`.

- [ ] Tests → FAIL → implémentation → vert → commit.

### Task 3: Consigne, branchement, documentation

**Files:** `discord-jarvis.js`, `tests/discord-jarvis.test.js`, `tests/discord-jarvis-outils.test.js`, `docs/discord-planning.md`, `AGENTS.md`.

- [ ] Tests → FAIL → implémentation → `npm run test:unit` → commit.
