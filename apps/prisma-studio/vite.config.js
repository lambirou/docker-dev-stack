import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// En développement (npm run dev), Vite sert le front sur 5173 et relaie /studio vers
// le BFF lancé à côté par npm start. En production il n'y a pas de proxy : le serveur
// Express sert lui-même le bundle construit ici, donc une seule origine.
const CIBLE_BFF = process.env.PRISMA_STUDIO_BFF || "http://localhost:5555";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    host: true,
    proxy: {
      "/studio": { target: CIBLE_BFF, changeOrigin: true },
      "/healthz": { target: CIBLE_BFF, changeOrigin: true },
    },
  },
  build: {
    // Studio est une grosse application : le morceau principal dépasse forcément la
    // limite d'avertissement par défaut, et la signaler à chaque build n'apprend rien.
    chunkSizeWarningLimit: 4096,
  },
});
