import { useEffect, useState } from "react";
import { chargerConfig } from "../data/config.js";

// config.json n'existe qu'à l'exécution : il est écrit par le conteneur nginx au
// démarrage, ou servi à la volée par le serveur Vite en développement. Son absence
// n'est pas une erreur, le portail retombe alors sur les noms de variables.
export function useConfig() {
  const [config, setConfig] = useState(null);
  const [etatConfig, setEtatConfig] = useState("chargement");

  useEffect(() => {
    let monte = true;
    chargerConfig()
      .then((donnees) => {
        if (!monte) return;
        setConfig(donnees);
        setEtatConfig(Object.keys(donnees).length > 0 ? "pret" : "absent");
      })
      .catch(() => {
        if (!monte) return;
        setConfig(null);
        setEtatConfig("absent");
      });
    return () => {
      monte = false;
    };
  }, []);

  return { config, etatConfig };
}
