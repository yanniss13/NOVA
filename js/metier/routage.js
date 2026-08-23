/* Contrat pur des URL internes de NOVA.

   GitHub Pages ne reecrit aucune URL : toutes les destinations vivent donc
   dans le fragment. Ce module ne connait ni le navigateur, ni la session, ni
   Supabase ; il valide et transforme seulement des valeurs. */

const ROUTE_SESSION_ID_MAX_LENGTH = 128;
/* `calculateur` est routable comme vue NUE : la route nomme l'onglet ouvert et
   ne transporte aucun build. Sans elle, `showView` ne trouvait pas de fragment
   a ecrire et laissait celui de l'onglet precedent : l'URL annoncait
   `#builder` pendant que le Calculateur etait affiche. Le lien vers un
   calculateur PRECONFIGURE reste hors perimetre — il demanderait de serialiser
   un contexte que la route ne sait pas reconstruire. */
const ROUTE_VIEWS = new Set([
  "dashboard", "builder", "roster", "member-roster", "availability",
  "boss", "analyse", "wiki", "collection", "calculateur", "admin"
]);
const GROUP_ROUTE_VIEWS = new Set(["boss", "analyse"]);
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

function sessionIdDeSegment(segment){
  if(typeof segment !== "string") return null;
  let decoded;
  try{
    decoded = decodeURIComponent(segment);
  }catch(error){
    return null;
  }
  return SESSION_ID_PATTERN.test(decoded) ? decoded : null;
}

function lireRoute(fragment){
  const source = String(fragment || "").replace(/^#/, "");
  if(ROUTE_VIEWS.has(source)) return { type:"view", view:source };
  const parts = source.split("/");
  if(parts.length !== 3 || parts[1] !== "groupe"
    || !GROUP_ROUTE_VIEWS.has(parts[0])) return null;
  const sessionId = sessionIdDeSegment(parts[2]);
  return sessionId
    ? { type:"group", view:parts[0], sessionId }
    : null;
}

function fragmentDeRoute(route){
  if(!route || typeof route !== "object") return null;
  if(route.type === "view" && ROUTE_VIEWS.has(route.view)){
    return "#" + route.view;
  }
  const sessionId = String(route.sessionId || "");
  if(route.type === "group" && GROUP_ROUTE_VIEWS.has(route.view)
    && SESSION_ID_PATTERN.test(sessionId)){
    return "#" + route.view + "/groupe/" + encodeURIComponent(sessionId);
  }
  return null;
}

function routeDeVue(view){
  return ROUTE_VIEWS.has(view) ? { type:"view", view } : null;
}

function urlAbsolueDeRoute(route, href){
  const fragment = fragmentDeRoute(route);
  if(!fragment) return null;
  try{
    const url = new URL(href);
    url.hash = fragment;
    return url.href;
  }catch(error){
    return null;
  }
}

export {
  fragmentDeRoute,
  lireRoute,
  routeDeVue,
  urlAbsolueDeRoute
};
