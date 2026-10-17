# Storage setup (Cloudflare R2, or Backblaze B2)

Two buckets:

| Bucket | Contents | Access |
|---|---|---|
| `xotiictech-media` | product/bot screenshots, GIFs, videos | **public**, via a custom domain |
| `xotiictech-deliverables` | the files buyers download | **private**. Buyers get 5-minute presigned URLs only |

## Cloudflare R2

1. Cloudflare dashboard → **R2** → enable it, then create both buckets.
2. **Public media bucket:** open `xotiictech-media` → **Settings → Custom Domains → Connect Domain** → `media.xotiictech.com`. Cloudflare creates the DNS record and certificate.
3. **Private bucket:** leave public access **off**.
4. **R2 → Manage R2 API Tokens → Create API token**
   - Permissions: *Object Read & Write*
   - Scope: *Apply to specific buckets* → both buckets
   - Copy the **Access Key ID** and **Secret Access Key**, plus your **account ID** from the R2 overview page.
5. Set these on `xotiictech-api` in Render:

```
STORAGE_BACKEND=s3
S3_ENDPOINT_URL=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_REGION=auto
S3_ACCESS_KEY_ID=…
S3_SECRET_ACCESS_KEY=…
S3_PUBLIC_BUCKET=xotiictech-media
S3_PRIVATE_BUCKET=xotiictech-deliverables
S3_PUBLIC_BASE_URL=https://media.xotiictech.com
```

6. Redeploy, then upload an image in `/xotiic → Products`. It should load from `media.xotiictech.com`.

### CORS (only if videos fail to play)

On the media bucket → Settings → CORS policy:

```json
[{ "AllowedOrigins": ["https://xotiictech.com"], "AllowedMethods": ["GET", "HEAD"], "AllowedHeaders": ["*"] }]
```

## Backblaze B2 (alternative)

The same code works through B2's S3-compatible API:

```
S3_ENDPOINT_URL=https://s3.<region>.backblazeb2.com
S3_REGION=<region>                  # e.g. us-west-004
S3_PUBLIC_BASE_URL=https://f004.backblazeb2.com/file/xotiictech-media   # or your CDN domain
```

Make the media bucket *Public* and the deliverables bucket *Private*, and use an application key limited to those two buckets.

## How downloads stay private

1. After payment, the buyer gets a link like `https://xotiictech.com/api/downloads/<signed token>`. The token is a JWT that expires with the order's download window (48 hours by default, configurable in Settings).
2. On click, the API checks: order paid, not refunded, window still open, under the download limit.
3. The API then generates a **5-minute presigned R2 URL** and redirects to it. The bucket itself is never public.
4. Signed-in buyers can always get a fresh link from `/account`, and admins can resend from `/xotiic → Orders`.

## Upload rules

- **Media:** PNG, JPEG, WebP, GIF, MP4, WebM up to 50 MB. The MIME type *and* file magic bytes are checked.
- **Deliverables:** `.zip .7z .rar .jar .exe .msi .tar .gz .pdf .txt` up to `MAX_UPLOAD_MB` (200 MB by default).
- Objects get random names (`media/<uuid>.png`), so uploaded filenames never become paths.
