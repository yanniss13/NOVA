"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const workflowPath = path.join(ROOT, ".github", "workflows", "pages.yml");
assert.ok(fs.existsSync(workflowPath), "workflow Pages manquant");

const yaml = fs.readFileSync(workflowPath, "utf8");
const required = [
  /* Les tests tournent sur TOUTE branche poussee : une regression trouvee sur
     une branche coute une minute, la meme trouvee apres fusion coute une
     enquete. Le garde-fou du deploiement est verifie plus bas. */
  /push:\s*\n\s*branches:\s*\['\*\*'\]/,
  /pull_request:\s*\n\s*branches:\s*\[main\]/,
  /workflow_dispatch:/,
  /actions\/checkout@v6/,
  /actions\/setup-node@v6/,
  /node-version:\s*["']?24["']?/,
  /actions\/setup-python@v6/,
  /python-version:\s*["']?3\.13["']?/,
  /pip install -r requirements-dev\.txt/,
  /npm ci/,
  /npx playwright install chromium/,
  // Le cache du navigateur est ce qui tient la duree du job : sans lui,
  // l'installation a deja pris de 22 s a 1806 s selon le debit du CDN.
  /path:\s*~\/\.cache\/ms-playwright/,
  /npm test/,
  /git archive HEAD/,
  /__BUILD_VERSION__/,
  /GITHUB_SHA/,
  /actions\/configure-pages@v6/,
  /actions\/upload-pages-artifact@v5/,
  // L'artefact ne doit contenir QUE la copie propre du commit testé.
  /path:\s*_site\s*$/m,
  /actions\/deploy-pages@v5/,
  /pages:\s*write/,
  /id-token:\s*write/,
  /name:\s*github-pages/
];
required.forEach(pattern =>
  assert.match(yaml, pattern, "contrat manquant : " + pattern)
);
/* `--with-deps` declenche un apt-get update qui va chercher les listes de
   paquets Ubuntu a chaque execution : 732 s mesurees le 19 aout, contre 3 s
   pour le cache du navigateur juste avant. L'image ubuntu-latest fournit deja
   les bibliotheques necessaires, et un manque se verrait aussitot au premier
   parcours Playwright. */
assert.ok(
  !/run:.*--with-deps/.test(yaml),
  "with-deps rallonge le job de plusieurs minutes sans rien apporter ici"
);

assert.ok(
  (yaml.match(/needs:\s*test/g) || []).length >= 1,
  "le paquetage doit dépendre des tests"
);
assert.ok(
  (yaml.match(/github\.event_name != 'pull_request'/g) || []).length >= 2,
  "paquetage et déploiement doivent être exclus des pull requests"
);
/* Depuis que le workflow se declenche sur toute branche, c'est CETTE condition
   qui empeche une branche de fonctionnalite de publier le site. */
assert.ok(
  (yaml.match(/github\.ref == 'refs\/heads\/main'/g) || []).length >= 2,
  "paquetage et déploiement doivent rester réservés à main"
);
assert.match(yaml, /deploy:[\s\S]*needs:\s*package/);

/* Chaîne de dépendance vérifiée par job, et pas seulement par comptage :
   package -> test, deploy -> package. Sans cela un `needs:` égaré suffirait. */
const jobs = {};
yaml.split(/\r?\n/).forEach(line => {
  const header = /^ {2}([a-z][\w-]*):\s*$/.exec(line);
  if(header) jobs[header[1]] = [];
  else{
    const current = Object.keys(jobs).pop();
    if(current) jobs[current].push(line);
  }
});
["test", "package", "deploy"].forEach(name =>
  assert.ok(jobs[name], "job manquant : " + name)
);
assert.match(
  jobs.package.join("\n"),
  /needs:\s*test/,
  "le paquetage doit dépendre du job de test"
);
assert.match(
  jobs.deploy.join("\n"),
  /needs:\s*package/,
  "le déploiement doit dépendre du paquetage"
);
assert.doesNotMatch(
  jobs.test.join("\n"),
  /continue-on-error:\s*true|if:\s*always\(\)/,
  "un échec de test ne doit jamais être ignoré"
);

console.log("PASS workflow Pages : tests obligatoires avant déploiement");
