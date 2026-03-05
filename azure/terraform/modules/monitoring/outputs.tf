output "log_analytics_workspace_id" {
  value = azurerm_log_analytics_workspace.main.id
}

output "app_insights_instrumentation_key" {
  value     = azurerm_application_insights.main.instrumentation_key
  sensitive = true
}

output "action_group_id" {
  value = azurerm_monitor_action_group.main.id
}
