/* Index de recherche sur les donnees generees.

   Deux tables construites une fois au chargement : chemin de fichier -> nom
   lisible, et identifiant -> personnage. Elles evitent de reparcourir DATA a
   chaque rendu.

   Les deux accesseurs tolerent l'absence : `nameOfFile` retombe sur le nom de
   fichier, `charOf` rend null. Un roster peut citer un personnage retire du
   catalogue, et le site doit continuer a s'afficher. */

import { DATA } from "../noyau/constantes.js";

  // Index de recherche : chemin de fichier -> nom lisible
  const FILE_NAME = new Map();
  Object.values(DATA.armes||{}).forEach(list => list.forEach(w => FILE_NAME.set(w.file, w.name)));
  Object.values(DATA.armures||{}).forEach(list => list.forEach(a => FILE_NAME.set(a.file, a.name)));
  Object.values(DATA.bijoux||{}).forEach(list => list.forEach(b => FILE_NAME.set(b.file, b.name)));
  const CHAR_BY_ID = new Map((DATA.personnages||[]).map(c => [c.id, c]));

  const nameOfFile = f => FILE_NAME.get(f) || (f ? f.split("/").pop().replace(/\.webp$/i,"") : "");
  const charOf = id => CHAR_BY_ID.get(id) || null;

export {
  charOf,
  nameOfFile
};
