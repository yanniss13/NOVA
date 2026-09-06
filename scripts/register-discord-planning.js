"use strict";

/* Enregistre `/planning`, `/chrono`, `/run` et `/build` dans UN serveur Discord sans
   les autres commandes de l'application. Le token Bot ne sert qu'à cette
   opération administrative et ne doit jamais rejoindre le dépôt ni Supabase.

   Les quatre commandes s'enregistrent ensemble parce qu'elles partagent un seul
   endpoint d'interactions : Discord n'en accepte qu'un par application. */

const {
  DISCORD_API, commandDefinitions
} = require("../supabase/functions/_shared/discord-planning.js");

async function discordApi(request, url, token, init) {
  const response = await request(url, Object.assign({}, init, {
    headers:Object.assign({
      Authorization:"Bot " + token,
      "Content-Type":"application/json"
    }, init && init.headers)
  }));
  const text = await response.text();
  if(!response.ok){
    throw new Error(response.status + " " + (text || response.statusText));
  }
  return text ? JSON.parse(text) : null;
}

async function registerPlanningCommand(options) {
  const config = options || {};
  const request = config.request || fetch;
  const applicationId = config.applicationId || process.env.DISCORD_APPLICATION_ID;
  const guildId = config.guildId || process.env.DISCORD_GUILD_ID;
  const token = config.token || process.env.DISCORD_BOT_TOKEN;
  const missing = [
    ["DISCORD_APPLICATION_ID", applicationId],
    ["DISCORD_GUILD_ID", guildId],
    ["DISCORD_BOT_TOKEN", token]
  ].filter(([, value]) => !value).map(([name]) => name);
  if(missing.length){
    throw new Error("Variables manquantes : " + missing.join(", "));
  }

  const collectionUrl = DISCORD_API + "/applications/"
    + encodeURIComponent(applicationId) + "/guilds/" + encodeURIComponent(guildId)
    + "/commands";
  /* Un seul GET pour toutes les commandes : chacune est ensuite créée ou mise à
     jour individuellement. Le PUT global, lui, effacerait les commandes de
     l'application qui ne figurent pas dans cette liste. */
  const commands = await discordApi(request, collectionUrl, token, { method:"GET" });
  const resultats = [];
  for(const command of commandDefinitions()){
    const existing = (commands || []).find(item => item.name === command.name);
    const url = existing
      ? collectionUrl + "/" + encodeURIComponent(existing.id)
      : collectionUrl;
    const saved = await discordApi(request, url, token, {
      method:existing ? "PATCH" : "POST",
      body:JSON.stringify(command)
    });
    resultats.push({
      name:command.name,
      action:existing ? "updated" : "created",
      command:saved
    });
  }
  /* `action` et `command` restent au premier niveau : /planning est la
     commande historique, et les appelants qui ne connaissent qu'elle
     continuent de lire son resultat sans changement. */
  return Object.assign({}, resultats[0], { commands:resultats });
}

async function main() {
  const result = await registerPlanningCommand();
  result.commands.forEach(commande => {
    console.log(
      "Commande /" + commande.name + " "
      + (commande.action === "created" ? "créée" : "mise à jour")
      + " dans le serveur " + process.env.DISCORD_GUILD_ID + "."
    );
  });
  console.log(
    "Autorisation de l'application : https://discord.com/oauth2/authorize?client_id="
    + encodeURIComponent(process.env.DISCORD_APPLICATION_ID)
    + "&scope=applications.commands&guild_id="
    + encodeURIComponent(process.env.DISCORD_GUILD_ID)
    + "&disable_guild_select=true"
  );
}

if(require.main === module){
  main().catch(error => {
    console.error("Échec de l'enregistrement des commandes : " + error.message);
    process.exitCode = 1;
  });
}

module.exports = { registerPlanningCommand };
