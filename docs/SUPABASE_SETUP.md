# Supabase setup (permanent database + file storage)

Without a database, the API uses a temporary SQLite file that Render wipes on every deploy, taking products, orders, bots and settings with it. Uploaded images and files also live on Render's temporary disk unless storage is configured. Supabase fixes both.

## 1. Create the project

1. Go to supabase.com → **New project**.
2. Pick a **region close to your Render region** (Render "Oregon" → Supabase "West US (North California)" or "East US"; the closer the faster).
3. Set a **database password**. Use letters and numbers only, so it needs no escaping in the URL. Save it somewhere safe.

## 2. Database → `DATABASE_URL`

1. In Supabase, click **Connect** (top bar) → **Connection string** → **URI**.
2. Choose **Session pooler**, not "Direct connection": the direct address is IPv6-only and Render can't reach it. It looks like:

   ```
   postgresql://postgres.<project-ref>:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres
   ```

3. Replace `[YOUR-PASSWORD]` (including the brackets) with your password, and add `?sslmode=require` to the end.
4. Render → **xotiictech-api** → **Environment** → `DATABASE_URL` = that full string → **Save**.
5. Check the deploy log for:

   ```
   Context impl PostgresqlImpl.
   Running upgrade  -> 0001 ... -> 0002 ... -> 0003
   ```

   `PostgresqlImpl` means Supabase is connected. From now on nothing resets. You'll need to re-add anything you created while on the temporary database.

> If your password contains symbols like `@ : / ? #`, they must be URL-encoded (`@` → `%40`), or you can simply reset the password in Supabase → Project Settings → Database.

## 3. Storage → images and uploaded files

Supabase Storage speaks the same S3 protocol the site already uses.

1. Supabase → **Storage** → **New bucket**:
   - `media`: turn **Public bucket ON** (product and bot images).
   - `deliverables`: leave **Public OFF** (paid downloads).
2. **Storage → Settings → S3 Connection**: copy the **Endpoint** and **Region**.
3. Same page → **S3 Access Keys → New access key**: copy the **Access key ID** and **Secret access key** (shown once).
4. Render → **xotiictech-api** → **Environment**:

   | Key | Value |
   |---|---|
   | `STORAGE_BACKEND` | `s3` |
   | `S3_ENDPOINT_URL` | the Endpoint, e.g. `https://<project-ref>.supabase.co/storage/v1/s3` |
   | `S3_REGION` | the Region, e.g. `us-east-1` |
   | `S3_ACCESS_KEY_ID` | access key ID |
   | `S3_SECRET_ACCESS_KEY` | secret access key |
   | `S3_PUBLIC_BUCKET` | `media` |
   | `S3_PRIVATE_BUCKET` | `deliverables` |
   | `S3_PUBLIC_BASE_URL` | `https://<project-ref>.supabase.co/storage/v1/object/public/media` |

5. **Save**, then re-upload your images in `/xotiic`. Test by opening a product page, and by test-buying a product that has an uploaded file.

Free-plan file uploads are capped at 50 MB per file. For bigger downloads, use the product's **download link** field (Drive/MEGA/Dropbox).

## Notes

- **Free projects pause after about a week with no database activity.** Your site queries the database constantly, so this shouldn't happen while it's live. If it ever does, click **Restore** in Supabase.
- **Backups:** the free plan has no point-in-time restore. Upgrade, or export now and then from Supabase → Database → Backups.
- **Never share** the database password or the S3 secret key. They only belong in Render's API environment.
