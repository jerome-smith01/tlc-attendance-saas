# Database Backup Architecture

This document details the automated, zero-cost database backup strategy for Supabase Free Tier projects. It is designed to be highly reliable, running entirely on free-tier services, and serves as a reference implementation for AI agents setting up backups on other projects.

## Architecture Overview

*   **Scheduler & Compute:** GitHub Actions (`ubuntu-latest` runner) triggered via a daily cron job.
*   **Export Tool:** `pg_dump` connecting to Supabase.
*   **Storage Provider:** Cloudflare R2 (S3-compatible, 10 GB free tier, $0 egress fees).
*   **Alerting:** Resend API for failure email notifications.
*   **Retention Policy:** 14 daily incrementals + 12 weekly snapshots (total 26 backup files max).

## Critical Implementation Details & Edge Cases

When implementing this for a new app, AI agents MUST address the following edge cases that cause standard `pg_dump` workflows to fail:

### 1. IPv6 Network Unreachable
Supabase direct connection URLs (`db.[project_ref].supabase.co`) resolve to IPv6 addresses on newer projects. GitHub Actions `ubuntu-latest` runners **do not support outbound IPv6**.
**Solution:** Connect via the Supabase IPv4 Session Pooler (port `5432`). 
*   **Host:** `aws-0-[region].pooler.supabase.com`
*   **User:** `postgres.[project_ref]`

### 2. PostgreSQL Version Mismatch
Supabase projects run newer versions of PostgreSQL (e.g., v17), while `ubuntu-latest` provides an older default client (e.g., v16). `pg_dump` will abort if the server version is newer than the client.
**Solution:** Explicitly add the official PostgreSQL apt repository and install the matching client version (e.g., `postgresql-client-17`).

### 3. Silent Failures & Empty Backups
In a bash pipeline (`pg_dump ... | gzip > backup.sql.gz`), if `pg_dump` fails (e.g., due to bad passwords or missing `PGSSLMODE=require`), the pipeline exits with `gzip`'s status code (`0`), resulting in a "successful" workflow that uploads a useless 20-byte empty archive.
**Solution:**
1.  Enable `set -e -o pipefail` in the bash script.
2.  Set `export PGSSLMODE="require"`.
3.  Implement a strict file size check (e.g., `< 200 bytes`) to explicitly fail the job if the backup is suspiciously small.

### 4. Non-Existent Cleanup Directories
When purging old backups (e.g., `aws s3 ls s3://bucket/weekly/`), the `ls` command will exit with a non-zero status if the directory doesn't exist yet (which is true on the first few runs). With `pipefail` enabled, this crashes the entire workflow.
**Solution:** Append `|| true` to the cleanup loops.

### 5. Resend Sandbox Constraints
If using Resend's free tier without a verified custom domain, emails can only be sent from `onboarding@resend.dev` to the **account owner's registered email address**.

---

## Reference Implementation: `db-backup.yml`

This is the standard GitHub Actions workflow template. It requires 7 GitHub Secrets:
`SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT_URL`, `R2_BUCKET_NAME`, `RESEND_API_KEY`.

