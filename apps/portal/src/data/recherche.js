import Fuse from "fuse.js";
import { categories, services } from "./services.js";

// Le libellé de la catégorie et les mots-clés sont aplatis dans l'index pour que
// « outillage », « cache » ou « base64 » ramènent les services concernés sans que
// l'utilisateur ait à connaître leur nom.
const indexables = services.map((service) => ({
  service,
  nom: service.nom,
  id: service.id,
  role: service.role,
  motsCles: service.motsCles ?? [],
  categorieLabel: categories.find((c) => c.id === service.categorie)?.label ?? "",
}));

const fuse = new Fuse(indexables, {
  keys: [
    { name: "nom", weight: 4 },
    { name: "id", weight: 3 },
    { name: "motsCles", weight: 2 },
    { name: "role", weight: 2 },
    { name: "categorieLabel", weight: 1 },
  ],
  // Seuil resserré depuis l'ajout des mots-clés : le corpus indexé a grossi, donc un
  // seuil large ramenait n'importe quoi (à 0.35, « rag » remontait les treize services).
  // 0.25 garde la tolérance aux fautes — « mailpt », « qdrnt », « phpmyadmn » et
  // « trafik » trouvent leur cible — sans faux positifs sur les termes courts.
  threshold: 0.25,
  ignoreLocation: true,
  ignoreDiacritics: true,
});

export function chercher(terme) {
  const nettoye = terme.trim();
  if (!nettoye) return services;
  return fuse.search(nettoye).map((resultat) => resultat.item.service);
}
