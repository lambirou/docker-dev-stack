import { useEffect, useRef } from "react";
import { IconeLune, IconeRafraichir, IconeSoleil } from "./Icons.jsx";

const bouton =
  "inline-flex size-9 items-center justify-center rounded-lg border border-bord bg-surface/70 text-attenue transition hover:border-bord-vif hover:text-texte focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function heure(date) {
  if (!date) return "jamais";
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function Header({
  recherche,
  onRecherche,
  joignables,
  sondes,
  dernierScan,
  enCours,
  onRafraichir,
  theme,
  onBasculerTheme,
}) {
  const champ = useRef(null);

  useEffect(() => {
    function surTouche(evenement) {
      const cible = evenement.target;
      const dansUnChamp =
        cible instanceof HTMLElement &&
        (cible.tagName === "INPUT" || cible.tagName === "TEXTAREA" || cible.isContentEditable);
      if (evenement.key === "/" && !dansUnChamp) {
        evenement.preventDefault();
        champ.current?.focus();
      }
      if (evenement.key === "Escape" && document.activeElement === champ.current) {
        champ.current.blur();
      }
    }
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, []);

  return (
    <header className="mb-10 flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dev Stack</h1>
          <p className="mt-1 text-sm text-attenue">
            <span className="font-mono text-texte">
              {joignables}/{sondes}
            </span>{" "}
            services joignables · dernier contrôle à {heure(dernierScan)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRafraichir}
            className={bouton}
            title="Relancer les sondes"
            aria-label="Relancer les sondes"
          >
            <IconeRafraichir className={enCours ? "animate-spin" : undefined} />
          </button>
          <button
            type="button"
            onClick={onBasculerTheme}
            className={bouton}
            title={theme === "clair" ? "Passer en thème sombre" : "Passer en thème clair"}
            aria-label={theme === "clair" ? "Passer en thème sombre" : "Passer en thème clair"}
          >
            {theme === "clair" ? <IconeLune /> : <IconeSoleil />}
          </button>
        </div>
      </div>

      <div className="relative">
        <input
          ref={champ}
          type="search"
          value={recherche}
          onChange={(evenement) => onRecherche(evenement.target.value)}
          placeholder="Filtrer les services"
          aria-label="Filtrer les services"
          className="w-full rounded-xl border border-bord bg-surface/70 px-4 py-2.5 pr-14 text-sm text-texte placeholder:text-attenue focus:border-bord-vif focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 rounded border border-bord bg-relief px-1.5 py-0.5 font-mono text-[10px] text-attenue">
          /
        </kbd>
      </div>
    </header>
  );
}
