/* Lecture d'un panneau d'equipement par Gemini.

   POURQUOI UNE FONCTION EDGE, et pas un appel direct depuis le navigateur.
   Le site est statique : tout ce qu'il embarque est telechargeable et lisible.
   Une cle d'API posee dans le JavaScript serait publique — utilisable par
   n'importe qui sur le quota du proprietaire, et revoquee d'office par Google
   des qu'il la repere. Elle reste donc ici, cote serveur, et le navigateur ne
   parle qu'a cette fonction.

   CE QUE GEMINI FAIT, ET CE QU'IL NE FAIT PAS. Il TRANSCRIT les lignes du
   panneau, rien de plus. Il ne devine ni l'arme, ni le grade, ni la
   configuration : c'est `deduireArme` qui parcourt le catalogue et ne retient
   que les configurations dont les totaux RECALCULES reproduisent ce qui a ete
   lu. Le modele remplace l'oeil, jamais le juge — une lecture fausse est donc
   rejetee, pas ecrite dans le build.

   La sortie a exactement la forme que produit Tesseract dans
   js/vues/import-captures.js, ce qui laisse tout le reste de la chaine
   intact.

   Secrets attendus : GEMINI_API_KEY.
*/

const CLE = Deno.env.get("GEMINI_API_KEY") || "";
/* Flash suffit largement pour lire un panneau de jeu, et coute une fraction
   de Pro. Surchargeable sans redeploiement du code.

   L'ALIAS, ET NON UN NOM FIGE. Le defaut valait `gemini-2.5-flash` : Google
   l'a retire aux cles recentes, et la fonction rendait un 404 que rien ne
   nommait. Un nom fige refera cette panne au prochain retrait. `-latest` suit
   la generation courante et y survit.

   Le prix de l'alias est une derive possible du comportement. Elle est tenable
   ICI, et seulement ici : la sortie du modele est jugee par `deduireArme` /
   `deduirePiece`, qui rejettent toute lecture dont les totaux recalcules ne
   reproduisent pas le panneau. Une derive fait donc echouer un import — elle
   n'ecrit jamais une valeur fausse dans un roster. */
const MODELE = Deno.env.get("GEMINI_MODEL") || "gemini-flash-latest";
const RACINE = "https://generativelanguage.googleapis.com/v1beta/models/";

/* Le navigateur courant n'envoie que la carte de droite, recadree sans perte.
   Trois Mo laissent une marge tres large a ce panneau. La borne protege aussi
   les isolates des anciennes PWA qui envoyaient encore toute une capture : le
   base64 existe plusieurs fois pendant le passage JSON et pouvait depasser la
   limite de ressources avant meme que Gemini ne reponde. */
const OCTETS_MAX = 3 * 1024 * 1024;
const CORPS_MAX = Math.ceil(OCTETS_MAX * 4 / 3) + 64 * 1024;

/* La liste des en-tetes autorises doit couvrir TOUT ce que supabase-js envoie,
   pas seulement ce qu'on lit. Le navigateur compare sa demande a cette liste
   et bloque l'appel des qu'un en-tete manque — meme si le prevol repond 200,
   ce qui rend la panne trompeuse. `x-client-info` et `apikey` partent avec
   chaque `functions.invoke`. */
const ENTETES = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, apikey, x-client-info",
  "Content-Type": "application/json; charset=utf-8"
};

const CONSIGNE = `Tu lis une capture d'ecran du jeu « Seven Deadly Sins: Origin ».
Le panneau de detail se trouve sur la droite de l'image.

Tu TRANSCRIS ce que le panneau affiche. Tu ne calcules rien, tu ne convertis
rien, tu ne devines rien. Si une information est absente ou illisible, rends
null plutot qu'une valeur inventee.

À lire :

1. « nom » : le titre du panneau, tout en haut, recopie mot pour mot.
   Exemple : « Baguette des ailes de la flamme noire ».
   Un equipement grave peut porter des chevrons : recopie-les sans les enlever.

2. « niveau » : le nombre qui suit « Lv. ». Un nombre entier, ou null.
   Ne le confonds pas avec le « +5 » d'un equipement grave, ni avec la
   puissance affichee a cote d'un losange.

3. « passif » : le nombre qui suit « Niv. », plus bas, devant le nom du passif.
   Exemple : « Niv. 7 Énergie de la flamme noire » donne 7. Ou null.

4. « stats » : TOUTES les lignes chiffrees du panneau, de haut en bas, dans
   l'ordre d'affichage. Chaque ligne donne :
   - « libelle » : le texte de la statistique, recopie mot pour mot, accents
     compris. Une ligne peut s'ecrire sur deux lignes a l'ecran : rassemble-la
     en une seule, separee par une espace.
     Exemple : « Augmentation des dégâts, compétence normale ».
   - « valeur » : le nombre tel qu'il est AFFICHE, avec son signe pourcent s'il
     y en a un, et son point decimal. « 48.82% » reste « 48.82% ». Ne convertis
     jamais en entier.
   - « section » : le titre de l'encadre qui contient la ligne, recopie mot
     pour mot — « Enchanter » pour une arme, « Bonus de gravure » pour un
     equipement grave. Pour une ligne qui se trouve AU-DESSUS de tout titre de
     section, rends null.

Cette distinction entre section et non-section est la plus importante de la
lecture : une ligne au-dessus du premier titre est une statistique native de
l'objet, une ligne sous un titre est un enchantement. Les confondre rend la
capture inutilisable.

N'inclus pas le texte descriptif du passif, ni les barres de progression, ni
quoi que ce soit hors du panneau de droite.`;

