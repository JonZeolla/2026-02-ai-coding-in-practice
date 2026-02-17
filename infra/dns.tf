############################
# Route53 A Record -> ALB (only when custom domain is configured)
############################

resource "aws_route53_record" "service" {
  count = local.has_custom_domain ? 1 : 0

  zone_id = var.hosted_zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}
