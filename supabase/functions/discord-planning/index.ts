import nacl from "npm:tweetnacl@1.0.3";
import { Buffer } from "node:buffer";

type EdgeSharedGlobal = typeof globalThis & {
  Buffer?: typeof Buffer;
  NOVA_AVAILABILITY_FONT?: unknown;
  NOVA_AVAILABILITY_PDF?: unknown;
  NOVA_DISCORD_PLANNING?: unknown;
  NOVA_BOSS_REMINDER?: unknown;
  NOVA_DISCORD_BUILD?: unknown;
  NOVA_DISCORD_BUILD_PNG?: unknown;
};

/* Le déploiement Supabase refuse le media type `.cjs`. Les modules partagés
   restent du JavaScript universel : Buffer est posé avant leur import
   dynamique, puis leurs API sont lues depuis un espace global dédié. */
const edgeSharedGlobal = globalThis as EdgeSharedGlobal;
edgeSharedGlobal.Buffer = Buffer;
await import("../_shared/availability-font.js");
await import("../_shared/availability-pdf.js");
await import("../_shared/discord-planning.js");
await import("../_shared/boss-reminder.js");
/* CHAQUE module partage est importé ici, même ceux dont seul un autre module
   partagé se sert. Ces fichiers sont universels : entre eux, ils se chargent
   par `require` côté Node et se lisent sur `globalThis` côté Deno. La CLI
   Supabase, elle, construit la liste des fichiers à téléverser en suivant les
   `import` — un module qui n'apparaît qu'en `require` n'est jamais déployé, et
   la fonction tombe à son premier appel. */
await import("../_shared/png-decode.js");
await import("../_shared/discord-build.js");
await import("../_shared/discord-build-png.js");
const availabilityPdfModule = edgeSharedGlobal.NOVA_AVAILABILITY_PDF;
const planningHelpersModule = edgeSharedGlobal.NOVA_DISCORD_PLANNING;
const bossReminderModule = edgeSharedGlobal.NOVA_BOSS_REMINDER;
const buildModule = edgeSharedGlobal.NOVA_DISCORD_BUILD;
const buildPngModule = edgeSharedGlobal.NOVA_DISCORD_BUILD_PNG;

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

type DiscordInteraction = {
  type?: number;
  application_id?: string;
  token?: string;
  guild_id?: string;
  channel_id?: string;
  data?: {
    name?: string;
    options?: {
      name?: string;
      type?: number;
      value?: unknown;
      focused?: boolean;
    }[];
  };
  member?: { roles?: string[]; permissions?: string };
};

type PlanningConfig = {
  publicKey: string;
  guildId: string;
  channelIds: string[];
  allowedRoleIds: string[];
  supabaseUrl: string;
  serviceRoleKey: string;
};

type Profile = { id: string; pseudo: string | null };
type AvailabilityRow = { owner: string; slots: string };
const NOVA_AVAILABILITY_URL = "https://yanniss13.github.io/NOVA/#availability";
const NOVA_CHRONO_PROGRESS_URL =
  "https://yanniss13.github.io/NOVA/data/chronometrage-avancement.json";
const NOVA_ROSTER_URL = "https://yanniss13.github.io/NOVA/#member-roster";
/* Le nom et l'element des personnages, le libelle et l'unite des statistiques.
   Le catalogue complet du site pese 2,5 Mo ; ce petit fichier en est l'extrait
   qui suffit a /build, publie par `scripts/generer-libelles-discord.js`. */
const NOVA_BUILD_LABELS_URL =
  "https://yanniss13.github.io/NOVA/data/libelles-discord.json";

const {
  currentAvailabilityWeekStart,
  buildAvailabilityReport,
  generateAvailabilityTablePng,
  generateAvailabilityDetailsPng
} = availabilityPdfModule as {
  currentAvailabilityWeekStart(now?: Date): string;
  buildAvailabilityReport(
    profiles: Profile[], rows: AvailabilityRow[], weekStart: string
  ): {
    label: string;
    declaredCount: number;
    members: unknown[];
  };
  generateAvailabilityTablePng(report: unknown): Promise<Uint8Array>;
  generateAvailabilityDetailsPng(report: unknown): Promise<Uint8Array>;
};

