# frontend

React app, deployed via AWS Amplify. Not scaffolded yet — from this directory:

```bash
npm create vite@latest . -- --template react-ts
npm install
npm install @aws-amplify/auth 
```

## Environment variables

`infra/main.tf` configures the Amplify app with these build-time env vars,
populated from the Terraform outputs — read them with `import.meta.env.*` if
you stick with Vite:

| Variable                    | Source                                  |
|------------------------------|------------------------------------------|
| `VITE_API_URL`               | API Gateway invoke URL                  |
| `VITE_USER_POOL_ID`          | Cognito user pool ID                    |
| `VITE_USER_POOL_CLIENT_ID`   | Cognito app client ID                   |
| `VITE_COGNITO_DOMAIN`        | Cognito hosted UI domain                |
| `VITE_AWS_REGION`            | AWS region                              |

For local dev, copy these into a `.env.local` using the values from
`terraform output` in `infra/`.

## Deployment

Amplify is configured for a monorepo layout (`appRoot: frontend` in the build
spec in `infra/main.tf`), so it builds only this directory and expects
`npm run build` to produce a `dist/` folder — the Vite default.
