// Toutes les icônes du portail passent par ce fichier. Il fait la correspondance entre
// les noms français employés dans les composants et le jeu Lucide, et fixe les valeurs
// par défaut communes. Les composants appelants n'importent jamais lucide-react
// directement : changer une icône se fait ici, en une ligne.
//
// Pour en ajouter une : choisir dans https://lucide.dev/icons, l'importer nommément
// ci-dessous et l'exporter. Seules les icônes importées entrent dans le bundle.
import {
  Box,
  Check,
  ChevronRight,
  Copy,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  LogOut,
  Moon,
  RefreshCw,
  Search,
  Sun,
  Wrench,
} from "lucide-react";

// Lucide dessine sur une grille de 24 px avec un trait de 2. Ramené à 16 px, ce trait
// alourdit le texte voisin : 1,8 conserve le rendu des icônes dessinées à la main qui
// occupaient cette place. Les appelants surchargent width et height au besoin, et
// l'attribut aria-hidden est posé par Lucide tant qu'aucune propriété ARIA n'est fournie.
const commun = { size: 16, strokeWidth: 1.8 };

export const IconeBase = (props) => <Database {...commun} {...props} />;
export const IconeLoupe = (props) => <Search {...commun} {...props} />;
export const IconeBoite = (props) => <Box {...commun} {...props} />;
export const IconeOutil = (props) => <Wrench {...commun} {...props} />;
export const IconeLien = (props) => <ExternalLink {...commun} {...props} />;
export const IconeCopie = (props) => <Copy {...commun} {...props} />;
export const IconeCheck = (props) => <Check {...commun} {...props} />;
export const IconeChevron = (props) => <ChevronRight {...commun} {...props} />;
export const IconeRafraichir = (props) => <RefreshCw {...commun} {...props} />;
export const IconeSoleil = (props) => <Sun {...commun} {...props} />;
export const IconeLune = (props) => <Moon {...commun} {...props} />;
export const IconeOeil = (props) => <Eye {...commun} {...props} />;
export const IconeOeilBarre = (props) => <EyeOff {...commun} {...props} />;
export const IconeDeconnexion = (props) => <LogOut {...commun} {...props} />;

// Clés utilisées par le champ `icone` des catégories dans data/services.js.
export const iconesCategorie = {
  base: IconeBase,
  loupe: IconeLoupe,
  boite: IconeBoite,
  outil: IconeOutil,
};