const {
  PLANNING_PROFILES_QUERY,
  parseIdList,
  planningAuthorizationError,
  formatChronoMessage,
  chronoInteractionComponents,
  isFreshDiscordTimestamp,
  hexToUint8Array,
  originalInteractionUrl,
  ephemeralInteractionMessage
} = planningHelpersModule as {
  PLANNING_PROFILES_QUERY: string;
  parseIdList(value?: string): string[];
  planningAuthorizationError(
    interaction: DiscordInteraction,
    config: { guildId: string; channelIds: string[]; allowedRoleIds: string[] },
    commandName?: string
  ): string;
  formatChronoMessage(avancement: unknown, recues: number | null): string;
  chronoInteractionComponents(): unknown[];
  isFreshDiscordTimestamp(value: string): boolean;
  hexToUint8Array(value: string): Uint8Array | null;
  originalInteractionUrl(applicationId: string, token: string): string;
  ephemeralInteractionMessage(content: string): unknown;
};

/* `/run` republie à la demande le rappel que le webhook envoie le dimanche.
   Le texte vient donc du module partagé avec le cron Node, jamais d'une copie
   locale qui divergerait à la première reformulation. */
type MissingMember = { pseudo: string; missing: number };
const {
  currentBossWeekStart,
  bossWeekLabel,
  collectReminderData,
  reminderMessage
} = bossReminderModule as {
  currentBossWeekStart(now?: Date): string;
  bossWeekLabel(weekStart: string): string;
  collectReminderData(
    request: (pathname: string) => Promise<unknown>, weekStart: string
  ): Promise<{ missingMembers: MissingMember[] }>;
  reminderMessage(weekLabel: string, missingMembers: MissingMember[]): string;
};

/* La commande /build : tout ce qui se raisonne est dans le module partage,
   l'Edge Function ne fait que lire Supabase, dessiner et publier. */
type BuildOptions = { joueur: string; personnage: string; arme: string };
type BuildCard = {
  joueur: string;
  personnage: string;
  arme: string;
  fichier: string;
};
type RosterRow = {
  owner: string;
  char_id: string;
  potential_tier: number;
  builds: unknown;
};
type BuildChoice = { name: string; value: string };
const {
  lireOptionsBuild,
  propositionsBuild,
  trouverProfil,
  resoudreDemandeBuild,
  contenuMessageBuild
} = buildModule as {
  lireOptionsBuild(interaction: DiscordInteraction): BuildOptions;
  propositionsBuild(entree: {
    interaction: DiscordInteraction;
    libelles: unknown;
    lireProfils(): Promise<Profile[]>;
    lireRoster(ownerId: string): Promise<{ char_id: string }[]>;
    lireBuilds(
      ownerId: string, charId: string
    ): Promise<Record<string, unknown>>;
  }): Promise<BuildChoice[]>;
  trouverProfil(profils: Profile[], saisie: string): Profile | null;
  resoudreDemandeBuild(entree: {
    profils: Profile[];
    lignes: RosterRow[];
    libelles: unknown;
    options: BuildOptions;
  }): { erreur?: string; cartes?: BuildCard[] };
  contenuMessageBuild(cartes: BuildCard[]): string;
};
const { generateBuildCardPng } = buildPngModule as {
  generateBuildCardPng(carte: BuildCard): Promise<Uint8Array>;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers:{ "Content-Type":"application/json; charset=utf-8" }
  });
}

function environment(): PlanningConfig {
  return {
    publicKey:Deno.env.get("DISCORD_PUBLIC_KEY") || "",
    guildId:Deno.env.get("DISCORD_GUILD_ID") || "",
    channelIds:parseIdList(Deno.env.get("DISCORD_PLANNING_CHANNEL_ID")),
    allowedRoleIds:parseIdList(Deno.env.get("DISCORD_PLANNING_ROLE_IDS")),
    supabaseUrl:Deno.env.get("SUPABASE_URL") || "",
    serviceRoleKey:Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  };
}

