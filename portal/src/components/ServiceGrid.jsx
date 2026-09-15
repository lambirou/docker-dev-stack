import ServiceCard from "./ServiceCard.jsx";
import { iconesCategorie } from "./Icons.jsx";

export default function ServiceGrid({ categories, services, etats }) {
  const sections = categories
    .map((categorie) => ({
      categorie,
      membres: services.filter((s) => s.categorie === categorie.id),
    }))
    .filter((section) => section.membres.length > 0);

  if (sections.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-bord px-4 py-10 text-center text-sm text-attenue">
        Aucun service ne correspond à cette recherche.
      </p>
    );
  }

  return (
    <div className="space-y-10">
      {sections.map(({ categorie, membres }) => {
        const Icone = iconesCategorie[categorie.icone];
        return (
          <section key={categorie.id}>
            <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold tracking-[0.12em] text-attenue uppercase">
              {Icone && <Icone width={14} height={14} />}
              {categorie.label}
              <span className="font-mono text-[11px] tracking-normal normal-case">
                {membres.length}
              </span>
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {membres.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  etat={service.sonde ? (etats[service.id] ?? "verification") : "tcp"}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
