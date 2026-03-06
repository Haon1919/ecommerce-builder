terraform {
  required_version = ">= 1.6.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }

  # Remote state in GCS (run setup-gcp.sh first to create the bucket)
  # backend "gcs" {
  #   bucket = "PLACEHOLDER_TF_STATE_BUCKET" # Replace after running setup-gcp.sh
  #   prefix = "terraform/state"
  # }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# ==================== ENABLE APIs ====================
resource "google_project_service" "required_apis" {
  for_each = toset([
    "run.googleapis.com",
    "sql-component.googleapis.com",
    "sqladmin.googleapis.com",
    "storage.googleapis.com",
    "secretmanager.googleapis.com",
    "pubsub.googleapis.com",
    "monitoring.googleapis.com",
    "logging.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "vpcaccess.googleapis.com",
    "servicenetworking.googleapis.com",
  ])

  service            = each.value
  disable_on_destroy = false
}

# ==================== SERVICE ACCOUNT ====================
resource "google_service_account" "app_sa" {
  account_id   = "ecommerce-builder-app"
  display_name = "Ecommerce Builder App Service Account"
  depends_on   = [google_project_service.required_apis]
}

resource "google_project_iam_member" "app_sa_roles" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/storage.objectAdmin",
    "roles/secretmanager.secretAccessor",
    "roles/pubsub.publisher",
    "roles/monitoring.metricWriter",
    "roles/logging.logWriter",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.app_sa.email}"
}

# ==================== SECRETS ====================
locals {
  secrets = {
    "db-password"    = var.db_password
    "jwt-secret"     = var.jwt_secret
    "encryption-key" = var.encryption_key
    "gemini-api-key" = var.gemini_api_key
  }
}

resource "google_secret_manager_secret" "app_secrets" {
  for_each  = local.secrets
  secret_id = "ecommerce-builder-${each.key}"

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "app_secret_versions" {
  for_each    = local.secrets
  secret      = google_secret_manager_secret.app_secrets[each.key].id
  secret_data = each.value
}

# ==================== GCS BUCKET ====================
resource "google_storage_bucket" "media_bucket" {
  name          = "${var.project_id}-ecommerce-media"
  location      = var.region
  force_destroy = false

  uniform_bucket_level_access = true
  public_access_prevention    = "inherited"

  cors {
    origin          = ["*"]
    method          = ["GET", "POST", "PUT"]
    response_header = ["Content-Type", "Authorization"]
    max_age_seconds = 3600
  }

  lifecycle_rule {
    condition { age = 365 }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }
}

resource "google_storage_bucket_iam_member" "media_public" {
  bucket = google_storage_bucket.media_bucket.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

# ==================== CLOUD SQL ====================
resource "google_sql_database_instance" "postgres" {
  name             = "ecommerce-builder-pg"
  database_version = "POSTGRES_15"
  region           = var.region

  deletion_protection = true # Set to false to allow `terraform destroy`

  settings {
    tier              = var.db_tier
    availability_type = var.environment == "production" ? "REGIONAL" : "ZONAL"
    disk_autoresize   = true
    disk_size         = 20

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      backup_retention_settings {
        retained_backups = 7
      }
    }

    insights_config {
      query_insights_enabled  = true
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = false
    }

    ip_configuration {
      ipv4_enabled    = false # Use Private IP only
      private_network = google_compute_network.vpc.id
    }

    maintenance_window {
      day          = 7 # Sunday
      hour         = 3 # 3 AM UTC
      update_track = "stable"
    }
  }

  depends_on = [
    google_project_service.required_apis,
    google_service_networking_connection.private_vpc_connection,
  ]
}

resource "google_sql_database" "app_db" {
  name     = "ecommerce_builder"
  instance = google_sql_database_instance.postgres.name
}

resource "google_sql_user" "app_user" {
  name     = "app_user"
  instance = google_sql_database_instance.postgres.name
  password = var.db_password
}

# ==================== VPC FOR PRIVATE SQL ====================
resource "google_compute_network" "vpc" {
  name                    = "ecommerce-builder-vpc"
  auto_create_subnetworks = true
  depends_on              = [google_project_service.required_apis]
}

resource "google_compute_global_address" "private_ip_range" {
  name          = "ecommerce-builder-private-ip"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc.id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_range.name]
  depends_on              = [google_project_service.required_apis]
}

resource "google_compute_subnetwork" "serverless_subnet" {
  count         = var.low_cost_mode ? 1 : 0
  name          = "serverless-subnet"
  ip_cidr_range = "10.0.0.0/28"
  region        = var.region
  network       = google_compute_network.vpc.id
}

resource "google_vpc_access_connector" "connector" {
  count         = var.low_cost_mode ? 0 : 1
  name          = "ecommerce-connector"
  region        = var.region
  ip_cidr_range = "10.8.0.0/28"
  network       = google_compute_network.vpc.name
  min_instances = 2
  max_instances = 3
  depends_on    = [google_project_service.required_apis]
}

# ==================== CLOUD RUN SERVICES ====================
locals {
  db_url    = "postgresql://app_user:${var.db_password}@${google_sql_database_instance.postgres.private_ip_address}:5432/ecommerce_builder"
  image_tag = var.environment == "production" ? "latest" : var.environment
}

