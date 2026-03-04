#!/usr/bin/env bash
# =============================================================================
# setup-gcp.sh — One-shot GCP bootstrap for Ecommerce Builder
#
# Run this ONCE before `terraform apply`. It:
#   1. Authenticates gcloud
#   2. Creates a GCS bucket for Terraform state
#   3. Enables the minimum APIs needed to bootstrap
#   4. Creates a Terraform service account with required permissions
#   5. Generates a terraform.tfvars with placeholders for secrets
#
# Usage:
#   chmod +x setup-gcp.sh
#   ./setup-gcp.sh --project=my-gcp-project-id --region=us-central1
# =============================================================================

set -euo pipefail

# --------------- Colours ---------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()   { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()  { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }
header() { echo -e "\n${BLUE}════════════════════════════════════════${NC}"; echo -e "${BLUE}  $*${NC}"; echo -e "${BLUE}════════════════════════════════════════${NC}"; }

# --------------- Parse args ---------------
PROJECT_ID=""
REGION="us-central1"
ENVIRONMENT="production"

for arg in "$@"; do
  case $arg in
    --project=*) PROJECT_ID="${arg#*=}" ;;
    --region=*)  REGION="${arg#*=}" ;;
    --env=*)     ENVIRONMENT="${arg#*=}" ;;
    --help|-h)
      echo "Usage: $0 --project=PROJECT_ID [--region=REGION] [--env=ENVIRONMENT]"
      exit 0
      ;;
    *) warn "Unknown argument: $arg" ;;
  esac
done

[[ -z "$PROJECT_ID" ]] && error "Required: --project=PROJECT_ID"

TF_STATE_BUCKET="${PROJECT_ID}-tf-state"
TF_SA_NAME="terraform-deployer"
TF_SA_EMAIL="${TF_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
TF_SA_KEY_FILE="$(dirname "$0")/../../.terraform-sa-key.json"
TFVARS_FILE="$(dirname "$0")/../terraform/terraform.tfvars"

header "Ecommerce Builder — GCP Bootstrap"
log "Project:     $PROJECT_ID"
log "Region:      $REGION"
log "Environment: $ENVIRONMENT"
log "TF State Bucket: $TF_STATE_BUCKET"

# --------------- Step 1: Auth check ---------------
header "Step 1 — Verify gcloud authentication"
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | grep -q "@"; then
  log "No active gcloud session found. Running: gcloud auth login"
  gcloud auth login
fi
ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -1)
log "Authenticated as: $ACTIVE_ACCOUNT"

gcloud config set project "$PROJECT_ID"
gcloud config set compute/region "$REGION"

# --------------- Step 2: Enable bootstrap APIs ---------------
header "Step 2 — Enable bootstrap APIs"
BOOTSTRAP_APIS=(
  "cloudresourcemanager.googleapis.com"
  "iam.googleapis.com"
  "storage.googleapis.com"
  "secretmanager.googleapis.com"
)

for api in "${BOOTSTRAP_APIS[@]}"; do
  log "Enabling $api..."
  gcloud services enable "$api" --project="$PROJECT_ID" --quiet
done

# --------------- Step 3: Create TF state bucket ---------------
header "Step 3 — Create Terraform state bucket"
if gsutil ls "gs://${TF_STATE_BUCKET}" &>/dev/null; then
  log "Bucket gs://${TF_STATE_BUCKET} already exists — skipping."
else
  log "Creating gs://${TF_STATE_BUCKET}..."
  gsutil mb -p "$PROJECT_ID" -l "$REGION" "gs://${TF_STATE_BUCKET}"
  gsutil versioning set on "gs://${TF_STATE_BUCKET}"
  gsutil uniform-bucket-level-access set on "gs://${TF_STATE_BUCKET}"
  log "Bucket created and versioning enabled."
fi

# --------------- Step 4: Create Terraform service account ---------------
header "Step 4 — Create Terraform service account"
if gcloud iam service-accounts describe "$TF_SA_EMAIL" --project="$PROJECT_ID" &>/dev/null; then
  log "Service account $TF_SA_EMAIL already exists — skipping creation."
else
  log "Creating service account: $TF_SA_NAME"
  gcloud iam service-accounts create "$TF_SA_NAME" \
    --display-name="Terraform Deployer" \
    --project="$PROJECT_ID"
fi

log "Granting IAM roles to Terraform service account..."
TF_ROLES=(
  "roles/editor"
  "roles/iam.securityAdmin"
  "roles/resourcemanager.projectIamAdmin"
  "roles/secretmanager.admin"
  "roles/cloudsql.admin"
  "roles/run.admin"
  "roles/storage.admin"
  "roles/servicenetworking.networksAdmin"
  "roles/vpcaccess.admin"
  "roles/monitoring.admin"
)

for role in "${TF_ROLES[@]}"; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${TF_SA_EMAIL}" \
    --role="$role" \
    --quiet 2>/dev/null || warn "Could not grant $role (may already exist)"
done

