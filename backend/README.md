# backend

Hono app that runs as the Lambda behind API Gateway. Every route (auth, presigned
URLs, file metadata) lives here; API Gateway forwards everything through a
catchall route and Hono does its own internal routing.

## Develop

```bash
npm install
npm run typecheck
```

## Build for deployment

Terraform's `archive_file` data source zips whatever is in `dist/`, so build
before running `terraform apply`:

```bash
npm run build
```

This bundles `src/index.ts` (and all dependencies) into `dist/index.js` via
esbuild. `infra/variables.tf` points `lambda_source_dir` at `../backend/dist`
by default, so as long as you build before `terraform apply`/`plan`, it picks
up the latest code.

## Routes

- `GET /health`
- `GET /files` — list the current user's files
- `POST /files/upload-url` — `{ fileName, contentType }` → presigned PUT URL + creates a metadata row
- `POST /files/:id/complete` — mark a file as fully uploaded
- `GET /files/:id/download-url` — presigned GET URL for an owned file
- `DELETE /files/:id` — deletes the S3 object and its metadata row

All routes expect a Cognito-issued JWT in the `Authorization` header — API
Gateway validates it before invoking the Lambda, and the handler reads the
user's `sub` claim out of the already-verified token.
