"use strict";

const DISCORD_API = "https://discord.com/api/v10";
const ADMINISTRATOR = 1n << 3n;
const MANAGE_GUILD = 1n << 5n;

function planningCommandDefinition() {
  return {
    name:"planning",
    description:"Affiche le planning des disponibilités de la confrérie",
    type:1
  };
}

function parseAllowedRoles(value) {
  return String(value || "")
    .split(",")
    .map(role => role.trim())
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
   autorisée. Le serveur et le salon sont obligatoires : les images contiennent les
   disponibilités nominatives de toute la confrérie. */
function planningAuthorizationError(interaction, config) {
  if(!config.guildId || !config.channelId){
    return "La commande /planning n'est pas encore configurée par l'administrateur.";
  }
  if(!interaction || interaction.guild_id !== config.guildId){
    return "Cette commande n'est pas autorisée sur ce serveur.";
  }
  if(interaction.channel_id !== config.channelId){
    return "Utilise /planning dans le salon Discord configuré pour les disponibilités.";
  }

  const allowedRoles = config.allowedRoleIds || [];
  if(!allowedRoles.length) return "";
  const member = interaction.member || {};
  const memberRoles = new Set(member.roles || []);
  if(allowedRoles.some(role => memberRoles.has(role))) return "";
  if(hasManagementPermission(member.permissions)) return "";
  return "Tu n'as pas le rôle Discord requis pour générer ce planning.";
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
  planningCommandDefinition,
  parseAllowedRoles,
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
