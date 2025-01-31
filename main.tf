terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5"
    }
  }
}

data "aws_caller_identity" "current" {}

# SNS Topic
resource "aws_sns_topic" "ecs_events" {
  name   = "ecs-events"
  policy = templatefile("${path.module}/sns_policy.json", {
    region     = data.aws_caller_identity.current.region
    accountId  = data.aws_caller_identity.current.account_id
    topic_name = "ecs-events"
  })
}

# Lambda Function
// zip package
data "archive_file" "lambda_package" {
  type        = "zip"
  source_dir  = "${path.module}/src"
  output_path = "${path.module}/lambda_package.zip"
}

// lambda function
resource "aws_lambda_function" "fn" {
  filename         = data.archive_file.lambda_package.output_path
  source_code_hash = data.archive_file.lambda_package.output_base64sha256
  function_name    = "ecs-events-notify-slack"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"

  environment {
    variables = {
      SLACK_WEBHOOK_URL = var.slack_webhook_url
    }
  }
}

# CloudWatch Event Rules
resource "aws_cloudwatch_event_rule" "this" {
  name        = "ecs-events"
  description = "Capture ECS events"

  event_pattern = jsonencode({
    source = ["aws.ecs"]
  })
}

# Event Rule Targets
resource "aws_cloudwatch_event_target" "sns" {
  rule      = aws_cloudwatch_event_rule.this.name
  target_id = "SendToSNS"
  arn       = aws_sns_topic.ecs_events.arn
}

# SNS Topic Subscription
resource "aws_sns_topic_subscription" "lambda" {
  topic_arn = aws_sns_topic.ecs_events.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.fn.arn
}

# Lambda Permission
resource "aws_lambda_permission" "sns" {
  statement_id  = "AllowSNSInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.fn.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.ecs_events.arn
}

# IAM Role for Lambda
resource "aws_iam_role" "lambda_role" {
  name = "ecs-events-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "lambda_policy" {
  name = "ecs-events-lambda-policy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}
