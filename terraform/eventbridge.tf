resource "aws_cloudwatch_event_rule" "health_check_rule" {
  name                = "ultraseguros-health-check-rule"
  description         = "Ejecuta el health check del sistema UltraSeguros cada minuto"
  schedule_expression = "rate(1 minute)"

  tags = {
    Project = var.project_name
  }
}

resource "aws_cloudwatch_event_target" "health_check_target" {
  rule      = aws_cloudwatch_event_rule.health_check_rule.name
  target_id = "HealthCheckLambda"
  arn       = aws_lambda_function.health_check.arn
}

resource "aws_lambda_permission" "eventbridge_health_check" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.health_check.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.health_check_rule.arn
}
