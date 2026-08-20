"use strict";

/* Enregistre les commandes NOVA (`/planning` et `/run`) dans UN serveur Discord
   sans remplacer les autres commandes de l'application. Le token Bot ne sert
   qu'à cette opération administrative et ne doit jamais rejoindre le dépôt ni
   Supabase. */

const {
  DISCORD_API, guildCommandDefinitions
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

async function registerGuildCommands(options) {
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
  const results = [];
  for(const command of guildCommandDefinitions()){
    const existing = (commands || []).find(known => known.name === command.name);
    const url = existing
      ? collectionUrl + "/" + encodeURIComponent(existing.id)
      : collectionUrl;
    const saved = await discordApi(request, url, token, {
      method:existing ? "PATCH" : "POST",
      body:JSON.stringify(command)
    });
    results.push({
      name:command.name,
      action:existing ? "updated" : "created",
      command:saved
    });
  }
  return results;
}

async function main() {
  const results = await registerGuildCommands();
  results.forEach(result => {
    console.log(
      "Commande /" + result.name + " "
      + (result.action === "created" ? "créée" : "mise à jour")
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

module.exports = { registerGuildCommands };
