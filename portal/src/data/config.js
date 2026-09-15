// Les identifiants réels ne vivent pas dans le bundle. Au démarrage du conteneur,
// nginx écrit /config.json à partir des variables passées par docker compose depuis
// le fichier .env ; le portail le lit à l'exécution. Modifier .env puis redémarrer le
// service portal suffit, il n'y a rien à reconstruire.
//
// Les chaînes de services.js sont des gabarits : le jeton ${POSTGRES_PASSWORD} est
// remplacé par la valeur réelle, ou par le nom de la variable si elle est absente.

const JETON = /\$\{([A-Z0-9_]+)\}/g;

// Un nom qui contient l'un de ces mots est masqué à l'écran tant que l'utilisateur
// n'a pas demandé l'affichage. La copie, elle, renvoie toujours la valeur réelle.
const SENSIBLE = /(PASSWORD|KEY|SECRET|TOKEN)/;

const POINTS = "••••••••";

export function estSensible(nom) {
  return SENSIBLE.test(nom);
}

export async function chargerConfig() {
  const reponse = await fetch("/config.json", { cache: "no-store" });
  if (!reponse.ok) throw new Error("config.json : " + reponse.status);
  const donnees = await reponse.json();
  if (!donnees || typeof donnees !== "object") throw new Error("config.json illisible");
  return donnees;
}

// Une variable inconnue retombe sur son propre nom : la carte reste lisible même
// sans config.json, et on voit tout de suite quelle ligne du .env est en cause.
export function resoudre(gabarit, config, { masquer = false } = {}) {
  if (!gabarit) return gabarit;
  return gabarit.replace(JETON, (_, nom) => {
    const valeur = config?.[nom];
    if (valeur === undefined) return nom;
    return masquer && estSensible(nom) ? POINTS : valeur;
  });
}

export function estResolu(gabarit, config) {
  if (!gabarit) return true;
  return [...gabarit.matchAll(JETON)].every(([, nom]) => config?.[nom] !== undefined);
}

export function preparer(gabarit, config, secretsVisibles = false) {
  const valeur = resoudre(gabarit, config);
  const affichage = secretsVisibles ? valeur : resoudre(gabarit, config, { masquer: true });
  return {
    valeur,
    affichage,
    masquee: affichage !== valeur,
    indisponible: !estResolu(gabarit, config),
  };
}
