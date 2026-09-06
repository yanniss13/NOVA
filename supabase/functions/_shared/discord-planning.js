"use strict";

const DISCORD_API = "https://discord.com/api/v10";

/* LA REQUETE DES PROFILS DU PLANNING, invites exclus.

   L'Edge Function lit `profiles` en service_role : aucune RLS ne la filtre,
   elle voit donc aussi les invites. Sans `membre=eq.true`, chaque invite
   entrait dans le tableau comme un membre n'ayant jamais pose ses creneaux,
   et gonflait le denominateur du « X/Y membres ont renseigne leurs
   creneaux ». La constante vit ici pour qu'un test puisse la tenir : le
   fichier `index.ts` n'est pas lisible depuis Node. */
const PLANNING_PROFILES_QUERY = "profiles?select=id,pseudo&membre=eq.true";
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

/* Rappel à la demande, avec le texte que le webhook publie le dimanche. */
function runCommandDefinition() {
  return {
    name:"run",
    description:"Affiche les runs de boss restantes avant le reset de lundi",
    type:1
  };
}

/* La definition de `/build` vit dans son propre module : elle porte trois
   options, et tout ce qui la sert (recherche du joueur, modele de carte) y est
   deja. Elle est lue PARESSEUSEMENT — au premier appel, pas au chargement —
   pour que l'ordre des imports de l'Edge Function n'ait pas d'importance. */
function buildCommandDefinitionOrNull() {
  if(typeof module !== "undefined" && module.exports
    && !globalThis.NOVA_DISCORD_BUILD){
    require("./discord-build.js");
  }
  const buildModule = globalThis.NOVA_DISCORD_BUILD;
  return buildModule ? buildModule.buildCommandDefinition() : null;
}

function commandDefinitions() {
  return [
    planningCommandDefinition(),
    chronoCommandDefinition(),
    runCommandDefinition(),
    buildCommandDefinitionOrNull()
  ].filter(Boolean);
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

/* LES SALONS D'UNE COMMANDE.

   Une commande peut avoir sa propre liste, et elle REMPLACE alors la liste
   generale : un salon dedie a /build n'ouvre pas /planning, /chrono et /run
   avec lui, et /build cesse de repondre ailleurs. « Seulement ici » ne
   voudrait rien dire si les deux listes s'additionnaient.

   Une liste propre vide veut dire « pas de reglage » : la commande retombe sur
   la liste generale, et le comportement historique tient. */
function channelsForCommand(config, commandName) {
  const parCommande = (config.channelIdsByCommand || {})[commandName] || [];
  return parCommande.length ? parCommande : (config.channelIds || []);
}

/* Renvoie un message utilisateur, ou une chaîne vide quand l'interaction est
   autorisée. Le serveur et au moins un salon sont obligatoires : ces commandes
   publient des données nominatives — les créneaux de toute la confrérie, ou
   l'équipement d'un membre. */
function planningAuthorizationError(interaction, config, commandName) {
  const commande = "/" + (commandName || "planning");
  const allowedChannels = channelsForCommand(config, commandName);
  if(!config.guildId || !allowedChannels.length){
    return "La commande " + commande
      + " n'est pas encore configurée par l'administrateur.";
  }
  if(!interaction || interaction.guild_id !== config.guildId){
    return "Cette commande n'est pas autorisée sur ce serveur.";
  }
  if(!allowedChannels.includes(interaction.channel_id)){
    return "Utilise " + commande
      + " dans un salon Discord où cette commande est autorisée.";
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
  const affinent = Number(avancement.affinent) || 0;
  const releves = Number(avancement.releves) || 0;
  const calculs = [];
  if(debloquent){
    calculs.push(debloquent+" compétences sans recharge deviennent calculables"
      + " par leur mesure");
  }
  if(affinent) calculs.push(affinent+" calculs existants sont affinés");
  if(calculs.length) lignes.push(calculs.join(" ; ")+".");
  if(releves){
    lignes.push(releves+" relèves restent hors du comparateur individuel.");
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
  PLANNING_PROFILES_QUERY,
  planningCommandDefinition,
  chronoCommandDefinition,
  runCommandDefinition,
  commandDefinitions,
  formatChronoMessage,
  chronoInteractionComponents,
  parseIdList,
  hasManagementPermission,
  channelsForCommand,
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
