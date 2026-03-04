output "api_url" {
  description = "Cloud Run API service URL"
  value       = google_cloud_run_v2_service.api.uri
}

output "admin_url" {
  description = "Cloud Run Admin panel URL"
  value       = google_cloud_run_v2_service.admin.uri
}

output "store_url" {
  description = "Cloud Run Store frontend URL"
  value       = google_cloud_run_v2_service.store.uri
}

output "super_admin_url" {
  description = "Cloud Run Super Admin URL"
  value       = google_cloud_run_v2_service.super_admin.uri
}

output "media_bucket_name" {
  description = "GCS media storage bucket name"
  value       = google_storage_bucket.media_bucket.name
}

output "media_bucket_url" {
  description = "GCS media storage bucket URL"
  value       = "https://storage.googleapis.com/${google_storage_bucket.media_bucket.name}"
}

output "database_instance_name" {
  description = "Cloud SQL instance name"
  value       = google_sql_database_instance.postgres.name
}

output "database_private_ip" {
  description = "Cloud SQL private IP address"
  value       = google_sql_database_instance.postgres.private_ip_address
}

output "database_connection_name" {
  description = "Cloud SQL connection name for Cloud SQL Proxy"
  value       = google_sql_database_instance.postgres.connection_name
}

output "service_account_email" {
  description = "App service account email"
  value       = google_service_account.app_sa.email
}

output "vpc_name" {
  description = "VPC network name"
  value       = google_compute_network.vpc.name
}

output "vpc_connector_name" {
  description = "VPC Access Connector name"
  value       = google_vpc_access_connector.connector.name
}

output "secret_names" {
  description = "Secret Manager secret IDs"
  value = {
    for k, v in google_secret_manager_secret.app_secrets : k => v.secret_id
  }
}

output "deployment_summary" {
  description = "Full deployment summary"
  value       = <<-EOT
    ===== Ecommerce Builder Deployment Summary =====

    API:         ${google_cloud_run_v2_service.api.uri}
    Admin Panel: ${google_cloud_run_v2_service.admin.uri}
    Store:       ${google_cloud_run_v2_service.store.uri}
    Super Admin: ${google_cloud_run_v2_service.super_admin.uri}

    Database: ${google_sql_database_instance.postgres.connection_name}
    Media Bucket: ${google_storage_bucket.media_bucket.name}

    Next steps:
    1. Run database migrations: npm run db:migrate
    2. Seed the database: npm run db:seed
    3. Configure your store at the Admin Panel URL
  EOT
}
