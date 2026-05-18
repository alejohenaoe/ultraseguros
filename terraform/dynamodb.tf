resource "aws_dynamodb_table" "state" {
  name         = "ultraseguros_state"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"

  attribute {
    name = "pk"
    type = "S"
  }

  tags = {
    Project = var.project_name
  }
}

resource "aws_dynamodb_table_item" "initial_state" {
  table_name = aws_dynamodb_table.state.name
  hash_key   = aws_dynamodb_table.state.hash_key

  item = jsonencode({
    pk             = { S = "SYSTEM" }
    current_level  = { N = "1" }
    error_count    = { N = "0" }
    success_streak = { N = "0" }
    last_updated   = { S = "2024-01-01T00:00:00Z" }
  })

  lifecycle {
    ignore_changes = [item]
  }
}
