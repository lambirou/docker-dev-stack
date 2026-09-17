import { useEffect, useRef, useState } from "react";
import { IconeCheck, IconeCopie } from "./Icons.jsx";
import Infobulle from "./Infobulle.jsx";

async function ecrirePressePapier(valeur) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(valeur);
    return;
  }
  // Repli pour les contextes non sécurisés, où l'API Clipboard est absente.
  const zone = document.createElement("textarea");
  zone.value = valeur;
  zone.setAttribute("readonly", "");
  zone.style.position = "fixed";
  zone.style.opacity = "0";
  document.body.appendChild(zone);
  zone.select();
  document.execCommand("copy");
  document.body.removeChild(zone);
}

export default function CopyButton({ valeur, libelle }) {
  const [copie, setCopie] = useState(false);
  const minuteur = useRef(null);

  useEffect(() => () => clearTimeout(minuteur.current), []);

  async function copier() {
    try {
      await ecrirePressePapier(valeur);
      setCopie(true);
      clearTimeout(minuteur.current);
      minuteur.current = setTimeout(() => setCopie(false), 1500);
    } catch {
      // Copie refusée par le navigateur : on laisse la valeur sélectionnable.
    }
  }

  const intitule = copie ? "Copié" : "Copier " + (libelle ?? valeur);

  return (
    // L'infobulle reste ouverte au clic : c'est elle qui confirme la copie, en écho
    // au passage de l'icône au vert.
    <Infobulle texte={intitule} fermerAuClic={false}>
      <button
        type="button"
        onClick={copier}
        aria-label={intitule}
        className="rounded-md p-1 text-attenue transition hover:bg-relief hover:text-texte focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {copie ? <IconeCheck className="text-ok" /> : <IconeCopie />}
      </button>
    </Infobulle>
  );
}
