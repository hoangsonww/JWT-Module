provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy = false
    }
    resource_group {
      prevent_deletion_if_contains_resources = true
    }
  }
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"
  common_tags = merge(var.tags, {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  })
}

# ---------- Resource Group ----------
resource "azurerm_resource_group" "main" {
  name     = "${local.name_prefix}-rg"
  location = var.location
  tags     = local.common_tags
}

# ---------- Networking ----------
module "networking" {
  source = "./modules/networking"

  name_prefix         = local.name_prefix
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  vnet_address_space  = var.vnet_address_space
  aks_subnet_prefix   = var.aks_subnet_prefix
  appgw_subnet_prefix = var.appgw_subnet_prefix
  environment         = var.environment
  tags                = local.common_tags
}

# ---------- ACR ----------
module "acr" {
  source = "./modules/acr"

  name_prefix         = local.name_prefix
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  environment         = var.environment
  tags                = local.common_tags
}

# ---------- Monitoring ----------
module "monitoring" {
  source = "./modules/monitoring"

  name_prefix         = local.name_prefix
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  log_retention_days  = var.log_retention_days
  alert_email         = var.alert_email
  environment         = var.environment
  tags                = local.common_tags
}

# ---------- Key Vault ----------
module "keyvault" {
  source = "./modules/keyvault"

  name_prefix         = local.name_prefix
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  environment         = var.environment
  tags                = local.common_tags
}

# ---------- AKS ----------
module "aks" {
  source = "./modules/aks"

  name_prefix            = local.name_prefix
  resource_group_name    = azurerm_resource_group.main.name
  location               = azurerm_resource_group.main.location
  aks_subnet_id          = module.networking.aks_subnet_id
  acr_id                 = module.acr.acr_id
  log_analytics_workspace_id = module.monitoring.log_analytics_workspace_id
  node_count             = var.aks_node_count
  min_nodes              = var.aks_min_nodes
  max_nodes              = var.aks_max_nodes
  vm_size                = var.aks_vm_size
  environment            = var.environment
  tags                   = local.common_tags
}
