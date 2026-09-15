import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Tooltip } from "@base-ui/react/tooltip";
import App from "./App.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {/* Délai partagé : la première infobulle se fait attendre, les suivantes
        s'affichent aussitôt tant que le pointeur reste dans la barre d'outils. */}
    <Tooltip.Provider delay={350} closeDelay={80}>
      <App />
    </Tooltip.Provider>
  </StrictMode>,
);
