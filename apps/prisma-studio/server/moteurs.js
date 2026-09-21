// Ouverture des connexions, un moteur à la fois.
//
// Chaque moteur a son pilote et son exécuteur, mais tous rendent la même chose : un
// objet `{ executor, fermer }`. Le serveur n'a donc pas à savoir à quel moteur il
// parle — c'est ce qui permet au contrat BFF de rester unique pour les trois.
//
// Les connexions sont mises en cache : les rouvrir à chaque requête coûterait un
// aller-retour réseau par cellule affichée, et Postgres verrait défiler des sessions
// éphémères par centaines.

import { existsSync } from "node:fs";

import postgres from "postgres";
import mysql from "mysql2/promise";
import { createPostgresJSExecutor } from "@prisma/studio-core/data/postgresjs";
import { createMySQL2Executor } from "@prisma/studio-core/data/mysql2";
import { createNodeSQLiteExecutor } from "@prisma/studio-core/data/node-sqlite";

const POOL_MAX = Number(process.env.PRISMA_STUDIO_POOL_MAX || 5);

// Une requête lancée depuis l'éditeur SQL peut être lourde ; au-delà, mieux vaut une
// erreur lisible dans l'interface qu'un onglet qui ne rend jamais la main.
const DELAI_S = Number(process.env.PRISMA_STUDIO_STATEMENT_TIMEOUT || 30);

function ouvrirPostgres(connexion) {
  const sql = postgres(connexion.url, {
    max: POOL_MAX,
    // Paramètres de session Postgres, pas options de postgres.js : ils passent donc
    // par `connection`, qui les transmet au moment du handshake. application_name
    // rend ces sessions reconnaissables dans pg_stat_activity.
    connection: {
      application_name: "prisma-studio",
      statement_timeout: String(DELAI_S * 1000),
    },
    // Pas de conversion des int8 : postgres.js les laisse en chaîne, ce qu'attend
    // Studio. En Number, un identifiant au-delà de 2^53 perdrait des chiffres.
    onnotice: () => {},
  });

  return {
    executor: createPostgresJSExecutor(sql),
    fermer: () => sql.end({ timeout: 5 }),
  };
}

function ouvrirMysql(connexion) {
  const pool = mysql.createPool({
    uri: connexion.url,
    connectionLimit: POOL_MAX,
    waitForConnections: true,
    // Studio attend des chaînes pour les grands entiers, comme côté Postgres :
    // sans ces deux lignes, mysql2 rend des BigInt que JSON.stringify refuse de
    // sérialiser — l'erreur tomberait au moment d'afficher la ligne.
    supportBigNumbers: true,
    bigNumberStrings: true,
    // Les dates restent telles que la base les donne, sans passage par l'objet Date
    // du serveur, qui y appliquerait son propre fuseau.
    dateStrings: true,
    connectAttributes: { program_name: "prisma-studio" },
  });

  return {
    executor: createMySQL2Executor(pool),
    fermer: () => pool.end(),
  };
}

async function ouvrirSqlite(connexion) {
  // SQLite crée le fichier quand il manque. Sur une console d'exploration, c'est un
  // piège : une faute de frappe dans le chemin ouvrirait une base vide, et personne
  // ne comprendrait pourquoi ses tables ont disparu. On exige donc un fichier
  // existant — créer une base n'est pas le rôle de cet écran.
  if (!existsSync(connexion.fichier)) {
    throw new Error(
      "Fichier introuvable : " +
        connexion.fichier +
        " (chemin vu par le conteneur, pas par l'hôte)",
    );
  }

  // Import différé : node:sqlite émet un avertissement « expérimental » au premier
  // chargement, inutile d'y exposer les stacks qui n'ouvrent jamais de SQLite.
  const { DatabaseSync } = await import("node:sqlite");
  const base = new DatabaseSync(connexion.fichier);
  return {
    executor: createNodeSQLiteExecutor(base),
    fermer: async () => base.close(),
  };
}

async function ouvrir(connexion) {
  switch (connexion.moteur) {
    case "postgres":
      return ouvrirPostgres(connexion);
    case "mysql":
      return ouvrirMysql(connexion);
    case "sqlite":
      return ouvrirSqlite(connexion);
    default:
      throw new Error("Moteur inconnu : " + connexion.moteur);
  }
}

export class Connexions {
  constructor() {
    /** @type {Map<string, Promise<{executor: object, fermer: Function}>>} */
    this.ouvertes = new Map();
  }

  /**
   * La promesse est mise en cache, pas son résultat : deux requêtes simultanées sur
   * une connexion encore froide attendent la même ouverture au lieu d'en lancer deux.
   */
  executor(connexion) {
    let promesse = this.ouvertes.get(connexion.id);
    if (!promesse) {
      promesse = ouvrir(connexion).catch((erreur) => {
        // Une ouverture ratée ne doit pas rester en cache, sinon la connexion
        // resterait cassée jusqu'au redémarrage même une fois la base revenue.
        this.ouvertes.delete(connexion.id);
        throw erreur;
      });
      this.ouvertes.set(connexion.id, promesse);
    }
    return promesse.then((ouverte) => ouverte.executor);
  }

  /** Appelé à la suppression d'une connexion, pour ne pas fuir un pool. */
  async fermer(id) {
    const promesse = this.ouvertes.get(id);
    if (!promesse) return;
    this.ouvertes.delete(id);
    try {
      const ouverte = await promesse;
      await ouverte.fermer();
    } catch {
      // La connexion était déjà en erreur : il n'y a rien à fermer proprement.
    }
  }

  async toutFermer() {
    await Promise.allSettled([...this.ouvertes.keys()].map((id) => this.fermer(id)));
  }
}

/**
 * Ouvre, interroge, referme. Sert au bouton « Tester » du formulaire : une connexion
 * pas encore enregistrée n'a rien à faire dans le cache.
 */
export async function tester(connexion) {
  const ouverte = await ouvrir(connexion);
  try {
    // « select 1 » est valide sur les trois moteurs : la sonde n'a pas à savoir
    // auquel elle parle.
    const [erreur] = await ouverte.executor.execute({
      sql: "select 1 as ok",
      parameters: [],
    });
    if (erreur) throw erreur;
  } finally {
    await ouverte.fermer().catch(() => {});
  }
}
