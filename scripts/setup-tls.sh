#!/usr/bin/env bash
# Génère des certificats HTTPS reconnus par le navigateur avec mkcert.
#
# mkcert -install ajoute une autorité de certification racine au magasin de
# confiance du système (et à celui de Firefox si certutil est présent). C'est
# une modification de la sécurité de la machine, réversible avec
# « mkcert -uninstall ». Le script demande confirmation sauf avec --accept-root-ca.
set -euo pipefail
. "$(cd -- "$(dirname -- "$0")" && pwd)/lib.sh"

ACCEPTE=0
ASSUME_OUI=${ASSUME_OUI:-0}
while [ $# -gt 0 ]; do
  case "$1" in
    --accept-root-ca|-y) ACCEPTE=1 ;;
    -h|--help) printf 'Usage: %s [--accept-root-ca]\n' "$0"; exit 0 ;;
    *) erreur "option inconnue : $1"; exit 2 ;;
  esac
  shift
done

etape 'Certificats HTTPS'

DOSSIER_CERTS="$RACINE_DEPOT/config/traefik/certs"
DOSSIER_DYN="$RACINE_DEPOT/config/traefik/dynamic"

if [ "$ACCEPTE" -eq 0 ]; then
  note "mkcert va installer une autorité de certification racine dans le magasin"
  note "de confiance du système. Cela modifie la configuration de sécurité de la"
  note "machine. Réversible avec : mkcert -uninstall"
  demander 'Continuer ?' || { note 'abandon, aucun changement'; exit 0; }
fi

if ! commande_existe mkcert; then
  note 'installation de mkcert'
  case "$(systeme)" in
    macos)
      if ! commande_existe brew; then
        erreur 'Homebrew introuvable : installe mkcert manuellement'
        exit 1
      fi
      brew install mkcert nss
      ;;
    linux|wsl)
      if commande_existe apt-get; then
        sudo_si_besoin apt-get update -qq
        sudo_si_besoin apt-get install -y mkcert libnss3-tools || true
      elif commande_existe dnf; then
        sudo_si_besoin dnf install -y mkcert nss-tools || true
      elif commande_existe pacman; then
        sudo_si_besoin pacman -S --noconfirm mkcert nss || true
      fi
      if ! commande_existe mkcert; then
        # Pas de paquet : binaire officiel dans ~/.local/bin.
        arch=$(uname -m)
        case "$arch" in
          x86_64|amd64) arch=amd64 ;;
          aarch64|arm64) arch=arm64 ;;
          *) erreur "architecture non gérée : $arch"; exit 1 ;;
        esac
        mkdir -p "$HOME/.local/bin"
        note "téléchargement du binaire mkcert (linux/$arch)"
        curl -fsSL "https://dl.filippo.io/mkcert/latest?for=linux/$arch" -o "$HOME/.local/bin/mkcert"
        chmod +x "$HOME/.local/bin/mkcert"
        export PATH="$HOME/.local/bin:$PATH"
        note "mkcert installé dans ~/.local/bin : ajoute ce dossier à ton PATH"
      fi
      ;;
    *)
      erreur 'système non géré : installe mkcert manuellement'
      exit 1
      ;;
  esac
fi

commande_existe mkcert || { erreur 'mkcert reste introuvable'; exit 1; }

note "installation de l'autorité racine locale"
mkcert -install

mkdir -p "$DOSSIER_CERTS"
(
  cd "$DOSSIER_CERTS"
  mkcert -cert-file local.pem -key-file local-key.pem '*.test' '*.localhost' localhost 127.0.0.1 ::1
)
ok "certificat écrit dans $DOSSIER_CERTS"

# Sur Linux, Traefik tourne en non-root dans son conteneur : la clé privée
# générée en 0600 lui serait illisible via le montage en lecture seule.
chmod 0644 "$DOSSIER_CERTS/local-key.pem" "$DOSSIER_CERTS/local.pem"

cp "$DOSSIER_DYN/tls.yml.example" "$DOSSIER_DYN/tls.yml"
ok 'configuration TLS activée pour Traefik'

compose restart traefik >/dev/null
ok 'Traefik redémarré, les certificats sont actifs'
note "redémarre le navigateur pour qu'il prenne en compte la nouvelle autorité"
