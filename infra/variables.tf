############################
# General
############################

variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Name used for resource naming and tagging"
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. staging, production)"
  type        = string
  validation {
    condition     = contains(["sandbox", "staging", "production"], var.environment)
    error_message = "environment must be one of: sandbox, staging, production"
  }
}

############################
# Networking
############################

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets (one per AZ)"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets (one per AZ)"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}

############################
# ECS / Container
############################

variable "container_image" {
  description = "Full container image URI including tag (e.g. 123456789.dkr.ecr.us-east-1.amazonaws.com/myapp:latest)"
  type        = string
}

variable "container_port" {
  description = "Port the container listens on"
  type        = number
  default     = 8000
}

variable "cpu" {
  description = "Fargate task CPU units (256, 512, 1024, 2048, 4096)"
  type        = number
  default     = 512
}

variable "memory" {
  description = "Fargate task memory in MiB"
  type        = number
  default     = 1024
}

variable "desired_count" {
  description = "Number of ECS tasks to run"
  type        = number
  default     = 1
}

variable "health_check_path" {
  description = "Path for ALB target group health check"
  type        = string
  default     = "/health"
}

variable "environment_variables" {
  description = "Environment variables to pass to the container"
  type        = map(string)
  default     = {}
}

############################
# DNS / TLS (optional)
############################

variable "domain_name" {
  description = "Fully qualified domain name for the service (leave empty to use ALB DNS directly)"
  type        = string
  default     = ""
}

variable "hosted_zone_id" {
  description = "Route53 hosted zone ID for the domain (required if domain_name is set)"
  type        = string
  default     = ""
}

############################
# Logging
############################

variable "log_retention_days" {
  description = "CloudWatch log group retention in days"
  type        = number
  default     = 30
}
