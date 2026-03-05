resource "azurerm_kubernetes_cluster" "main" {
  name                = "${var.name_prefix}-aks"
  location            = var.location
  resource_group_name = var.resource_group_name
  dns_prefix          = var.name_prefix
  kubernetes_version  = "1.29"

  default_node_pool {
    name                = "system"
    node_count          = var.node_count
    vm_size             = var.vm_size
    vnet_subnet_id      = var.aks_subnet_id
    enable_auto_scaling = true
    min_count           = var.min_nodes
    max_count           = var.max_nodes
    os_disk_size_gb     = 50
    os_disk_type        = "Managed"
    max_pods            = 50
    zones               = var.environment == "prod" ? ["1", "2", "3"] : null

    node_labels = {
      "nodepool-type" = "system"
      "environment"   = var.environment
    }
  }

  identity {
    type = "SystemAssigned"
  }

  network_profile {
    network_plugin    = "azure"
    network_policy    = "azure"
    load_balancer_sku = "standard"
    service_cidr      = "10.1.0.0/16"
    dns_service_ip    = "10.1.0.10"
  }

  oms_agent {
    log_analytics_workspace_id = var.log_analytics_workspace_id
  }

  azure_policy_enabled = true

  auto_scaler_profile {
    balance_similar_node_groups = true
    scale_down_delay_after_add  = "10m"
    scale_down_unneeded         = "10m"
  }

  tags = var.tags
}

# ---------- ACR Pull Permission ----------
resource "azurerm_role_assignment" "acr_pull" {
  principal_id                     = azurerm_kubernetes_cluster.main.kubelet_identity[0].object_id
  role_definition_name             = "AcrPull"
  scope                            = var.acr_id
  skip_service_principal_aad_check = true
}