resource "google_cloud_run_v2_service" "api" {
  name     = "ecommerce-api"
  location = var.region

  template {
    service_account = google_service_account.app_sa.email

    dynamic "vpc_access" {
      for_each = var.low_cost_mode ? [] : [1]
      content {
        connector = google_vpc_access_connector.connector[0].id
        egress    = "ALL_TRAFFIC"
      }
    }

    dynamic "vpc_access" {
      for_each = var.low_cost_mode ? [1] : []
      content {
        network_interfaces {
          network    = google_compute_network.vpc.name
          subnetwork = google_compute_subnetwork.serverless_subnet[0].name
        }
        egress = "ALL_TRAFFIC"
      }
    }

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    containers {
      image = "gcr.io/${var.project_id}/ecommerce-api:${local.image_tag}"

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        startup_cpu_boost = true
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "DATABASE_URL"
        value = local.db_url
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "GCS_BUCKET_NAME"
        value = google_storage_bucket.media_bucket.name
      }
      env {
        name  = "STRUCTURED_LOGGING"
        value = "true"
      }
      env {
        name  = "SUPER_ADMIN_EMAIL"
        value = var.super_admin_email
      }

      env {
        name = "JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.app_secrets["jwt-secret"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "ENCRYPTION_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.app_secrets["encryption-key"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "GEMINI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.app_secrets["gemini-api-key"].secret_id
            version = "latest"
          }
        }
      }

      liveness_probe {
        http_get { path = "/health" }
        initial_delay_seconds = 30
        period_seconds        = 30
      }
    }
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_cloud_run_service_iam_member" "api_public" {
  location = google_cloud_run_v2_service.api.location
  service  = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service" "admin" {
  name     = "ecommerce-admin"
  location = var.region

  template {
    scaling {
      min_instance_count = var.min_instances
      max_instance_count = 5
    }
    containers {
      image = "gcr.io/${var.project_id}/ecommerce-admin:${local.image_tag}"
      resources {
        limits = {
          cpu    = "1"
          memory = "256Mi"
        }
      }
      env {
        name  = "NEXT_PUBLIC_API_URL"
        value = "https://${google_cloud_run_v2_service.api.uri}"
      }
    }
  }
}

resource "google_cloud_run_service_iam_member" "admin_public" {
  location = google_cloud_run_v2_service.admin.location
  service  = google_cloud_run_v2_service.admin.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service" "store" {
  name     = "ecommerce-store"
  location = var.region

  template {
    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }
    containers {
      image = "gcr.io/${var.project_id}/ecommerce-store:${local.image_tag}"
      resources {
        limits = {
          cpu    = "1"
          memory = "256Mi"
        }
      }
      env {
        name  = "NEXT_PUBLIC_API_URL"
        value = "https://${google_cloud_run_v2_service.api.uri}"
      }
    }
  }
}

resource "google_cloud_run_service_iam_member" "store_public" {
  location = google_cloud_run_v2_service.store.location
  service  = google_cloud_run_v2_service.store.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service" "super_admin" {
  name     = "ecommerce-super-admin"
  location = var.region

  template {
    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }
    containers {
      image = "gcr.io/${var.project_id}/ecommerce-super-admin:${local.image_tag}"
      resources {
        limits = {
          cpu    = "1"
          memory = "256Mi"
        }
      }
      env {
        name  = "NEXT_PUBLIC_API_URL"
        value = "https://${google_cloud_run_v2_service.api.uri}"
      }
    }
  }
}

resource "google_cloud_run_service_iam_member" "super_admin_public" {
  location = google_cloud_run_v2_service.super_admin.location
  service  = google_cloud_run_v2_service.super_admin.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ==================== CLOUD MONITORING ALERTS ====================
resource "google_monitoring_alert_policy" "high_error_rate" {
  display_name = "High Error Rate — Ecommerce Builder"
  combiner     = "OR"

  conditions {
    display_name = "Cloud Run 5xx rate > 5%"
    condition_threshold {
      filter          = "resource.type = \"cloud_run_revision\" AND metric.type = \"run.googleapis.com/request_count\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.05
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }

  documentation {
    content = "High error rate detected on Ecommerce Builder platform. Check logs for details."
  }

  depends_on = [google_project_service.required_apis]
}

# ==================== CLOUD RUN JOB: PERFORMANCE TESTS ====================
resource "google_cloud_run_v2_job" "performance_test" {
  name     = "ecommerce-performance-test"
  location = var.region

  template {
    template {
      service_account = google_service_account.app_sa.email

      # Tests might need to hit private database endpoints in the future
      dynamic "vpc_access" {
        for_each = var.low_cost_mode ? [] : [1]
        content {
          connector = google_vpc_access_connector.connector[0].id
          egress    = "ALL_TRAFFIC"
        }
      }

      dynamic "vpc_access" {
        for_each = var.low_cost_mode ? [1] : []
        content {
          network_interfaces {
            network    = google_compute_network.vpc.name
            subnetwork = google_compute_subnetwork.serverless_subnet[0].name
          }
          egress = "ALL_TRAFFIC"
        }
      }

      containers {
        image = "gcr.io/${var.project_id}/ecommerce-performance-tests:${local.image_tag}"

        # Command to run a specific test by default, can be overridden when executing
        command = ["k6", "run", "/tests/scenarios/storefront-load.js"]

        resources {
          limits = {
            cpu    = "2"
            memory = "1024Mi"
          }
        }

        # The TARGET_URL the scripts expect to hit
        env {
          name  = "TARGET_URL"
          value = "https://${google_cloud_run_v2_service.store.uri}"
        }
      }
    }
  }

  depends_on = [
    google_project_service.required_apis,
    google_cloud_run_v2_service.store
  ]
}
