environment    = "prod"
region         = "us-east-1"
project_name   = "jwt-module"

vpc_cidr             = "10.2.0.0/16"
public_subnet_cidrs  = ["10.2.1.0/24", "10.2.2.0/24", "10.2.3.0/24"]
private_subnet_cidrs = ["10.2.11.0/24", "10.2.12.0/24", "10.2.13.0/24"]

ecs_task_cpu    = 512
ecs_task_memory = 1024
desired_count   = 3
min_capacity    = 3
max_capacity    = 20

container_port    = 5001
health_check_path = "/health"
log_retention_days = 90

tags = {
  CostCenter  = "production"
  Compliance  = "required"
}
