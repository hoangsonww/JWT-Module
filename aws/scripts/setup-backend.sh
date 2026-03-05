#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# JWT Module — One-Time AWS Backend Setup
# Creates S3 bucket, DynamoDB lock table, SSM parameters
# ============================================================

REGION="${AWS_REGION:-us-east-1}"
PROJECT_NAME="jwt-module"
BUCKET_NAME="${PROJECT_NAME}-terraform-state"
TABLE_NAME="${PROJECT_NAME}-terraform-locks"
ENVIRONMENT="${1:?Usage: setup-backend.sh <environment>}"
NAME_PREFIX="${PROJECT_NAME}-${ENVIRONMENT}"

echo "==> Setting up Terraform backend in ${REGION}"

# ---------- S3 Bucket ----------
if aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
  echo "==> S3 bucket '${BUCKET_NAME}' already exists"
else
  echo "==> Creating S3 bucket: ${BUCKET_NAME}"
  aws s3api create-bucket \
    --bucket "$BUCKET_NAME" \
    --region "$REGION" \
    ${REGION:+$([ "$REGION" != "us-east-1" ] && echo "--create-bucket-configuration LocationConstraint=$REGION" || echo "")}

  aws s3api put-bucket-versioning \
    --bucket "$BUCKET_NAME" \
    --versioning-configuration Status=Enabled

  aws s3api put-bucket-encryption \
    --bucket "$BUCKET_NAME" \
    --server-side-encryption-configuration '{
      "Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]
    }'

  aws s3api put-public-access-block \
    --bucket "$BUCKET_NAME" \
    --public-access-block-configuration \
      "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
fi

# ---------- DynamoDB Table ----------
if aws dynamodb describe-table --table-name "$TABLE_NAME" --region "$REGION" >/dev/null 2>&1; then
  echo "==> DynamoDB table '${TABLE_NAME}' already exists"
else
  echo "==> Creating DynamoDB lock table: ${TABLE_NAME}"
  aws dynamodb create-table \
    --table-name "$TABLE_NAME" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION"
fi

# ---------- SSM Parameters ----------
echo "==> Creating SSM parameters for secrets (if not exist)..."

for PARAM_NAME in "jwt-access-secret" "jwt-refresh-secret"; do
  FULL_NAME="/${NAME_PREFIX}/${PARAM_NAME}"
  if aws ssm get-parameter --name "$FULL_NAME" --region "$REGION" >/dev/null 2>&1; then
    echo "    SSM parameter '${FULL_NAME}' already exists"
  else
    echo "    Creating SSM parameter: ${FULL_NAME}"
    RANDOM_SECRET=$(openssl rand -base64 48)
    aws ssm put-parameter \
      --name "$FULL_NAME" \
      --type SecureString \
      --value "$RANDOM_SECRET" \
      --region "$REGION" \
      --description "JWT secret for ${NAME_PREFIX}"
    echo "    WARNING: Random secret generated. Update with your own value if needed."
  fi
done

echo ""
echo "==> Backend setup complete!"
echo "    S3 Bucket:  ${BUCKET_NAME}"
echo "    Lock Table: ${TABLE_NAME}"
echo "    SSM Params: /${NAME_PREFIX}/jwt-access-secret"
echo "                /${NAME_PREFIX}/jwt-refresh-secret"
