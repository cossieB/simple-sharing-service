output "api_endpoint" {
  description = "Base URL of the API Gateway, hits the Hono lambda for every path"
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "s3_bucket_name" {
  description = "S3 bucket for uploaded files"
  value       = aws_s3_bucket.uploads.bucket
}

output "dynamodb_table_name" {
  description = "DynamoDB table storing file metadata"
  value       = aws_dynamodb_table.files.name
}

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.this.id
}

output "cognito_user_pool_client_id" {
  value = aws_cognito_user_pool_client.this.id
}

output "cognito_hosted_ui_domain" {
  value = "https://${aws_cognito_user_pool_domain.this.domain}.auth.${var.aws_region}.amazoncognito.com"
}

output "amplify_app_id" {
  value = aws_amplify_app.frontend.id
}

output "amplify_default_domain" {
  description = "Default Amplify domain (branch will be published at https://<branch>.<this domain>)"
  value       = aws_amplify_app.frontend.default_domain
}
