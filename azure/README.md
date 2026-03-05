# Azure Infrastructure — JWT Module

Enterprise-grade Azure deployment using AKS, ACR, Key Vault, and Azure Monitor.

## Architecture

```
Internet → NSG → AKS Cluster (Azure CNI) → Pods
                      ↑
                ACR (images)
                Key Vault (secrets)
                Log Analytics (monitoring)
```

- **AKS**: Managed Kubernetes with autoscaling, Azure CNI, Azure Policy
- **ACR**: Container registry with managed identity pull
- **Key Vault**: Secret management with RBAC, soft delete, purge protection
- **Networking**: VNet with NSGs, dedicated subnets for AKS and App Gateway
- **Monitoring**: Log Analytics, Application Insights, metric alerts

## Prerequisites

- Azure CLI (`az`) authenticated
- Terraform >= 1.5.0
- Docker
- kubectl

## Quick Start

### 1. Setup Backend (one-time)

```bash
chmod +x azure/scripts/*.sh
./azure/scripts/setup-backend.sh
```

### 2. Deploy Infrastructure

```bash
cd azure/terraform
terraform init
terraform plan -var-file=environments/dev.tfvars
terraform apply -var-file=environments/dev.tfvars
```

### 3. Deploy Application

```bash
./azure/scripts/deploy.sh dev
```

## Environments

| Environment | Nodes | VM Size          | Auto-scale | AZ Spread | ACR SKU  |
|-------------|-------|------------------|------------|-----------|----------|
| dev         | 1     | Standard_B2s     | 1-3        | No        | Standard |
| staging     | 2     | Standard_B2s     | 2-5        | No        | Standard |
| prod        | 3     | Standard_D2s_v5  | 3-15       | Yes (1,2,3) | Premium |

## Security

- System-assigned managed identity (no service principal keys)
- Key Vault with RBAC authorization
- Network Security Groups with least-privilege rules
- Azure Policy for governance (location, tags, public IP)
- AKS Azure Policy addon enabled
- Azure CNI network policy

## Teardown

```bash
./azure/scripts/destroy.sh dev
```
