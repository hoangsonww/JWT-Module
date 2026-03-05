environment    = "dev"
location       = "East US"
project_name   = "jwt-module"

vnet_address_space  = ["10.0.0.0/16"]
aks_subnet_prefix   = "10.0.0.0/20"
appgw_subnet_prefix = "10.0.16.0/24"

aks_node_count = 1
aks_min_nodes  = 1
aks_max_nodes  = 3
aks_vm_size    = "Standard_B2s"

container_port     = 5001
health_check_path  = "/health"
log_retention_days = 7

tags = {
  CostCenter = "development"
}
