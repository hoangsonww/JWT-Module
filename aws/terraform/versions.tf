terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "jwt-module-terraform-state"
    key            = "aws/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "jwt-module-terraform-locks"
    encrypt        = true
  }
}
