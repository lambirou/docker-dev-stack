import CopyButton from "./CopyButton.jsx";
import StatusDot from "./StatusDot.jsx";
import { IconeLien } from "./Icons.jsx";
import { preparer } from "../data/config.js";

const chip =
  "inline-flex items-center gap-1 rounded-md border border-bord bg-relief px-2 py-1 font-mono text-[11px] text-attenue transition hover:border-bord-vif hover:text-texte focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export default function ServiceCard({ service, etat, config, secretsVisibles }) {
  const aInterfaceWeb = Boolean(service.urlTest);
  const identifiants = service.identifiants ?? [];
  const portsAnnexes = service.portsAnnexes ?? [];

  // Chaque gabarit est résolu deux fois : la valeur réelle part au presse-papiers,
  // la version masquée reste à l'écran tant que l'utilisateur n'a pas tout affiché.
  const connexion = service.connexion ? preparer(service.connexion, config, secretsVisibles) : null;
  const lignes = identifiants.map((item) => ({
    label: item.label,
    ...preparer(item.valeur, config, secretsVisibles),
  }));
  const aUneValeurManquante =
    lignes.some((l) => l.indisponible) || Boolean(connexion?.indisponible);
  const aUneValeurMasquee = lignes.some((l) => l.masquee) || Boolean(connexion?.masquee);

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-bord bg-surface/70 p-5 shadow-sm backdrop-blur-sm transition hover:border-bord-vif hover:shadow-lg">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-tight">{service.nom}</h3>
          <p className="mt-1 text-[13px] leading-snug text-attenue">{service.role}</p>
        </div>
        <StatusDot etat={etat} />
      </header>

      {aInterfaceWeb ? (
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={service.urlTest}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-accent/12 px-2.5 py-1 font-mono text-xs font-medium text-accent transition hover:bg-accent/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {service.urlTest.replace("https://", "")}
            <IconeLien width={12} height={12} />
          </a>
          <a href={service.urlLocalhost} target="_blank" rel="noreferrer" className={chip}>
            {service.urlLocalhost.replace("https://", "")}
          </a>
          <a
            href={"http://localhost:" + service.portDirect}
            target="_blank"
            rel="noreferrer"
            className={chip}
          >
            localhost:{service.portDirect}
          </a>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-bord bg-relief px-3 py-2">
          <code className="truncate font-mono text-[11px] text-attenue">
            {connexion?.affichage}
          </code>
          <CopyButton valeur={connexion?.valeur} libelle="la chaîne de connexion" />
        </div>
      )}

      {portsAnnexes.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-attenue">
          {portsAnnexes.map((p) => (
            <li key={p.label}>
              {p.label} <span className="font-mono text-texte/70">{p.port}</span>
            </li>
          ))}
        </ul>
      )}

      {identifiants.length > 0 && (
        <details className="rounded-lg border border-bord bg-relief/50">
          <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-attenue transition hover:text-texte">
            Identifiants
          </summary>
          <dl className="space-y-1.5 border-t border-bord px-3 py-2.5">
            {lignes.map((ligne) => (
              <div key={ligne.label} className="flex items-center justify-between gap-3">
                <dt className="shrink-0 text-[11px] text-attenue">{ligne.label}</dt>
                <dd className="flex min-w-0 items-center gap-1">
                  <code
                    title={
                      ligne.indisponible
                        ? "Variable absente de config.json : seul son nom est affiché"
                        : undefined
                    }
                    className={
                      "truncate font-mono text-[11px] " +
                      (ligne.indisponible ? "text-accent" : "text-texte")
                    }
                  >
                    {ligne.affichage}
                  </code>
                  <CopyButton valeur={ligne.valeur} libelle={ligne.label} />
                </dd>
              </div>
            ))}
          </dl>
          {aUneValeurManquante ? (
            <p className="border-t border-bord px-3 py-2 text-[11px] leading-snug text-attenue">
              Les entrées en couleur nomment une variable absente de{" "}
              <code className="font-mono">config.json</code> : renseignez-la dans{" "}
              <code className="font-mono">.env</code>, puis redémarrez le portail.
            </p>
          ) : aUneValeurMasquee ? (
            <p className="border-t border-bord px-3 py-2 text-[11px] leading-snug text-attenue">
              Valeurs masquées à l'écran. Le bouton de copie renvoie la valeur réelle.
            </p>
          ) : null}
        </details>
      )}

      <footer className="mt-auto pt-1">
        <code className="font-mono text-[10px] text-attenue/70">{service.image}</code>
      </footer>
    </article>
  );
}
