"use strict";

/* Enveloppe Node de la logique de rappel partagée avec la commande `/run` de
   l'Edge Function. Le code vit dans `supabase/functions/_shared/` pour que le
   cron du dimanche et la commande à la demande produisent exactement le même
   message. */
module.exports = require("../supabase/functions/_shared/boss-reminder.js");
