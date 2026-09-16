#!/usr/bin/env bash
# Vérifie que chaque service de la stack répond correctement.
# Code de sortie non nul si au moins un contrôle échoue.
set -uo pipefail
. "$(cd -- "$(dirname -- "$0")" && pwd)/lib.sh"
# lib.sh active -euo pipefail : ici on veut enchaîner tous les contrôles, y
# compris ceux qui échouent, et tolérer un tableau de résultats vide (bash 3.2).
set +eu

ENV_FICHIER="$RACINE_DEPOT/.env"
RESULTATS=()

# Tinyauth ne redirige vers sa page de connexion que les clients qu'il identifie
# comme des navigateurs ; aux autres il répond 401. Sans cet en-tête, le contrôle
# du routage signalerait en échec les hôtes protégés, qui fonctionnent pourtant.
NAVIGATEUR='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'

resultat() { # nom succès(0/1) détail
  local etat='ECHEC'
  [ "$2" -eq 0 ] && etat='OK'
  RESULTATS+=("$1|$etat|$3")
}

cfg() { lire_dotenv "$ENV_FICHIER" "$1" "${2:-}"; }

code_http() { # url [en-tête Host]
  if [ -n "${2:-}" ]; then
    curl -s -o /dev/null -w '%{http_code}' -A "$NAVIGATEUR" -H "Host: $2" "$1" 2>/dev/null || printf '000'
  else
    curl -s -o /dev/null -w '%{http_code}' -A "$NAVIGATEUR" "$1" 2>/dev/null || printf '000'
  fi
}

commande_existe curl || { erreur 'curl est requis par ce script'; exit 1; }

etape 'Conteneurs'
while IFS='|' read -r service statut; do
  [ -n "$service" ] || continue
  succes=1
  case "$statut" in
    Up*unhealthy*) succes=1 ;;
    Up*) succes=0 ;;
  esac
  resultat "$service" "$succes" "$statut"
done <<< "$(compose ps --format '{{.Service}}|{{.Status}}' 2>/dev/null)"

etape 'Bases de données'

pg=$(compose exec -T postgres psql -U "$(cfg POSTGRES_USER dev)" -d "$(cfg POSTGRES_DB devdb)" \
  -tAc "SELECT extversion FROM pg_extension WHERE extname='vector'" 2>/dev/null | tr -d '\r' | tr -d ' ')
[ -n "$pg" ] && resultat 'postgres/pgvector' 0 "vector $pg" || resultat 'postgres/pgvector' 1 'pas de réponse'

my=$(compose exec -T mariadb mariadb -u "$(cfg MARIADB_USER dev)" "-p$(cfg MARIADB_PASSWORD)" -N -e 'SELECT VERSION()' 2>/dev/null | tr -d '\r')
[ -n "$my" ] && resultat 'mariadb' 0 "$my" || resultat 'mariadb' 1 'pas de réponse'

rd=$(compose exec -T redis redis-cli -a "$(cfg REDIS_PASSWORD)" --no-auth-warning ping 2>/dev/null | tr -d '\r')
case "$rd" in *PONG*) resultat 'redis' 0 "$rd" ;; *) resultat 'redis' 1 'pas de réponse' ;; esac

neo=$(compose exec -T neo4j cypher-shell -u neo4j -p "$(cfg NEO4J_PASSWORD)" 'RETURN 1 AS ok;' 2>/dev/null | tr -d '\r')
case "$neo" in *1*) resultat 'neo4j' 0 'cypher-shell' ;; *) resultat 'neo4j' 1 'pas de réponse' ;; esac

etape 'Endpoints HTTP'

verifier_endpoint() { # nom url
  local code
  code=$(code_http "$2")
  [ "$code" = '200' ] && resultat "$1" 0 "HTTP $code" || resultat "$1" 1 "HTTP $code"
}

verifier_endpoint qdrant       "http://localhost:$(cfg QDRANT_HTTP_PORT 6333)/healthz"
verifier_endpoint meilisearch  "http://localhost:$(cfg MEILI_PORT 7700)/health"
verifier_endpoint minio        "http://localhost:$(cfg MINIO_API_PORT 9000)/minio/health/live"
verifier_endpoint mailpit      "http://localhost:$(cfg MAILPIT_UI_PORT 8025)/api/v1/info"
verifier_endpoint redisinsight "http://localhost:$(cfg REDISINSIGHT_PORT 5540)/api/health/"
verifier_endpoint it-tools     "http://localhost:$(cfg IT_TOOLS_PORT 8081)/"
verifier_endpoint dockhand     "http://localhost:$(cfg DOCKHAND_PORT 8082)/"
# La racine redirige vers la page de connexion : on sonde /login, qui repond 200.
verifier_endpoint traefik-manager "http://localhost:$(cfg TRAEFIK_MANAGER_PORT 8083)/login"

etape 'Routage Traefik'

PORT_HTTP=$(cfg TRAEFIK_HTTP_PORT 80)
PORT_HTTPS=$(cfg TRAEFIK_HTTPS_PORT 443)

while IFS= read -r nom; do
  fqdn="$nom"
  http=$(code_http "http://127.0.0.1:$PORT_HTTP/" "$fqdn")
  https=$(curl -sk -o /dev/null -w '%{http_code}' -A "$NAVIGATEUR" --resolve "$fqdn:$PORT_HTTPS:127.0.0.1" \
    "https://$fqdn:$PORT_HTTPS/" 2>/dev/null || printf '000')
  succes=1
  case "$http" in 200|302) case "$https" in 200|302) succes=0 ;; esac ;; esac
  resultat "$fqdn" "$succes" "http $http / https $https"
done <<< "$(noms_stack)"

etape 'Résultat'
printf '\n'
printf '  %-22s %-7s %s\n' 'Service' 'Etat' 'Detail'
printf '  %-22s %-7s %s\n' '----------------------' '-------' '------'
echecs=0
for ligne in "${RESULTATS[@]}"; do
  IFS='|' read -r nom etat detail <<< "$ligne"
  [ "$etat" = 'OK' ] || echecs=$((echecs + 1))
  printf '  %-22s %-7s %s\n' "$nom" "$etat" "$detail"
done
printf '\n'

if [ "$echecs" -gt 0 ]; then
  erreur "$echecs contrôle(s) en échec"
  exit 1
fi
ok "${#RESULTATS[@]} contrôles passés"
