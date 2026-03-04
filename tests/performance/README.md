# Performance Testing Suite (k6)

This directory contains the performance testing scripts and infrastructure configuration for the Ecommerce Builder platform using [k6](https://k6.io/).

## Local Execution (Docker)

You can run the performance tests locally against a running local development server (`npm run dev`) using Docker. The k6 Docker image runs the tests without requiring k6 to be installed on your host machine.

From the repository root, run:
```bash
# Make sure your local dev server is running first
npm run test:perf:local
```

This will spin up a transient k6 container, mount the `scenarios` folder, and execute the default test against `http://localhost:3003` (the storefront).

### Running Specific Scenarios Locally

You can override the target URL and scenario via Docker environment variables:
```bash
docker run --rm -it -v "$(pwd)/tests/performance/scenarios:/tests/scenarios" \
  -e TARGET_URL=http://localhost:3001/api \
  grafana/k6 run /tests/scenarios/api-checkout-load.js
```

## Cloud Execution (GCP Cloud Run Jobs)

The infrastructure includes a Terraform-managed **Cloud Run Job** (`ecommerce-performance-test`) that runs these exact scripts in the GCP environment over the private VPC. This allows extremely high throughput load testing without taxing your local machine or traversing the public internet overhead unecessarily for internal API tests.

### 1. Build and Push the Docker Image
Before triggering a run, you must build the image and push it to GCR:
```bash
export PROJECT_ID=$(gcloud config get-value project)
docker build -t gcr.io/$PROJECT_ID/ecommerce-performance-tests:latest tests/performance
docker push gcr.io/$PROJECT_ID/ecommerce-performance-tests:latest
```

### 2. Execute the Cloud Run Job
You can trigger the job manually from the initial default configuration (storefront load test):
```bash
gcloud run jobs execute ecommerce-performance-test --region=us-central1 --wait
```

### 3. Execute a Specific Scenario in the Cloud
If you want to run the API checkout load test instead of the default, you can override the arguments when executing the job:
```bash
gcloud run jobs execute ecommerce-performance-test \
  --region=us-central1 \
  --update-env-vars="TARGET_URL=https://ecommerce-api-XYZ-uc.a.run.app/api" \
  --args="run,/tests/scenarios/api-checkout-load.js" \
  --wait
```
*(Replace the API URL with your actual deployed API URL).*

## Adding New Scenarios
To add a new scenario, create a `.js` file in `tests/performance/scenarios/` and export a default function. You get full autocompletion in VSCode because of the `@types/k6` dependency in this directory's `package.json`.