async function verifyDiscordRequest(
  request: Request,
  publicKey: string
): Promise<{ valid: boolean; body: string }> {
  const signature = request.headers.get("X-Signature-Ed25519") || "";
  const timestamp = request.headers.get("X-Signature-Timestamp") || "";
  const body = await request.text();
  const signatureBytes = hexToUint8Array(signature);
  const publicKeyBytes = hexToUint8Array(publicKey);
  if(!signatureBytes || signatureBytes.length !== 64
    || !publicKeyBytes || publicKeyBytes.length !== 32
    || !isFreshDiscordTimestamp(timestamp)){
    return { valid:false, body };
  }
  try {
    return {
      valid:nacl.sign.detached.verify(
        new TextEncoder().encode(timestamp + body),
        signatureBytes,
        publicKeyBytes
      ),
      body
    };
  } catch (_) {
    return { valid:false, body };
  }
}

async function supabaseJson<T>(
  config: PlanningConfig,
  pathname: string,
  init?: RequestInit
): Promise<T> {
  if(!config.supabaseUrl || !config.serviceRoleKey){
    throw new Error("Configuration Supabase interne absente");
  }
  const response = await fetch(config.supabaseUrl + "/rest/v1/" + pathname, {
    ...init,
    headers:{
      apikey:config.serviceRoleKey,
      Authorization:"Bearer " + config.serviceRoleKey,
      "Content-Type":"application/json",
      ...(init?.headers || {})
    }
  });
  if(!response.ok){
    throw new Error(pathname + " -> " + response.status + " " + await response.text());
  }
  return await response.json() as T;
}

/* Chaque salon garde son propre délai, et chaque commande le sien : une demande
   dans un salon n'empêche ni les autres salons de répondre, ni `/run` de
   s'exécuter pendant qu'un planning se génère. */
async function claimGeneration(
  interaction: DiscordInteraction,
  config: PlanningConfig,
  commandName = "planning",
  cooldownSeconds = 30
): Promise<boolean> {
  /* Le nom de la commande entre dans la portée : /chrono ne coûte qu'une
     lecture, il n'a aucune raison d'être retenu parce qu'un planning vient
     d'être publié dans le même salon. */
  const scope = config.guildId + ":" + (interaction.channel_id || "")
    + (commandName === "planning" ? "" : ":" + commandName);
  return await supabaseJson<boolean>(config, "rpc/claim_discord_planning_request", {
    method:"POST",
    body:JSON.stringify({
      p_scope:scope,
      p_cooldown_seconds:cooldownSeconds
    })
  });
}

async function editOriginalText(
  interaction: DiscordInteraction,
  content: string
): Promise<void> {
  const response = await fetch(originalInteractionUrl(
    interaction.application_id || "", interaction.token || ""
  ), {
    method:"PATCH",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({ content, allowed_mentions:{ parse:[] } })
  });
  if(!response.ok){
    throw new Error("Discord PATCH texte -> " + response.status + " " + await response.text());
  }
}

async function editOriginalWithPlanning(
  interaction: DiscordInteraction,
  content: string,
  tableFilename: string,
  table: Uint8Array,
  detailsFilename: string,
  details: Uint8Array
): Promise<void> {
  const form = new FormData();
  form.append("payload_json", JSON.stringify({
    content,
    allowed_mentions:{ parse:[] },
    attachments:[
      {
        id:0,
        filename:tableFilename,
        description:"Tableau hebdomadaire des disponibilités de la confrérie"
      },
      {
        id:1,
        filename:detailsFilename,
        description:"Créneaux écrits pour chaque membre de la confrérie"
      }
    ],
    embeds:[
      { image:{ url:"attachment://" + tableFilename } },
      { image:{ url:"attachment://" + detailsFilename } }
    ],
    components:[{
      type:1,
      components:[{
        type:2,
        style:5,
        label:"NOVA - Renseigner mes créneaux",
        url:NOVA_AVAILABILITY_URL
      }]
    }]
  }));
  form.append("files[0]", new Blob([table], { type:"image/png" }), tableFilename);
  form.append("files[1]", new Blob([details], { type:"image/png" }), detailsFilename);
  const response = await fetch(originalInteractionUrl(
    interaction.application_id || "", interaction.token || ""
  ), { method:"PATCH", body:form });
  if(!response.ok){
    throw new Error("Discord PATCH planning -> " + response.status + " " + await response.text());
  }
}

