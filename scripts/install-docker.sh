#!/usr/bin/env bash
# Vérifie le moteur Docker, l'installe si nécessaire, puis attend qu'il réponde.
#   macOS : Docker Desktop via Homebrew.
#   Linux : script officiel get.docker.com (demande confirmation).
# Si le moteur répond déjà, le script ne fait rien.
set -euo pipefail
. "$(cd -- "$(dirname -- "$0")" && pwd)/lib.sh"

DELAI=240
FORCE=0
ASSUME_OUI=${ASSUME_OUI:-0}

while [ $# -gt 0 ]; do
  case "$1" in
    --force) FORCE=1 ;;
    --timeout) DELAI="$2"; shift ;;
    -y|--yes) ASSUME_OUI=1 ;;
    -h|--help)
      printf 'Usage: %s [--force] [--timeout SECONDES] [-y]\n' "$0"
      exit 0
      ;;
    *) erreur "option inconnue : $1"; exit 2 ;;
  esac
  shift
done

etape 'Docker'

if moteur_docker_ok && [ "$FORCE" -eq 0 ]; then
  ok "moteur Docker $(docker version --format '{{.Server.Version}}') opérationnel"
  compose_v2_ok || { erreur "le plugin « docker compose » v2 est absent"; exit 1; }
  exit 0
fi

OS=$(systeme)

if ! commande_existe docker; then
  note "Docker est absent de cette machine ($OS)"
  case "$OS" in
    macos)
      if ! commande_existe brew; then
        erreur 'Homebrew introuvable : installe Docker Desktop manuellement'
        note 'https://www.docker.com/products/docker-desktop/'
        exit 1
      fi
      demander 'Installer Docker Desktop via Homebrew ?' || { note 'abandon'; exit 1; }
      brew install --cask docker-desktop || brew install --cask docker
      ok 'Docker Desktop installé'
      ;;
    linux|wsl)
      note 'installation via le script officiel https://get.docker.com (root requis)'
      demander 'Continuer ?' || { note 'abandon'; exit 1; }
      script=$(mktemp)
      curl -fsSL https://get.docker.com -o "$script"
      sudo_si_besoin sh "$script"
      rm -f "$script"
      if ! groups | grep -qw docker; then
        sudo_si_besoin usermod -aG docker "$(id -un)" || true
        note "ton compte a été ajouté au groupe docker : déconnecte-toi puis reconnecte-toi"
        note "sans cela, chaque commande docker devra être préfixée de sudo"
      fi
      ;;
    windows)
      erreur 'sous Windows, utilise scripts\\install-docker.ps1 dans un PowerShell administrateur'
      exit 1
      ;;
    *)
      erreur "système non reconnu : installe Docker manuellement"
      exit 1
      ;;
  esac
fi

# Le binaire est là mais le moteur ne répond pas : on le démarre.
case "$OS" in
  macos)
    if ! moteur_docker_ok; then
      note 'démarrage de Docker Desktop'
      open -a Docker 2>/dev/null || open -a 'Docker Desktop' 2>/dev/null || true
    fi
    ;;
  linux|wsl)
    if ! moteur_docker_ok && commande_existe systemctl; then
      note 'démarrage du service docker'
      sudo_si_besoin systemctl enable --now docker || true
    fi
    ;;
esac

printf '    attente du moteur '
if attendre moteur_docker_ok "$DELAI"; then
  printf '\n'
else
  printf '\n'
  erreur "le moteur Docker n'a pas répondu en $DELAI secondes"
  case "$OS" in
    macos) note "ouvre Docker Desktop, attends l'icône verte, puis relance" ;;
    linux|wsl) note "vérifie : systemctl status docker — et que ton compte est dans le groupe docker" ;;
  esac
  exit 1
fi

if ! compose_v2_ok; then
  erreur 'le plugin « docker compose » v2 est absent'
  note 'Debian/Ubuntu : sudo apt install docker-compose-plugin'
  note 'Fedora/RHEL   : sudo dnf install docker-compose-plugin'
  exit 1
fi

ok "moteur Docker $(docker version --format '{{.Server.Version}}') opérationnel"
