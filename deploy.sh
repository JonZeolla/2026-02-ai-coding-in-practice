#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="${SCRIPT_DIR}/infra"

AWS_REGION="us-east-1"
AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query 'Account' --output text)"
REPO_NAME="hiring-portal"
IMAGE_TAG="latest"
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPO_NAME}"

PROJECT_NAME="hiring-portal"
ENVIRONMENT="sandbox"
DOMAIN_NAME="hello.the-demo-lab.com"
HOSTED_ZONE_ID="Z04186241E78KS1NJ8TIH"
CONTAINER_PORT="3000"

# DB_PASSWORD is required for RDS; ANTHROPIC_API_KEY is optional
DB_PASSWORD="${DB_PASSWORD:?DB_PASSWORD must be set for RDS}"

# Additional env vars passed to the container (on top of auto-wired RDS/Redis endpoints)
ENV_VARS="{"
ENV_VARS+="\"ANTHROPIC_API_KEY\":\"${ANTHROPIC_API_KEY:-}\""
ENV_VARS+="}"

TF_VARS=(
  -var "project_name=${PROJECT_NAME}"
  -var "environment=${ENVIRONMENT}"
  -var "container_image=${ECR_URI}:${IMAGE_TAG}"
  -var "domain_name=${DOMAIN_NAME}"
  -var "hosted_zone_id=${HOSTED_ZONE_ID}"
  -var "container_port=${CONTAINER_PORT}"
  -var "cpu=1024"
  -var "memory=2048"
  -var "db_password=${DB_PASSWORD}"
  -var "environment_variables=${ENV_VARS}"
)

# Prefer terraform, fall back to tofu
if command -v terraform &>/dev/null; then
  TF="terraform"
elif command -v tofu &>/dev/null; then
  TF="tofu"
else
  echo "Error: neither terraform nor tofu found in PATH" >&2
  exit 1
fi
echo "Using: ${TF}"

echo ""
echo "==> Step 1: Initialize infrastructure"
cd "${INFRA_DIR}"
if [ ! -f backend.hcl ]; then
  echo "Error: ${INFRA_DIR}/backend.hcl not found. Copy backend.hcl.example and fill in your values." >&2
  exit 1
fi
${TF} init -backend-config=backend.hcl

echo ""
echo "==> Step 2: Create ECR repository (if not already created)"
${TF} apply -target=aws_ecr_repository.main "${TF_VARS[@]}" -auto-approve

echo ""
echo "==> Step 3: Authenticate Docker with ECR"
aws ecr get-login-password --region "${AWS_REGION}" |
  docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

echo ""
echo "==> Step 4: Build and push unified container image"
cd "${SCRIPT_DIR}"
docker build --platform linux/amd64 -t "${REPO_NAME}:${IMAGE_TAG}" .
docker tag "${REPO_NAME}:${IMAGE_TAG}" "${ECR_URI}:${IMAGE_TAG}"
docker push "${ECR_URI}:${IMAGE_TAG}"

echo ""
echo "==> Step 5: Deploy full infrastructure"
cd "${INFRA_DIR}"
${TF} apply "${TF_VARS[@]}" -auto-approve

echo ""
echo "==> Done! Service URL:"
${TF} output -raw service_url 2>/dev/null || echo "(output not yet available)"
echo ""
