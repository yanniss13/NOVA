"use strict";

/* Module universel : Node fournit Buffer globalement ; l'Edge Function pose
   le Buffer compatible Node avant l'import dynamique de ce fichier. */
const Buffer = globalThis.Buffer;
if(!Buffer) throw new Error("Buffer indisponible pour la génération PDF");
if(typeof module !== "undefined" && module.exports && !globalThis.NOVA_AVAILABILITY_FONT){
  require("./availability-font.js");
}

/* Génération autonome du planning PDF envoyé sur Discord.

   Ce script ne dépend d'aucun paquet npm : le workflow du rappel peut donc le
   lancer avec le seul Node fourni par GitHub Actions. Les disponibilités
   restent celles de la semaine ISO de Paris (lundi 00 h), distincte de la
   semaine du boss qui ne bascule qu'à 9 h. */

const PDF_WIDTH = 842;
const PDF_HEIGHT = 595;
const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const SHORT_DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre"
];
const EMPTY_MASK = "0".repeat(168);
const MASK_PATTERN = /^[01]{168}$/;

function parisDateParts(now) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone:"Europe/Paris",
    year:"numeric",
    month:"2-digit",
    day:"2-digit",
    weekday:"short"
  }).formatToParts(now || new Date());
  const get = type => (parts.find(part => part.type === type) || {}).value;
  return {
    year:+get("year"),
    month:+get("month"),
    day:+get("day"),
    weekday:{ Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 }[get("weekday")]
  };
}

