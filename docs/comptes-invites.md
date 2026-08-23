# Ouvrir un compte à quelqu'un hors de la confrérie

Le site distingue trois situations : le **visiteur** sans compte, l'**invité**
qui a un compte sans appartenir à la confrérie, et le **membre**. Un compte
fraîchement créé est un invité — il garde son propre roster, son OCR, ses
presets et ses équipes, et ne voit rien de la confrérie.

## Ce qu'un invité voit

| | Invité | Membre |
|---|---|---|
| Créer une équipe, Wiki, Collection, Calculateur | ✅ | ✅ |
| Son roster, son OCR, ses presets, ses équipes | ✅ | ✅ |
| Accueil, Analyse, Équipes de la confrérie | ❌ | ✅ |
| Dispos, Sessions de boss, Recensement | ❌ | ✅ |

Le cloisonnement vit dans les politiques RLS de Supabase, pas dans l'interface :
masquer un onglet est une politesse, refuser une lecture est la barrière.

**La cloison est asymétrique, et c'est voulu.** L'invité ne voit rien de la
confrérie ; la confrérie, elle, lit son roster et sa collection — il apparaît
donc dans les listes déroulantes de membres. C'est ce qui permet de l'aider sur
ses builds.

## 1. Appliquer le schéma

Coller le contenu complet de `supabase/schema.sql` dans **Supabase → SQL
Editor → Run**. Le fichier est idempotent : il se rejoue sans dommage.

À ce collage, et à celui-là seulement, **tous les comptes déjà existants
deviennent membres**. C'est voulu : sans cette promotion, la confrérie entière
se retrouverait invitée chez elle. Les collages suivants ne repromeuvent
personne — le garde `if not exists` du bloc de migration s'en assure.

## 2. Se donner le drapeau d'administrateur — une seule fois

Cette étape ne peut pas vivre dans le schéma : y écrire un identifiant de
compte figerait une donnée d'installation dans un fichier versionné.

Relever son propre identifiant dans **Supabase → Authentication → Users**, puis
dans le SQL Editor :

```sql
update public.profiles set admin = true, membre = true
where id = '<uuid-du-proprietaire>';
```

**Tant que cette ligne n'est pas passée, personne ne peut promouvoir personne**
et l'onglet « Membres » n'apparaît nulle part. C'est la première chose à
vérifier après application, et elle se fait dans la foulée du collage.

Le drapeau `admin` ne se change **que** par ici : un trigger refuse toute
modification venue d'une session du site, y compris celle d'un administrateur.

## 3. Accueillir quelqu'un

La personne crée son compte depuis le site, comme n'importe qui. Elle est
invitée.

Ouvrir l'onglet **Membres**, trouver son pseudo, cliquer sur **Accueillir dans
la confrérie**. Elle doit **recharger la page** : les drapeaux sont lus à
l'ouverture de session, pas à chaque instant.

Le même écran permet de la retirer. Un administrateur ne peut pas se retirer
lui-même — ni depuis l'écran, ni par un appel direct : le SQL le refuse aussi.

## Vérifier que la cloison tient

Depuis un compte invité :

- l'onglet « Accueil » n'apparaît pas, et `#analyse` dans l'URL ne l'ouvre pas ;
- son roster s'affiche et s'enregistre normalement ;
- la page Collection ne propose que son propre pseudo dans la liste des membres.

## Ce qui reste hors périmètre

Confirmation d'email à l'inscription, invitation par code, rôles fins,
suppression de compte depuis l'écran, plusieurs confréries sur une instance.
