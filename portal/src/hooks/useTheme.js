import { useCallback, useEffect, useState } from "react";

const CLE = "portal-theme";

function themeInitial() {
  try {
    const stocke = window.localStorage.getItem(CLE);
    if (stocke === "clair" || stocke === "sombre") return stocke;
  } catch {
    // localStorage indisponible : on retombe sur le thème sombre.
  }
  return "sombre";
}

export function useTheme() {
  const [theme, setTheme] = useState(themeInitial);

  useEffect(() => {
    document.documentElement.classList.toggle("clair", theme === "clair");
    try {
      window.localStorage.setItem(CLE, theme);
    } catch {
      // Préférence non persistée, sans conséquence sur l'affichage.
    }
  }, [theme]);

  const basculer = useCallback(() => {
    setTheme((actuel) => (actuel === "clair" ? "sombre" : "clair"));
  }, []);

  return { theme, basculer };
}
