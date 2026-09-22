variable "project_name" {
  description = "Name prefix used for all resources"
  type        = string
  default     = "simple-sharing-service"
}

variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "eu-west-2"
}

variable "allowed_origins" {
  description = "Origins allowed to call the API and upload/download via presigned URLs (your Amplify app URL + local dev)"
  type        = list(string)
  default     = ["http://localhost:5173"]
}

variable "lambda_source_dir" {
  description = "Path to the built Hono lambda bundle (e.g. output of esbuild), zipped for deployment. Relative to the infra/ directory."
  type        = string
  default     = "../backend/dist"
}

variable "lambda_handler" {
  description = "Lambda handler entrypoint"
  type        = string
  default     = "index.handler"
}

variable "amplify_callback_urls" {
  description = "OAuth callback/logout URLs for the Cognito hosted UI (your React app's routes)"
  type        = list(string)
  default     = ["http://localhost:5173/callback"]
}

variable "github_repo_url" {
  description = "GitHub repository URL for the React frontend (e.g. https://github.com/org/repo). Leave blank to skip Amplify's GitHub connection and connect manually in the console."
  type        = string
  default     = ""
}

variable "github_access_token" {
  description = "GitHub personal access token with repo access, used by Amplify to set up the webhook. Leave blank if connecting manually."
  type        = string
  default     = ""
  sensitive   = true
}

variable "amplify_branch_name" {
  description = "Git branch Amplify should build and deploy"
  type        = string
  default     = "main"
}
