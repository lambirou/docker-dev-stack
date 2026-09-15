#!/usr/bin/env bash
# Fonctions partagées par les scripts d'installation macOS / Linux / WSL.
# Équivalent POSIX de scripts/lib.ps1. Ce fichier se source, il ne s'exécute
# pas seul :  . "$(dirname "$0")/lib.sh"

set -euo pipefail

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  C_RESET=$'\033[0m'
  C_CYAN=$'\033[36m'
  C_VERT=$'\033[32m'
  C_JAUNE=$'\033[33m'
  C_ROUGE=$'\033[31m'
else
  C_RESET=''
  C_CYAN=''
  C_VERT=''
  C_JAUNE=''
  C_ROUGE=''
fi

etape()  { printf '\n%s==> %s%s\n' "$C_CYAN" "$1" "$C_RESET"; }
ok()     { printf '    %s[ok]%s   %s\n' "$C_VERT" "$C_RESET" "$1"; }
note()   { printf '    %s[note]%s %s\n' "$C_JAUNE" "$C_RESET" "$1"; }
erreur() { printf '    %s[err]%s  %s\n' "$C_ROUGE" "$C_RESET" "$1" >&2; }

RACINE_DEPOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)

# macos, linux, wsl, windows (Git Bash / MSYS) ou inconnu.
systeme() {
  case "$(uname -s)" in
    Darwin) printf 'macos' ;;
    Linux)
      if grep -qi microsoft /proc/version 2>/dev/null; then printf 'wsl'; else printf 'linux'; fi
      ;;
    MINGW*|MSYS*|CYGWIN*) printf 'windows' ;;
    *) printf 'inconnu' ;;
  esac
}

commande_existe() { command -v "$1" >/dev/null 2>&1; }

est_root() { [ "$(id -u)" -eq 0 ]; }

# Exécute la commande en root : directement si on y est déjà, via sudo sinon.
sudo_si_besoin() {
  if est_root; then
    "$@"
  elif commande_existe sudo; then
    sudo "$@"
  else
    erreur "droits root requis et sudo introuvable : relance en root"
    return 1
  fi
}

# Question fermée. ASSUME_OUI=1 (option -y) répond oui sans demander.
demander() {
  local reponse
  if [ "${ASSUME_OUI:-0}" = "1" ]; then return 0; fi
  printf '    %s (o/N) ' "$1"
  read -r reponse || reponse=''
  case "$reponse" in [oOyY]*) return 0 ;; *) return 1 ;; esac
}

# lire_dotenv <fichier> <clé> [valeur par défaut]
lire_dotenv() {
  local fichier="$1" cle="$2" defaut="${3:-}" valeur=''
  if [ -f "$fichier" ]; then
    valeur=$(sed -n "s/^[[:space:]]*$cle=//p" "$fichier" | tail -n 1 | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/")
  fi
  if [ -n "$valeur" ]; then printf '%s' "$valeur"; else printf '%s' "$defaut"; fi
}

# Renseigne une clé du .env seulement si elle est absente ou vide. Une valeur
# déjà saisie n'est jamais écrasée : le fichier de l'utilisateur, mots de passe
# compris, reste le sien.
definir_dotenv_si_vide() {
  local fichier="$1" cle="$2" valeur="$3" commentaire="${4:-}" temporaire
  if [ -n "$(lire_dotenv "$fichier" "$cle")" ]; then return 0; fi
  if grep -qE "^[[:space:]]*$cle=" "$fichier" 2>/dev/null; then
    temporaire=$(mktemp)
    sed "s|^[[:space:]]*$cle=.*$|$cle=$valeur|" "$fichier" > "$temporaire"
    cat "$temporaire" > "$fichier"
    rm -f "$temporaire"
    return 0
  fi
  {
    printf '\n'
    [ -n "$commentaire" ] && printf '# %s\n' "$commentaire"
    printf '%s=%s\n' "$cle" "$valeur"
  } >> "$fichier"
}

compose() { (cd "$RACINE_DEPOT" && docker compose "$@"); }

moteur_docker_ok() {
  commande_existe docker || return 1
  docker info --format '{{.ServerVersion}}' >/dev/null 2>&1
}

compose_v2_ok() {
  commande_existe docker || return 1
  docker compose version >/dev/null 2>&1
}

# Chemin du socket Docker du contexte courant : /var/run/docker.sock avec
# Docker Desktop, tout autre chemin avec Colima, Rancher Desktop ou Podman.
socket_docker() {
  local hote
  hote=$(docker context inspect --format '{{.Endpoints.docker.Host}}' 2>/dev/null || true)
  case "$hote" in
    unix://*) printf '%s' "${hote#unix://}" ;;
    *) printf '/var/run/docker.sock' ;;
  esac
}

# attendre <commande> [timeout] [intervalle]
attendre() {
  local commande="$1" delai="${2:-120}" pas="${3:-3}" fin
  fin=$(( $(date +%s) + delai ))
  while [ "$(date +%s)" -lt "$fin" ]; do
    if eval "$commande" >/dev/null 2>&1; then return 0; fi
    sleep "$pas"
    printf '.'
  done
  return 1
}

noms_stack() {
  printf '%s\n' portal traefik minio mail redis qdrant meilisearch neo4j phpmyadmin tools containers
}

vider_cache_dns() {
  case "$(systeme)" in
    macos)
      sudo_si_besoin dscacheutil -flushcache >/dev/null 2>&1 || true
      sudo_si_besoin killall -HUP mDNSResponder >/dev/null 2>&1 || true
      ;;
    linux|wsl)
      if commande_existe resolvectl; then
        sudo_si_besoin resolvectl flush-caches >/dev/null 2>&1 || true
      fi
      ;;
  esac
}
