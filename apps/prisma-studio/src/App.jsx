import { useCallback, useEffect, useState } from "react";

// L'ordre compte : la feuille de Studio d'abord, la nôtre ensuite, sans quoi nos
// variables de thème seraient écrasées par les siennes. C'est index.css qui réaccorde
// la palette sur celle du portail — voir le commentaire qui s'y trouve.
import "@prisma/studio-core/ui/index.css";

import ModalAjout from "./composants/ModalAjout.jsx";
import Selecteur from "./composants/Selecteur.jsx";
import StudioConnecte from "./composants/StudioConnecte.jsx";
import { listerConnexions } from "./api.js";

// La dernière base ouverte est retenue : rouvrir l'onglet ramène là où on était,
// plutôt que de refaire le tour du sélecteur à chaque fois.
const CLE_DERNIERE = "prisma-studio-connexion";

function derniereConnexion() {
  try {
    return window.localStorage.getItem(CLE_DERNIERE);
  } catch {
    return null; // localStorage indisponible : on retombe sur le sélecteur.
  }
}

function memoriser(id) {
  try {
    if (id) window.localStorage.setItem(CLE_DERNIERE, id);
    else window.localStorage.removeItem(CLE_DERNIERE);
  } catch {
    // Préférence non conservée, sans conséquence sur la session en cours.
  }
}

export default function App() {
  const [connexions, setConnexions] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [choisie, setChoisie] = useState(null);
  const [modalOuverte, setModalOuverte] = useState(false);

  const recharger = useCallback(async () => {
    try {
      const liste = await listerConnexions();
      setConnexions(liste);
      setErreur(null);
      return liste;
    } catch (e) {
      setErreur("Connexions illisibles : " + e.message);
      return [];
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    recharger().then((liste) => {
      // Réouverture directe de la dernière base, si elle existe toujours : une
      // connexion supprimée entre-temps ramène simplement au sélecteur.
      const id = derniereConnexion();
      const retrouvee = id ? liste.find((c) => c.id === id) : null;
      if (retrouvee) setChoisie(retrouvee);
    });
  }, [recharger]);

  function choisir(connexion) {
    memoriser(connexion.id);
    setChoisie(connexion);
  }

  function revenir() {
    memoriser(null);
    setChoisie(null);
    // Studio range la table courante, le tri et les filtres dans le fragment d'URL.
    // Le vider évite que la base suivante hérite d'un état qui ne la concerne pas.
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }

  if (choisie) {
    return <StudioConnecte connexion={choisie} onRetour={revenir} />;
  }

  if (chargement) {
    return (
      <div className="accueil">
        <p className="patiente">Chargement des connexions…</p>
      </div>
    );
  }

  return (
    <>
      <Selecteur
        connexions={connexions}
        erreur={erreur}
        onChoisir={choisir}
        onAjouter={() => setModalOuverte(true)}
        onChangement={recharger}
      />
      {modalOuverte && (
        <ModalAjout
          onFerme={() => setModalOuverte(false)}
          onAjoutee={async (creee) => {
            await recharger();
            setModalOuverte(false);
            // On ouvre directement la base qu'on vient d'ajouter : c'était le but du
            // geste, la faire chercher dans la liste serait un pas de trop.
            choisir(creee);
          }}
        />
      )}
    </>
  );
}
