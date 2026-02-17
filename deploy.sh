#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="${SCRIPT_DIR}/infra"
CONTAINER_DIR="${SCRIPT_DIR}/../hello-world-web"

AWS_REGION="us-east-1"
AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query 'Account' --output text)"
REPO_NAME="hello-world-web"
IMAGE_TAG="latest"
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPO_NAME}"

echo "==> Step 1: Create ECR repository (if not already created)"
cd "${INFRA_DIR}"
terraform apply -target=aws_ecr_repository.main -auto-approve

echo ""
echo "==> Step 2: Authenticate Docker with ECR"
aws ecr get-login-password --region "${AWS_REGION}" | \
  docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

echo ""
echo "==> Step 3: Build and push container image"
cd "${CONTAINER_DIR}"
docker build --platform linux/amd64 -t "${REPO_NAME}:${IMAGE_TAG}" .
docker tag "${REPO_NAME}:${IMAGE_TAG}" "${ECR_URI}:${IMAGE_TAG}"
docker push "${ECR_URI}:${IMAGE_TAG}"

echo ""
echo "==> Step 4: Deploy full infrastructure"
cd "${INFRA_DIR}"
terraform apply -auto-approve

echo ""
echo "==> Done! Service URL:"
terraform output -raw service_url
echo ""
