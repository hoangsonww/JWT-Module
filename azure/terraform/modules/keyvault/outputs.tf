output "vault_name" {
  value = azurerm_key_vault.main.name
}

output "vault_id" {
  value = azurerm_key_vault.main.id
}

output "vault_uri" {
  value = azurerm_key_vault.main.vault_uri
}
