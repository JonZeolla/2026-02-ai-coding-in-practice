############################
# Application Load Balancer
############################

resource "aws_lb" "main" {
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  tags = {
    Name = "${var.project_name}-alb"
  }
}

############################
# Target Group
############################

resource "aws_lb_target_group" "main" {
  name        = "${var.project_name}-tg"
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    path                = var.health_check_path
    protocol            = "HTTP"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 4
  }

  tags = {
    Name = "${var.project_name}-tg"
  }
}

############################
# HTTPS Listener (443) - only when custom domain is configured
############################

resource "aws_lb_listener" "https" {
  count = local.has_custom_domain ? 1 : 0

  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  certificate_arn   = aws_acm_certificate_validation.main[0].certificate_arn
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.main.arn
  }
}

############################
# HTTP Listener (80)
# When domain is set: redirects to HTTPS
# When no domain: forwards traffic directly
############################

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = local.has_custom_domain ? "redirect" : "forward"

    dynamic "redirect" {
      for_each = local.has_custom_domain ? [1] : []
      content {
        protocol    = "HTTPS"
        port        = "443"
        host        = "#{host}"
        path        = "/#{path}"
        query       = "#{query}"
        status_code = "HTTP_301"
      }
    }

    target_group_arn = local.has_custom_domain ? null : aws_lb_target_group.main.arn
  }
}