function currentAvailabilityWeekStart(now) {
  const paris = parisDateParts(now);
  const date = new Date(Date.UTC(paris.year, paris.month - 1, paris.day));
  date.setUTCDate(date.getUTCDate() - ((paris.weekday + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function dayDate(weekStart, day) {
  const [year, month, date] = String(weekStart).split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, date));
  result.setUTCDate(result.getUTCDate() + day);
  return result;
}

function weekLabel(weekStart) {
  const first = dayDate(weekStart, 0);
  const last = dayDate(weekStart, 6);
  const lastPart = last.getUTCDate() + " " + MONTHS[last.getUTCMonth()];
  const firstPart = first.getUTCMonth() === last.getUTCMonth()
    ? String(first.getUTCDate())
    : first.getUTCDate() + " " + MONTHS[first.getUTCMonth()];
  return "semaine du " + firstPart + " au " + lastPart;
}

function normalizedMask(value) {
  return typeof value === "string" && MASK_PATTERN.test(value) ? value : EMPTY_MASK;
}

function buildAvailabilityReport(profiles, rows, weekStart) {
  const rowByOwner = new Map();
  (rows || []).forEach(row => {
    if(row && row.owner && MASK_PATTERN.test(row.slots)) rowByOwner.set(row.owner, row.slots);
  });

  const seen = new Set();
  const members = (profiles || []).flatMap(profile => {
    if(!profile || !profile.id || seen.has(profile.id)) return [];
    seen.add(profile.id);
    const hasRow = rowByOwner.has(profile.id);
    const mask = hasRow ? rowByOwner.get(profile.id) : EMPTY_MASK;
    return [{
      owner:profile.id,
      pseudo:String(profile.pseudo || "Membre").trim() || "Membre",
      mask,
      declared:hasRow,
      hours:[...mask].filter(value => value === "1").length
    }];
  }).sort((a, b) => a.pseudo.localeCompare(b.pseudo, "fr"));

  const counts = new Array(168).fill(0);
  members.forEach(member => {
    for(let index = 0; index < 168; index += 1){
      if(member.mask[index] === "1") counts[index] += 1;
    }
  });
  const best = counts
    .map((count, index) => ({ index, count }))
    .filter(slot => slot.count > 0)
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .slice(0, 3);

  return {
    weekStart,
    label:weekLabel(weekStart),
    members,
    declaredCount:members.filter(member => member.declared).length,
    counts,
    max:counts.reduce((maximum, count) => Math.max(maximum, count), 0),
    best
  };
}

function memberDayIntervals(mask, day) {
  const intervals = [];
  let start = null;
  for(let hour = 0; hour <= 24; hour += 1){
    const selected = hour < 24 && mask[day * 24 + hour] === "1";
    if(selected && start === null) start = hour;
    if(!selected && start !== null){
      intervals.push({ start, end:hour });
      start = null;
    }
  }
  return intervals;
}

function hourLabel(hour) {
  return String(hour).padStart(2, "0") + "h";
}

function intervalLabel(interval) {
  return hourLabel(interval.start) + "-" + hourLabel(interval.end);
}

/* Les polices PDF standard comprennent Windows-1252. On conserve donc les
   accents français et on remplace proprement les caractères que cette police
   ne sait pas dessiner, au lieu de produire un carré illisible. */
const CP1252 = new Map([
  ["€",0x80], ["‚",0x82], ["ƒ",0x83], ["„",0x84], ["…",0x85],
  ["†",0x86], ["‡",0x87], ["ˆ",0x88], ["‰",0x89], ["Š",0x8a],
  ["‹",0x8b], ["Œ",0x8c], ["Ž",0x8e], ["‘",0x91], ["’",0x92],
  ["“",0x93], ["”",0x94], ["•",0x95], ["–",0x96], ["—",0x97],
  ["˜",0x98], ["™",0x99], ["š",0x9a], ["›",0x9b], ["œ",0x9c],
  ["ž",0x9e], ["Ÿ",0x9f]
]);

function winAnsiBytes(value) {
  const bytes = [];
  for(const char of String(value).replace(/[\r\n]+/g, " ")){
    const code = char.codePointAt(0);
    if(code >= 32 && code <= 255){
      bytes.push(code);
      continue;
    }
    if(CP1252.has(char)){
      bytes.push(CP1252.get(char));
      continue;
    }
    const fallback = char.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if(fallback.length === 1 && fallback.charCodeAt(0) >= 32 && fallback.charCodeAt(0) < 127){
      bytes.push(fallback.charCodeAt(0));
    }else{
      bytes.push(0x3f);
    }
  }
  return Buffer.from(bytes);
}

function pdfEscapedText(value) {
  const input = winAnsiBytes(value);
  const bytes = [];
  for(const byte of input){
    if(byte === 0x28 || byte === 0x29 || byte === 0x5c) bytes.push(0x5c);
    bytes.push(byte);
  }
  return Buffer.from(bytes);
}

function number(value) {
  return Number(value.toFixed(3)).toString();
}

class PdfCanvas {
  constructor() {
    this.parts = [];
  }

  ascii(command) {
    this.parts.push(Buffer.from(command, "ascii"));
  }

  rectangle(x, y, width, height, fill, stroke) {
    this.ascii("q ");
    if(fill) this.ascii(fill.map(number).join(" ") + " rg ");
    if(stroke) this.ascii(stroke.map(number).join(" ") + " RG 0.45 w ");
    this.ascii([x, y, width, height].map(number).join(" ") + " re ");
    this.ascii(fill && stroke ? "B Q\n" : fill ? "f Q\n" : "S Q\n");
  }

  text(x, y, size, value, options) {
    const config = options || {};
    const color = config.color || [0.12, 0.1, 0.14];
    const font = config.bold ? "F2" : "F1";
    this.ascii("BT /" + font + " " + number(size) + " Tf "
      + color.map(number).join(" ") + " rg 1 0 0 1 "
      + number(x) + " " + number(y) + " Tm (");
    this.parts.push(pdfEscapedText(value));
    this.ascii(") Tj ET\n");
  }

  buffer() {
    return Buffer.concat(this.parts);
  }
}

function slotLabel(index) {
  const day = Math.floor(index / 24);
  const hour = index % 24;
  return SHORT_DAYS[day] + " " + hourLabel(hour) + "-" + hourLabel(hour + 1);
}

function pageOne(report) {
  const canvas = new PdfCanvas();
  canvas.rectangle(0, 0, PDF_WIDTH, PDF_HEIGHT, [1, 1, 1]);
  canvas.rectangle(0, 526, PDF_WIDTH, 69, [0.12, 0.08, 0.16]);
  canvas.text(26, 560, 20, "Disponibilités de la confrérie", {
    bold:true, color:[0.86, 0.7, 0.24]
  });
  canvas.text(26, 540, 10, report.label + " — heure de Paris", { color:[1, 1, 1] });

  const membersLabel = report.declaredCount + " membre"
    + (report.declaredCount === 1 ? " a" : "s ont")
    + " renseigné leurs créneaux sur " + report.members.length + ".";
  canvas.text(26, 510, 10, membersLabel, { bold:true });
  const bestLabel = report.best.length
    ? "Meilleurs créneaux : " + report.best.map(slot =>
      slotLabel(slot.index) + " (" + slot.count + ")"
    ).join("  |  ")
    : "Aucun créneau disponible n'a encore été déclaré.";
  canvas.text(26, 494, 9, bestLabel);

  const left = 26;
  const timeWidth = 48;
  const dayWidth = (PDF_WIDTH - 52 - timeWidth) / 7;
  const headerBottom = 451;
  const headerHeight = 24;
  const rowHeight = 16;
  canvas.rectangle(left, headerBottom, timeWidth, headerHeight, [0.2, 0.14, 0.25], [1, 1, 1]);
  canvas.text(left + 11, headerBottom + 8, 8, "Heure", { bold:true, color:[1, 1, 1] });
  for(let day = 0; day < 7; day += 1){
    const date = dayDate(report.weekStart, day);
    const label = SHORT_DAYS[day] + " " + String(date.getUTCDate()).padStart(2, "0")
      + "/" + String(date.getUTCMonth() + 1).padStart(2, "0");
    const x = left + timeWidth + day * dayWidth;
    canvas.rectangle(x, headerBottom, dayWidth, headerHeight, [0.2, 0.14, 0.25], [1, 1, 1]);
    canvas.text(x + 31, headerBottom + 8, 8, label, { bold:true, color:[1, 1, 1] });
  }

  for(let hour = 0; hour < 24; hour += 1){
    const y = headerBottom - (hour + 1) * rowHeight;
    canvas.rectangle(left, y, timeWidth, rowHeight, [0.94, 0.92, 0.95], [0.75, 0.72, 0.77]);
    canvas.text(left + 9, y + 5, 7.5, hourLabel(hour));
    for(let day = 0; day < 7; day += 1){
      const count = report.counts[day * 24 + hour];
      const ratio = report.max ? count / report.max : 0;
      const fill = count
        ? [0.91 - 0.55 * ratio, 0.86 - 0.69 * ratio, 0.96 - 0.43 * ratio]
        : [0.97, 0.97, 0.97];
      const x = left + timeWidth + day * dayWidth;
      canvas.rectangle(x, y, dayWidth, rowHeight, fill, [0.78, 0.76, 0.79]);
      canvas.text(x + dayWidth / 2 - (count >= 10 ? 5 : 2.5), y + 5, 7.5,
        count ? String(count) : "-", {
          bold:count > 0,
          color:ratio > 0.55 ? [1, 1, 1] : [0.16, 0.12, 0.18]
        });
    }
  }
  canvas.text(26, 35, 8,
    "Chaque nombre indique combien de membres sont disponibles pendant cette heure.",
    { color:[0.35, 0.32, 0.37] });
  canvas.text(740, 35, 8, "Page 1", { color:[0.35, 0.32, 0.37] });
  return canvas.buffer();
}

function wrapLine(text, maximum) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  words.forEach(word => {
    const candidate = line ? line + " " + word : word;
    if(line && candidate.length > maximum){
      lines.push(line);
      line = word;
    }else{
      line = candidate;
    }
  });
  if(line) lines.push(line);
  return lines.length ? lines : [""];
}

function memberLines(member, maximum) {
  const lines = [{ text:member.pseudo + " — " + member.hours + " h disponibles", bold:true }];
  let hasInterval = false;
  for(let day = 0; day < 7; day += 1){
    const intervals = memberDayIntervals(member.mask, day);
    if(!intervals.length) continue;
    hasInterval = true;
    const text = DAYS[day] + " : " + intervals.map(intervalLabel).join(", ");
    wrapLine(text, maximum || 118).forEach((part, index) => lines.push({
      text:part,
      indent:index === 0 ? 12 : 32,
      color:[0.24, 0.21, 0.26]
    }));
  }
  if(!hasInterval) lines.push({
    text:member.declared ? "Aucun créneau sélectionné." : "Disponibilités non renseignées.",
    indent:12,
    color:[0.45, 0.42, 0.47]
  });
  return lines;
}

function detailPages(report) {
  const pages = [];
  let canvas;
  let y;
  let column;
  const columnLeft = [26, 430];

  function finishPage() {
    if(!canvas) return;
    canvas.text(740, 35, 8, "Page " + (pages.length + 2), {
      color:[0.35, 0.32, 0.37]
    });
    pages.push(canvas.buffer());
  }

  function newPage() {
    finishPage();
    canvas = new PdfCanvas();
    canvas.rectangle(0, 0, PDF_WIDTH, PDF_HEIGHT, [1, 1, 1]);
    canvas.rectangle(0, 526, PDF_WIDTH, 69, [0.12, 0.08, 0.16]);
    canvas.text(26, 560, 18, "Détail des disponibilités par membre", {
      bold:true, color:[0.86, 0.7, 0.24]
    });
    canvas.text(26, 540, 10, report.label + " — heure de Paris", { color:[1, 1, 1] });
    canvas.rectangle(420, 43, 0.6, 469, null, [0.86, 0.82, 0.88]);
    y = 504;
    column = 0;
  }

  function nextColumn() {
    if(column === 0){
      column = 1;
      y = 504;
    }else{
      newPage();
    }
  }

  newPage();
  if(!report.members.length){
    canvas.text(26, y, 11, "Aucun membre n'est enregistré dans la confrérie.");
  }else{
    report.members.forEach(member => {
      const lines = memberLines(member, 54);
      const blockHeight = lines.length * 8.4 + 4;
      if(y - blockHeight < 43) nextColumn();
      lines.forEach(line => {
        const indent = line.indent ? (line.indent > 20 ? 18 : 9) : 0;
        canvas.text(columnLeft[column] + indent, y, line.bold ? 7.8 : 7.1, line.text, {
          bold:!!line.bold,
          color:line.color
        });
        y -= 8.4;
      });
      y -= 4;
    });
  }
  finishPage();
  return pages;
}

function streamObject(content) {
  return Buffer.concat([
    Buffer.from("<< /Length " + content.length + " >>\nstream\n", "ascii"),
    content,
    Buffer.from("\nendstream", "ascii")
  ]);
}

function createPdf(pageContents) {
  const objects = [null];
  const add = body => { objects.push(body); return objects.length - 1; };
  const pagesId = add(null);
  const regularFontId = add(Buffer.from(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "ascii"
  ));
  const boldFontId = add(Buffer.from(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    "ascii"
  ));
  const pageIds = pageContents.map(content => {
    const contentId = add(streamObject(content));
    return add(Buffer.from(
      "<< /Type /Page /Parent " + pagesId + " 0 R "
      + "/MediaBox [0 0 " + PDF_WIDTH + " " + PDF_HEIGHT + "] "
      + "/Resources << /Font << /F1 " + regularFontId + " 0 R /F2 "
      + boldFontId + " 0 R >> >> /Contents " + contentId + " 0 R >>",
      "ascii"
    ));
  });
  objects[pagesId] = Buffer.from(
    "<< /Type /Pages /Count " + pageIds.length + " /Kids ["
    + pageIds.map(id => id + " 0 R").join(" ") + "] >>",
    "ascii"
  );
  const catalogId = add(Buffer.from("<< /Type /Catalog /Pages " + pagesId + " 0 R >>", "ascii"));

  const chunks = [Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "binary")];
  const offsets = [0];
  let length = chunks[0].length;
  for(let id = 1; id < objects.length; id += 1){
    offsets[id] = length;
    const chunk = Buffer.concat([
      Buffer.from(id + " 0 obj\n", "ascii"),
      objects[id],
      Buffer.from("\nendobj\n", "ascii")
    ]);
    chunks.push(chunk);
    length += chunk.length;
  }
  const xrefOffset = length;
  const xref = ["xref", "0 " + objects.length, "0000000000 65535 f "];
  for(let id = 1; id < objects.length; id += 1){
    xref.push(String(offsets[id]).padStart(10, "0") + " 00000 n ");
  }
  chunks.push(Buffer.from(
    xref.join("\n") + "\ntrailer\n<< /Size " + objects.length + " /Root "
    + catalogId + " 0 R >>\nstartxref\n" + xrefOffset + "\n%%EOF\n",
    "ascii"
  ));
  return Buffer.concat(chunks);
}

