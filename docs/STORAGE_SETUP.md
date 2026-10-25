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

### CORS (required for uploads)

Admin uploads go **straight from your browser to the bucket** in parts, so **both** buckets need a CORS rule that allows `PUT` from your site. On each bucket → Settings → CORS policy:

```json
[
  {
    "AllowedOrigins": ["https://xotiictech.net", "https://www.xotiictech.net"],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

If an upload fails with "Upload blocked: check the storage bucket's CORS settings", this rule is missing or the domain doesn't match.

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

- **How big files work:** in production the browser uploads in 16 MB+ parts, 4 at a time, directly to the bucket with presigned URLs. Files never pass through the website or the API, so size isn't limited by them. There's a progress bar, failed parts retry 3 times, and a cancelled upload is cleaned up.
- **Media:** PNG, JPEG, WebP, GIF, MP4, WebM and MOV, up to `MAX_MEDIA_MB` (5 GB by default). The MIME type *and* the file's magic bytes are checked. A mismatching file is deleted after upload.
- **Deliverables:** `.zip .7z .rar .tar .gz .tgz .xz .bz2 .jar .exe .msi .dll .apk .dmg .iso .mcpack .mcaddon .mrpack .unitypackage .pdf .txt`, up to `MAX_UPLOAD_MB` (50 GB by default).
- **Objects get random names** (`media/<uuid>.png`), so uploaded filenames never become paths.
- **Your storage provider can still cap file size.**
  - **Supabase Storage free plan:** 50 MB per file. Raise it under Storage → Settings → *Global file size limit*; above 50 MB needs the Pro plan.
  - **Cloudflare R2:** no practical per-file limit (5 TB), 10 GB free storage and free downloads. It's the best fit for huge zips and long videos.
- **Very large or rarely updated files:** you can also skip uploading and use the product's **external download link** field (Drive, MEGA, Dropbox).
- **Content Security Policy:** the site's CSP allows uploads to `*.supabase.co`, `*.r2.cloudflarestorage.com`, `*.backblazeb2.com` and `*.amazonaws.com`. For another provider, set `UPLOAD_CONNECT_SRC` on the web service.
