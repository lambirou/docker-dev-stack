import { useMemo } from "react";
import { Studio } from "@prisma/studio-core/ui";
import { createStudioBFFClient } from "@prisma/studio-core/data/bff";
import { createPostgresAdapter } from "@prisma/studio-core/data/postgres-core";
import { createMySQLAdapter } from "@prisma/studio-core/data/mysql-core";
import { createSQLiteAdapter } from "@prisma/studio-core/data/sqlite-core";

import { IconeRetour } from "./Icones.jsx";

// L'endpoint est relatif : le même processus sert le bundle et le BFF, donc l'origine
// est forcément la bonne — que la page soit ouverte par https://prisma.dev.test ou
// par http://localhost:5555. Une URL absolue aurait figé l'un des deux accès.
const URL_BFF = "/studio";

const ADAPTATEURS = {
  postgres: createPostgresAdapter,
  mysql: createMySQLAdapter,
  sqlite: createSQLiteAdapter,
};

export default function StudioConnecte({ connexion, onRetour }) {
  // Mémoïsé sur l'identifiant : reconstruire l'adaptateur à chaque rendu relancerait
  // l'introspection du schéma et ferait clignoter toute l'interface.
  const adapter = useMemo(() => {
    const executor = createStudioBFFClient({
      url: URL_BFF,
      // Le serveur y lit quelle base ouvrir. C'est l'usage prévu de customPayload :
      // véhiculer le contexte de la requête sans rien exposer de sensible.
      customPayload: { connexionId: connexion.id },
    });

    const fabrique = ADAPTATEURS[connexion.moteur];
    if (!fabrique) throw new Error("Moteur non géré : " + connexion.moteur);
    return fabrique({ executor });
  }, [connexion.id, connexion.moteur]);

  // Pas de prop llm : sans elle, Studio masque simplement ses fonctions assistées par
  // IA. Les brancher supposerait une clé d'API et un appel sortant, ce qu'une stack
  // de développement locale n'a pas à faire dans le dos de qui l'utilise.
  return (
    <div className="studio-hote">
      <header className="barre">
        <button type="button" className="retour" onClick={onRetour}>
          <IconeRetour width={15} height={15} />
          Changer de base
        </button>
        <span className="barre-nom">{connexion.nom}</span>
        {connexion.detail && <span className="barre-detail">{connexion.detail}</span>}
      </header>

      <div className="studio-cadre">
        {/* La clé force un remontage au changement de base : sans elle, Studio
            conserverait la table et les filtres de la précédente, qui n'existent
            pas forcément dans la nouvelle. */}
        <Studio key={connexion.id} adapter={adapter} />
      </div>
    </div>
  );
}
