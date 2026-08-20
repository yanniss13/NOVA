import nacl from "npm:tweetnacl@1.0.3";
import { Buffer } from "node:buffer";

type EdgeSharedGlobal = typeof globalThis & {
  Buffer?: typeof Buffer;
  NOVA_AVAILABILITY_FONT?: unknown;
  NOVA_AVAILABILITY_PDF?: unknown;
  NOVA_DISCORD_PLANNING?: unknown;
};

/* Le déploiement Supabase refuse le media type `.cjs`. Les modules partagés
   restent du JavaScript universel : Buffer est posé avant leur import
   dynamique, puis leurs API sont lues depuis un espace global dédié. */
const edgeSharedGlobal = globalThis as EdgeSharedGlobal;
edgeSharedGlobal.Buffer = Buffer;
await import("../_shared/availability-font.js");
await import("../_shared/availability-pdf.js");
await import("../_shared/discord-planning.js");
const availabilityPdfModule = edgeSharedGlobal.NOVA_AVAILABILITY_PDF;
const planningHelpersModule = edgeSharedGlobal.NOVA_DISCORD_PLANNING;

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

type DiscordInteraction = {
  type?: number;
  application_id?: string;
  token?: string;
  guild_id?: string;
  channel_id?: string;
  data?: { name?: string };
  member?: { roles?: string[]; permissions?: string };
};

type PlanningConfig = {
  publicKey: string;
  guildId: string;
  channelId: string;
  allowedRoleIds: string[];
  supabaseUrl: string;
  serviceRoleKey: string;
};

type Profile = { id: string; pseudo: string | null };
type AvailabilityRow = { owner: string; slots: string };
const NOVA_AVAILABILITY_URL = "https://yanniss13.github.io/NOVA/#availability";

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
  parseAllowedRoles,
  planningAuthorizationError,
  isFreshDiscordTimestamp,
  hexToUint8Array,
  originalInteractionUrl,
  ephemeralInteractionMessage
} = planningHelpersModule as {
  parseAllowedRoles(value?: string): string[];
  planningAuthorizationError(
    interaction: DiscordInteraction,
    config: { guildId: string; channelId: string; allowedRoleIds: string[] }
  ): string;
  isFreshDiscordTimestamp(value: string): boolean;
  hexToUint8Array(value: string): Uint8Array | null;
  originalInteractionUrl(applicationId: string, token: string): string;
  ephemeralInteractionMessage(content: string): unknown;
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
    channelId:Deno.env.get("DISCORD_PLANNING_CHANNEL_ID") || "",
    allowedRoleIds:parseAllowedRoles(Deno.env.get("DISCORD_PLANNING_ROLE_IDS")),
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

async function claimGeneration(config: PlanningConfig): Promise<boolean> {
  return await supabaseJson<boolean>(config, "rpc/claim_discord_planning_request", {
    method:"POST",
    body:JSON.stringify({
      p_scope:config.guildId + ":" + config.channelId,
      p_cooldown_seconds:30
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

async function generateAndPublishPlanning(
  interaction: DiscordInteraction,
  config: PlanningConfig
): Promise<void> {
  try {
    if(!await claimGeneration(config)){
      await editOriginalText(
        interaction,
        "⏳ Un planning vient déjà d'être demandé. Réessaie dans quelques secondes."
      );
      return;
    }

    const weekStart = currentAvailabilityWeekStart(new Date());
    const [profiles, availabilityRows] = await Promise.all([
      supabaseJson<Profile[]>(config, "profiles?select=id,pseudo"),
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
  if(interaction.type !== 2 || interaction.data?.name !== "planning"){
    return jsonResponse(ephemeralInteractionMessage("Commande Discord inconnue."));
  }
  const authorizationError = planningAuthorizationError(interaction, config);
  if(authorizationError){
    return jsonResponse(ephemeralInteractionMessage(authorizationError));
  }
  if(!interaction.application_id || !interaction.token){
    return jsonResponse({ error:"Interaction Discord incomplète" }, 400);
  }

  /* Discord exige une première réponse en moins de trois secondes. La réponse
     différée (type 5) crée le message d'attente ; les images remplacent ensuite ce
     message dans la tâche de fond gardée en vie par Supabase. */
  EdgeRuntime.waitUntil(generateAndPublishPlanning(interaction, config));
  return jsonResponse({ type:5 });
});