async function editOriginalWithComponents(
  interaction: DiscordInteraction,
  content: string,
  components: unknown[]
): Promise<void> {
  const response = await fetch(originalInteractionUrl(
    interaction.application_id || "", interaction.token || ""
  ), {
    method:"PATCH",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({ content, components, allowed_mentions:{ parse:[] } })
  });
  if(!response.ok){
    throw new Error("Discord PATCH chrono -> " + response.status
      + " " + await response.text());
  }
}

/* L'avancement se lit sur GitHub Pages et non en base : c'est le fichier que
   `scripts/lister-chronometrage.py` publie, donc exactement le compte que
   « Mon suivi » affiche. Deux chemins qui liraient deux sources finiraient par
   annoncer deux chiffres. */
async function readChronoProgress(): Promise<unknown> {
  const response = await fetch(
    NOVA_CHRONO_PROGRESS_URL,
    { headers:{ Accept:"application/json" } }
  );
  if(!response.ok){
    throw new Error("Avancement -> " + response.status);
  }
  return await response.json();
}

/* Le nombre d'envois en attente. Une panne de lecture rend null : la fonction
   de rendu tait alors la ligne au lieu d'annoncer zero. */
async function countPendingMeasures(config: PlanningConfig): Promise<number | null> {
  try {
    const rows = await supabaseJson<{ id: string }[]>(
      config, "animation_measures?select=id"
    );
    return Array.isArray(rows) ? rows.length : null;
  } catch (error) {
    console.error("Lecture de animation_measures impossible", error);
    return null;
  }
}

async function publishChronoProgress(
  interaction: DiscordInteraction,
  config: PlanningConfig
): Promise<void> {
  try {
    if(!await claimGeneration(interaction, config, "chrono")){
      await editOriginalText(
        interaction,
        "⏳ L'avancement vient déjà d'être demandé. Réessaie dans quelques secondes."
      );
      return;
    }
    const [avancement, recues] = await Promise.all([
      readChronoProgress(),
      countPendingMeasures(config)
    ]);
    await editOriginalWithComponents(
      interaction,
      formatChronoMessage(avancement, recues),
      chronoInteractionComponents()
    );
  } catch (error) {
    console.error("Échec de /chrono", error);
    try {
      await editOriginalText(
        interaction,
        "❌ L'avancement du chronométrage n'a pas pu être lu."
      );
    } catch (editError) {
      console.error("Impossible de publier l'erreur Discord", editError);
    }
  }
}

async function generateAndPublishPlanning(
  interaction: DiscordInteraction,
  config: PlanningConfig
): Promise<void> {
  try {
    if(!await claimGeneration(interaction, config, "planning", 30)){
      await editOriginalText(
        interaction,
        "⏳ Un planning vient déjà d'être demandé. Réessaie dans quelques secondes."
      );
      return;
    }

    const weekStart = currentAvailabilityWeekStart(new Date());
    const [profiles, availabilityRows] = await Promise.all([
      supabaseJson<Profile[]>(config, PLANNING_PROFILES_QUERY),
      supabaseJson<AvailabilityRow[]>(config,
        "member_availability?week_start=eq." + encodeURIComponent(weekStart)
        + "&select=owner,slots")
    ]);
    const report = buildAvailabilityReport(profiles, availabilityRows, weekStart);
    const [table, details] = await Promise.all([
      generateAvailabilityTablePng(report),
      generateAvailabilityDetailsPng(report)
    ]);
    const tableFilename = "tableau-disponibilites-" + weekStart + ".png";
    const detailsFilename = "creneaux-par-membre-" + weekStart + ".png";
    const content = "📅 **Disponibilités de la confrérie** — " + report.label
      + "\n" + report.declaredCount + "/" + report.members.length
      + " membres ont renseigné leurs créneaux."
      + "\n👉 Pense à renseigner tes disponibilités sur **NOVA** avec le bouton ci-dessous.";
    await editOriginalWithPlanning(
      interaction, content, tableFilename, table, detailsFilename, details
    );
  } catch (error) {
    console.error("Échec de /planning", error);
    try {
      await editOriginalText(
        interaction,
        "❌ Le planning n'a pas pu être généré. Un administrateur peut consulter les logs Supabase."
      );
    } catch (editError) {
      console.error("Impossible de publier l'erreur Discord", editError);
    }
  }
}

