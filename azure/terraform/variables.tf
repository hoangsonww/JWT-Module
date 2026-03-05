variable "location" {
  description = "Azure region"
  type        = string
  default     = "East US"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "jwt-module"
}

variable "vnet_address_space" {
  description = "Virtual network address space"
  type        = list(string)
  default     = ["10.0.0.0/16"]
}

variable "aks_subnet_prefix" {
  description = "AKS subnet address prefix"
  type        = string
  default     = "10.0.0.0/20"
}

variable "appgw_subnet_prefix" {
  description = "Application Gateway subnet prefix"
  type        = string
  default     = "10.0.16.0/24"
}

variable "aks_node_count" {
  description = "Initial AKS node count"
  type        = number
  default     = 2
}

variable "aks_min_nodes" {
  description = "Minimum AKS nodes for autoscaler"
  type        = number
  default     = 2
}

variable "aks_max_nodes" {
  description = "Maximum AKS nodes for autoscaler"
  type        = number
  default     = 10
}

variable "aks_vm_size" {
  description = "AKS node VM size"
  type        = string
  default     = "Standard_B2s"
}

variable "container_port" {
  description = "Container port"
  type        = number
  default     = 5001
}

variable "health_check_path" {
  description = "Health check endpoint"
  type        = string
  default     = "/health"
}

variable "alert_email" {
  description = "Email for alert notifications"
  type        = string
  default     = ""
}

variable "log_retention_days" {
  description = "Log Analytics retention in days"
  type        = number
  default     = 30
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
