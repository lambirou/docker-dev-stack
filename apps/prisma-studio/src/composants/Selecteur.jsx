import { useState } from "react";
import { IconeBase, IconeCorbeille, IconePlus } from "./Icones.jsx";
import { supprimerConnexion } from "../api.js";

const LIBELLE_MOTEUR = {
  postgres: "PostgreSQL",
  mysql: "MySQL / MariaDB",
  sqlite: "SQLite",
};

/**
 * Écran d'accueil : la liste des bases connues, et de quoi en ajouter une.
 *
 * Les connexions venues du .env portent la mention « stack » et ne se suppriment
 * pas : elles seraient reconstruites au prochain démarrage, et laisser croire le
 * contraire ne ferait qu'égarer.
 */
export default function Selecteur({
  connexions,
  erreur,
  onChoisir,
  onAjouter,
  onChangement,
}) {
  const [suppression, setSuppression] = useState(null);
  const [erreurLocale, setErreurLocale] = useState(null);

  async function supprimer(connexion) {
    setErreurLocale(null);
    setSuppression(connexion.id);
    try {
      await supprimerConnexion(connexion.id);
      await onChangement();
    } catch (e) {
      setErreurLocale(e.message);
    } finally {
      setSuppression(null);
    }
  }

  return (
    <div className="accueil">
      <main className="accueil-carte">
        <h1 className="accueil-titre">Prisma Studio</h1>
        <p className="accueil-sous-titre">Choisissez une base à ouvrir.</p>

        {(erreur || erreurLocale) && (
          <p className="alerte" role="alert">
            {erreur || erreurLocale}
          </p>
        )}

        <ul className="liste">
          {connexions.map((connexion) => (
            <li key={connexion.id} className="liste-ligne">
              <button
                type="button"
                className="connexion"
                onClick={() => onChoisir(connexion)}
              >
                <IconeBase className="connexion-icone" width={18} height={18} />
                <span className="connexion-texte">
                  <span className="connexion-nom">{connexion.nom}</span>
                  <span className="connexion-detail">
                    {LIBELLE_MOTEUR[connexion.moteur] ?? connexion.moteur}
                    {connexion.detail ? " · " + connexion.detail : ""}
                  </span>
                </span>
                {connexion.origine === "stack" && (
                  <span className="badge" title="Définie dans le fichier .env">
                    stack
                  </span>
                )}
              </button>

              {connexion.origine === "ajoutee" && (
                <button
                  type="button"
                  className="supprimer"
                  onClick={() => supprimer(connexion)}
                  disabled={suppression === connexion.id}
                  aria-label={"Supprimer la connexion " + connexion.nom}
                  title="Supprimer cette connexion"
                >
                  <IconeCorbeille width={15} height={15} />
                </button>
              )}
            </li>
          ))}

          {connexions.length === 0 && (
            <li className="vide">
              Aucune base configurée. Ajoutez une connexion pour commencer.
            </li>
          )}

          <li className="liste-ligne">
            <button type="button" className="connexion ajouter" onClick={onAjouter}>
              <IconePlus className="connexion-icone" width={18} height={18} />
              <span className="connexion-nom">Ajouter une base de données</span>
            </button>
          </li>
        </ul>
      </main>

      <p className="pied">
        Les connexions vivent sur le serveur : aucun mot de passe n'atteint le
        navigateur.
      </p>
    </div>
  );
}
