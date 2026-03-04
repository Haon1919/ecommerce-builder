#!/usr/bin/env bash
# =============================================================================
# create-secrets.sh — Rotate or create secrets in GCP Secret Manager
#
# Usage:
#   ./create-secrets.sh --project=my-project [--rotate]
# =============================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()   { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

PROJECT_ID=""
ROTATE=false

for arg in "$@"; do
  case $arg in
    --project=*) PROJECT_ID="${arg#*=}" ;;
    --rotate)    ROTATE=true ;;
    --help|-h)
      echo "Usage: $0 --project=PROJECT_ID [--rotate]"
      echo "  --rotate  Add a new version to existing secrets (safe rotation)"
      exit 0
      ;;
  esac
done

[[ -z "$PROJECT_ID" ]] && error "Required: --project=PROJECT_ID"

upsert_secret() {
  local name="$1"
  local value="$2"

  if gcloud secrets describe "$name" --project="$PROJECT_ID" &>/dev/null; then
    if $ROTATE; then
      log "Rotating secret: $name"
      echo -n "$value" | gcloud secrets versions add "$name" \
        --project="$PROJECT_ID" --data-file=-
    else
      log "Secret $name already exists. Use --rotate to add a new version."
    fi
  else
    log "Creating secret: $name"
    echo -n "$value" | gcloud secrets create "$name" \
      --project="$PROJECT_ID" \
      --replication-policy="automatic" \
      --data-file=-
  fi
}

echo ""
echo -e "${BLUE}=== Secret Manager Setup ===${NC}"
echo "Project: $PROJECT_ID"
echo ""

# Generate new values
DB_PASSWORD=$(openssl rand -base64 32 | tr -d '=/+' | head -c 32)
JWT_SECRET=$(openssl rand -base64 64)
ENCRYPTION_KEY=$(openssl rand -hex 16)

warn "This script will create/rotate secrets. Existing app instances must be restarted to pick up new secrets."

if $ROTATE; then
  warn "ROTATE mode: new secret versions will be created."
  read -r -p "Continue with rotation? [y/N] " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || { log "Aborted."; exit 0; }
fi

upsert_secret "ecommerce-builder-db-password"    "$DB_PASSWORD"
upsert_secret "ecommerce-builder-jwt-secret"     "$JWT_SECRET"
upsert_secret "ecommerce-builder-encryption-key" "$ENCRYPTION_KEY"

echo ""
echo -e "${YELLOW}ACTION REQUIRED — Set these manually (they require your input):${NC}"
echo ""
echo "  gcloud secrets versions add ecommerce-builder-gemini-api-key \\"
echo "    --project=$PROJECT_ID --data-file=<(echo -n 'YOUR_GEMINI_API_KEY')"
echo ""
echo -e "${GREEN}Auto-generated values (save these for terraform.tfvars):${NC}"
echo "  db_password    = \"${DB_PASSWORD}\""
echo "  jwt_secret     = \"${JWT_SECRET}\""
echo "  encryption_key = \"${ENCRYPTION_KEY}\""
echo ""
echo "Secrets are now stored in GCP Secret Manager."
echo "Update your terraform.tfvars with the values above, then run terraform apply."
