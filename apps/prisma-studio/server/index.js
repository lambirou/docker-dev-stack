// BFF de Prisma Studio : le seul composant qui parle aux bases de données.
//
// Le composant <Studio /> ne sait pas ouvrir une connexion : il construit du SQL et
// le confie à un « executor » qui poste sur cet endpoint. Les chaînes de connexion
// restent donc côté serveur, et le navigateur ne reçoit jamais le moindre mot de
// passe — c'est tout l'intérêt du montage décrit par la documentation d'embarquement.
//
// Ce même processus sert aussi le bundle construit par Vite : une seule origine, donc
// pas de CORS à ouvrir, et un seul conteneur à faire vivre dans la stack.

import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import { serializeError } from "@prisma/studio-core/data/bff";

import { Registre, normaliser, pourClient } from "./connexions.js";
import { Connexions, tester } from "./moteurs.js";

const RACINE = dirname(dirname(fileURLToPath(import.meta.url)));
const STATIQUE = join(RACINE, "dist");

const PORT = Number(process.env.PRISMA_STUDIO_PORT || 5555);
const HOTE = process.env.PRISMA_STUDIO_HOST || "0.0.0.0";

const registre = await new Registre().charger();
const connexions = new Connexions();

const app = express();
// Les requêtes de Studio transportent des lignes entières : la limite par défaut
// d'express (100 ko) serait atteinte dès qu'une cellule contient un JSON un peu gros.
app.use(express.json({ limit: "16mb" }));

// --- API du sélecteur de connexions -----------------------------------------

app.get("/api/connexions", (_requete, reponse) => {
  reponse.json({ connexions: registre.toutes().map(pourClient) });
});

/**
 * Éprouve une connexion sans l'enregistrer. C'est ce qui permet au formulaire de dire
 * « hôte introuvable » ou « mot de passe refusé » pendant que l'utilisateur a encore
 * les champs sous les yeux, plutôt qu'après coup depuis l'écran principal.
 */
app.post("/api/connexions/test", async (requete, reponse) => {
  try {
    await tester(normaliser(requete.body));
    reponse.json({ ok: true });
  } catch (erreur) {
    reponse.status(400).json({ ok: false, message: message(erreur) });
  }
});

app.post("/api/connexions", async (requete, reponse) => {
  try {
    // Enregistrer une connexion qui ne répond pas ne rendrait service à personne :
    // elle encombrerait la liste et échouerait à chaque ouverture.
    const candidate = normaliser(requete.body);
    await tester(candidate);
    const creee = await registre.ajouter(candidate);
    reponse.status(201).json({ connexion: pourClient(creee) });
  } catch (erreur) {
    reponse.status(400).json({ ok: false, message: message(erreur) });
  }
});

app.delete("/api/connexions/:id", async (requete, reponse) => {
  try {
    await registre.supprimer(requete.params.id);
    await connexions.fermer(requete.params.id);
    reponse.json({ ok: true });
  } catch (erreur) {
    reponse.status(400).json({ ok: false, message: message(erreur) });
  }
});

// --- Contrat BFF -------------------------------------------------------------

/**
 * Studio transporte l'identifiant de la connexion courante dans `customPayload`,
 * prévu exactement pour ce genre de contexte — c'est ainsi que la documentation
 * suggère de véhiculer un tenant ou un jeton. Le serveur y lit de quoi choisir la
 * bonne base ; le navigateur, lui, ne manipule qu'un identifiant opaque.
 */
function connexionDe(charge) {
  const id = charge?.customPayload?.connexionId;
  if (!id) throw new Error("Aucune connexion sélectionnée.");
  const connexion = registre.trouver(id);
  if (!connexion) throw new Error("Connexion inconnue : " + id);
  return connexion;
}

/**
 * Point d'entrée unique du contrat BFF. La réponse est toujours un tableau
 * [erreur, résultat], jamais une exception HTTP : l'interface sait afficher une
 * erreur sérialisée, pas un 500 vide.
 */
