terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Configure via: terraform init -backend-config=backend.hcl
  backend "s3" {
    key     = "ecs-service/terraform.tfstate"
    encrypt = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

locals {
  has_custom_domain = var.domain_name != "" && var.hosted_zone_id != ""

  # Auto-wire RDS and Redis endpoints into container environment variables.
  # These are merged with var.environment_variables; explicit values take precedence.
  backing_service_env = {
    DB_HOST     = aws_db_instance.main.address
    DB_PORT     = tostring(aws_db_instance.main.port)
    DB_USER     = var.db_username
    DB_PASSWORD = var.db_password
    DB_NAME     = var.db_name
    REDIS_HOST  = aws_elasticache_cluster.main.cache_nodes[0].address
    REDIS_PORT  = tostring(aws_elasticache_cluster.main.cache_nodes[0].port)
  }

  container_env = merge(local.backing_service_env, var.environment_variables)
}
