import { Tooltip } from "@base-ui/react/tooltip";

// Remplace l'attribut title natif : celui-ci n'est ni stylable, ni annoncé de façon
// fiable, et son délai d'apparition d'une seconde n'est pas réglable. Base UI fournit
// le positionnement, le portail, le délai partagé entre infobulles et le lien
// aria-describedby avec l'élément déclencheur.
//
// L'enfant devient le déclencheur tel quel, via la composition `render` de Base UI :
// aucun élément n'est ajouté autour, la mise en page des boutons reste intacte.

const POPUP =
  "z-50 max-w-64 rounded-md border border-bord bg-surface px-2 py-1 text-[11px] leading-snug " +
  "text-texte shadow-lg shadow-black/25 origin-[var(--transform-origin)] " +
  "transition-[transform,opacity] duration-150 ease-out " +
  "data-starting-style:scale-95 data-starting-style:opacity-0 " +
  "data-ending-style:scale-95 data-ending-style:opacity-0 data-instant:transition-none";

export default function Infobulle({ texte, side = "top", fermerAuClic = true, children }) {
  // Sans texte, le déclencheur est rendu seul : les appelants n'ont pas à gérer le cas.
  if (!texte) return children;

  return (
    <Tooltip.Root>
      <Tooltip.Trigger closeOnClick={fermerAuClic} render={children} />
      <Tooltip.Portal>
        <Tooltip.Positioner side={side} sideOffset={8}>
          <Tooltip.Popup className={POPUP}>{texte}</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
