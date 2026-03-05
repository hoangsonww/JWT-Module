#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# JWT Module — AWS ECS Deployment Script
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# ---------- Configuration ----------
ENVIRONMENT="${1:?Usage: deploy.sh <environment> [image-tag]}"
IMAGE_TAG="${2:-$(git -C "$PROJECT_ROOT" rev-parse --short HEAD)}"
REGION="${AWS_REGION:-us-east-1}"
PROJECT_NAME="jwt-module"
NAME_PREFIX="${PROJECT_NAME}-${ENVIRONMENT}"

echo "==> Deploying ${NAME_PREFIX} with tag ${IMAGE_TAG}"

# ---------- Get ECR URL ----------
ECR_URL=$(aws ecr describe-repositories \
  --repository-names "$PROJECT_NAME" \
  --region "$REGION" \
  --query 'repositories[0].repositoryUri' \
  --output text)

echo "==> ECR Repository: ${ECR_URL}"

# ---------- Authenticate Docker ----------
aws ecr get-login-password --region "$REGION" | \
  docker login --username AWS --password-stdin "${ECR_URL%%/*}"

# ---------- Build & Push ----------
echo "==> Building Docker image..."
docker build -t "${ECR_URL}:${IMAGE_TAG}" -t "${ECR_URL}:latest" "$PROJECT_ROOT"

echo "==> Pushing to ECR..."
docker push "${ECR_URL}:${IMAGE_TAG}"
docker push "${ECR_URL}:latest"

# ---------- Update ECS Service ----------
CLUSTER_NAME="${NAME_PREFIX}-cluster"
SERVICE_NAME="${NAME_PREFIX}-service"

echo "==> Forcing new deployment on ECS service..."
aws ecs update-service \
  --cluster "$CLUSTER_NAME" \
  --service "$SERVICE_NAME" \
  --force-new-deployment \
  --region "$REGION" \
  --no-cli-pager

# ---------- Wait for Stability ----------
echo "==> Waiting for service to stabilize (timeout: 10 min)..."
if aws ecs wait services-stable \
  --cluster "$CLUSTER_NAME" \
  --services "$SERVICE_NAME" \
  --region "$REGION" 2>/dev/null; then
  echo "==> Deployment successful!"
else
  echo "==> ERROR: Deployment did not stabilize. Check ECS console for details."
  echo "==> The deployment circuit breaker will automatically roll back if configured."
  exit 1
fi

# ---------- Verify Health ----------
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --names "${NAME_PREFIX}-alb" \
  --region "$REGION" \
  --query 'LoadBalancers[0].DNSName' \
  --output text 2>/dev/null || echo "")

if [[ -n "$ALB_DNS" ]]; then
  echo "==> Health check: http://${ALB_DNS}/health"
  curl -sf "http://${ALB_DNS}/health" && echo "" || echo "==> Warning: Health check failed (may need time to propagate)"
fi

echo "==> Done."