```yaml
name: Supabase Automated DB Backup

on:
  schedule:
    - cron: '0 2 * * *'
  workflow_dispatch:

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Install Postgres Client (v17)
        run: |
          sudo apt-get update
          sudo apt-get install -y curl ca-certificates lsb-release
          sudo install -d /usr/share/postgresql-common/pgdg
          sudo curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc --fail https://www.postgresql.org/media/keys/ACCC4CF8.asc
          sudo sh -c 'echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
          sudo apt-get update
          sudo apt-get install -y postgresql-client-17

      - name: Perform Dump & Upload to Cloudflare R2
        id: backup_step
        env:
          PGPASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
          SUPABASE_PROJECT_REF: ${{ secrets.SUPABASE_PROJECT_REF }}
          SUPABASE_DB_HOST: ${{ secrets.SUPABASE_DB_HOST }}
          SUPABASE_DB_USER: ${{ secrets.SUPABASE_DB_USER }}
          R2_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
          R2_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
          R2_ENDPOINT_URL: ${{ secrets.R2_ENDPOINT_URL }}
          BUCKET_NAME: ${{ secrets.R2_BUCKET_NAME }}
        run: |
          set -e -o pipefail

          export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
          export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
          export PGSSLMODE="require"

          # Fallback to Supabase Session Pooler (IPv4 compatible) if SUPABASE_DB_HOST is not provided
          HOST="${SUPABASE_DB_HOST:-aws-0-us-east-1.pooler.supabase.com}"
          USER="${SUPABASE_DB_USER:-postgres.${SUPABASE_PROJECT_REF}}"

          DATE=$(date +'%Y-%m-%d')
          DAY_OF_WEEK=$(date +'%u') # 7 = Sunday
          WEEK_NUM=$(date +'%V')
          YEAR=$(date +'%Y')

          FILENAME="backup_${DATE}.sql.gz"

          echo "Connecting to database host: $HOST with user: $USER..."

          # 1. Export database via pg_dump using Session Mode (Port 5432)
          pg_dump -h "$HOST" \
                  -p 5432 \
                  -U "$USER" \
                  -d postgres \
                  --clean --if-exists --quote-all-identifiers \
                  | gzip > "$FILENAME"

          # Verify backup file is non-empty before uploading (> 100 bytes)
          FILESIZE=$(stat -c%s "$FILENAME" || echo 0)
          echo "Generated backup size: $FILESIZE bytes"

          if [ "$FILESIZE" -lt 200 ]; then
            echo "ERROR: Backup file size is suspiciously small ($FILESIZE bytes). pg_dump may have failed."
            exit 1
          fi

          # 2. Upload Daily Backup
          aws --endpoint-url "$R2_ENDPOINT_URL" s3 cp "$FILENAME" "s3://${BUCKET_NAME}/daily/daily_${DATE}.sql.gz"

          # 3. If Sunday, upload to Weekly folder as well
          if [ "$DAY_OF_WEEK" -eq 7 ]; then
            aws --endpoint-url "$R2_ENDPOINT_URL" s3 cp "$FILENAME" "s3://${BUCKET_NAME}/weekly/weekly_${YEAR}_W${WEEK_NUM}.sql.gz"
          fi

          # 4. Purge Daily backups older than 14 days
          CUTOFF_DAILY=$(date -d '14 days ago' +'%Y-%m-%d')
          aws --endpoint-url "$R2_ENDPOINT_URL" s3 ls "s3://${BUCKET_NAME}/daily/" | while read -r line; do
            FILE=$(echo $line | awk '{print $4}')
            if [[ $FILE =~ daily_([0-9]{4}-[0-9]{2}-[0-9]{2})\.sql\.gz ]]; then
              FILE_DATE="${BASH_REMATCH[1]}"
              if [[ "$FILE_DATE" < "$CUTOFF_DAILY" ]]; then
                aws --endpoint-url "$R2_ENDPOINT_URL" s3 rm "s3://${BUCKET_NAME}/daily/$FILE"
              fi
            fi
          done || true

          # 5. Purge Weekly backups older than 84 days (12 weeks)
          CUTOFF_WEEKLY=$(date -d '84 days ago' +'%Y-%m-%d')
          aws --endpoint-url "$R2_ENDPOINT_URL" s3 ls "s3://${BUCKET_NAME}/weekly/" | while read -r line; do
            FILE=$(echo $line | awk '{print $4}')
            if [[ $FILE =~ weekly_([0-9]{4}-[0-9]{2}-[0-9]{2})\.sql\.gz ]]; then
              FILE_DATE="${BASH_REMATCH[1]}"
              if [[ "$FILE_DATE" < "$CUTOFF_WEEKLY" ]]; then
                aws --endpoint-url "$R2_ENDPOINT_URL" s3 rm "s3://${BUCKET_NAME}/weekly/$FILE"
              fi
            fi
          done || true

      - name: Send Failure Notification via Resend
        if: failure()
        env:
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
        run: |
          curl -X POST 'https://api.resend.com/emails' \
            -H "Authorization: Bearer ${RESEND_API_KEY}" \
            -H "Content-Type: application/json" \
            -d '{
              "from": "Supabase Backup <onboarding@resend.dev>",
              "to": ["heyrromey@gmail.com"],
              "subject": "ALERT: Supabase DB Backup Failed for '${{ github.repository }}'",
              "text": "The automated Supabase database backup workflow failed on '${{ github.repository }}'.\n\nPlease check the GitHub Action run: '${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}'"
            }'
```
