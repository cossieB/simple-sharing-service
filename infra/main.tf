terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

resource "random_id" "suffix" {
  byte_length = 4
}

# ---------------------------------------------------------------------------
# S3 bucket for uploaded files
# ---------------------------------------------------------------------------

resource "aws_s3_bucket" "uploads" {
  bucket = "${var.project_name}-uploads-${random_id.suffix.hex}"
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket                  = aws_s3_bucket.uploads.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "HEAD"]
    allowed_origins = var.allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# ---------------------------------------------------------------------------
# DynamoDB table for file metadata (s3 key, uploader, etc.)
# ---------------------------------------------------------------------------

resource "aws_dynamodb_table" "files" {
  name         = "${var.project_name}-files"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  # Lets the lambda query "all files uploaded by user X, newest first"
  global_secondary_index {
    name            = "userId-createdAt-index"
    projection_type = "ALL"

    key_schema {
      attribute_name = "userId"
      key_type       = "HASH"
    }

    key_schema {
      attribute_name = "createdAt"
      key_type       = "RANGE"
    }
  }

  point_in_time_recovery {
    enabled = true
  }
}

# ---------------------------------------------------------------------------
# Cognito (auth for the API + React app)
# ---------------------------------------------------------------------------

resource "aws_cognito_user_pool" "this" {
  name                     = "${var.project_name}-user-pool"
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = false
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }
}

resource "aws_cognito_user_pool_client" "this" {
  name         = "${var.project_name}-client"
  user_pool_id = aws_cognito_user_pool.this.id

  generate_secret     = false
  explicit_auth_flows = ["ALLOW_USER_PASSWORD_AUTH", "ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  supported_identity_providers         = ["COGNITO"]

  callback_urls = var.amplify_callback_urls
  logout_urls   = var.amplify_callback_urls
}

resource "aws_cognito_user_pool_domain" "this" {
  domain       = "${var.project_name}-${random_id.suffix.hex}"
  user_pool_id = aws_cognito_user_pool.this.id
}

# ---------------------------------------------------------------------------
# Lambda (Hono app) — IAM role + permissions
# ---------------------------------------------------------------------------

resource "aws_iam_role" "lambda_exec" {
  name = "${var.project_name}-lambda-exec-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Read/write objects in the bucket + generate presigned URLs (presigning is a
# local SDK operation, so it just needs the underlying GetObject/PutObject perms)
resource "aws_iam_role_policy" "lambda_s3" {
  name = "${var.project_name}-lambda-s3-policy"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket",
      ]
      Resource = [
        aws_s3_bucket.uploads.arn,
        "${aws_s3_bucket.uploads.arn}/*",
      ]
    }]
  })
}

resource "aws_iam_role_policy" "lambda_dynamodb" {
  name = "${var.project_name}-lambda-dynamodb-policy"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
      ]
      Resource = [
        aws_dynamodb_table.files.arn,
        "${aws_dynamodb_table.files.arn}/index/*",
      ]
    }]
  })
}

# Zips whatever's in lambda_source_dir (point this at your built Hono bundle,
# e.g. after `esbuild src/index.ts --bundle --platform=node --outdir=dist`)
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = var.lambda_source_dir
  output_path = "${path.module}/build/lambda.zip"
}

resource "aws_lambda_function" "api" {
  function_name = "${var.project_name}-api"
  role          = aws_iam_role.lambda_exec.arn
  handler       = var.lambda_handler
  runtime       = "nodejs24.x"
  timeout       = 29
  memory_size   = 256

  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  environment {
    variables = {
      BUCKET_NAME         = aws_s3_bucket.uploads.bucket
      TABLE_NAME          = aws_dynamodb_table.files.name
      USER_POOL_ID        = aws_cognito_user_pool.this.id
      USER_POOL_CLIENT_ID = aws_cognito_user_pool_client.this.id
      ALLOWED_ORIGINS     = join(",", var.allowed_origins)
    }
  }
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.this.execution_arn}/*/*"
}

# ---------------------------------------------------------------------------
# API Gateway (HTTP API) — catchall route to the Hono lambda, Cognito JWT auth
# ---------------------------------------------------------------------------

resource "aws_apigatewayv2_api" "this" {
  name          = "${var.project_name}-api"
  protocol_type = "HTTP"

  # cors_configuration {
  #   allow_origins = var.allowed_origins
  #   allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
  #   allow_headers = ["Authorization", "content-type", "*"]
  #   max_age = 600
  # }
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.this.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.this.id
  name             = "${var.project_name}-cognito-authorizer"
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.this.id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.this.id}"
  }
}

# Catchall — everything (including "/") goes to the Hono app, which does its
# own internal routing. Auth is enforced here; have Hono skip auth-free
# routes (e.g. health checks) by not relying on the authorizer context for those.
resource "aws_apigatewayv2_route" "root" {
  api_id             = aws_apigatewayv2_api.this.id
  route_key          = "ANY /"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "catchall" {
  api_id             = aws_apigatewayv2_api.this.id
  route_key          = "ANY /{proxy+}"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "options_root" {
  api_id             = aws_apigatewayv2_api.this.id
  route_key          = "OPTIONS /"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "NONE"
}

resource "aws_apigatewayv2_route" "options_catchall" {
  api_id             = aws_apigatewayv2_api.this.id
  route_key          = "OPTIONS /{proxy+}"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "NONE"
}

resource "aws_apigatewayv2_route" "health" {
  api_id    = aws_apigatewayv2_api.this.id
  route_key = "GET /health"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.this.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = 20
    throttling_rate_limit  = 10
  }
}

# ---------------------------------------------------------------------------
# Amplify — React frontend
# ---------------------------------------------------------------------------

resource "aws_amplify_app" "frontend" {
  name         = "${var.project_name}-frontend"
  repository   = var.github_repo_url != "" ? var.github_repo_url : null
  access_token = var.github_access_token != "" ? var.github_access_token : null


  # Monorepo layout: frontend/ lives alongside backend/ and infra/ in the same
  # repo, so Amplify needs an explicit appRoot pointing at the frontend folder.
  build_spec = <<-EOT
    version: 1
    applications:
      - appRoot: frontend
        frontend:
          phases:
            preBuild:
              commands:
                - npm ci
            build:
              commands:
                - npm run build
          artifacts:
            baseDirectory: dist
            files:
              - '**/*'
          cache:
            paths:
              - node_modules/**/*
  EOT


  environment_variables = {
    VITE_API_URL             = aws_apigatewayv2_stage.default.invoke_url
    VITE_USER_POOL_ID        = aws_cognito_user_pool.this.id
    VITE_USER_POOL_CLIENT_ID = aws_cognito_user_pool_client.this.id
    VITE_COGNITO_DOMAIN      = aws_cognito_user_pool_domain.this.domain
    VITE_AWS_REGION          = var.aws_region
  }

  custom_rule {
    source = "/<*>"
    target = "/index.html"
    status = "404-200" # SPA fallback for client-side routing
  }
}

resource "aws_amplify_branch" "main" {
  app_id            = aws_amplify_app.frontend.id
  branch_name       = var.amplify_branch_name
  enable_auto_build = var.github_repo_url != ""
}
