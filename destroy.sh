#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="${SCRIPT_DIR}/infra"

AWS_REGION="us-east-1"
AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query 'Account' --output text)"
REPO_NAME="hello-world-web"
IMAGE_TAG="latest"
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPO_NAME}"

PROJECT_NAME="hello-world-web"
ENVIRONMENT="sandbox"
DOMAIN_NAME="hello.the-demo-lab.com"
HOSTED_ZONE_ID="Z04186241E78KS1NJ8TIH"
CONTAINER_PORT="80"
TF_VARS=(-var "project_name=${PROJECT_NAME}" -var "environment=${ENVIRONMENT}" -var "container_image=${ECR_URI}:${IMAGE_TAG}" -var "domain_name=${DOMAIN_NAME}" -var "hosted_zone_id=${HOSTED_ZONE_ID}" -var "container_port=${CONTAINER_PORT}")

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
echo "==> Step 2: Destroy all infrastructure"
${TF} destroy "${TF_VARS[@]}" -auto-approve

echo ""
echo "==> Done! All resources destroyed."
