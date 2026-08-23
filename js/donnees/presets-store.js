/* Les presets d'equipement d'un membre : lecture et ecriture Supabase, avec
   cache local.

   Le cache n'est PAS indexe par proprietaire, contrairement au roster et a la
   collection : un preset est prive, on n'affiche jamais celui d'un autre.

   Il sert a afficher vite et hors ligne, et n'accorde JAMAIS un droit : la RLS
   reste seule juge de ce qu'un membre peut ecrire.

   Aucun rendu ici. La forme d'un preset vit dans metier/presets.js. */

import { CLOUD_PRESETS_CACHE_KEY } from "../noyau/constantes.js";
import { PRESETS_MAX, nomPresetValide, normaliserPreset } from "../metier/presets.js";
import { sb } from "../noyau/supabase-client.js";
import { sessionCourante } from "../etat/session.js";

  function lireCachePresets(){
    try{
      const brut = JSON.parse(localStorage.getItem(CLOUD_PRESETS_CACHE_KEY));
      return Array.isArray(brut) ? brut : [];
    }catch(erreur){
      return [];
    }
  }
  let cachePresets = lireCachePresets();

  function ecrireCachePresets(presets){
    cachePresets = presets;
    localStorage.setItem(CLOUD_PRESETS_CACHE_KEY, JSON.stringify(cachePresets));
    return cachePresets.slice();
  }

  function presetDepuisLigne(ligne){
    const contenu = normaliserPreset(ligne && ligne.payload);
    if(!contenu || !ligne.id) return null;
    return Object.assign({ id:ligne.id, nom:ligne.nom }, contenu);
  }

  function identifiant(){
    return typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : "p-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  /* Nom prefixe : le chargeur de tests concatene TOUS les modules dans une
     seule portee, ou `parNom` appartient deja a metier/wiki-equipement.js. */
  function parNomDePreset(a, b){
    return String(a.nom).localeCompare(String(b.nom));
  }

  const PresetsStore = {
    all(){
      return cachePresets.slice();
    },
    async refresh(){
      if(!sessionCourante.user || !sb) return PresetsStore.all();
      const { data, error } = await sb.from("gear_presets")
        .select("id,nom,payload")
        .eq("owner", sessionCourante.user.id)
        .order("nom");
      if(error) throw error;
      return ecrireCachePresets(
        (data || []).map(presetDepuisLigne).filter(Boolean)
      );
    },
    /* `id` fourni : correction d'un preset existant. Absent : creation.
       La distinction compte pour la limite — renommer son 40e preset ne doit
       pas se heurter au plafond. */
    async save(nom, payload, id){
      const propre = nomPresetValide(nom);
      if(!propre) throw new Error("NOM_INVALIDE");
      const contenu = normaliserPreset(payload);
      if(!contenu) throw new Error("PRESET_INVALIDE");
      const existant = id
        ? cachePresets.find(preset => preset.id === id)
        : null;
      if(!existant && cachePresets.length >= PRESETS_MAX){
        throw new Error("TROP_DE_PRESETS");
      }
      if(!sessionCourante.user || !sb) throw new Error("AUTH_REQUIRED");
      const owner = sessionCourante.user.id;
      const identite = existant ? existant.id : (id || identifiant());
      const { error } = await sb.from("gear_presets")
        .upsert({ owner, id:identite, nom:propre, payload:contenu });
      if(error) throw error;
      const suivant = cachePresets.filter(preset => preset.id !== identite);
      suivant.push(Object.assign({ id:identite, nom:propre }, contenu));
      suivant.sort(parNomDePreset);
      return ecrireCachePresets(suivant);
    },
    async remove(id){
      if(!sessionCourante.user || !sb) throw new Error("AUTH_REQUIRED");
      const owner = sessionCourante.user.id;
      const { error } = await sb.from("gear_presets")
        .delete()
        .eq("owner", owner)
        .eq("id", id);
      if(error) throw error;
      return ecrireCachePresets(cachePresets.filter(preset => preset.id !== id));
    }
  };

/* Pas encore d'export : le garde-fou structurel refuse un export orphelin, et
   les vues qui appelleront ce store arrivent au lot suivant. Le test l'atteint
   sans passer par l'export. */
