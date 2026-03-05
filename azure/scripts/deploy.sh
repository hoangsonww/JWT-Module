#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# JWT Module — Azure AKS Deployment Script
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

ENVIRONMENT="${1:?Usage: deploy.sh <environment> [image-tag]}"
IMAGE_TAG="${2:-$(git -C "$PROJECT_ROOT" rev-parse --short HEAD)}"
PROJECT_NAME="jwt-module"
NAME_PREFIX="${PROJECT_NAME}-${ENVIRONMENT}"
RESOURCE_GROUP="${NAME_PREFIX}-rg"

echo "==> Deploying ${NAME_PREFIX} with tag ${IMAGE_TAG}"

# ---------- Get ACR Login Server ----------
ACR_NAME=$(az acr list --resource-group "$RESOURCE_GROUP" --query '[0].name' -o tsv)
ACR_LOGIN=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)

echo "==> ACR: ${ACR_LOGIN}"

# ---------- Build & Push ----------
echo "==> Authenticating with ACR..."
az acr login --name "$ACR_NAME"

echo "==> Building Docker image..."
docker build -t "${ACR_LOGIN}/${PROJECT_NAME}:${IMAGE_TAG}" \
             -t "${ACR_LOGIN}/${PROJECT_NAME}:latest" \
             "$PROJECT_ROOT"

echo "==> Pushing to ACR..."
docker push "${ACR_LOGIN}/${PROJECT_NAME}:${IMAGE_TAG}"
docker push "${ACR_LOGIN}/${PROJECT_NAME}:latest"

# ---------- Get AKS Credentials ----------
AKS_NAME="${NAME_PREFIX}-aks"
echo "==> Getting AKS credentials..."
az aks get-credentials --resource-group "$RESOURCE_GROUP" --name "$AKS_NAME" --overwrite-existing

# ---------- Deploy to K8s ----------
echo "==> Applying Kubernetes manifests..."
if [[ -d "$PROJECT_ROOT/k8s/overlays/$ENVIRONMENT" ]]; then
  kubectl apply -k "$PROJECT_ROOT/k8s/overlays/$ENVIRONMENT"
else
  kubectl apply -k "$PROJECT_ROOT/k8s/base"
fi

# ---------- Update Image ----------
echo "==> Updating deployment image..."
kubectl set image deployment/jwt-module \
  jwt-module="${ACR_LOGIN}/${PROJECT_NAME}:${IMAGE_TAG}" \
  -n jwt-module

# ---------- Verify Rollout ----------
echo "==> Waiting for rollout..."
if kubectl rollout status deployment/jwt-module -n jwt-module --timeout=300s; then
  echo "==> Deployment successful!"
else
  echo "==> ERROR: Rollout failed. Rolling back..."
  kubectl rollout undo deployment/jwt-module -n jwt-module
  exit 1
fi

echo "==> Done."
