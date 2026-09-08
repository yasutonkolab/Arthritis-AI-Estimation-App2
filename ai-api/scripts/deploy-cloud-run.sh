#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ $# -lt 3 || $# -gt 4 ]]; then
  echo "Usage: $0 PROJECT_ID SUPABASE_STORAGE_HOST API_KEY_SECRET_NAME [SERVICE_NAME]" >&2
  exit 2
fi

if [[ ! -f model/ra_screening_model.pt ]]; then
  echo "model/ra_screening_model.pt is missing. This weight file is not stored in git; place the delivered checkpoint at that path before deploying." >&2
  exit 1
fi

project_id=$1
supabase_host=$2
secret_name=$3
service_name=${4:-ra-image-inference}
region=asia-northeast1
repository=ra-inference
runtime_service_account="${service_name}-runtime@${project_id}.iam.gserviceaccount.com"
image="${region}-docker.pkg.dev/${project_id}/${repository}/${service_name}:$(date +%Y%m%d%H%M%S)"

if [[ ! "$supabase_host" =~ ^[a-z0-9][a-z0-9.-]*\.supabase\.co$ ]]; then
  echo "SUPABASE_STORAGE_HOST must be one Supabase hostname, for example example.supabase.co." >&2
  exit 2
fi

gcloud artifacts repositories describe "$repository" --project="$project_id" --location="$region" >/dev/null 2>&1 \
  || gcloud artifacts repositories create "$repository" --project="$project_id" --location="$region" --repository-format=docker
gcloud artifacts repositories set-cleanup-policies "$repository" \
  --project="$project_id" \
  --location="$region" \
  --policy=artifact-registry-cleanup-policy.json \
  --no-dry-run
gcloud secrets describe "$secret_name" --project="$project_id" >/dev/null
gcloud iam service-accounts describe "$runtime_service_account" --project="$project_id" >/dev/null 2>&1 \
  || gcloud iam service-accounts create "${service_name}-runtime" --project="$project_id" --display-name="${service_name} Cloud Run runtime"
gcloud secrets add-iam-policy-binding "$secret_name" --project="$project_id" \
  --member="serviceAccount:${runtime_service_account}" \
  --role="roles/secretmanager.secretAccessor" >/dev/null
source_bucket="${project_id}_cloudbuild"
source_staging="gs://${source_bucket}/source"
if gcloud storage buckets describe "gs://${source_bucket}" --project="$project_id" >/dev/null 2>&1; then
  gcloud storage buckets update "gs://${source_bucket}" --project="$project_id" \
    --lifecycle-file=cloudbuild-source-lifecycle.json
fi
gcloud builds submit --project="$project_id" --config=cloudbuild.yaml \
  --gcs-source-staging-dir="$source_staging" \
  --substitutions="_IMAGE=${image}" \
  .
gcloud storage buckets update "gs://${source_bucket}" --project="$project_id" \
  --lifecycle-file=cloudbuild-source-lifecycle.json
gcloud run deploy "$service_name" \
  --project="$project_id" \
  --region="$region" \
  --image="$image" \
  --allow-unauthenticated \
  --port=8080 \
  --cpu=2 \
  --memory=4Gi \
  --concurrency=1 \
  --min-instances=0 \
  --max-instances=2 \
  --timeout=60 \
  --cpu-throttling \
  --service-account="$runtime_service_account" \
  --set-env-vars="SUPABASE_STORAGE_HOSTS=${supabase_host}" \
  --set-secrets="AI_API_KEY=${secret_name}:latest"
gcloud artifacts repositories delete "$repository" \
  --project="$project_id" \
  --location="$region" \
  --quiet

echo "Deployed ${service_name}."
