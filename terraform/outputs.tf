output "api_endpoint" {
  value       = "https://${aws_api_gateway_rest_api.main.id}.execute-api.${var.aws_region}.amazonaws.com/prod/service-api"
  description = "URL exacta para pegar en el script K6"
}

output "dynamodb_table" {
  value       = "ultraseguros_state"
  description = "Nombre de la tabla DynamoDB con el estado del sistema"
}

output "router_function" {
  value       = "ultraseguros-router"
  description = "Nombre de la función Lambda del Router"
}
