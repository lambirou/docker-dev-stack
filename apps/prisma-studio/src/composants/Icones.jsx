// Icônes en ligne plutôt qu'une bibliothèque : il en faut quatre, et le bundle de
// Studio est déjà volumineux.

export function IconeBase(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="3" />
      <path d="M4.5 5.5v6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-6" />
      <path d="M4.5 11.5v7c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-7" />
    </svg>
  );
}

export function IconePlus(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

export function IconeCorbeille(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M4 7h16M10 11v6M14 11v6" strokeLinecap="round" />
      <path d="M6 7l1 13h10l1-13M9 7V4h6v3" strokeLinejoin="round" />
    </svg>
  );
}

export function IconeRetour(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