function generateAvailabilityPdf(report) {
  return createPdf([pageOne(report), ...detailPages(report)]);
}

/* Aperçu PNG affiché directement par Discord.

   Le PDF reste le document détaillé ; cette image reprend sa grille agrégée
   dans un format 16:10 lisible dans le fil de discussion. Le petit alphabet
   bitmap et l'encodeur PNG sont internes afin de ne dépendre ni de Canvas, ni
   d'une bibliothèque native absente de GitHub Actions et de Supabase Edge. */
const FONT_5X7 = {
  " ":["00000","00000","00000","00000","00000","00000","00000"],
  "A":["01110","10001","10001","11111","10001","10001","10001"],
  "B":["11110","10001","10001","11110","10001","10001","11110"],
  "C":["01111","10000","10000","10000","10000","10000","01111"],
  "D":["11110","10001","10001","10001","10001","10001","11110"],
  "E":["11111","10000","10000","11110","10000","10000","11111"],
  "F":["11111","10000","10000","11110","10000","10000","10000"],
  "G":["01111","10000","10000","10111","10001","10001","01111"],
  "H":["10001","10001","10001","11111","10001","10001","10001"],
  "I":["11111","00100","00100","00100","00100","00100","11111"],
  "J":["00111","00010","00010","00010","10010","10010","01100"],
  "K":["10001","10010","10100","11000","10100","10010","10001"],
  "L":["10000","10000","10000","10000","10000","10000","11111"],
  "M":["10001","11011","10101","10101","10001","10001","10001"],
  "N":["10001","11001","10101","10011","10001","10001","10001"],
  "O":["01110","10001","10001","10001","10001","10001","01110"],
  "P":["11110","10001","10001","11110","10000","10000","10000"],
  "Q":["01110","10001","10001","10001","10101","10010","01101"],
  "R":["11110","10001","10001","11110","10100","10010","10001"],
  "S":["01111","10000","10000","01110","00001","00001","11110"],
  "T":["11111","00100","00100","00100","00100","00100","00100"],
  "U":["10001","10001","10001","10001","10001","10001","01110"],
  "V":["10001","10001","10001","10001","10001","01010","00100"],
  "W":["10001","10001","10001","10101","10101","10101","01010"],
  "X":["10001","10001","01010","00100","01010","10001","10001"],
  "Y":["10001","10001","01010","00100","00100","00100","00100"],
  "Z":["11111","00001","00010","00100","01000","10000","11111"],
  "0":["01110","10001","10011","10101","11001","10001","01110"],
  "1":["00100","01100","00100","00100","00100","00100","01110"],
  "2":["01110","10001","00001","00010","00100","01000","11111"],
  "3":["11110","00001","00001","01110","00001","00001","11110"],
  "4":["00010","00110","01010","10010","11111","00010","00010"],
  "5":["11111","10000","10000","11110","00001","00001","11110"],
  "6":["01110","10000","10000","11110","10001","10001","01110"],
  "7":["11111","00001","00010","00100","01000","01000","01000"],
  "8":["01110","10001","10001","01110","10001","10001","01110"],
  "9":["01110","10001","10001","01111","00001","00001","01110"],
  "-":["00000","00000","00000","11111","00000","00000","00000"],
  "/":["00001","00010","00010","00100","01000","01000","10000"],
  ":":["00000","00100","00100","00000","00100","00100","00000"],
  ".":["00000","00000","00000","00000","00000","00100","00100"],
  "(":["00010","00100","01000","01000","01000","00100","00010"],
  ")":["01000","00100","00010","00010","00010","00100","01000"],
  "|":["00100","00100","00100","00100","00100","00100","00100"],
  "=":["00000","11111","00000","11111","00000","00000","00000"],
  "?":["01110","10001","00001","00010","00100","00000","00100"]
};

