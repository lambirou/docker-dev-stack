// Appels à l'API du sélecteur. Tout passe par le serveur : le navigateur ne connaît
// des connexions que leur description, jamais leur chaîne complète ni leur mot de
// passe. Un identifiant opaque suffit à désigner celle qu'on veut ouvrir.

async function lire(reponse) {
  let charge = null;
  try {
    charge = await reponse.json();
  } catch {
    // Réponse vide ou illisible : le code HTTP reste notre seule information.
  }
  if (!reponse.ok) {
    throw new Error(charge?.message || "Erreur " + reponse.status);
  }
  return charge;
}

export async function listerConnexions() {
  const reponse = await fetch("/api/connexions", { cache: "no-store" });
  const charge = await lire(reponse);
  return charge?.connexions ?? [];
}

/** Éprouve une connexion sans l'enregistrer. Lève avec le message du serveur. */
export async function testerConnexion(formulaire) {
  const reponse = await fetch("/api/connexions/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formulaire),
  });
  await lire(reponse);
}

export async function ajouterConnexion(formulaire) {
  const reponse = await fetch("/api/connexions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formulaire),
  });
  const charge = await lire(reponse);
  return charge.connexion;
}

export async function supprimerConnexion(id) {
  const reponse = await fetch("/api/connexions/" + encodeURIComponent(id), {
    method: "DELETE",
  });
  await lire(reponse);
}
