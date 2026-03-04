variable "project_id" {
  description = "GCP Project ID"
  type        = string
  # PLACEHOLDER: Set via TF_VAR_project_id env var or terraform.tfvars
}

variable "region" {
  description = "GCP region for all resources"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Deployment environment (production, staging)"
  type        = string
  default     = "production"
}

variable "db_tier" {
  description = "Cloud SQL machine tier"
  type        = string
  default     = "db-f1-micro" # Change to db-n1-standard-2 for production
}

variable "db_password" {
  description = "PostgreSQL database password"
  type        = string
  sensitive   = true
  # PLACEHOLDER: Set via TF_VAR_db_password or Secret Manager
}

variable "jwt_secret" {
  description = "JWT signing secret (min 64 chars)"
  type        = string
  sensitive   = true
  # PLACEHOLDER: Generate with: openssl rand -base64 64
}

variable "encryption_key" {
  description = "AES-256 encryption key for PII (exactly 32 chars)"
  type        = string
  sensitive   = true
  # PLACEHOLDER: Generate with: openssl rand -hex 16
}

variable "gemini_api_key" {
  description = "Google Gemini API key"
  type        = string
  sensitive   = true
  # PLACEHOLDER: https://aistudio.google.com/app/apikey
}

variable "super_admin_email" {
  description = "Email address for the super admin account"
  type        = string
  # PLACEHOLDER: your-admin@example.com
}

variable "min_instances" {
  description = "Minimum number of Cloud Run instances"
  type        = number
  default     = 0 # Set to 1 to avoid cold starts
}

variable "max_instances" {
  description = "Maximum number of Cloud Run instances"
  type        = number
  default     = 10
}