/* Trois lectures Supabase avant de pouvoir répondre : la réponse différée reste
   nécessaire, Discord n'accorde que trois secondes. Le délai anti-spam est plus
   court que celui du planning — il s'agit de texte, pas de deux images à
   dessiner. */
async function publishBossRunReminder(
  interaction: DiscordInteraction,
  config: PlanningConfig
): Promise<void> {
  try {
    if(!await claimGeneration(interaction, config, "run", 10)){
      await editOriginalText(
        interaction,
        "⏳ Un rappel vient déjà d'être affiché. Réessaie dans quelques secondes."
      );
      return;
    }

    const weekStart = currentBossWeekStart(new Date());
    const { missingMembers } = await collectReminderData(
      pathname => supabaseJson<unknown>(config, pathname), weekStart
    );
    await editOriginalText(
      interaction, reminderMessage(bossWeekLabel(weekStart), missingMembers)
    );
  } catch (error) {
    console.error("Échec de /run", error);
    try {
      await editOriginalText(
        interaction,
        "❌ Le rappel n'a pas pu être affiché. Un administrateur peut consulter les logs Supabase."
      );
    } catch (editError) {
      console.error("Impossible de publier l'erreur Discord", editError);
    }
  }
}

/* Le catalogue de libelles ne change qu'a un deploiement du site : le garder
   en memoire evite de le retelecharger a chaque commande. Une instance Edge
   froide le lit une fois, les suivantes le retrouvent ici. */
let buildLabelsCache: unknown = null;
async function readBuildLabels(): Promise<unknown> {
  if(buildLabelsCache) return buildLabelsCache;
  const response = await fetch(
    NOVA_BUILD_LABELS_URL, { headers:{ Accept:"application/json" } }
  );
  if(!response.ok){
    throw new Error("Libellés -> " + response.status);
  }
  buildLabelsCache = await response.json();
  return buildLabelsCache;
}

/* Une image par build, jusqu'a trois : c'est le nombre d'armes qu'un
   personnage peut equiper. Discord en accepte dix par message, la limite ne
   sera donc jamais atteinte par cette commande. */
async function editOriginalWithCards(
  interaction: DiscordInteraction,
  content: string,
  cartes: BuildCard[],
  images: Uint8Array[]
): Promise<void> {
  const form = new FormData();
  form.append("payload_json", JSON.stringify({
    content,
    allowed_mentions:{ parse:[] },
    attachments:cartes.map((carte, index) => ({
      id:index,
      filename:carte.fichier,
      description:"Build " + carte.arme + " de " + carte.personnage
        + " dans le roster de " + carte.joueur
    })),
    embeds:cartes.map(carte => ({
      image:{ url:"attachment://" + carte.fichier }
    })),
    components:[{
      type:1,
      components:[{
        type:2,
        style:5,
        label:"NOVA - Voir les rosters",
        url:NOVA_ROSTER_URL
      }]
    }]
  }));
  images.forEach((image, index) => {
    form.append(
      "files[" + index + "]",
      new Blob([image], { type:"image/png" }),
      cartes[index].fichier
    );
  });
  const response = await fetch(originalInteractionUrl(
    interaction.application_id || "", interaction.token || ""
  ), { method:"PATCH", body:form });
  if(!response.ok){
    throw new Error("Discord PATCH build -> " + response.status
      + " " + await response.text());
  }
}

/* POURQUOI L'ERREUR EST PUBLIQUE. Discord veut une premiere reponse en moins
   de trois secondes, et le caractere ephemere se decide a cet instant — avant
   d'avoir lu quoi que ce soit. Verifier le pseudo AVANT de differer
   demanderait deux lectures Supabase dans ce budget de trois secondes ; une
   faute de frappe repond donc dans le salon, comme pour les trois autres
   commandes. */
