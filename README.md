# Simple Sharing Service

```
.
├── backend/   # Hono app, deployed as a single Lambda behind API Gateway
├── frontend/  # React app, deployed via AWS Amplify
└── infra/     # Terraform for everything above, plus Cognito, S3, DynamoDB
```

## Deploy order

```bash
# 1. Build the lambda bundle so Terraform has something to zip
cd backend && npm install && npm run build && cd ..

# 2. Provision everything
cd infra
terraform init
terraform apply

# 3. Scaffold/build the frontend (see frontend/README.md), then push to the
#    GitHub repo you configured in infra (github_repo_url/github_access_token)
#    — Amplify will build and deploy it automatically on push.
```

After `terraform apply`, `terraform output` in `infra/` gives you the API URL,
Cognito IDs, S3 bucket name, and Amplify domain to wire the frontend up to.
