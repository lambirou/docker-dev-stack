import { useEffect, useRef } from "react";
import { Toggle } from "@base-ui/react/toggle";
import {
  IconeDeconnexion,
  IconeLune,
  IconeOeil,
  IconeOeilBarre,
  IconeRafraichir,
  IconeSoleil,
} from "./Icons.jsx";
import Infobulle from "./Infobulle.jsx";

const bouton =
  "inline-flex size-9 items-center justify-center rounded-lg border border-bord bg-surface/70 text-attenue transition hover:border-bord-vif hover:text-texte focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-disabled:cursor-not-allowed data-disabled:opacity-40";

// Le bouton des identifiants porte un état visible : Base UI expose data-pressed, il n'y
// a donc rien à dériver côté React pour le styler.
const boutonEtat = bouton + " data-pressed:border-accent/50 data-pressed:text-accent";

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
  secretsVisibles,
  onBasculerSecrets,
  configDisponible,
  urlDeconnexion,
}) {
  const champ = useRef(null);

  const libelleTheme = theme === "clair" ? "Passer en thème sombre" : "Passer en thème clair";
  const libelleSecrets = !configDisponible
    ? "config.json n'a pas été chargé : aucune valeur à dévoiler"
    : secretsVisibles
      ? "Masquer les identifiants"
      : "Afficher les identifiants en clair";

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
          <Infobulle texte="Relancer les sondes">
            <button
              type="button"
              onClick={onRafraichir}
              className={bouton}
              aria-label="Relancer les sondes"
            >
              <IconeRafraichir className={enCours ? "animate-spin" : undefined} />
            </button>
          </Infobulle>

          {/* Un bouton désactivé ne reçoit aucun événement de pointeur : l'infobulle est
              donc accrochée à l'enveloppe, sinon l'explication resterait invisible dans
              le seul cas où elle est utile. */}
          <Infobulle texte={libelleSecrets}>
            <span className="inline-flex">
              <Toggle
                pressed={secretsVisibles}
                onPressedChange={onBasculerSecrets}
                disabled={!configDisponible}
                className={boutonEtat}
                aria-label={
                  secretsVisibles ? "Masquer les identifiants" : "Afficher les identifiants"
                }
              >
                {secretsVisibles ? <IconeOeilBarre /> : <IconeOeil />}
              </Toggle>
            </span>
          </Infobulle>

          <Infobulle texte={libelleTheme}>
            <Toggle
              pressed={theme === "clair"}
              onPressedChange={onBasculerTheme}
              className={bouton}
              aria-label={libelleTheme}
            >
              {theme === "clair" ? <IconeLune /> : <IconeSoleil />}
            </Toggle>
          </Infobulle>

          {/* Un simple lien, pas un fetch : la page /logout de tinyauth vit sur une
              autre origine que le portail et n'autorise pas les appels croisés. En y
              naviguant, le navigateur y est same-origin, la session est détruite puis
              le formulaire de connexion s'affiche. Le bouton disparaît si l'URL de
              tinyauth est inconnue, plutôt que de proposer un lien mort. */}
          {urlDeconnexion ? (
            <Infobulle texte="Fermer la session tinyauth">
              <a
                href={urlDeconnexion.replace(/\/$/, "") + "/logout"}
                className={bouton}
                aria-label="Se déconnecter"
              >
                <IconeDeconnexion />
              </a>
            </Infobulle>
          ) : null}
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
