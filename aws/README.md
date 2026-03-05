# AWS Infrastructure — JWT Module

Enterprise-grade AWS deployment using ECS Fargate, ALB, and CloudWatch.

## Architecture

```
Internet → ALB (public subnets, TLS) → ECS Fargate (private subnets) → CloudWatch
                                              ↑
                                        ECR (images)
                                        SSM (secrets)
```

- **VPC**: 3 public + 3 private subnets across AZs
- **ALB**: HTTPS termination, health checks, access logs
- **ECS Fargate**: Serverless containers, auto-scaling, circuit breaker
- **ECR**: Container registry with image scanning
- **CloudWatch**: Logs, metrics, alarms, dashboard
- **SSM Parameter Store**: Encrypted secret management

## Prerequisites

- AWS CLI v2 configured with appropriate credentials
- Terraform >= 1.5.0
- Docker
- `openssl` (for secret generation)

## Quick Start

### 1. Setup Backend (one-time)

```bash
chmod +x aws/scripts/*.sh
./aws/scripts/setup-backend.sh dev
```

### 2. Deploy Infrastructure

```bash
cd aws/terraform
terraform init
terraform plan -var-file=environments/dev.tfvars
terraform apply -var-file=environments/dev.tfvars
```

### 3. Deploy Application

```bash
./aws/scripts/deploy.sh dev
```

## Environments

| Environment | Tasks | CPU | Memory | Auto-scale | NAT GWs |
|-------------|-------|-----|--------|------------|---------|
| dev         | 1     | 256 | 512MB  | 1-3        | 1       |
| staging     | 2     | 256 | 512MB  | 2-6        | 1       |
| prod        | 3     | 512 | 1024MB | 3-20       | 3 (HA)  |

## Cost Estimate (us-east-1)

| Component        | Dev (~)    | Prod (~)    |
|-----------------|------------|-------------|
| ECS Fargate     | $10/mo     | $90/mo      |
| ALB             | $20/mo     | $20/mo      |
| NAT Gateway     | $35/mo     | $105/mo     |
| CloudWatch      | $5/mo      | $15/mo      |
| **Total**       | **~$70/mo**| **~$230/mo**|

## Teardown

```bash
./aws/scripts/destroy.sh dev
```
