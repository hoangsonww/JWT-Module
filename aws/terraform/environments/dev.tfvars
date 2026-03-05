environment    = "dev"
region         = "us-east-1"
project_name   = "jwt-module"

vpc_cidr             = "10.0.0.0/16"
public_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
private_subnet_cidrs = ["10.0.11.0/24", "10.0.12.0/24", "10.0.13.0/24"]

ecs_task_cpu    = 256
ecs_task_memory = 512
desired_count   = 1
min_capacity    = 1
max_capacity    = 3

container_port    = 5001
health_check_path = "/health"
log_retention_days = 7

tags = {
  CostCenter = "development"
}