/* Le schema ferme la sortie : pas de prose, pas de champ surprise, et les
   types sont garantis a l'arrivee. */
const SCHEMA = {
  type: "OBJECT",
  properties: {
    nom: { type: "STRING", nullable: true },
    niveau: { type: "INTEGER", nullable: true },
    passif: { type: "INTEGER", nullable: true },
    stats: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          libelle: { type: "STRING" },
          valeur: { type: "STRING" },
          section: { type: "STRING", nullable: true }
        },
        required: ["libelle", "valeur"]
      }
    }
  },
  required: ["nom", "stats"]
};

/* LA SATURATION N'EST PAS UN REFUS.

   Un 503 « UNAVAILABLE » ne dit pas que notre requete est mauvaise : il dit que
   Google est sature a cet instant, et la meme requete aboutit le plus souvent
   deux secondes plus tard. Abandonner au premier essai renvoyait le membre a
   Tesseract — et a ses quatre megaoctets — pour un incident qui n'a pas dure.

   On ne rejoue QUE la saturation et l'injoignable. Rejouer un 400 ou un 403 ne
   ferait que retarder un echec certain, et rejouer un 429 aggraverait un quota
   deja depasse. */
const SATURATION = new Set([500, 502, 503, 504]);
/* Deux reprises, deux secondes et demie au pire. Au-dela, l'attente couterait
   au membre plus que le repli sur le moteur local ne lui coute. */
const REPRISES = [700, 1800];

async function lireChezGemini(
  image: { donnees: string; type: string }
): Promise<Response | null> {
  const corps = JSON.stringify({
    systemInstruction: { parts: [{ text: CONSIGNE }] },
    contents: [{
      role: "user",
      parts: [{ inlineData: { mimeType: image.type, data: image.donnees } }]
    }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: SCHEMA,
      /* Une transcription n'a pas a etre creative : on veut la meme lecture
         pour la meme image. */
      temperature: 0
    }
  });

  let derniere: Response | null = null;
  for (let essai = 0; essai <= REPRISES.length; essai++) {
    if (essai > 0) {
      console.warn("gemini saturé, reprise " + essai + "/" + REPRISES.length);
      await new Promise((suite) => setTimeout(suite, REPRISES[essai - 1]));
    }
    try {
      derniere = await fetch(
        RACINE + encodeURIComponent(MODELE) + ":generateContent?key="
          + encodeURIComponent(CLE),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: corps
        }
      );
    } catch {
      derniere = null;
      continue;
    }
    if (derniere.ok || !SATURATION.has(derniere.status)) return derniere;
    /* Une reponse abandonnee doit liberer son flux avant la reprise. La garder
       ouverte jusqu'a la fin de l'appel immobilise inutilement des ressources
       de l'isolate, surtout quand plusieurs captures arrivent a la suite. */
    if (essai < REPRISES.length) {
      try {
        await derniere.body?.cancel();
      } catch { /* Le corps peut deja avoir ete ferme par la plateforme. */ }
      derniere = null;
    }
  }
  return derniere;
}

function refus(message: string, code: number): Response {
  return new Response(JSON.stringify({ erreur: message }), {
    status: code, headers: ENTETES
  });
}

/* `verify_jwt` ne suffit PAS a exiger un compte.

   Il verifie la SIGNATURE du jeton, et la cle anonyme du projet est un jeton
   valablement signe : elle est publiee dans index.html, donc n'importe qui
   pourrait appeler cette fonction et vider le quota. On lit donc les
   revendications pour exiger un vrai utilisateur.

   Le jeton n'est pas re-verifie ici : la plateforme l'a deja fait avant de nous
   passer la requete. On ne fait que LIRE ce qu'elle a valide. */
