import { useMemo } from "react";
import { Studio } from "@prisma/studio-core/ui";
import { createPostgresAdapter } from "@prisma/studio-core/data/postgres-core";
import { createStudioBFFClient } from "@prisma/studio-core/data/bff";

// L'ordre compte : la feuille de Studio d'abord, la nôtre ensuite, sans quoi nos
// variables de thème seraient écrasées par les siennes. C'est index.css qui réaccorde
// la palette sur celle du portail — voir le commentaire qui s'y trouve.
import "@prisma/studio-core/ui/index.css";

// L'endpoint est relatif : le même processus sert le bundle et le BFF, donc l'origine
// est forcément la bonne — que la page soit ouverte par https://prisma.dev.test ou par
// http://localhost:5555. Une URL absolue, elle, aurait figé l'un des deux accès.
const URL_BFF = "/studio";

export default function App() {
  // Mémoïsé : reconstruire l'adaptateur à chaque rendu relancerait l'introspection du
  // schéma et ferait clignoter toute l'interface.
  const adapter = useMemo(() => {
    const executor = createStudioBFFClient({ url: URL_BFF });
    return createPostgresAdapter({ executor });
  }, []);

  // Pas de prop llm : sans elle, Studio masque simplement ses fonctions assistées par
  // IA. Les y brancher supposerait une clé d'API et un appel sortant, ce qu'une stack
  // de développement locale n'a pas à faire dans le dos de qui l'utilise.
  return (
    <div className="studio-hote">
      <Studio adapter={adapter} />
    </div>
  );
}
