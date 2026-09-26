import { Hono } from "hono";
import { handle } from "hono/aws-lambda";
import { cors } from "hono/cors";
import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, DeleteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";

const BUCKET_NAME = process.env.BUCKET_NAME!;
const TABLE_NAME = process.env.TABLE_NAME!;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "").split(",").filter(Boolean);

const s3 = new S3Client({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

type Bindings = {
    event: APIGatewayProxyEventV2WithJWTAuthorizer;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use(
    "*",
    cors({
        origin: ALLOWED_ORIGINS,
        allowMethods: ["GET", "POST", "DELETE", "OPTIONS", "PUT", "PATCH"],
        maxAge: 300,
        allowHeaders: ["Authorization", "Content-Type", "*"],
    })
);

// Cognito JWT claims are already verified by API Gateway's authorizer;
// we just read the subject out of them here.
function getUserId(c: { env: Bindings }): string {
    const claims = c.env.event.requestContext.authorizer.jwt.claims;
    const sub = claims.sub as string | undefined;
    if (!sub) throw new HttpError(401, "Missing user identity");
    return sub;
}

class HttpError extends Error {
    constructor(public status: number, message: string) {
        super(message);
    }
}

app.onError((err, c) => {
    if (err instanceof HttpError) {
        return c.json({ error: err.message }, err.status as any);
    }
    console.error(err);
    return c.json({ error: "Internal server error" }, 500);
});

app.get("/health", (c) => c.json({ ok: true }));

// List the current user's files, most recent first
app.get("/files", async (c) => {
    const userId = getUserId(c);

    const result = await ddb.send(
        new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: "userId-createdAt-index",
            KeyConditionExpression: "userId = :userId",
            ExpressionAttributeValues: { ":userId": userId },
            ScanIndexForward: false,
        })
    );

    return c.json({ files: result.Items ?? [] });
});

// Request a presigned URL to upload a new file, and create its metadata row
app.post("/files/upload-url", async (c) => {
    const userId = getUserId(c);
    const body = await c.req.json<{ fileName: string; contentType: string, size: unknown }>();

    if (!body.fileName || !body.contentType || !body.size) {
        throw new HttpError(400, "fileName, contentType and size are required");
    }
    
    if (typeof body.size !== "number" || body.size > 16 * 1024 * 1024) throw new HttpError(400, "File too big or file size unknown")

    const id = randomUUID();
    const s3Key = `${userId}/${id}/${body.fileName}`;
    const createdAt = new Date().toISOString();

    const uploadUrl = await getSignedUrl(
        s3,
        new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: s3Key,
            ContentType: body.contentType,
        }),
        { expiresIn: 300 }
    );

    await ddb.send(
        new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                id,
                userId,
                s3Key,
                fileName: body.fileName,
                contentType: body.contentType,
                createdAt,
                status: "pending",
            },
        })
    );

    return c.json({ id, uploadUrl, s3Key });
});

// Request a presigned URL to download an existing file
app.get("/files/:id/download-url", async (c) => {
    const userId = getUserId(c);
    const id = c.req.param("id");

    const item = await getOwnedFile(id, userId);

    const downloadUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: BUCKET_NAME, Key: item.s3Key }),
        { expiresIn: 3600 }
    );

    return c.json({ downloadUrl });
});

// Mark a file as fully uploaded (call this after the presigned PUT succeeds)
app.post("/files/:id/complete", async (c) => {
    const userId = getUserId(c);
    const id = c.req.param("id");
    await getOwnedFile(id, userId);

    await ddb.send(
        new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { id }, // The primary key of the item you want to update
            UpdateExpression: "SET #status = :status",
            ExpressionAttributeNames: {
                "#status": "status", // "status" is a DynamoDB reserved keyword, so we use an alias
            },
            ExpressionAttributeValues: {
                ":status": "uploaded",
            },
            ConditionExpression: "attribute_exists(id)",
        })
    );


    return c.json({ ok: true });
});

app.delete("/files/:id", async (c) => {
    const userId = getUserId(c);
    const id = c.req.param("id");
    const item = await getOwnedFile(id, userId);

    await Promise.all([
        s3.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: item.s3Key })),
        ddb.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { id } })),
    ]);

    return c.json({ ok: true });
});

async function getOwnedFile(id: string, userId: string) {
    const result = await ddb.send(
        new GetCommand({ TableName: TABLE_NAME, Key: { id } })
    );
    if (!result.Item) throw new HttpError(404, "File not found");
    if (result.Item.userId !== userId) throw new HttpError(403, "Forbidden");
    return result.Item as { s3Key: string;[key: string]: unknown };
}

export const handler = handle(app);