async function publishCharacterBuild(
  interaction: DiscordInteraction,
  config: PlanningConfig
): Promise<void> {
  try {
    if(!await claimGeneration(interaction, config, "build", 10)){
      await editOriginalText(
        interaction,
        "⏳ Un build vient déjà d'être demandé. Réessaie dans quelques secondes."
      );
      return;
    }

    const options = lireOptionsBuild(interaction);
    const [profiles, libelles] = await Promise.all([
      supabaseJson<Profile[]>(config, PLANNING_PROFILES_QUERY),
      readBuildLabels()
    ]);
    /* On retrouve le pseudo AVANT de lire le roster : `roster_characters`
       compte une ligne par personnage possede, chacune portant tous ses
       builds. Lire la table entiere pour n'en garder qu'un joueur ferait
       transiter plusieurs mega-octets a chaque commande.

       Un pseudo introuvable passe quand meme par `resoudreDemandeBuild`, avec
       un roster vide : la phrase d'erreur et les pseudos proches restent
       ecrits a un seul endroit. */
    const profil = trouverProfil(profiles, options.joueur);
    const lignes = profil
      ? await supabaseJson<RosterRow[]>(config,
        "roster_characters?owner=eq." + encodeURIComponent(profil.id)
        + "&select=owner,char_id,potential_tier,builds")
      : [];
    const resultat = resoudreDemandeBuild({
      profils:profiles, lignes, libelles, options
    });
    if(resultat.erreur || !resultat.cartes || !resultat.cartes.length){
      await editOriginalText(interaction, "❌ " + (resultat.erreur
        || "Aucun build à partager."));
      return;
    }

    const cartes = resultat.cartes;
    const images = await Promise.all(cartes.map(generateBuildCardPng));
    await editOriginalWithCards(
      interaction, contenuMessageBuild(cartes), cartes, images
    );
  } catch (error) {
    console.error("Échec de /build", error);
    try {
      await editOriginalText(
        interaction,
        "❌ Le build n'a pas pu être partagé. Un administrateur peut consulter les logs Supabase."
      );
    } catch (editError) {
      console.error("Impossible de publier l'erreur Discord", editError);
    }
  }
}

/* L'AUTOCOMPLETION DE /build.

   Discord envoie une interaction de type 4 à chaque frappe et n'accorde que
   trois secondes : aucune réponse différée n'est possible, contrairement à la
   commande elle-même. D'où les caches — sans eux, taper « Elizabeth » lancerait
   neuf lectures Supabase, et la neuvième arriverait trop tard.

   Les durées sont courtes exprès : un membre accueilli ou un build enregistré
   à l'instant doit apparaître dans la minute, pas au prochain redémarrage de
   l'instance. */
const CACHE_PROFILS_MS = 60_000;
const CACHE_ROSTER_MS = 30_000;

let profilsCache: { valeur: Profile[]; expire: number } | null = null;
async function profilsEnCache(config: PlanningConfig): Promise<Profile[]> {
  const maintenant = Date.now();
  if(profilsCache && profilsCache.expire > maintenant) return profilsCache.valeur;
  const valeur = await supabaseJson<Profile[]>(config, PLANNING_PROFILES_QUERY);
  profilsCache = { valeur, expire:maintenant + CACHE_PROFILS_MS };
  return valeur;
}

const rosterCache = new Map<string, { valeur: unknown; expire: number }>();
async function rosterEnCache<T>(
  config: PlanningConfig, cle: string, chemin: string
): Promise<T> {
  const maintenant = Date.now();
  const garde = rosterCache.get(cle);
  if(garde && garde.expire > maintenant) return garde.valeur as T;
  const valeur = await supabaseJson<T>(config, chemin);
  rosterCache.set(cle, { valeur, expire:maintenant + CACHE_ROSTER_MS });
  return valeur;
}

/* L'enchaînement des trois menus vit dans le module partagé, éprouvé en Node
   avec des lecteurs factices. Ne restent ici que les lectures réelles et leur
   cache — et le fait, décidé là-bas, qu'aucune ne se fasse inutilement. */
async function propositionsDeBuild(
  interaction: DiscordInteraction,
  config: PlanningConfig
): Promise<BuildChoice[]> {
  return await propositionsBuild({
    interaction,
    libelles:await readBuildLabels(),
    lireProfils:() => profilsEnCache(config),
    /* `select=char_id` et rien d'autre : `builds` est la colonne lourde, et le
       menu des personnages n'en a aucun besoin. */
    lireRoster:ownerId => rosterEnCache<{ char_id: string }[]>(
      config,
      "chars:" + ownerId,
      "roster_characters?owner=eq." + encodeURIComponent(ownerId)
        + "&select=char_id"
    ),
    /* Les builds d'UNE ligne : le personnage est déjà choisi. */
    lireBuilds:async (ownerId, charId) => {
      const lignes = await rosterEnCache<{ builds: Record<string, unknown> }[]>(
        config,
        "builds:" + ownerId + ":" + charId,
        "roster_characters?owner=eq." + encodeURIComponent(ownerId)
          + "&char_id=eq." + encodeURIComponent(charId) + "&select=builds"
      );
      return (lignes[0] && lignes[0].builds) || {};
    }
  });
}