log "Granting TF SA access to the state bucket..."
gsutil iam ch "serviceAccount:${TF_SA_EMAIL}:roles/storage.objectAdmin" "gs://${TF_STATE_BUCKET}"

# --------------- Step 5: Generate SA key for CI/CD ---------------
header "Step 5 — Generate service account key"
if [[ -f "$TF_SA_KEY_FILE" ]]; then
  warn "Key file already exists: $TF_SA_KEY_FILE — skipping regeneration."
  warn "Delete it manually if you want a new key."
else
  gcloud iam service-accounts keys create "$TF_SA_KEY_FILE" \
    --iam-account="$TF_SA_EMAIL" \
    --project="$PROJECT_ID"
  log "SA key saved to: $TF_SA_KEY_FILE"
  warn "IMPORTANT: Add the contents of this file as GCP_SA_KEY in your GitHub repository secrets."
  warn "IMPORTANT: Do NOT commit this file to git. It is listed in .gitignore."
fi

# --------------- Step 6: Update main.tf with real bucket name ---------------
header "Step 6 — Update Terraform backend config"
MAIN_TF="$(dirname "$0")/../terraform/main.tf"
if grep -q "PLACEHOLDER_TF_STATE_BUCKET" "$MAIN_TF"; then
  sed -i.bak "s/PLACEHOLDER_TF_STATE_BUCKET/${TF_STATE_BUCKET}/" "$MAIN_TF"
  rm -f "${MAIN_TF}.bak"
  log "Updated main.tf backend bucket to: $TF_STATE_BUCKET"
else
  log "main.tf already has a real bucket name — skipping."
fi

# --------------- Step 7: Generate terraform.tfvars ---------------
header "Step 7 — Generate terraform.tfvars"
if [[ -f "$TFVARS_FILE" ]]; then
  warn "terraform.tfvars already exists — not overwriting. Edit manually."
else
  log "Generating placeholder tfvars at: $TFVARS_FILE"

  # Try to auto-generate secrets
  DB_PASSWORD=$(openssl rand -base64 32 | tr -d '=/+' | head -c 32)
  JWT_SECRET=$(openssl rand -base64 64)
  ENCRYPTION_KEY=$(openssl rand -hex 16)

  cat > "$TFVARS_FILE" <<TFVARS
# =====================================================
# terraform.tfvars — DO NOT COMMIT TO GIT
# Generated by setup-gcp.sh on $(date)
# =====================================================

project_id      = "${PROJECT_ID}"
region          = "${REGION}"
environment     = "${ENVIRONMENT}"

# Database
db_tier         = "db-f1-micro"   # Change to db-n1-standard-2 for production
db_password     = "${DB_PASSWORD}"

# Secrets (auto-generated — safe to use)
jwt_secret      = "${JWT_SECRET}"
encryption_key  = "${ENCRYPTION_KEY}"  # Must be exactly 32 hex chars

# REQUIRED: Add your Gemini API key from https://aistudio.google.com/app/apikey
gemini_api_key  = "REPLACE_WITH_YOUR_GEMINI_API_KEY"

# REQUIRED: Your super admin email address
super_admin_email = "REPLACE_WITH_YOUR_EMAIL@example.com"

# Scaling
min_instances   = 0   # Set to 1 to avoid cold starts (increases cost)
max_instances   = 10
TFVARS

  log "terraform.tfvars generated with auto-generated secrets."
  warn "ACTION REQUIRED: Edit $TFVARS_FILE and fill in:"
  warn "  - gemini_api_key"
  warn "  - super_admin_email"
fi

# --------------- Step 8: Initialize Terraform ---------------
header "Step 8 — Initialize Terraform"
TF_DIR="$(dirname "$0")/../terraform"
log "Running terraform init in $TF_DIR..."

(
  cd "$TF_DIR"
  export GOOGLE_APPLICATION_CREDENTIALS="$TF_SA_KEY_FILE"
  terraform init \
    -backend-config="bucket=${TF_STATE_BUCKET}" \
    -backend-config="prefix=terraform/state"
)

log "Terraform initialized successfully."

# --------------- Done ---------------
header "Bootstrap Complete!"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo "  1. Edit infrastructure/terraform/terraform.tfvars with your API keys"
echo "  2. Add the following secrets to your GitHub repository:"
echo "     - GCP_SA_KEY       → Contents of .terraform-sa-key.json"
echo "     - GCP_PROJECT_ID   → ${PROJECT_ID}"
echo "     - GCP_REGION       → ${REGION}"
echo "  3. Run: cd infrastructure/terraform && terraform plan"
echo "  4. Run: cd infrastructure/terraform && terraform apply"
echo "  5. After apply, run migrations:"
echo "     gcloud run jobs execute migrate-job --region=${REGION}"
echo ""
echo -e "${YELLOW}SECURITY REMINDERS:${NC}"
echo "  - .terraform-sa-key.json is in .gitignore — never commit it"
echo "  - terraform.tfvars is in .gitignore — never commit it"
echo "  - Rotate secrets periodically via Secret Manager"
echo ""
