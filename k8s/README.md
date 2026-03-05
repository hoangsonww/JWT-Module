# Kubernetes Deployment — JWT Module

Production-grade Kubernetes manifests with Kustomize overlays and Helm chart.

## Deployment Options

### Option 1: Kustomize

```bash
# Dev
kubectl apply -k k8s/overlays/dev

# Staging
kubectl apply -k k8s/overlays/staging

# Production
kubectl apply -k k8s/overlays/prod
```

### Option 2: Helm

```bash
# Dev
helm install jwt-module k8s/helm -f k8s/helm/values-dev.yaml -n jwt-module --create-namespace

# Staging
helm install jwt-module k8s/helm -f k8s/helm/values-staging.yaml -n jwt-module --create-namespace

# Production
helm install jwt-module k8s/helm -f k8s/helm/values-prod.yaml -n jwt-module --create-namespace

# Upgrade
helm upgrade jwt-module k8s/helm -f k8s/helm/values-prod.yaml -n jwt-module
```

## Environment Configuration

| Setting | Dev | Staging | Prod |
|---------|-----|---------|------|
| Replicas | 1 | 2 | 3 |
| CPU request | 64m | 128m | 256m |
| Memory request | 64Mi | 128Mi | 256Mi |
| CPU limit | 256m | 500m | 1000m |
| Memory limit | 128Mi | 256Mi | 512Mi |
| HPA | disabled | 2-6 | 3-20 |
| PDB | disabled | 1 min | 1 min |
| Network Policy | yes | yes | yes |
| Priority Class | default | default | high (1000000) |

## Secret Management

The base `secret.yaml` contains placeholder values. For production:

1. **SealedSecrets**: `kubeseal` encrypts secrets client-side
2. **External Secrets Operator**: Syncs from AWS SSM / Azure Key Vault
3. **SOPS**: Encrypt secret files in git with age/PGP keys

Never commit real secrets to the repository.

## Security Features

- Pod Security Standards: `restricted` enforcement on namespace
- Non-root container (UID 1000)
- Read-only root filesystem
- All capabilities dropped
- Automount service account token disabled
- Network policies: default deny, allow only ingress-nginx + DNS
- Resource limits on all containers

## Health Checks

- **Startup**: `/health` every 2s, 30 failures allowed (60s max startup)
- **Readiness**: `/health` every 10s, 3 failures to mark unready
- **Liveness**: `/health` every 15s, 3 failures to restart

## Troubleshooting

```bash
# Check pod status
kubectl get pods -n jwt-module

# View logs
kubectl logs -f deployment/jwt-module -n jwt-module

# Describe pod for events
kubectl describe pod -l app.kubernetes.io/name=jwt-module -n jwt-module

# Check HPA status
kubectl get hpa -n jwt-module

# Port-forward for local testing
kubectl port-forward svc/jwt-module 5001:80 -n jwt-module
```
