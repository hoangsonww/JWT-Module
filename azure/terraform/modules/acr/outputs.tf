output "acr_id" {
  value = azurerm_container_registry.main.id
}

output "login_server" {
  value = azurerm_container_registry.main.login_server
}
