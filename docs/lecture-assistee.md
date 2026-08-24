# Lecture assistée des captures (Gemini)

Quand un membre connecté importe une capture d'équipement, elle est lue par un
modèle plutôt que par Tesseract. C'est plus fidèle sur les valeurs qui se jouent
au centième de pourcent — `16.80 %` et `16.81 %` désignent deux enchantements
différents — et ça évite de télécharger les quatre mégaoctets du moteur.

**Tesseract reste entier** pour le mode hors ligne, les visiteurs sans compte,
et tout appel qui échoue.

## Le principe, et pourquoi il tient

Le modèle **transcrit**, il ne déduit rien. Sa sortie a exactement la forme que
produit Tesseract :

```json
{ "nom": …, "niveau": …, "passif": …,
  "stats": [ { "libelle": …, "valeur": …, "section": … } ] }
```

Elle passe ensuite par le même juge que la saisie manuelle : `deduireArme` et
`deduirePiece` parcourent le catalogue et ne retiennent que les configurations
dont les totaux **recalculés** reproduisent ce qui a été lu.

C'est ce qui rend l'ensemble sûr : **une lecture fausse est rejetée, pas écrite
dans le roster**. Le modèle remplace l'œil, jamais le juge.

La distinction la plus lourde de conséquences est celle des sections : une ligne
au-dessus du premier titre est une statistique **native**, une ligne sous un
titre (« Enchanter », « Bonus de gravure ») est un **enchantement**. Les
confondre rend la capture inexploitable, et la consigne y insiste.

## Déployer

La CLI n'est pas installée : préfixer chaque commande par `npx -y supabase@latest`,
comme pour `discord-planning`.

```powershell
npx -y supabase@latest login
npx -y supabase@latest link --project-ref uxouhbgdlolidjmxwgae
npx -y supabase@latest secrets set GEMINI_API_KEY=<la-cle>
npx -y supabase@latest functions deploy lecture-panneau --project-ref uxouhbgdlolidjmxwgae
```

La clé se crée sur **aistudio.google.com**, section *Clés API*. Le palier
gratuit s'applique sans carte bancaire ; sur ce palier, Google se réserve
d'utiliser le contenu envoyé pour améliorer ses modèles.

**Tant que le secret n'est pas posé**, la fonction répond « non configurée » et
le site utilise Tesseract. Rien ne casse.

### Changer de modèle sans toucher au code

```powershell
npx -y supabase@latest secrets set GEMINI_MODEL=gemini-3-flash-preview
```

Par défaut `gemini-2.5-flash`. Les modèles en *preview* changent ou
disparaissent sans préavis : préférer le plus fiable au plus récent.

## Deux contrôles d'accès, et pourquoi il en faut deux

`verify_jwt` vérifie la **signature** du jeton. Il ne suffit pas : la clé
anonyme du projet est publiée dans `index.html` et forme un jeton valablement
signé. La fonction lit donc aussi les revendications et exige
`role === "authenticated"` avec un `sub`. Sans ce second contrôle, n'importe qui
pourrait vider le quota.

Côté navigateur, `lectureAssisteeDisponible` évite l'appel quand il ne peut pas
aboutir — hors ligne, sans compte, sans client Supabase.

## Ce qui a été vérifié

Quatre captures réelles, passées dans la chaîne complète avec le catalogue du
dépôt. Toutes ressortent en candidate **unique** :

| Capture | Particularité | Résultat |
|---|---|---|
| Baguette des ailes de la flamme noire | perle Légendaire, 4 enchantements | élément Foudre déduit seul |
| Épée longue des ailes de la flamme noire | ligne du haut coupée par le défilement | 4 enchantements, palier 5 |
| Hache flamboyante | séparateur de milliers (`3 425`) | 2 enchantements |
| Vêtements formels légers | équipement gravé, **sans « Lv. »** | unique grâce au nom |

Le dernier cas a produit une amélioration : trois armures liées ont des courbes
identiques et sortaient **ambiguës**. Le titre du panneau les sépare — il ne
servait à rien avec Tesseract, qui le lit très mal, doré sur doré.

## Éprouver le prompt sans déployer

Sur **aistudio.google.com**, *Playground* :

1. coller la consigne dans **System instructions** (elle vit dans
   `supabase/functions/lecture-panneau/index.ts`, constante `CONSIGNE`) ;
2. **Temperature à 0** — la fonction l'impose ;
3. **couper Grounding with Google Search** ;
4. déposer la capture et lancer, sans écrire de message.

**Un nouveau chat par image.** Le Playground accumule le contexte : envoyer une
seconde capture dans le même fil fait répondre sur la première. La fonction, elle,
envoie une requête isolée sans historique.

## Modifier la consigne

Elle vit dans le code, pas dans un fichier à part : deux copies finiraient par
diverger, et un essai dans le Playground ne prouverait plus rien sur ce qui
tourne en production. Après modification, refaire les quatre captures ci-dessus.
