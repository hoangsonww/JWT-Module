variable "name_prefix" { type = string }
variable "resource_group_name" { type = string }
variable "location" { type = string }
variable "log_retention_days" { type = number }
variable "alert_email" { type = string }
variable "environment" { type = string }
variable "tags" { type = map(string) }
