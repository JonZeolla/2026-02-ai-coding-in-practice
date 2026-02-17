# Infrastructure

Terraform configuration for deploying a containerized application on **AWS ECS Fargate** behind an Application Load Balancer, with optional custom domain and TLS support.

## Architecture Overview

```
Internet
   │
   ▼
┌──────────────────────────────────────────────────────────┐
│ VPC (10.0.0.0/16)                                        │
│                                                          │
│  ┌─────────────────────────┐                             │
│  │ Public Subnets           │                             │
│  │  ┌─────────────────┐    │                             │
│  │  │ ALB (port 80/443)│    │                             │
│  │  └────────┬────────┘    │                             │
│  │           │   NAT GW    │                             │
│  └───────────┼─────────────┘                             │
│              │                                            │
│  ┌───────────┼─────────────┐                             │
│  │ Private Subnets          │                             │
│  │  ┌────────▼────────┐    │                             │
│  │  │ ECS Fargate Tasks│    │                             │
│  │  └─────────────────┘    │                             │
│  └─────────────────────────┘                             │
└──────────────────────────────────────────────────────────┘
```

## AWS Resources Created

| Resource | File | Description |
|---|---|---|
| VPC, Subnets, IGW, NAT GW, Route Tables | `vpc.tf` | Networking foundation with public and private subnets across two AZs |
| Application Load Balancer, Target Group, Listeners | `alb.tf` | Internet-facing ALB with HTTP (and optional HTTPS) listeners |
| ECS Cluster, Task Definition, Service | `ecs.tf` | Fargate service running the container with deployment circuit breaker |
| ECR Repository | `ecr.tf` | Container image registry with scan-on-push enabled |
| ACM Certificate, DNS Validation | `cert.tf` | TLS certificate with automated DNS validation (only when custom domain is set) |
| Route53 A Record | `dns.tf` | Alias record pointing the custom domain to the ALB (only when custom domain is set) |
| IAM Roles & Policies | `iam.tf` | Execution role (image pull, logging) and task role (CloudWatch metrics, SSM read) |
| Security Groups | `security_groups.tf` | ALB SG (HTTP/HTTPS inbound) and ECS SG (ALB-only inbound on container port) |
| CloudWatch Log Group | `logging.tf` | Centralized container logs with configurable retention |

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.5
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) configured with appropriate credentials
- [Docker](https://docs.docker.com/get-docker/) (required by `deploy.sh` to build and push container images)
- An AWS account with permissions to create the resources listed above
- (Optional) A Route53 hosted zone if you want a custom domain with TLS

## Directory Structure

```
infra/
├── README.md            # This file
├── main.tf              # Terraform/provider config, S3 backend, data sources
├── variables.tf         # All input variables
├── outputs.tf           # Stack outputs
├── terraform.tfvars     # Variable values (git-ignored)
├── backend.hcl          # S3 backend config (git-ignored)
├── backend.hcl.example  # Example backend config
├── vpc.tf               # VPC, subnets, IGW, NAT, route tables
├── alb.tf               # ALB, target group, HTTP/HTTPS listeners
├── ecs.tf               # ECS cluster, task definition, service
├── ecr.tf               # ECR repository
├── cert.tf              # ACM certificate + DNS validation
├── dns.tf               # Route53 alias record
├── iam.tf               # Execution and task IAM roles
├── security_groups.tf   # ALB and ECS security groups
├── logging.tf           # CloudWatch log group
├── .gitignore           # Ignores state, lock, tfvars, backend.hcl
└── remote-state/        # Bootstrap stack for Terraform remote state
    ├── main.tf
    ├── variables.tf
    ├── outputs.tf
    └── terraform.tfvars.example
```

## Getting Started

### 1. Bootstrap Remote State (first time only)

The `remote-state/` sub-directory provisions the S3 bucket and DynamoDB table used by Terraform to store state remotely.

```bash
cd remote-state

# Create your variable file from the example
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars and set your bucket name, region, and lock table name

terraform init
terraform apply
```

This creates:

- **S3 bucket** — versioned, KMS-encrypted, with all public access blocked
- **DynamoDB table** — for state locking and consistency

### 2. Configure the Backend

Create `backend.hcl` from the provided example:

```bash
cp backend.hcl.example backend.hcl
```

Fill in the values using the outputs from step 1:

```hcl
bucket         = "your-terraform-state-bucket"
region         = "us-east-1"
dynamodb_table = "terraform-locks"
```

### 3. Configure Variables

Create `terraform.tfvars` with your deployment values:

```hcl
aws_region      = "us-east-1"
project_name    = "hello-world-web"
environment     = "sandbox"           # sandbox | staging | production
container_image = "123456789.dkr.ecr.us-east-1.amazonaws.com/my-app:latest"
container_port  = 80
cpu             = 256
memory          = 512
desired_count   = 1
health_check_path = "/health"

# Optional: custom domain with TLS
# domain_name    = "app.example.com"
# hosted_zone_id = "Z1234567890ABC"

# Optional: environment variables for the container
# environment_variables = {
#   LOG_LEVEL = "info"
# }
```

### 4. Deploy

**Option A — One-command deploy** using the `deploy.sh` script located in the parent directory:

```bash
cd ..
./deploy.sh
```

This script automates the full workflow in a single run:

1. Creates the ECR repository via a targeted `terraform apply`
2. Authenticates Docker with ECR
3. Builds the container image (`linux/amd64`) from `../hello-world-web` and pushes it to ECR
4. Runs `terraform apply` on the full infrastructure stack
5. Prints the service URL

> **Note:** `deploy.sh` assumes `terraform init` has already been run in the `infra/` directory. It hardcodes the region (`us-east-1`), repository name (`hello-world-web`), and image tag (`latest`).

**Option B — Manual deploy** with Terraform directly:

```bash
terraform init -backend-config=backend.hcl
terraform plan
terraform apply
```

## Input Variables

| Variable | Type | Default | Description |
|---|---|---|---|
| `aws_region` | `string` | `us-east-1` | AWS region to deploy into |
| `project_name` | `string` | — (required) | Name used for resource naming and tagging |
| `environment` | `string` | — (required) | Deployment environment (`sandbox`, `staging`, `production`) |
| `vpc_cidr` | `string` | `10.0.0.0/16` | CIDR block for the VPC |
| `public_subnet_cidrs` | `list(string)` | `["10.0.1.0/24", "10.0.2.0/24"]` | CIDRs for public subnets (one per AZ) |
| `private_subnet_cidrs` | `list(string)` | `["10.0.10.0/24", "10.0.11.0/24"]` | CIDRs for private subnets (one per AZ) |
| `container_image` | `string` | — (required) | Full container image URI with tag |
| `container_port` | `number` | `8000` | Port the container listens on |
| `cpu` | `number` | `512` | Fargate task CPU units (256, 512, 1024, 2048, 4096) |
| `memory` | `number` | `1024` | Fargate task memory in MiB |
| `desired_count` | `number` | `1` | Number of ECS tasks to run |
| `health_check_path` | `string` | `/health` | Path for ALB target group health check |
| `environment_variables` | `map(string)` | `{}` | Environment variables passed to the container |
| `domain_name` | `string` | `""` | FQDN for the service (leave empty to use ALB DNS) |
| `hosted_zone_id` | `string` | `""` | Route53 hosted zone ID (required if `domain_name` is set) |
| `log_retention_days` | `number` | `30` | CloudWatch log retention in days |

## Outputs

| Output | Description |
|---|---|
| `vpc_id` | ID of the VPC |
| `public_subnet_ids` | IDs of the public subnets |
| `private_subnet_ids` | IDs of the private subnets |
| `alb_dns_name` | DNS name of the ALB |
| `alb_arn` | ARN of the ALB |
| `ecs_cluster_name` | Name of the ECS cluster |
| `ecs_service_name` | Name of the ECS service |
| `service_url` | URL for accessing the service (HTTPS if custom domain, HTTP otherwise) |
| `ecr_repository_url` | URL of the ECR repository |
| `log_group_name` | Name of the CloudWatch log group |

## Custom Domain & TLS

To enable a custom domain with automatic TLS, set both `domain_name` and `hosted_zone_id` in your `terraform.tfvars`. When configured, Terraform will:

1. Create an ACM certificate for the domain
2. Add DNS validation records to Route53
3. Wait for certificate validation to complete
4. Add an HTTPS listener (port 443) on the ALB
5. Redirect all HTTP traffic (port 80) to HTTPS
6. Create a Route53 A record aliased to the ALB

When these variables are left empty, the service is accessible via the ALB's DNS name over plain HTTP.

## Security

- **ECS tasks run in private subnets** with no public IP; outbound internet access goes through the NAT Gateway.
- **ALB is the only public entry point**, restricted to ports 80 and 443.
- **ECS security group** only allows inbound traffic from the ALB on the container port.
- **ECS outbound** is restricted to HTTPS (port 443) for AWS API access (ECR, CloudWatch, SSM).
- **IAM follows least privilege** — the execution role uses the AWS-managed ECS policy; the task role grants only CloudWatch metrics and SSM parameter read access.
- **Terraform state** is stored in a versioned, KMS-encrypted S3 bucket with all public access blocked.
- Sensitive files (`terraform.tfvars`, `backend.hcl`, `*.tfstate`) are git-ignored.

## Useful Commands

```bash
# Initialize with remote backend
terraform init -backend-config=backend.hcl

# Preview changes
terraform plan

# Apply changes
terraform apply

# Show current outputs
terraform output

# Force a new ECS deployment (e.g. after pushing a new image with the same tag)
aws ecs update-service \
  --cluster <cluster-name> \
  --service <service-name> \
  --force-new-deployment

# Tail container logs
aws logs tail /ecs/<project-name> --follow

# Destroy all resources (use with caution)
terraform destroy
```

## Remote State Module

The `remote-state/` directory is a standalone Terraform root module that bootstraps the backend resources:

| Variable | Type | Default | Description |
|---|---|---|---|
| `aws_region` | `string` | `us-east-1` | AWS region for state resources |
| `state_bucket_name` | `string` | — (required) | S3 bucket name for Terraform state |
| `lock_table_name` | `string` | `terraform-locks` | DynamoDB table name for state locking |

| Output | Description |
|---|---|
| `state_bucket_name` | Name of the S3 state bucket |
| `state_bucket_arn` | ARN of the S3 state bucket |
| `lock_table_name` | Name of the DynamoDB lock table |
| `lock_table_arn` | ARN of the DynamoDB lock table |
