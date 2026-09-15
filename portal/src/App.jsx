import { useMemo, useState } from "react";
import Header from "./components/Header.jsx";
import ServiceGrid from "./components/ServiceGrid.jsx";
import { categories, services } from "./data/services.js";
import { chercher } from "./data/recherche.js";
import { useHealth } from "./hooks/useHealth.js";
import { useTheme } from "./hooks/useTheme.js";

export default function App() {
  const [recherche, setRecherche] = useState("");
  const { etats, dernierScan, enCours, rafraichir } = useHealth(services);
  const { theme, basculer } = useTheme();

  const visibles = useMemo(() => chercher(recherche), [recherche]);

  const sondes = services.filter((service) => service.sonde).length;
  const joignables = Object.values(etats).filter((etat) => etat === "joignable").length;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <Header
        recherche={recherche}
        onRecherche={setRecherche}
        joignables={joignables}
        sondes={sondes}
        dernierScan={dernierScan}
        enCours={enCours}
        onRafraichir={rafraichir}
        theme={theme}
        onBasculerTheme={basculer}
      />

      <main>
        <ServiceGrid categories={categories} services={visibles} etats={etats} />
      </main>

      <footer className="mt-14 border-t border-bord pt-6 text-xs leading-relaxed text-attenue">
        <p>
          Les sondes interrogent le port publié sur <code className="font-mono">localhost</code>,
          pas le domaine <code className="font-mono">.test</code> : une carte reste fiable même
          sans entrée dans le fichier hosts. Une réponse opaque ne dit pas si le service est
          sain, seulement qu'il répond.
        </p>
        <p className="mt-2">
          Les URL en <code className="font-mono">.test</code> exigent{" "}
          <code className="font-mono">scripts\setup-hosts.ps1</code>. Les équivalents en{" "}
          <code className="font-mono">.localhost</code> fonctionnent sans rien installer.
        </p>
      </footer>
    </div>
  );
}
