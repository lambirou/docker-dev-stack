const apparences = {
  joignable: { couleur: "bg-ok", texte: "text-ok", libelle: "joignable", pulse: true },
  injoignable: { couleur: "bg-ko", texte: "text-ko", libelle: "injoignable", pulse: false },
  verification: {
    couleur: "bg-attente",
    texte: "text-attente",
    libelle: "vérification",
    pulse: true,
  },
  tcp: { couleur: "bg-neutre", texte: "text-attenue", libelle: "TCP", pulse: false },
};

export default function StatusDot({ etat }) {
  const apparence = apparences[etat] ?? apparences.tcp;

  return (
    <span
      className={
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-bord bg-relief px-2 py-0.5 text-[11px] font-medium " +
        apparence.texte
      }
    >
      <span className="relative flex size-2">
        {apparence.pulse && (
          <span
            className={
              "absolute inline-flex size-full animate-ping rounded-full opacity-60 " +
              apparence.couleur
            }
          />
        )}
        <span className={"relative inline-flex size-2 rounded-full " + apparence.couleur} />
      </span>
      {apparence.libelle}
    </span>
  );
}
