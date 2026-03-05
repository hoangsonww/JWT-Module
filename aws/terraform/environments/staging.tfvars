environment    = "staging"
region         = "us-east-1"
project_name   = "jwt-module"

vpc_cidr             = "10.1.0.0/16"
public_subnet_cidrs  = ["10.1.1.0/24", "10.1.2.0/24", "10.1.3.0/24"]
private_subnet_cidrs = ["10.1.11.0/24", "10.1.12.0/24", "10.1.13.0/24"]

ecs_task_cpu    = 256
ecs_task_memory = 512
desired_count   = 2
min_capacity    = 2
max_capacity    = 6

container_port    = 5001
health_check_path = "/health"
log_retention_days = 14

tags = {
  CostCenter = "staging"
}
