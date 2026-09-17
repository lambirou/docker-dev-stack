import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const INTERVALLE_MS = 15000;
const DELAI_MS = 5000;

// Une requête no-cors renvoie une réponse opaque : impossible d'en lire le code HTTP.
// La seule information exploitable est « le service a répondu quelque chose ».
// C'est exactement la question posée ici, d'où le vocabulaire joignable / injoignable.
async function sonder(url) {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), DELAI_MS);
  try {
    await fetch(url, {
      mode: "no-cors",
      cache: "no-store",
      signal: controleur.signal,
      redirect: "follow",
    });
    return "joignable";
  } catch {
    return "injoignable";
  } finally {
    clearTimeout(minuteur);
  }
}

export function useHealth(services) {
  const sondables = useMemo(() => services.filter((s) => s.sonde), [services]);

  const [etats, setEtats] = useState(() =>
    Object.fromEntries(sondables.map((s) => [s.id, "verification"])),
  );
  const [dernierScan, setDernierScan] = useState(null);
  const [enCours, setEnCours] = useState(false);

  const verrou = useRef(false);
  const monte = useRef(true);

  const rafraichir = useCallback(async () => {
    if (verrou.current) return;
    verrou.current = true;
    setEnCours(true);
    try {
      const resultats = await Promise.all(
        sondables.map(async (s) => [s.id, await sonder(s.sonde)]),
      );
      if (!monte.current) return;
      setEtats(Object.fromEntries(resultats));
      setDernierScan(new Date());
    } finally {
      verrou.current = false;
      if (monte.current) setEnCours(false);
    }
  }, [sondables]);

  useEffect(() => {
    monte.current = true;
    rafraichir();

    const minuteur = setInterval(rafraichir, INTERVALLE_MS);
    const surRetour = () => {
      if (document.visibilityState === "visible") rafraichir();
    };
    document.addEventListener("visibilitychange", surRetour);

    return () => {
      monte.current = false;
      clearInterval(minuteur);
      document.removeEventListener("visibilitychange", surRetour);
    };
  }, [rafraichir]);

  return { etats, dernierScan, enCours, rafraichir };
}
