/* Les runs d'entraînement du boss de confrérie.

   Une ligne par run. Toute écriture est suivie d'une relecture complète : le
   volume est minuscule (quelques runs par semaine) et c'est le serveur qui
   fige les équipes — la ligne relue est la seule vérité.

   Une correction porte le `updated_at` relu, en CHAINE OPAQUE : Date.parse
   perdrait les microsecondes de PostgreSQL et ferait échouer toute
   comparaison. Zéro ligne modifiée = quelqu'un est passé entre-temps.

   Le cache sert à afficher hors ligne, il n'accorde AUCUN droit. */

import { CLOUD_TRAINING_CACHE_KEY } from "../noyau/constantes.js";
import { sb } from "../noyau/supabase-client.js";
import { sessionCourante } from "../etat/session.js";

  const TABLE_ENTRAINEMENT = "boss_training_runs";
  const COLONNES_ENTRAINEMENT = "id,played_on,global_score::text,note,participants,"
    + "equipes,created_by,created_by_pseudo,created_at,updated_by_pseudo,updated_at";

  function lireCacheEntrainement(){
    try{
      const brut = JSON.parse(localStorage.getItem(CLOUD_TRAINING_CACHE_KEY));
      return brut && brut.version === 1 && Array.isArray(brut.runs) ? brut : null;
    }catch(erreur){
      return null;
    }
  }
  let cacheEntrainement = lireCacheEntrainement();

  function normaliserRunEntrainement(ligne){
    return {
      id:ligne.id,
      playedOn:ligne.played_on,
      score:String(ligne.global_score),
      note:ligne.note || "",
      participants:Array.isArray(ligne.participants) ? ligne.participants : [],
      equipes:ligne.equipes && typeof ligne.equipes === "object" ? ligne.equipes : {},
      createdBy:ligne.created_by || null,
      createdByPseudo:ligne.created_by_pseudo || "Membre",
      createdAt:ligne.created_at,
      updatedByPseudo:ligne.updated_by_pseudo || null,
      updatedAt:String(ligne.updated_at)
    };
  }

  function ligneDeSaisieEntrainement(saisie){
    const equipes = {};
    saisie.participants.forEach(id => {
      const choix = saisie.equipes && saisie.equipes[id];
      equipes[id] = { teamId:choix && choix.teamId ? choix.teamId : null };
    });
    return {
      played_on:saisie.playedOn,
      global_score:saisie.score,
      note:saisie.note,
      participants:saisie.participants,
      equipes
    };
  }

  function exigerSessionEntrainement(){
    if(!sessionCourante.user || !sb) throw new Error("AUTH_REQUIRED");
  }

  const EntrainementStore = {
    all(){
      return cacheEntrainement ? cacheEntrainement.runs.slice() : [];
    },
    lastSyncedAt(){
      return cacheEntrainement ? cacheEntrainement.syncedAt : null;
    },
    aUnCache(){
      return !!cacheEntrainement;
    },
    async refresh(){
      exigerSessionEntrainement();
      const { data, error } = await sb.from(TABLE_ENTRAINEMENT)
        .select(COLONNES_ENTRAINEMENT)
        .order("played_on", { ascending:false });
      if(error) throw error;
      cacheEntrainement = {
        version:1,
        syncedAt:Date.now(),
        runs:(data || []).map(normaliserRunEntrainement)
      };
      try{
        localStorage.setItem(CLOUD_TRAINING_CACHE_KEY, JSON.stringify(cacheEntrainement));
      }catch(erreur){ /* quota plein : le cache est un confort */ }
      return EntrainementStore.all();
    },
    async create(saisie){
      exigerSessionEntrainement();
      const ligne = Object.assign(ligneDeSaisieEntrainement(saisie),
        { created_by:sessionCourante.user.id });
      const { error } = await sb.from(TABLE_ENTRAINEMENT).insert(ligne);
      if(error) throw error;
    },
    async update(id, jeton, saisie){
      exigerSessionEntrainement();
      const { data, error } = await sb.from(TABLE_ENTRAINEMENT)
        .update(ligneDeSaisieEntrainement(saisie))
        .eq("id", id)
        .eq("updated_at", jeton)
        .select("id");
      if(error) throw error;
      if(!data || !data.length) throw new Error("TRAINING_CONFLICT");
    },
    async remove(id){
      exigerSessionEntrainement();
      const { error } = await sb.from(TABLE_ENTRAINEMENT).delete().eq("id", id);
      if(error) throw error;
    }
  };

export { EntrainementStore };
