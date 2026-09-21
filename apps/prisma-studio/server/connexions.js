// Registre des connexions proposées dans le sélecteur.
//
// Deux origines, volontairement distinctes :
//
//   « stack »   — déduites du .env au démarrage (PostgreSQL, MariaDB). Elles ne sont
//                 pas modifiables depuis l'interface : leur source de vérité est le
//                 fichier .env, et les éditer ici ne ferait que créer un deuxième
//                 endroit où chercher la bonne valeur.
//   « ajoutée » — saisies dans l'interface et écrites dans un fichier JSON, sur un
//                 volume Docker. Elles survivent donc au redémarrage du conteneur.
//
// Les secrets ne quittent jamais ce module : `pourClient()` en donne une vue sans
// mot de passe, et c'est la seule forme qui part vers le navigateur.

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

const MOTEURS = new Set(["postgres", "mysql", "sqlite"]);

const PORT_PAR_DEFAUT = { postgres: 5432, mysql: 3306 };

/** Emplacement du fichier de connexions ajoutées, sur le volume persistant. */
const FICHIER =
  process.env.PRISMA_STUDIO_CONNEXIONS || "/data/connexions.json";

/**
 * Connexions déduites du .env. Elles n'apparaissent que si les variables
 * correspondantes sont là : une stack sans MariaDB n'affiche pas de carte MariaDB.
 */
function connexionsDeLaStack() {
  const liste = [];

  // DATABASE_URL reste prioritaire, comme avant l'arrivée du sélecteur : elle
  // permet de pointer la carte principale vers une autre base sans rien changer
  // d'autre. Le nom affiché le dit, pour éviter de croire qu'on est sur la base
  // de la stack alors qu'on regarde ailleurs.
  if (process.env.DATABASE_URL) {
    liste.push({
      id: "postgres",
      nom: "PostgreSQL (DATABASE_URL)",
      moteur: "postgres",
      origine: "stack",
      url: process.env.DATABASE_URL,
    });
  } else if (
    process.env.POSTGRES_USER &&
    process.env.POSTGRES_PASSWORD &&
    process.env.POSTGRES_DB
  ) {
    liste.push({
      id: "postgres",
      nom: "PostgreSQL",
      moteur: "postgres",
      origine: "stack",
      url: urlPostgres({
        hote: process.env.POSTGRES_HOST || "postgres",
        port: Number(process.env.POSTGRES_INTERNAL_PORT || 5432),
        base: process.env.POSTGRES_DB,
        utilisateur: process.env.POSTGRES_USER,
        motDePasse: process.env.POSTGRES_PASSWORD,
      }),
    });
  }

  if (
    process.env.MARIADB_USER &&
    process.env.MARIADB_PASSWORD &&
    process.env.MARIADB_DATABASE
  ) {
    liste.push({
      id: "mariadb",
      nom: "MariaDB",
      moteur: "mysql",
      origine: "stack",
      url: urlMysql({
        hote: process.env.MARIADB_HOST || "mariadb",
        port: Number(process.env.MARIADB_INTERNAL_PORT || 3306),
        base: process.env.MARIADB_DATABASE,
        utilisateur: process.env.MARIADB_USER,
        motDePasse: process.env.MARIADB_PASSWORD,
      }),
    });
  }

  return liste;
}

// encodeURIComponent partout : un mot de passe contenant @, / ou : casserait l'URL
// sans cela, et l'erreur qui en résulte ne ressemble en rien à sa cause.
function urlPostgres({ hote, port, base, utilisateur, motDePasse }) {
  return (
    "postgresql://" +
    encodeURIComponent(utilisateur) +
    ":" +
    encodeURIComponent(motDePasse) +
    "@" +
    hote +
    ":" +
    (port || PORT_PAR_DEFAUT.postgres) +
    "/" +
    encodeURIComponent(base)
  );
}

function urlMysql({ hote, port, base, utilisateur, motDePasse }) {
  return (
    "mysql://" +
    encodeURIComponent(utilisateur) +
    ":" +
    encodeURIComponent(motDePasse) +
    "@" +
    hote +
    ":" +
    (port || PORT_PAR_DEFAUT.mysql) +
    "/" +
    encodeURIComponent(base)
  );
}

/**
 * Vérifie et normalise ce qui arrive du formulaire. Retourne la connexion prête à
 * être enregistrée, ou lève une erreur dont le message est destiné à l'utilisateur :
 * c'est lui qui devra corriger le champ fautif.
 */
