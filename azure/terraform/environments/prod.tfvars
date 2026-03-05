environment    = "prod"
location       = "East US"
project_name   = "jwt-module"

vnet_address_space  = ["10.2.0.0/16"]
aks_subnet_prefix   = "10.2.0.0/20"
appgw_subnet_prefix = "10.2.16.0/24"

aks_node_count = 3
aks_min_nodes  = 3
aks_max_nodes  = 15
aks_vm_size    = "Standard_D2s_v5"

container_port     = 5001
health_check_path  = "/health"
log_retention_days = 90

tags = {
  CostCenter = "production"
  Compliance = "required"
}
