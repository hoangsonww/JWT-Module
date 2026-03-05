environment    = "staging"
location       = "East US"
project_name   = "jwt-module"

vnet_address_space  = ["10.1.0.0/16"]
aks_subnet_prefix   = "10.1.0.0/20"
appgw_subnet_prefix = "10.1.16.0/24"

aks_node_count = 2
aks_min_nodes  = 2
aks_max_nodes  = 5
aks_vm_size    = "Standard_B2s"

container_port     = 5001
health_check_path  = "/health"
log_retention_days = 14

tags = {
  CostCenter = "staging"
}
