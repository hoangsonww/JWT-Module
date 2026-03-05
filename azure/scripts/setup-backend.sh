#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# JWT Module — One-Time Azure Backend Setup
# ============================================================

LOCATION="${AZURE_LOCATION:-eastus}"
RG_NAME="jwt-module-tfstate-rg"
STORAGE_ACCOUNT="jwtmoduletfstate"
CONTAINER_NAME="tfstate"

echo "==> Setting up Terraform backend in ${LOCATION}"

# ---------- Resource Group ----------
if az group show --name "$RG_NAME" >/dev/null 2>&1; then
  echo "==> Resource group '${RG_NAME}' already exists"
else
  echo "==> Creating resource group: ${RG_NAME}"
  az group create --name "$RG_NAME" --location "$LOCATION"
fi

# ---------- Storage Account ----------
if az storage account show --name "$STORAGE_ACCOUNT" --resource-group "$RG_NAME" >/dev/null 2>&1; then
  echo "==> Storage account '${STORAGE_ACCOUNT}' already exists"
else
  echo "==> Creating storage account: ${STORAGE_ACCOUNT}"
  az storage account create \
    --name "$STORAGE_ACCOUNT" \
    --resource-group "$RG_NAME" \
    --location "$LOCATION" \
    --sku Standard_LRS \
    --encryption-services blob \
    --min-tls-version TLS1_2 \
    --allow-blob-public-access false
fi

# ---------- Blob Container ----------
ACCOUNT_KEY=$(az storage account keys list \
  --account-name "$STORAGE_ACCOUNT" \
  --resource-group "$RG_NAME" \
  --query '[0].value' -o tsv)

if az storage container show --name "$CONTAINER_NAME" \
    --account-name "$STORAGE_ACCOUNT" --account-key "$ACCOUNT_KEY" >/dev/null 2>&1; then
  echo "==> Blob container '${CONTAINER_NAME}' already exists"
else
  echo "==> Creating blob container: ${CONTAINER_NAME}"
  az storage container create \
    --name "$CONTAINER_NAME" \
    --account-name "$STORAGE_ACCOUNT" \
    --account-key "$ACCOUNT_KEY"
fi

echo ""
echo "==> Backend setup complete!"
echo "    Resource Group:  ${RG_NAME}"
echo "    Storage Account: ${STORAGE_ACCOUNT}"
echo "    Container:       ${CONTAINER_NAME}"
