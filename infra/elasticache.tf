############################
# ElastiCache Subnet Group
############################

resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.project_name}-redis-subnet"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${var.project_name}-redis-subnet"
  }
}

############################
# ElastiCache Security Group
############################

resource "aws_security_group" "redis" {
  name        = "${var.project_name}-redis-sg"
  description = "Allow Redis access from ECS tasks"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-redis-sg"
  }
}

resource "aws_security_group_rule" "redis_ingress_from_ecs" {
  type                     = "ingress"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ecs.id
  security_group_id        = aws_security_group.redis.id
  description              = "Allow Redis from ECS tasks"
}

############################
# ElastiCache Redis Cluster
############################

resource "aws_elasticache_cluster" "main" {
  cluster_id      = "${var.project_name}-redis"
  engine          = "redis"
  engine_version  = "7.1"
  node_type       = "cache.t3.micro"
  num_cache_nodes = 1
  port            = 6379

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  tags = {
    Name = "${var.project_name}-redis"
  }
}