app.post("/studio", async (requete, reponse) => {
  const charge = requete.body;
  const procedure = charge?.procedure ?? "query";

  try {
    const connexion = connexionDe(charge);
    const executor = await connexions.executor(connexion);

    switch (procedure) {
      case "query": {
        const [erreur, resultat] = await executor.execute(charge.query, {
          schema: charge.schema,
        });
        return reponse.json([erreur ? serializeError(erreur) : null, resultat]);
      }

      // Deux requêtes ordonnées, la seconde seulement si la première passe. Les
      // écritures MySQL s'en servent : elles modifient, puis relisent la ligne.
      case "sequence": {
        const [premiere, seconde] = charge.sequence;

        const [erreurPremiere, resultatPremiere] = await executor.execute(premiere);
        if (erreurPremiere) {
          return reponse.json([[serializeError(erreurPremiere)]]);
        }

        const [erreurSeconde, resultatSeconde] = await executor.execute(seconde);
        if (erreurSeconde) {
          return reponse.json([
            [null, resultatPremiere],
            [serializeError(erreurSeconde)],
          ]);
        }

        return reponse.json([
          [null, resultatPremiere],
          [null, resultatSeconde],
        ]);
      }

      // Tout ou rien : c'est ce qui rend atomique l'enregistrement de plusieurs
      // lignes modifiées d'un coup. L'ordre des résultats suit celui des requêtes.
      case "transaction": {
        if (typeof executor.executeTransaction !== "function") {
          return reponse
            .status(501)
            .json([serializeError(new Error("Transactions non gérées par ce moteur."))]);
        }
        const [erreur, resultats] = await executor.executeTransaction(charge.queries);
        return reponse.json([erreur ? serializeError(erreur) : null, resultats]);
      }

      // EXPLAIN dans une transaction annulée : l'éditeur SQL souligne les erreurs
      // sans que la requête soit réellement exécutée.
      case "sql-lint": {
        if (typeof executor.lintSql !== "function") {
          return reponse
            .status(501)
            .json([serializeError(new Error("Analyse SQL non gérée par ce moteur."))]);
        }
        const [erreur, resultat] = await executor.lintSql({
          schema: charge.schema,
          schemaVersion: charge.schemaVersion,
          sql: charge.sql,
        });
        return reponse.json([erreur ? serializeError(erreur) : null, resultat]);
      }

      // Query Insights suppose une source de télémétrie que cette stack n'a pas. Le
      // client est configuré sans, l'onglet « Queries » n'apparaît donc pas : ce cas
      // ne sert qu'à répondre clairement si la procédure arrivait quand même.
      default:
        return reponse
          .status(501)
          .json([
            serializeError(new Error("Procédure non prise en charge : " + procedure)),
          ]);
    }
  } catch (erreur) {
    return reponse.json([serializeError(erreur)]);
  }
});

/**
 * Sonde du portail et de docker compose. Elle interroge réellement la base de la
 * stack quand il y en a une : un conteneur qui répond alors que Postgres est tombé
 * ne serait pas une bonne nouvelle.
 */
app.get("/healthz", async (_requete, reponse) => {
  const principale = registre.trouver("postgres");
  const total = registre.toutes().length;
  if (!principale) return reponse.json({ statut: "ok", connexions: total });

  try {
    const executor = await connexions.executor(principale);
    const [erreur] = await executor.execute({ sql: "select 1", parameters: [] });
    if (erreur) throw erreur;
    return reponse.json({ statut: "ok", connexions: total });
  } catch (erreur) {
    return reponse.status(503).json({ statut: "ko", message: message(erreur) });
  }
});

app.use(
  express.static(STATIQUE, {
    setHeaders: (reponse, chemin) => {
      // Les fichiers d'/assets portent une empreinte dans leur nom : leur contenu ne
      // change jamais sous ce nom, ils peuvent donc être gardés indéfiniment.
      const empreinte = /[\\/]assets[\\/]/.test(chemin);
      reponse.setHeader(
        "Cache-Control",
        empreinte ? "public, max-age=31536000, immutable" : "no-cache",
      );
    },
  }),
);

// Studio garde son état dans l'URL (table courante, tri, filtres) : un rechargement
// tombe donc sur un chemin que le serveur ne connaît pas, et qui doit rendre l'app.
app.get(/.*/, (_requete, reponse) => {
  reponse.sendFile(join(STATIQUE, "index.html"));
});

function message(erreur) {
  return String(erreur?.message ?? erreur);
}

const serveur = createServer(app);

serveur.listen(PORT, HOTE, () => {
  const noms = registre.toutes().map((c) => c.nom);
  console.log(`prisma-studio: à l'écoute sur http://${HOTE}:${PORT}`);
  console.log(
    `prisma-studio: ${noms.length} connexion(s) — ${noms.join(", ") || "aucune"}`,
  );
});

// Sans cela, docker compose stop attend dix secondes puis tue le processus, et les
// connexions ouvertes restent pendantes côté serveur jusqu'à leur expiration.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    console.log(`prisma-studio: ${signal} reçu, fermeture`);
    serveur.close(() => {
      connexions.toutFermer().finally(() => process.exit(0));
    });
  });
}
