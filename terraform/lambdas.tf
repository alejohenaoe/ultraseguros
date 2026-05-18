# ─── npm install triggers ──────────────────────────────────────────────────

resource "null_resource" "npm_router" {
  triggers = {
    code_hash = filemd5("${path.module}/../lambdas/router/index.mjs")
  }
  provisioner "local-exec" {
    command = "cd ${path.module}/../lambdas/router && npm install"
  }
}

resource "null_resource" "npm_level1" {
  triggers = {
    code_hash = filemd5("${path.module}/../lambdas/level1/index.mjs")
  }
  provisioner "local-exec" {
    command = "cd ${path.module}/../lambdas/level1 && npm install"
  }
}

resource "null_resource" "npm_level2" {
  triggers = {
    code_hash = filemd5("${path.module}/../lambdas/level2/index.mjs")
  }
  provisioner "local-exec" {
    command = "cd ${path.module}/../lambdas/level2 && npm install"
  }
}

resource "null_resource" "npm_level3" {
  triggers = {
    code_hash = filemd5("${path.module}/../lambdas/level3/index.mjs")
  }
  provisioner "local-exec" {
    command = "cd ${path.module}/../lambdas/level3 && npm install"
  }
}

resource "null_resource" "npm_health_check" {
  triggers = {
    code_hash = filemd5("${path.module}/../lambdas/health-check/index.mjs")
  }
  provisioner "local-exec" {
    command = "cd ${path.module}/../lambdas/health-check && npm install"
  }
}

# ─── ZIP archives ─────────────────────────────────────────────────────────

data "archive_file" "router_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../lambdas/router"
  output_path = "/tmp/ultraseguros-router.zip"
  depends_on  = [null_resource.npm_router]
}

data "archive_file" "level1_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../lambdas/level1"
  output_path = "/tmp/ultraseguros-level1.zip"
  depends_on  = [null_resource.npm_level1]
}

data "archive_file" "level2_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../lambdas/level2"
  output_path = "/tmp/ultraseguros-level2.zip"
  depends_on  = [null_resource.npm_level2]
}

data "archive_file" "level3_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../lambdas/level3"
  output_path = "/tmp/ultraseguros-level3.zip"
  depends_on  = [null_resource.npm_level3]
}

data "archive_file" "health_check_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../lambdas/health-check"
  output_path = "/tmp/ultraseguros-health-check.zip"
  depends_on  = [null_resource.npm_health_check]
}

# ─── Lambda functions ─────────────────────────────────────────────────────

resource "aws_lambda_function" "router" {
  function_name    = "ultraseguros-router"
  role             = aws_iam_role.lambda_role.arn
  runtime          = "nodejs20.x"
  handler          = "index.handler"
  timeout          = 30
  memory_size      = 256
  filename         = data.archive_file.router_zip.output_path
  source_code_hash = data.archive_file.router_zip.output_base64sha256

  environment {
    variables = {
      TABLE_NAME      = "ultraseguros_state"
      LEVEL1_FUNCTION = "ultraseguros-level1"
      LEVEL2_FUNCTION = "ultraseguros-level2"
      LEVEL3_FUNCTION = "ultraseguros-level3"
    }
  }

  depends_on = [
    null_resource.npm_router,
    aws_cloudwatch_log_group.router_logs,
  ]

  tags = {
    Project = var.project_name
  }
}

resource "aws_lambda_function" "level1" {
  function_name    = "ultraseguros-level1"
  role             = aws_iam_role.lambda_role.arn
  runtime          = "nodejs20.x"
  handler          = "index.handler"
  timeout          = 30
  memory_size      = 256
  filename         = data.archive_file.level1_zip.output_path
  source_code_hash = data.archive_file.level1_zip.output_base64sha256

  depends_on = [
    null_resource.npm_level1,
    aws_cloudwatch_log_group.level1_logs,
  ]

  tags = {
    Project = var.project_name
  }
}

resource "aws_lambda_function" "level2" {
  function_name    = "ultraseguros-level2"
  role             = aws_iam_role.lambda_role.arn
  runtime          = "nodejs20.x"
  handler          = "index.handler"
  timeout          = 30
  memory_size      = 256
  filename         = data.archive_file.level2_zip.output_path
  source_code_hash = data.archive_file.level2_zip.output_base64sha256

  depends_on = [
    null_resource.npm_level2,
    aws_cloudwatch_log_group.level2_logs,
  ]

  tags = {
    Project = var.project_name
  }
}

resource "aws_lambda_function" "level3" {
  function_name    = "ultraseguros-level3"
  role             = aws_iam_role.lambda_role.arn
  runtime          = "nodejs20.x"
  handler          = "index.handler"
  timeout          = 30
  memory_size      = 256
  filename         = data.archive_file.level3_zip.output_path
  source_code_hash = data.archive_file.level3_zip.output_base64sha256

  depends_on = [
    null_resource.npm_level3,
    aws_cloudwatch_log_group.level3_logs,
  ]

  tags = {
    Project = var.project_name
  }
}

resource "aws_lambda_function" "health_check" {
  function_name    = "ultraseguros-health-check"
  role             = aws_iam_role.lambda_role.arn
  runtime          = "nodejs20.x"
  handler          = "index.handler"
  timeout          = 30
  memory_size      = 256
  filename         = data.archive_file.health_check_zip.output_path
  source_code_hash = data.archive_file.health_check_zip.output_base64sha256

  environment {
    variables = {
      TABLE_NAME = "ultraseguros_state"
    }
  }

  depends_on = [
    null_resource.npm_health_check,
    aws_cloudwatch_log_group.health_check_logs,
  ]

  tags = {
    Project = var.project_name
  }
}
