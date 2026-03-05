locals {
  # ACR names must be alphanumeric
  acr_name = replace("${var.name_prefix}acr", "-", "")
}

resource "azurerm_container_registry" "main" {
  name                = local.acr_name
  resource_group_name = var.resource_group_name
  location            = var.location
  sku                 = var.environment == "prod" ? "Premium" : "Standard"
  admin_enabled       = false

  dynamic "retention_policy" {
    for_each = var.environment == "prod" ? [1] : []
    content {
      enabled = true
      days    = 30
    }
  }

  tags = var.tags
}
