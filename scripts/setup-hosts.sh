#!/usr/bin/env bash
# Ajoute (ou retire) les entrées *.test de la stack dans /etc/hosts.
# Exige root ou sudo. Idempotent : les anciennes lignes dev-stack sont
# réécrites à chaque exécution.
set -euo pipefail
. "$(cd -- "$(dirname -- "$0")" && pwd)/lib.sh"

RETIRER=0
while [ $# -gt 0 ]; do
  case "$1" in
    --remove|-r) RETIRER=1 ;;
    -h|--help) printf 'Usage: %s [--remove]\n' "$0"; exit 0 ;;
    *) erreur "option inconnue : $1"; exit 2 ;;
  esac
  shift
done

etape 'Fichier hosts'

if [ "$(systeme)" = 'windows' ]; then
  erreur 'sous Windows, utilise scripts\\setup-hosts.ps1 dans un PowerShell administrateur'
  exit 1
fi

FICHIER_HOSTS=/etc/hosts
MARQUEUR='# dev-stack'

if ! est_root && ! commande_existe sudo; then
  erreur "droits root requis pour modifier $FICHIER_HOSTS"
  exit 1
fi

temporaire=$(mktemp)
trap 'rm -f "$temporaire"' EXIT

grep -v -- "$MARQUEUR" "$FICHIER_HOSTS" > "$temporaire" || true

if [ "$RETIRER" -eq 0 ]; then
  while IFS= read -r nom; do
    printf '127.0.0.1 %s %s\n' "$nom" "$MARQUEUR" >> "$temporaire"
  done <<< "$(noms_stack)"
fi

# cp préserve l'inode et les permissions du fichier système, contrairement à mv.
sudo_si_besoin cp "$temporaire" "$FICHIER_HOSTS"
vider_cache_dns

if [ "$RETIRER" -eq 1 ]; then
  ok 'entrées dev-stack retirées'
  exit 0
fi

ok "$(noms_stack | wc -l | tr -d ' ') entrées écrites dans $FICHIER_HOSTS"
while IFS= read -r nom; do
  printf '           https://%s\n' "$nom"
done <<< "$(noms_stack)"