export function normaliser(brut) {
  const nom = String(brut?.nom ?? "").trim();
  const moteur = String(brut?.moteur ?? "").trim();

  if (!nom) throw new Error("Le nom est obligatoire.");
  if (!MOTEURS.has(moteur)) throw new Error("Moteur inconnu : " + moteur);

  if (moteur === "sqlite") {
    const fichier = String(brut?.fichier ?? "").trim();
    if (!fichier) throw new Error("Le chemin du fichier est obligatoire.");
    return { nom, moteur, fichier };
  }

  // Une URL collée l'emporte sur les champs : c'est ce que l'interface annonce, et
  // c'est le geste le plus courant quand on a déjà la chaîne sous la main.
  const url = String(brut?.url ?? "").trim();
  if (url) {
    let analysee;
    try {
      analysee = new URL(url);
    } catch {
      throw new Error("URL de connexion illisible.");
    }
    const attendus =
      moteur === "postgres"
        ? ["postgresql:", "postgres:"]
        : ["mysql:", "mariadb:"];
    if (!attendus.includes(analysee.protocol)) {
      throw new Error(
        "L'URL commence par « " +
          analysee.protocol +
          " », attendu « " +
          attendus[0] +
          " ».",
      );
    }
    return { nom, moteur, url };
  }

  const hote = String(brut?.hote ?? "").trim();
  const base = String(brut?.base ?? "").trim();
  const utilisateur = String(brut?.utilisateur ?? "").trim();
  const motDePasse = String(brut?.motDePasse ?? "");
  const port = Number(brut?.port) || PORT_PAR_DEFAUT[moteur];

  if (!hote) throw new Error("L'hôte est obligatoire.");
  if (!base) throw new Error("Le nom de la base est obligatoire.");
  if (!utilisateur) throw new Error("L'utilisateur est obligatoire.");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Le port doit être un entier entre 1 et 65535.");
  }

  const champs = { hote, port, base, utilisateur, motDePasse };
  return {
    nom,
    moteur,
    url: moteur === "postgres" ? urlPostgres(champs) : urlMysql(champs),
  };
}

/**
 * Vue destinée au navigateur. Ni mot de passe, ni URL complète : seulement de quoi
 * afficher et choisir. C'est la contrepartie du montage BFF — la chaîne de connexion
 * reste sur le serveur, l'interface n'en connaît que la description.
 */
export function pourClient(connexion) {
  const vue = {
    id: connexion.id,
    nom: connexion.nom,
    moteur: connexion.moteur,
    origine: connexion.origine,
  };

  if (connexion.moteur === "sqlite") {
    vue.detail = connexion.fichier;
    return vue;
  }

  // hôte, port et base sont utiles pour distinguer deux connexions homonymes ;
  // l'utilisateur et le mot de passe n'ont rien à faire là.
  try {
    const u = new URL(connexion.url);
    const base = decodeURIComponent(u.pathname.replace(/^\//, ""));
    vue.detail = u.hostname + (u.port ? ":" + u.port : "") + "/" + base;
  } catch {
    vue.detail = "";
  }
  return vue;
}

export class Registre {
  constructor() {
    this.stack = connexionsDeLaStack();
    this.ajoutees = [];
  }

  /** Relit le fichier du volume. Son absence est normale au premier démarrage. */
  async charger() {
    try {
      const brut = await readFile(FICHIER, "utf8");
      const donnees = JSON.parse(brut);
      if (Array.isArray(donnees?.connexions)) {
        this.ajoutees = donnees.connexions.filter(
          (c) => c && typeof c.id === "string" && MOTEURS.has(c.moteur),
        );
      }
    } catch (erreur) {
      if (erreur?.code !== "ENOENT") {
        // Un fichier illisible ne doit pas empêcher la console de démarrer : les
        // connexions de la stack, elles, restent parfaitement utilisables.
        console.warn(
          "prisma-studio: " + FICHIER + " illisible, connexions ajoutées ignorées —",
          erreur?.message ?? erreur,
        );
      }
    }
    return this;
  }

  /** Écriture atomique : un fichier temporaire, puis un renommage. */
  async enregistrer() {
    await mkdir(dirname(FICHIER), { recursive: true });
    const temporaire = join(
      dirname(FICHIER),
      ".connexions-" + randomUUID() + ".tmp",
    );
    const contenu = JSON.stringify({ connexions: this.ajoutees }, null, 2);
    await writeFile(temporaire, contenu, { encoding: "utf8", mode: 0o600 });
    await rename(temporaire, FICHIER);
  }

  toutes() {
    return [...this.stack, ...this.ajoutees];
  }

  trouver(id) {
    return this.toutes().find((c) => c.id === id) ?? null;
  }

  async ajouter(brut) {
    const normalisee = normaliser(brut);
    const connexion = { id: randomUUID(), origine: "ajoutee", ...normalisee };
    this.ajoutees.push(connexion);
    await this.enregistrer();
    return connexion;
  }

  /**
   * Seules les connexions ajoutées se suppriment. Retirer une connexion de la stack
   * n'aurait aucun effet durable : elle serait reconstruite au prochain démarrage à
   * partir du .env. Mieux vaut le dire que laisser croire à une suppression.
   */
  async supprimer(id) {
    if (this.stack.some((c) => c.id === id)) {
      throw new Error(
        "Cette connexion vient du fichier .env : elle se modifie là-bas, pas ici.",
      );
    }
    const avant = this.ajoutees.length;
    this.ajoutees = this.ajoutees.filter((c) => c.id !== id);
    if (this.ajoutees.length === avant) throw new Error("Connexion inconnue.");
    await this.enregistrer();
  }
}
