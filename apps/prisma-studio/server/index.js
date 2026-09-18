// BFF de Prisma Studio : le seul composant qui parle à PostgreSQL.
//
// Le composant <Studio /> ne sait pas ouvrir une connexion : il construit du SQL et
// le confie à un « executor » qui poste sur cet endpoint. La chaîne de connexion
// reste donc côté serveur, et le navigateur ne reçoit jamais le mot de passe de la
// base — c'est tout l'intérêt du montage décrit par la documentation d'embarquement.
//
// Ce même processus sert aussi le bundle construit par Vite : une seule origine, donc
// pas de CORS à ouvrir, et un seul conteneur à faire vivre dans la stack.

import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import postgres from "postgres";
import { createPostgresJSExecutor } from "@prisma/studio-core/data/postgresjs";
import { serializeError } from "@prisma/studio-core/data/bff";

const RACINE = dirname(dirname(fileURLToPath(import.meta.url)));
const STATIQUE = join(RACINE, "dist");

const PORT = Number(process.env.PRISMA_STUDIO_PORT || 5555);
const HOTE = process.env.PRISMA_STUDIO_HOST || "0.0.0.0";

// Nombre de connexions ouvertes vers Postgres. Studio est une console mono-utilisateur :
// une poignée suffit, et la stack locale n'a pas à supporter un pool de serveur web.
const POOL_MAX = Number(process.env.PRISMA_STUDIO_POOL_MAX || 5);

// Une requête lancée depuis l'éditeur SQL peut être lourde ; au-delà, mieux vaut une
// erreur lisible dans l'interface qu'un onglet figé.
const DELAI_REQUETE_S = Number(process.env.PRISMA_STUDIO_STATEMENT_TIMEOUT || 30);

/**
 * Construit l'URL de connexion. DATABASE_URL a la priorité : elle permet de pointer
 * Studio vers une autre base que celle de la stack sans toucher au reste. Sinon on
 * recompose l'URL depuis les variables POSTGRES_* que docker-compose transmet déjà
 * au portail — une seule source de vérité, le fichier .env.
 */
function urlBase() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const utilisateur = process.env.POSTGRES_USER;
  const motDePasse = process.env.POSTGRES_PASSWORD;
  const base = process.env.POSTGRES_DB;
  const hote = process.env.POSTGRES_HOST || "postgres";
  const port = process.env.POSTGRES_INTERNAL_PORT || "5432";

  if (!utilisateur || !motDePasse || !base) {
    throw new Error(
      "connexion introuvable : renseignez DATABASE_URL, ou POSTGRES_USER, " +
        "POSTGRES_PASSWORD et POSTGRES_DB dans le fichier .env",
    );
  }

  // encodeURIComponent, parce qu'un mot de passe contenant @ ou / casserait l'URL.
  return (
    "postgresql://" +
    encodeURIComponent(utilisateur) +
    ":" +
    encodeURIComponent(motDePasse) +
    "@" +
    hote +
    ":" +
    port +
    "/" +
    encodeURIComponent(base)
  );
}

const sql = postgres(urlBase(), {
  max: POOL_MAX,
  // Ces deux réglages sont des paramètres de session Postgres, pas des options de
  // postgres.js : ils passent donc par connection, qui les envoie au moment du
  // handshake. application_name rend les sessions de Studio reconnaissables dans
  // pg_stat_activity, ce qui aide à savoir qui tient une requête longue.
  connection: {
    application_name: "prisma-studio",
    statement_timeout: String(DELAI_REQUETE_S * 1000),
  },
  // Pas de conversion des int8 : postgres.js les laisse en chaîne, et c'est
  // exactement ce que Studio attend — au-delà de 2^53, un Number perdrait des
  // chiffres, y compris sur le compteur de lignes qu'il ajoute à chaque select.
  onnotice: () => {},
});

const executor = createPostgresJSExecutor(sql);

const app = express();
// Les requêtes de Studio transportent des lignes entières : la limite par défaut
// d'express (100 ko) serait atteinte dès qu'une cellule contient un JSON un peu gros.
app.use(express.json({ limit: "16mb" }));

/**
 * Point d'entrée unique du contrat BFF. Studio poste ici toutes ses procédures ; la
 * réponse est toujours un tableau [erreur, résultat], jamais une exception HTTP :
 * l'interface sait afficher une erreur sérialisée, pas un 500 vide.
 */
app.post("/studio", async (requete, reponse) => {
  const charge = requete.body;
  const procedure = charge?.procedure ?? "query";

  try {
    switch (procedure) {
      case "query": {
        const [erreur, resultat] = await executor.execute(charge.query, {
          schema: charge.schema,
        });
        return reponse.json([erreur ? serializeError(erreur) : null, resultat]);
      }

      // Deux requêtes ordonnées : la seconde n'est lancée que si la première passe.
      // Prisma Studio s'en sert pour les écritures qui doivent relire la ligne écrite.
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

      // Tout ou rien : c'est ce qui rend atomique l'enregistrement de plusieurs lignes
      // modifiées d'un coup dans la grille. L'ordre des résultats suit celui des requêtes.
      case "transaction": {
        const [erreur, resultats] = await executor.executeTransaction(charge.queries);
        return reponse.json([erreur ? serializeError(erreur) : null, resultats]);
      }

      // EXPLAIN dans une transaction annulée : l'éditeur SQL souligne les erreurs sans
      // que la requête soit réellement exécutée.
      case "sql-lint": {
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
          .json([serializeError(new Error("procédure non prise en charge : " + procedure))]);
    }
  } catch (erreur) {
    return reponse.json([serializeError(erreur)]);
  }
});

/**
 * Sonde du portail et de docker compose. Elle interroge réellement Postgres : un
 * conteneur qui répond alors que la base est tombée ne serait pas une bonne nouvelle.
 */
app.get("/healthz", async (_requete, reponse) => {
  try {
    await sql`select 1`;
    return reponse.json({ statut: "ok" });
  } catch (erreur) {
    return reponse.status(503).json({ statut: "ko", message: String(erreur?.message ?? erreur) });
  }
});

app.use(
  express.static(STATIQUE, {
    // Les noms de fichiers d'/assets portent une empreinte : leur contenu ne change
    // jamais sous un même nom, ils peuvent donc être gardés indéfiniment.
    setHeaders: (reponse, chemin) => {
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

const serveur = createServer(app);

serveur.listen(PORT, HOTE, () => {
  console.log(`prisma-studio: à l'écoute sur http://${HOTE}:${PORT}`);
});

// Sans cela, docker compose stop attend dix secondes puis tue le processus, et les
// connexions Postgres restent ouvertes côté serveur jusqu'à leur expiration.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    console.log(`prisma-studio: ${signal} reçu, fermeture`);
    serveur.close(() => {
      sql.end({ timeout: 5 }).finally(() => process.exit(0));
    });
  });
}
