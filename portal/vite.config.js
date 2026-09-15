import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const FICHIER_ENV = new URL("../.env", import.meta.url);

// Même filtre que portal/docker-entrypoint.d/40-portal-config.sh : seules les
// variables des services de la stack sont exposées au portail.
const FILTRE = /^(POSTGRES|MARIADB|QDRANT|MEILI|NEO4J|REDIS|MINIO)_[A-Z0-9_]*$/;

function lireEnv() {
  let brut;
  try {
    brut = readFileSync(FICHIER_ENV, "utf8");
  } catch {
    return {};
  }
  const config = {};
  for (const ligne of brut.split(/\r?\n/)) {
    const propre = ligne.trim();
    if (!propre || propre.startsWith("#")) continue;
    const separateur = propre.indexOf("=");
    if (separateur < 1) continue;
    const nom = propre.slice(0, separateur).trim();
    const valeur = propre
      .slice(separateur + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (FILTRE.test(nom) && valeur) config[nom] = valeur;
  }
  return config;
}

// En production, nginx écrit /config.json au démarrage du conteneur. Le serveur de
// développement rend le même service, relu à chaque requête pour suivre le .env.
function configRuntime() {
  return {
    name: "portail-config-runtime",
    configureServer(serveur) {
      serveur.middlewares.use((requete, reponse, suite) => {
        if (!requete.url?.startsWith("/config.json")) return suite();
        reponse.setHeader("Content-Type", "application/json");
        reponse.setHeader("Cache-Control", "no-store");
        reponse.end(JSON.stringify(lireEnv()));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), configRuntime()],
  server: {
    port: 5173,
    host: true,
  },
});