Deno.serve(async request => {
  if(request.method !== "POST"){
    return jsonResponse({ error:"Méthode non autorisée" }, 405);
  }

  const config = environment();
  if(!config.publicKey){
    console.error("Secret DISCORD_PUBLIC_KEY absent");
    return jsonResponse({ error:"Configuration Discord absente" }, 500);
  }
  const verified = await verifyDiscordRequest(request, config.publicKey);
  if(!verified.valid){
    return jsonResponse({ error:"Signature Discord invalide" }, 401);
  }

  let interaction: DiscordInteraction;
  try {
    interaction = JSON.parse(verified.body) as DiscordInteraction;
  } catch (_) {
    return jsonResponse({ error:"Corps JSON invalide" }, 400);
  }

  if(interaction.type === 1) return jsonResponse({ type:1 });
  /* Discord n'accepte qu'UN endpoint d'interactions par application : les quatre
     commandes arrivent forcément ici, et c'est le nom qui les sépare. */
  const commandName = interaction.data?.name || "";

  /* L'autocomplétion, avant tout le reste : c'est le seul type qui répond
     autre chose qu'un message, et il n'a que trois secondes.

     Elle passe par le MÊME contrôle de serveur, de salon et de rôle que la
     commande — proposer la liste des pseudos de la confrérie dans un salon
     non autorisé serait une fuite. Mais un menu de suggestions ne sait pas
     afficher d'erreur : un refus, comme une panne de lecture, répond une
     liste vide. Un champ qui ne propose rien se comprend ; un menu figé sur
     « Loading options failed » ne se comprend pas. */
  if(interaction.type === 4){
    if(commandName !== "build") return jsonResponse({ type:8, data:{ choices:[] } });
    if(planningAuthorizationError(interaction, config, commandName)){
      return jsonResponse({ type:8, data:{ choices:[] } });
    }
    let choices: BuildChoice[] = [];
    try {
      choices = await propositionsDeBuild(interaction, config);
    } catch (error) {
      console.error("Échec de l'autocomplétion de /build", error);
    }
    return jsonResponse({ type:8, data:{ choices } });
  }
  const taches: Record<string, (
    interaction: DiscordInteraction, config: PlanningConfig
  ) => Promise<void>> = {
    planning:generateAndPublishPlanning,
    chrono:publishChronoProgress,
    run:publishBossRunReminder,
    build:publishCharacterBuild
  };
  /* `hasOwnProperty` et non un accès direct : sans lui, un nom comme
     « constructor » remonterait une fonction héritée d'Object.prototype et
     passerait la garde ci-dessous. Discord ne peut envoyer que des commandes
     enregistrées, et la signature Ed25519 est déjà vérifiée — mais une table
     de routage indexée par une chaîne venue du réseau se referme ici, pas
     dans le raisonnement de celui qui la relit. */
  const tache = interaction.type === 2
    && Object.prototype.hasOwnProperty.call(taches, commandName)
    ? taches[commandName]
    : undefined;
  if(!tache){
    return jsonResponse(ephemeralInteractionMessage("Commande Discord inconnue."));
  }
  const authorizationError = planningAuthorizationError(
    interaction, config, commandName
  );
  if(authorizationError){
    return jsonResponse(ephemeralInteractionMessage(authorizationError));
  }
  if(!interaction.application_id || !interaction.token){
    return jsonResponse({ error:"Interaction Discord incomplète" }, 400);
  }

  /* Discord exige une première réponse en moins de trois secondes. La réponse
     différée (type 5) crée le message d'attente ; le contenu remplace ensuite ce
     message dans la tâche de fond gardée en vie par Supabase. */
  EdgeRuntime.waitUntil(tache(interaction, config));
  return jsonResponse({ type:5 });
});
