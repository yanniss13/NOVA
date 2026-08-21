"use strict";

const DISCORD_API = "https://discord.com/api/v10";
const ADMINISTRATOR = 1n << 3n;
const MANAGE_GUILD = 1n << 5n;

const NOVA_CHRONO_URL =
  "https://yanniss13.github.io/NOVA/outils/chrono-animation.html";

function planningCommandDefinition() {
  return {
    name:"planning",
    description:"Affiche le planning des disponibilités de la confrérie",
    type:1
  };
}

function chronoCommandDefinition() {
  return {
    name:"chrono",
    description:"Où en est le chronométrage des animations, et quoi mesurer",
    type:1
  };
}

function commandDefinitions() {
  return [planningCommandDefinition(), chronoCommandDefinition()];
}

/* Les salons comme les rôles arrivent en une chaîne séparée par des
   virgules : un seul identifiant reste valide, plusieurs se cumulent. */
function parseIdList(value) {
  return String(value || "")
    .split(",")
    .map(identifiant => identifiant.trim())
    .filter(Boolean);
}

function hasManagementPermission(value) {
  try {
    const permissions = BigInt(value || "0");
    return (permissions & ADMINISTRATOR) !== 0n
      || (permissions & MANAGE_GUILD) !== 0n;
  } catch (_) {
    return false;
  }
}

/* Renvoie un message utilisateur, ou une chaîne vide quand l'interaction est
   autorisée. Le serveur et au moins un salon sont obligatoires : les
   images contiennent les disponibilités nominatives de toute la confrérie. */
function planningAuthorizationError(interaction, config, commandName) {
  const commande = "/" + (commandName || "planning");
  const allowedChannels = config.channelIds || [];
  if(!config.guildId || !allowedChannels.length){
    return "La commande " + commande
      + " n'est pas encore configurée par l'administrateur.";
  }
  if(!interaction || interaction.guild_id !== config.guildId){
    return "Cette commande n'est pas autorisée sur ce serveur.";
  }
  if(!allowedChannels.includes(interaction.channel_id)){
    return "Utilise " + commande
      + " dans un salon Discord configuré pour les disponibilités.";
  }

  const allowedRoles = config.allowedRoleIds || [];
  if(!allowedRoles.length) return "";
  const member = interaction.member || {};
  const memberRoles = new Set(member.roles || []);
  if(allowedRoles.some(role => memberRoles.has(role))) return "";
  if(hasManagementPermission(member.permissions)) return "";
  return "Tu n'as pas le rôle Discord requis pour lancer " + commande + ".";
}

/* Le message de /chrono. Fonction pure : elle reçoit ce que la fonction Edge
   a lu, elle ne lit rien elle-même, et les tests Node la vérifient sans
   réseau.

   `recues` peut être null quand la boîte de réception n'a pas répondu. On tait
   alors la ligne au lieu d'annoncer un zéro : « personne n'a rien envoyé » et
   « je n'ai pas pu compter » ne sont pas la même information. */
function formatChronoMessage(avancement, recues) {
  const total = Number(avancement && avancement.total) || 0;
  const mesurees = Number(avancement && avancement.mesurees) || 0;
  if(!total){
    return "⏱️ **Chronométrage des animations** — liste indisponible pour le moment.";
  }
  if(mesurees >= total){
    return "⏱️ **Chronométrage des animations** — " + total + "/" + total
      + " mesurées. Tout est fait, merci à celles et ceux qui ont chronométré.";
  }

  const lignes = [
    "⏱️ **Chronométrage des animations** — " + mesurees + "/" + total
      + " mesurées."
  ];
  const debloquent = Number(avancement.debloquent) || 0;
  if(debloquent){
    lignes.push("Aucune source publique ne publie ces durées. Sans elles, "
      + debloquent + " compétences n'ont aucun DPS calculable.");
  }
  if(Number.isFinite(Number(recues)) && Number(recues) > 0){
    lignes.push(Number(recues) + " mesure(s) reçue(s) attendent d'être validées.");
  }

  const prochaines = (avancement.prochaines || []).slice(0, 5);
  if(prochaines.length){
    lignes.push("");
    lignes.push("**Les plus utiles à mesurer maintenant :**");
    prochaines.forEach(ligne => {
      lignes.push("• " + ligne.heros + " · " + ligne.arme + " · " + ligne.nom
        + " *(" + String(ligne.categorie || "").toLowerCase()
        + ", " + ligne.touche + ")*");
    });
  }
  return lignes.join("\n");
}

function chronoInteractionComponents() {
  return [{
    type:1,
    components:[{
      type:2,
      style:5,
      label:"NOVA - Chronométrer une animation",
      url:NOVA_CHRONO_URL
    }]
  }];
}

function isFreshDiscordTimestamp(value, nowMs, toleranceMs) {
  if(!/^\d+$/.test(String(value || ""))) return false;
  const timestampMs = Number(value) * 1000;
  if(!Number.isFinite(timestampMs)) return false;
  const now = nowMs === undefined ? Date.now() : nowMs;
  const tolerance = toleranceMs === undefined ? 5 * 60 * 1000 : toleranceMs;
  return Math.abs(now - timestampMs) <= tolerance;
}

function hexToUint8Array(value) {
  const hex = String(value || "");
  if(!hex || hex.length % 2 || !/^[0-9a-f]+$/i.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for(let index = 0; index < bytes.length; index += 1){
    bytes[index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function originalInteractionUrl(applicationId, token) {
  return DISCORD_API + "/webhooks/" + encodeURIComponent(applicationId)
    + "/" + encodeURIComponent(token) + "/messages/@original";
}

function ephemeralInteractionMessage(content) {
  return {
    type:4,
    data:{
      content,
      flags:64,
      allowed_mentions:{ parse:[] }
    }
  };
}

const discordPlanningApi = {
  DISCORD_API,
  NOVA_CHRONO_URL,
  planningCommandDefinition,
  chronoCommandDefinition,
  commandDefinitions,
  formatChronoMessage,
  chronoInteractionComponents,
  parseIdList,
  hasManagementPermission,
  planningAuthorizationError,
  isFreshDiscordTimestamp,
  hexToUint8Array,
  originalInteractionUrl,
  ephemeralInteractionMessage
};

if(typeof module !== "undefined" && module.exports){
  module.exports = discordPlanningApi;
}
globalThis.NOVA_DISCORD_PLANNING = discordPlanningApi;
