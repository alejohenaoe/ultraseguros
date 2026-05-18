resource "aws_cloudwatch_log_group" "router_logs" {
  name              = "/aws/lambda/ultraseguros-router"
  retention_in_days = 7

  tags = {
    Project = var.project_name
  }
}

resource "aws_cloudwatch_log_group" "level1_logs" {
  name              = "/aws/lambda/ultraseguros-level1"
  retention_in_days = 7

  tags = {
    Project = var.project_name
  }
}

resource "aws_cloudwatch_log_group" "level2_logs" {
  name              = "/aws/lambda/ultraseguros-level2"
  retention_in_days = 7

  tags = {
    Project = var.project_name
  }
}

resource "aws_cloudwatch_log_group" "level3_logs" {
  name              = "/aws/lambda/ultraseguros-level3"
  retention_in_days = 7

  tags = {
    Project = var.project_name
  }
}

resource "aws_cloudwatch_log_group" "health_check_logs" {
  name              = "/aws/lambda/ultraseguros-health-check"
  retention_in_days = 7

  tags = {
    Project = var.project_name
  }
}

resource "aws_cloudwatch_log_group" "apigateway_logs" {
  name              = "/aws/apigateway/ultraseguros"
  retention_in_days = 7

  tags = {
    Project = var.project_name
  }
}
