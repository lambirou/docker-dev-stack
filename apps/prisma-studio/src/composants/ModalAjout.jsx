import { useEffect, useRef, useState } from "react";
import { ajouterConnexion, testerConnexion } from "../api.js";

const MOTEURS = [
  { id: "postgres", label: "PostgreSQL", port: 5432 },
  { id: "mysql", label: "MySQL / MariaDB", port: 3306 },
  { id: "sqlite", label: "SQLite", port: null },
];

const VIDE = {
  nom: "",
  hote: "",
  port: "",
  base: "",
  utilisateur: "",
  motDePasse: "",
  url: "",
  fichier: "",
};

/**
 * Formulaire d'ajout d'une connexion.
 *
 * Deux saisies possibles pour PostgreSQL et MySQL : les champs séparés, ou une URL
 * collée telle quelle — c'est le geste le plus courant quand on l'a déjà sous la
 * main. Le serveur donne la priorité à l'URL quand elle est remplie, et l'interface
 * n'affiche donc qu'un mode à la fois pour éviter l'ambiguïté.
 *
 * Rien n'est enregistré sans que la connexion ait répondu : une entrée morte dans la
 * liste ne rendrait service à personne.
 */
export default function ModalAjout({ onFerme, onAjoutee }) {
  const [moteur, setMoteur] = useState("postgres");
  const [mode, setMode] = useState("champs");
  const [valeurs, setValeurs] = useState(VIDE);
  const [etat, setEtat] = useState("saisie");
  const [message, setMessage] = useState(null);

  const dialogue = useRef(null);
  const premierChamp = useRef(null);

  useEffect(() => {
    premierChamp.current?.focus();
  }, []);

  // Échap ferme, comme n'importe quelle boîte de dialogue.
  useEffect(() => {
    function surTouche(evenement) {
      if (evenement.key === "Escape") onFerme();
    }
    document.addEventListener("keydown", surTouche);
    return () => document.removeEventListener("keydown", surTouche);
  }, [onFerme]);

  const estSqlite = moteur === "sqlite";
  const parUrl = !estSqlite && mode === "url";

  function definir(champ, valeur) {
    setValeurs((actuelles) => ({ ...actuelles, [champ]: valeur }));
    setMessage(null);
    setEtat("saisie");
  }

  /** Ce qui part au serveur : seulement les champs du mode affiché. */
  function charge() {
    const base = { nom: valeurs.nom.trim(), moteur };
    if (estSqlite) return { ...base, fichier: valeurs.fichier.trim() };
    if (parUrl) return { ...base, url: valeurs.url.trim() };
    return {
      ...base,
      hote: valeurs.hote.trim(),
      port: valeurs.port,
      base: valeurs.base.trim(),
      utilisateur: valeurs.utilisateur.trim(),
      motDePasse: valeurs.motDePasse,
    };
  }

  async function tester() {
    setEtat("test");
    setMessage(null);
    try {
      await testerConnexion(charge());
      setEtat("teste");
      setMessage("Connexion réussie.");
    } catch (erreur) {
      setEtat("erreur");
      setMessage(erreur.message);
    }
  }

  async function enregistrer(evenement) {
    evenement.preventDefault();
    setEtat("envoi");
    setMessage(null);
    try {
      const creee = await ajouterConnexion(charge());
      await onAjoutee(creee);
    } catch (erreur) {
      setEtat("erreur");
      setMessage(erreur.message);
    }
  }

  const occupe = etat === "test" || etat === "envoi";
  const portParDefaut = MOTEURS.find((m) => m.id === moteur)?.port;

  return (
    <div
      className="voile"
      ref={dialogue}
      // Un clic hors de la boîte ferme, mais pas un clic qui a commencé dedans et
      // s'est terminé dehors — c'est ce qui arrive en sélectionnant du texte.
      onMouseDown={(evenement) => {
        if (evenement.target === dialogue.current) onFerme();
      }}
    >
      <form
        className="modal"
        onSubmit={enregistrer}
        role="dialog"
        aria-modal="true"
        aria-label="Ajouter une base de données"
      >
        <h2 className="modal-titre">Ajouter une base de données</h2>

        <div className="onglets" role="group" aria-label="Moteur">
          {MOTEURS.map((m) => (
            <button
              key={m.id}
              type="button"
              className={"onglet" + (moteur === m.id ? " actif" : "")}
              onClick={() => {
                setMoteur(m.id);
                setMode("champs");
                setMessage(null);
                setEtat("saisie");
              }}
              aria-pressed={moteur === m.id}
            >
              {m.label}
            </button>
          ))}
        </div>

        <label className="champ">
          <span>Nom</span>
          <input
            ref={premierChamp}
            value={valeurs.nom}
            onChange={(e) => definir("nom", e.target.value)}
            placeholder="Ma base de test"
            required
          />
        </label>

        {estSqlite ? (
          <label className="champ">
            <span>Chemin du fichier</span>
            <input
              value={valeurs.fichier}
              onChange={(e) => definir("fichier", e.target.value)}
              placeholder="/sqlite/ma-base.db"
              required
            />
            <small>
              Chemin vu par le conteneur. Le dossier <code>data/sqlite</code> de la
              stack y est monté sur <code>/sqlite</code>.
            </small>
          </label>
        ) : parUrl ? (
          <label className="champ">
            <span>URL de connexion</span>
            <input
              value={valeurs.url}
              onChange={(e) => definir("url", e.target.value)}
              placeholder={
                moteur === "postgres"
                  ? "postgresql://user:motdepasse@hote:5432/base"
                  : "mysql://user:motdepasse@hote:3306/base"
              }
              required
            />
            <small>
              Depuis un conteneur, l'hôte est le nom du service — <code>postgres</code>,{" "}
              <code>mariadb</code> — et non <code>localhost</code>.
            </small>
          </label>
        ) : (
          <>
            <div className="paire">
              <label className="champ">
                <span>Hôte</span>
                <input
                  value={valeurs.hote}
                  onChange={(e) => definir("hote", e.target.value)}
                  placeholder={moteur === "postgres" ? "postgres" : "mariadb"}
                  required
                />
              </label>
              <label className="champ court">
                <span>Port</span>
                <input
                  value={valeurs.port}
                  onChange={(e) => definir("port", e.target.value)}
                  placeholder={String(portParDefaut)}
                  inputMode="numeric"
                />
              </label>
            </div>

            <label className="champ">
              <span>Base</span>
              <input
                value={valeurs.base}
                onChange={(e) => definir("base", e.target.value)}
                required
              />
            </label>

            <div className="paire">
              <label className="champ">
                <span>Utilisateur</span>
                <input
                  value={valeurs.utilisateur}
                  onChange={(e) => definir("utilisateur", e.target.value)}
                  required
                />
              </label>
              <label className="champ">
                <span>Mot de passe</span>
                <input
                  type="password"
                  value={valeurs.motDePasse}
                  onChange={(e) => definir("motDePasse", e.target.value)}
                />
              </label>
            </div>

            <small className="aide">
              Depuis un conteneur, l'hôte est le nom du service — <code>postgres</code>,{" "}
              <code>mariadb</code> — et non <code>localhost</code>.
            </small>
          </>
        )}

        {!estSqlite && (
          <button
            type="button"
            className="lien"
            onClick={() => {
              setMode(parUrl ? "champs" : "url");
              setMessage(null);
              setEtat("saisie");
            }}
          >
            {parUrl ? "Saisir les champs séparément" : "Coller une URL à la place"}
          </button>
        )}

        {message && (
          <p className={etat === "erreur" ? "alerte" : "succes"} role="status">
            {message}
          </p>
        )}

        <footer className="modal-pied">
          <button type="button" className="bouton" onClick={onFerme} disabled={occupe}>
            Annuler
          </button>
          <button type="button" className="bouton" onClick={tester} disabled={occupe}>
            {etat === "test" ? "Test en cours…" : "Tester"}
          </button>
          <button type="submit" className="bouton primaire" disabled={occupe}>
            {etat === "envoi" ? "Enregistrement…" : "Enregistrer"}
          </button>
        </footer>
      </form>
    </div>
  );
}