function bitmapText(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function atlasStringWidth(value, atlas) {
  let width = 0;
  for(const character of bitmapText(value)){
    let index = atlas.characters.indexOf(character);
    if(index < 0) index = atlas.characters.indexOf("?");
    width += atlas.advances[index];
  }
  return width;
}

class RasterCanvas {
  constructor(width, height, background) {
    this.width = width;
    this.height = height;
    this.pixels = Buffer.alloc(width * height * 4);
    this.rectangle(0, 0, width, height, background);
  }

  rectangle(x, y, width, height, color) {
    const left = Math.max(0, Math.floor(x));
    const top = Math.max(0, Math.floor(y));
    const right = Math.min(this.width, Math.ceil(x + width));
    const bottom = Math.min(this.height, Math.ceil(y + height));
    for(let row = top; row < bottom; row += 1){
      let offset = (row * this.width + left) * 4;
      for(let column = left; column < right; column += 1){
        this.pixels[offset] = color[0];
        this.pixels[offset + 1] = color[1];
        this.pixels[offset + 2] = color[2];
        this.pixels[offset + 3] = color.length > 3 ? color[3] : 255;
        offset += 4;
      }
    }
  }

  outline(x, y, width, height, thickness, color) {
    this.rectangle(x, y, width, thickness, color);
    this.rectangle(x, y + height - thickness, width, thickness, color);
    this.rectangle(x, y, thickness, height, color);
    this.rectangle(x + width - thickness, y, thickness, height, color);
  }

  circle(centerX, centerY, radius, color) {
    const top = Math.max(0, Math.floor(centerY - radius));
    const bottom = Math.min(this.height, Math.ceil(centerY + radius));
    const radiusSquared = radius * radius;
    for(let y = top; y < bottom; y += 1){
      const halfWidth = Math.sqrt(Math.max(0, radiusSquared - (y + 0.5 - centerY) ** 2));
      this.rectangle(centerX - halfWidth, y, halfWidth * 2, 1, color);
    }
  }

  /* Poser une image decodee, pixel pour pixel, en respectant sa transparence.
     Aucun redimensionnement : les vignettes sont publiees a la taille exacte
     ou la carte les dessine, et un plus proche voisin creneleraient des
     icones detourees. Ce qui depasse la surface est simplement coupe. */
  drawImage(image, x, y) {
    if(!image || !image.pixels) return;
    const gauche = Math.round(x);
    const haut = Math.round(y);
    for(let ligne = 0; ligne < image.height; ligne += 1){
      const cibleY = haut + ligne;
      if(cibleY < 0 || cibleY >= this.height) continue;
      for(let colonne = 0; colonne < image.width; colonne += 1){
        const cibleX = gauche + colonne;
        if(cibleX < 0 || cibleX >= this.width) continue;
        const source = (ligne * image.width + colonne) * 4;
        const alpha = image.pixels[source + 3];
        if(!alpha) continue;
        const cible = (cibleY * this.width + cibleX) * 4;
        const ratio = alpha / 255;
        for(let canal = 0; canal < 3; canal += 1){
          this.pixels[cible + canal] = Math.round(
            image.pixels[source + canal] * ratio
            + this.pixels[cible + canal] * (1 - ratio)
          );
        }
        this.pixels[cible + 3] = 255;
      }
    }
  }

  textWidth(value, scale) {
    const length = bitmapText(value).length;
    return length ? length * 6 * scale - scale : 0;
  }

  text(x, y, value, scale, color) {
    let cursor = Math.round(x);
    for(const character of bitmapText(value)){
      const glyph = FONT_5X7[character] || FONT_5X7["?"];
      glyph.forEach((row, rowIndex) => {
        for(let column = 0; column < 5; column += 1){
          if(row[column] === "1"){
            this.rectangle(
              cursor + column * scale,
              y + rowIndex * scale,
              scale,
              scale,
              color
            );
          }
        }
      });
      cursor += 6 * scale;
    }
  }

  centeredText(center, y, value, scale, color) {
    this.text(center - this.textWidth(value, scale) / 2, y, value, scale, color);
  }

  atlasTextWidth(value, atlas) {
    return atlasStringWidth(value, atlas);
  }

  atlasText(x, y, value, atlas, color) {
    let cursor = Math.round(x);
    const atlasWidth = atlas.cellWidth * atlas.characters.length;
    for(const character of bitmapText(value)){
      let characterIndex = atlas.characters.indexOf(character);
      if(characterIndex < 0) characterIndex = atlas.characters.indexOf("?");
      const sourceLeft = characterIndex * atlas.cellWidth;
      for(let row = 0; row < atlas.cellHeight; row += 1){
        const targetY = Math.round(y) + row;
        if(targetY < 0 || targetY >= this.height) continue;
        for(let column = 0; column < atlas.cellWidth; column += 1){
          const targetX = cursor + column - atlas.inset;
          if(targetX < 0 || targetX >= this.width) continue;
          const alpha = atlas.alpha[row * atlasWidth + sourceLeft + column];
          if(!alpha) continue;
          const offset = (targetY * this.width + targetX) * 4;
          const ratio = alpha / 255;
          this.pixels[offset] = Math.round(color[0] * ratio + this.pixels[offset] * (1 - ratio));
          this.pixels[offset + 1] = Math.round(color[1] * ratio + this.pixels[offset + 1] * (1 - ratio));
          this.pixels[offset + 2] = Math.round(color[2] * ratio + this.pixels[offset + 2] * (1 - ratio));
          this.pixels[offset + 3] = 255;
        }
      }
      cursor += atlas.advances[characterIndex];
    }
  }

  centeredAtlasText(center, y, value, atlas, color) {
    this.atlasText(center - this.atlasTextWidth(value, atlas) / 2, y, value, atlas, color);
  }
}

let availabilityFontsPromise;
async function availabilityFonts() {
  if(!availabilityFontsPromise){
    availabilityFontsPromise = (async () => {
      const source = globalThis.NOVA_AVAILABILITY_FONT;
      if(!source) throw new Error("Polices NOVA indisponibles pour l'aperçu PNG");
      const decode = async encoded => {
        if(typeof DecompressionStream !== "function"){
          throw new Error("Décompression des polices indisponible dans ce runtime");
        }
        const compressed = Buffer.from(encoded.data, "base64");
        const stream = new Blob([compressed]).stream()
          .pipeThrough(new DecompressionStream("deflate"));
        return {
          characters:source.characters,
          cellWidth:encoded.cellWidth,
          cellHeight:encoded.cellHeight,
          inset:encoded.inset,
          advances:encoded.advances,
          alpha:new Uint8Array(await new Response(stream).arrayBuffer())
        };
      };
      const [display, brand, body] = await Promise.all([
        decode(source.display), decode(source.brand), decode(source.body)
      ]);
      return { display, brand, body };
    })();
  }
  return availabilityFontsPromise;
}

function mixedColor(from, to, ratio) {
  return from.map((value, index) => Math.round(value + (to[index] - value) * ratio));
}

let crcTable;
function crc32(bytes) {
  if(!crcTable){
    crcTable = new Uint32Array(256);
    for(let value = 0; value < 256; value += 1){
      let crc = value;
      for(let bit = 0; bit < 8; bit += 1){
        crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
      }
      crcTable[value] = crc >>> 0;
    }
  }
  let crc = 0xffffffff;
  for(const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngUint32(value) {
  const bytes = Buffer.alloc(4);
  bytes[0] = (value >>> 24) & 0xff;
  bytes[1] = (value >>> 16) & 0xff;
  bytes[2] = (value >>> 8) & 0xff;
  bytes[3] = value & 0xff;
  return bytes;
}

function pngChunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const content = Buffer.from(data || []);
  return Buffer.concat([
    pngUint32(content.length),
    name,
    content,
    pngUint32(crc32(Buffer.concat([name, content])))
  ]);
}

async function deflateBytes(bytes) {
  if(typeof CompressionStream !== "function"){
    throw new Error("Compression PNG indisponible dans ce runtime");
  }
  const compressed = new Blob([bytes])
    .stream()
    .pipeThrough(new CompressionStream("deflate"));
  return Buffer.from(await new Response(compressed).arrayBuffer());
}

async function encodePng(canvas) {
  const stride = canvas.width * 4;
  const raw = Buffer.alloc((stride + 1) * canvas.height);
  for(let row = 0; row < canvas.height; row += 1){
    const target = row * (stride + 1);
    raw[target] = 0;
    canvas.pixels.copy(raw, target + 1, row * stride, (row + 1) * stride);
  }
  const header = Buffer.alloc(13);
  pngUint32(canvas.width).copy(header, 0);
  pngUint32(canvas.height).copy(header, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", await deflateBytes(raw)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

async function generateAvailabilityPreviewPng(report) {
  const width = 1600;
  const height = 1000;
  const fonts = await availabilityFonts();
  const colors = {
    background:[12, 9, 18, 255],
    header:[22, 14, 31, 255],
    panel:[27, 20, 36, 255],
    panelLight:[39, 29, 50, 255],
    border:[91, 70, 101, 255],
    gold:[239, 190, 67, 255],
    goldDark:[145, 91, 29, 255],
    parchment:[248, 241, 222, 255],
    muted:[184, 169, 191, 255],
    heatLow:[82, 47, 105, 255],
    heatHigh:[205, 128, 35, 255]
  };
  const canvas = new RasterCanvas(width, height, colors.background);

  canvas.rectangle(0, 0, width, 202, colors.header);
  canvas.rectangle(0, 0, width, 8, colors.gold);
  canvas.rectangle(0, 198, width, 2, colors.goldDark);

  /* Emblème et typographies reprennent la direction artistique de NOVA :
     violet obsidienne, filets or et titres Cinzel. */
  canvas.circle(72, 72, 43, colors.gold);
  canvas.circle(72, 72, 38, colors.header);
  canvas.circle(72, 72, 31, colors.panelLight);
  canvas.centeredAtlasText(72, 41, "7", fonts.display, colors.gold);
  canvas.atlasText(130, 29, "CONFRERIE 7DS", fonts.brand, colors.gold);
  canvas.atlasText(132, 68, "TEAM BUILDER - BOSS DE GUILDE", fonts.body, colors.muted);

  canvas.atlasText(48, 112, "PLANNING HEBDOMADAIRE", fonts.display, colors.parchment);
  canvas.centeredAtlasText(1280, 35, report.label + " - PARIS", fonts.body, colors.parchment);
  const declared = report.declaredCount + " / " + report.members.length
    + " MEMBRES - CRENEAUX RENSEIGNES";
  canvas.centeredAtlasText(1280, 78, declared, fonts.body, colors.muted);

  const bestText = report.best.length
    ? "MEILLEURS CRENEAUX : " + report.best.map(slot =>
      slotLabel(slot.index) + " (" + slot.count + ")"
    ).join(" | ")
    : "AUCUN CRENEAU DISPONIBLE DECLARE";
  canvas.rectangle(42, 218, width - 84, 48, colors.panel);
  canvas.outline(42, 218, width - 84, 48, 1, colors.goldDark);
  canvas.atlasText(60, 222, bestText, fonts.body, colors.parchment);

  const left = 42;
  const top = 282;
  const timeWidth = 100;
  const gridWidth = width - left * 2;
  const dayWidth = (gridWidth - timeWidth) / 7;
  const headerHeight = 46;
  const rowHeight = 26;

  canvas.rectangle(left, top, timeWidth, headerHeight, colors.panelLight);
  canvas.centeredAtlasText(left + timeWidth / 2, top + 3, "HEURE", fonts.body, colors.parchment);
  for(let day = 0; day < 7; day += 1){
    const date = dayDate(report.weekStart, day);
    const label = SHORT_DAYS[day] + " " + String(date.getUTCDate()).padStart(2, "0")
      + "/" + String(date.getUTCMonth() + 1).padStart(2, "0");
    const x = left + timeWidth + day * dayWidth;
    canvas.rectangle(x + 1, top, dayWidth - 2, headerHeight, colors.panelLight);
    canvas.centeredAtlasText(x + dayWidth / 2, top + 3, label, fonts.body, colors.parchment);
  }

  for(let hour = 0; hour < 24; hour += 1){
    const y = top + headerHeight + hour * rowHeight;
    canvas.rectangle(left, y + 1, timeWidth, rowHeight - 2,
      hour % 2 ? colors.panel : colors.panelLight);
    canvas.centeredAtlasText(left + timeWidth / 2, y - 3, hourLabel(hour), fonts.body, colors.muted);
    for(let day = 0; day < 7; day += 1){
      const count = report.counts[day * 24 + hour];
      const ratio = report.max ? count / report.max : 0;
      const fill = count
        ? mixedColor(colors.heatLow, colors.heatHigh, ratio)
        : (hour % 2 ? colors.panel : colors.panelLight);
      const x = left + timeWidth + day * dayWidth;
      canvas.rectangle(x + 1, y + 1, dayWidth - 2, rowHeight - 2, fill);
      canvas.centeredAtlasText(
        x + dayWidth / 2,
        y - 3,
        count ? String(count) : "-",
        fonts.body,
        count ? colors.parchment : colors.muted
      );
    }
  }

  canvas.outline(left, top, gridWidth, headerHeight + 24 * rowHeight, 2, colors.goldDark);
  canvas.rectangle(42, 964, width - 84, 1, colors.border);
  canvas.atlasText(48, 963,
    "CHAQUE NOMBRE INDIQUE LES MEMBRES DISPONIBLES PENDANT CETTE HEURE",
    fonts.body, colors.muted);
  return await encodePng(canvas);
}

function packedDetailLines(member, font, maximumWidth) {
  const entries = [];
  for(let day = 0; day < 7; day += 1){
    const intervals = memberDayIntervals(member.mask, day);
    if(!intervals.length) continue;
    entries.push(SHORT_DAYS[day] + " : " + intervals.map(intervalLabel).join(" ET "));
  }
  if(!entries.length){
    return [member.declared ? "AUCUN CRENEAU SELECTIONNE" : "DISPONIBILITES NON RENSEIGNEES"];
  }

  const lines = [];
  let current = "";
  entries.forEach(entry => {
    const candidate = current ? current + "  /  " + entry : entry;
    if(current && atlasStringWidth(candidate, font) > maximumWidth){
      lines.push(current);
      current = entry;
    }else{
      current = candidate;
    }
  });
  if(current) lines.push(current);
  return lines;
}

async function generateAvailabilityDetailsPng(report) {
  const width = 1600;
  const fonts = await availabilityFonts();
  const colors = {
    background:[12, 9, 18, 255],
    header:[22, 14, 31, 255],
    panel:[27, 20, 36, 255],
    panelLight:[39, 29, 50, 255],
    border:[91, 70, 101, 255],
    gold:[239, 190, 67, 255],
    goldDark:[145, 91, 29, 255],
    parchment:[248, 241, 222, 255],
    muted:[184, 169, 191, 255]
  };
  const columnWidth = 738;
  const columnLeft = [42, 820];
  const maximumLineWidth = columnWidth - 36;
  const cards = report.members.map(member => {
    const lines = packedDetailLines(member, fonts.body, maximumLineWidth);
    return { member, lines, height:68 + lines.length * 34 };
  });
  const split = Math.ceil(cards.length / 2);
  const columns = [cards.slice(0, split), cards.slice(split)];
  const columnHeight = column => column.reduce((total, card) => total + card.height + 12, 0);
  const height = Math.max(680, 230 + Math.max(...columns.map(columnHeight), 0) + 42);
  const canvas = new RasterCanvas(width, height, colors.background);

  canvas.rectangle(0, 0, width, 202, colors.header);
  canvas.rectangle(0, 0, width, 8, colors.gold);
  canvas.rectangle(0, 198, width, 2, colors.goldDark);
  canvas.circle(72, 72, 43, colors.gold);
  canvas.circle(72, 72, 38, colors.header);
  canvas.circle(72, 72, 31, colors.panelLight);
  canvas.centeredAtlasText(72, 41, "7", fonts.display, colors.gold);
  canvas.atlasText(130, 29, "CONFRERIE 7DS", fonts.brand, colors.gold);
  canvas.atlasText(132, 68, "TEAM BUILDER - BOSS DE GUILDE", fonts.body, colors.muted);
  canvas.atlasText(48, 112, "CRENEAUX PAR MEMBRE", fonts.display, colors.parchment);
  canvas.centeredAtlasText(1280, 35, report.label + " - PARIS", fonts.body, colors.parchment);
  canvas.centeredAtlasText(
    1280,
    78,
    report.declaredCount + " / " + report.members.length + " MEMBRES - CRENEAUX RENSEIGNES",
    fonts.body,
    colors.muted
  );

  if(!cards.length){
    canvas.rectangle(42, 230, width - 84, 90, colors.panel);
    canvas.outline(42, 230, width - 84, 90, 1, colors.goldDark);
    canvas.atlasText(68, 251, "AUCUN MEMBRE ENREGISTRE DANS LA CONFRERIE", fonts.body,
      colors.parchment);
  }else{
    columns.forEach((column, columnIndex) => {
      let y = 218;
      column.forEach((card, cardIndex) => {
        const x = columnLeft[columnIndex];
        const fill = cardIndex % 2 ? colors.panel : colors.panelLight;
        canvas.rectangle(x, y, columnWidth, card.height, fill);
        canvas.outline(x, y, columnWidth, card.height, 1, colors.goldDark);
        canvas.atlasText(
          x + 18,
          y + 10,
          card.member.pseudo + " - " + card.member.hours + " H DISPONIBLES",
          fonts.brand,
          colors.gold
        );
        card.lines.forEach((line, lineIndex) => {
          canvas.atlasText(
            x + 18,
            y + 54 + lineIndex * 34,
            line,
            fonts.body,
            line.includes("NON RENSEIGNEES") ? colors.muted : colors.parchment
          );
        });
        y += card.height + 12;
      });
    });
  }

  canvas.rectangle(42, height - 22, width - 84, 1, colors.border);
  return await encodePng(canvas);
}

async function generateAvailabilityTablePng(report) {
  return await generateAvailabilityPreviewPng(report);
}

/* La surface de dessin, les polices et l'encodeur sortent pour la carte de
   /build : elle partage la charte du planning, il n'y a aucune raison d'en
   ecrire un second exemplaire. Ce qui reste prive, c'est la MISE EN PAGE du
   planning — chaque commande dessine la sienne. */
const availabilityPdfApi = {
  RasterCanvas,
  encodePng,
  availabilityFonts,
  atlasStringWidth,
  bitmapText,
  currentAvailabilityWeekStart,
  weekLabel,
  normalizedMask,
  buildAvailabilityReport,
  memberDayIntervals,
  generateAvailabilityPdf,
  generateAvailabilityPreviewPng,
  generateAvailabilityTablePng,
  generateAvailabilityDetailsPng
};

/* `.js` est accepté par le paquetage Supabase, contrairement à `.cjs`. Cette
   double exposition garde une source unique : require() côté Node et variable
   globale après import dynamique côté Deno. */
if(typeof module !== "undefined" && module.exports){
  module.exports = availabilityPdfApi;
}
globalThis.NOVA_AVAILABILITY_PDF = availabilityPdfApi;