function estUnMembreConnecte(requete: Request): boolean {
  const entete = requete.headers.get("authorization") || "";
  const jeton = entete.replace(/^Bearer\s+/i, "").trim();
  const parties = jeton.split(".");
  if (parties.length !== 3) return false;
  try {
    const base64 = parties[1].replace(/-/g, "+").replace(/_/g, "/");
    const charge = JSON.parse(atob(base64.padEnd(
      base64.length + (4 - base64.length % 4) % 4, "="
    )));
    return charge && charge.role === "authenticated"
      && typeof charge.sub === "string" && charge.sub.length > 0;
  } catch {
    return false;
  }
}

/* Une image arrive en base64, avec ou sans son prefixe `data:`. On accepte les
   deux : le navigateur produit naturellement le prefixe, et l'exiger cote
   client pour le retirer ici serait un aller-retour inutile. */
function decouperImage(brut: unknown): { donnees: string; type: string } | null {
  if (typeof brut !== "string" || !brut) return null;
  const trouve = /^data:([\w/+.-]+);base64,(.*)$/s.exec(brut);
  const donnees = trouve ? trouve[2] : brut;
  const type = trouve ? trouve[1] : "image/png";
  if (!donnees || !/^[A-Za-z0-9+/=\s]+$/.test(donnees)) return null;
  /* Le base64 pese un tiers de plus que les octets qu'il code. */
  if (donnees.length * 3 / 4 > OCTETS_MAX) return null;
  return { donnees: donnees.replace(/\s+/g, ""), type };
}

Deno.serve(async (requete: Request) => {
  if (requete.method === "OPTIONS") {
    return new Response("ok", { headers: ENTETES });
  }
  if (requete.method !== "POST") return refus("Méthode non autorisée.", 405);
  if (!estUnMembreConnecte(requete)) {
    return refus("Cette lecture demande un compte.", 401);
  }
  if (!CLE) return refus("La lecture assistée n’est pas configurée.", 503);

  /* Rejeter une ancienne capture trop lourde AVANT `requete.json()` evite de
     materialiser son base64 dans le tas du worker. Le proxy fournit cette
     longueur sur les appels navigateur ; la verification apres lecture reste
     l'autorite lorsqu'elle est absente. */
  const longueur = Number(requete.headers.get("content-length") || 0);
  if (Number.isFinite(longueur) && longueur > CORPS_MAX) {
    return refus("Image trop lourde. Mets NOVA à jour puis réessaie.", 413);
  }

  let corps: { image?: unknown };
  try {
    corps = await requete.json();
  } catch {
    return refus("Corps de requête illisible.", 400);
  }

  const image = decouperImage(corps.image);
  if (!image) return refus("Image absente, mal encodée ou trop lourde.", 400);

  const reponse = await lireChezGemini(image);
  if (!reponse) return refus("Le service de lecture est injoignable.", 502);

  if (!reponse.ok) {
    /* Le corps de l'erreur amont peut nommer la cle ou le projet : il reste
       dans les journaux, il ne part JAMAIS au navigateur.

       Mais « la lecture a échoué » tout court est indiagnostiquable : une clé
       invalide, une API non activée et un nom de modèle périmé donnent le même
       message, alors que ce sont trois réparations differentes. On remonte donc
       le statut HTTP et l'enum canonique de Google (`PERMISSION_DENIED`,
       `INVALID_ARGUMENT`, `NOT_FOUND`…) : ces deux-la designent la cause sans
       rien reveler du secret. */
    const brut = await reponse.text();
    console.error("gemini", reponse.status, brut);
    let canonique = "";
    try {
      canonique = String(JSON.parse(brut)?.error?.status || "");
    } catch { /* Google n'a pas toujours la politesse du JSON. */ }

    if (reponse.status === 429) {
      return refus("Quota de lecture assistée atteint. Réessaie plus tard.", 429);
    }
    /* La saturation a survecu aux reprises : ce n'est pas une panne du site, et
       le message doit le dire — sinon le membre cherche une erreur de son cote
       alors qu'il n'a qu'a recommencer. */
    if (SATURATION.has(reponse.status)) {
      return refus(
        "Le service de lecture est saturé en ce moment. Réessaie dans un instant"
          + " (Google : " + reponse.status
          + (canonique ? " " + canonique : "") + ").",
        503
      );
    }
    return refus(
      "La lecture assistée a échoué (Google : " + reponse.status
        + (canonique ? " " + canonique : "") + ").",
      502
    );
  }

  const charge = await reponse.json();
  const texte = charge?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof texte !== "string") return refus("Réponse illisible.", 502);

  let lu: unknown;
  try {
    lu = JSON.parse(texte);
  } catch {
    return refus("Réponse mal formée.", 502);
  }

  return new Response(JSON.stringify(lu), { headers: ENTETES });
});
