const commun = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export function IconeBase(props) {
  return (
    <svg {...commun} {...props}>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="3" />
      <path d="M4.5 5.5v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6" />
      <path d="M4.5 11.5v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6" />
    </svg>
  );
}

export function IconeLoupe(props) {
  return (
    <svg {...commun} {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 4.5 4.5" />
    </svg>
  );
}

export function IconeBoite(props) {
  return (
    <svg {...commun} {...props}>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </svg>
  );
}

export function IconeOutil(props) {
  return (
    <svg {...commun} {...props}>
      <path d="M14.7 6.3a4 4 0 0 0 5.2 5.2l-8 8a2.8 2.8 0 0 1-4-4l8-8Z" />
      <path d="M6.5 17.5h.01" />
    </svg>
  );
}

export function IconeLien(props) {
  return (
    <svg {...commun} {...props}>
      <path d="M14 4h6v6" />
      <path d="M20 4 10.5 13.5" />
      <path d="M18 14v5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V8a1.5 1.5 0 0 1 1.5-1.5H10" />
    </svg>
  );
}

export function IconeCopie(props) {
  return (
    <svg {...commun} {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 5.5A1.5 1.5 0 0 0 13.5 4h-8A1.5 1.5 0 0 0 4 5.5v8A1.5 1.5 0 0 0 5.5 15" />
    </svg>
  );
}

export function IconeCheck(props) {
  return (
    <svg {...commun} {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  );
}

export function IconeRafraichir(props) {
  return (
    <svg {...commun} {...props}>
      <path d="M20 11a8 8 0 1 0-.7 4.5" />
      <path d="M20 4.5V11h-6.5" />
    </svg>
  );
}

export function IconeSoleil(props) {
  return (
    <svg {...commun} {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
    </svg>
  );
}

export function IconeLune(props) {
  return (
    <svg {...commun} {...props}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
    </svg>
  );
}

export const iconesCategorie = {
  base: IconeBase,
  loupe: IconeLoupe,
  boite: IconeBoite,
  outil: IconeOutil,
};
