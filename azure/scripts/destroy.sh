#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# JWT Module — Azure Infrastructure Teardown
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TF_DIR="$SCRIPT_DIR/../terraform"
ENVIRONMENT="${1:?Usage: destroy.sh <environment>}"

echo "WARNING: This will destroy ALL Azure infrastructure for jwt-module-${ENVIRONMENT}."
echo ""
read -rp "Type the environment name to confirm: " CONFIRM

if [[ "$CONFIRM" != "$ENVIRONMENT" ]]; then
  echo "Confirmation failed. Aborting."
  exit 1
fi

if [[ "$ENVIRONMENT" == "prod" ]]; then
  echo ""
  echo "DANGER: You are about to destroy PRODUCTION infrastructure."
  read -rp "Type 'destroy-production' to confirm: " CONFIRM2
  if [[ "$CONFIRM2" != "destroy-production" ]]; then
    echo "Production destruction aborted."
    exit 1
  fi
fi

cd "$TF_DIR"

echo "==> Running terraform destroy..."
terraform destroy \
  -var-file="environments/${ENVIRONMENT}.tfvars" \
  -auto-approve

echo "==> Infrastructure destroyed for ${ENVIRONMENT}."
