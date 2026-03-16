# Incident Response

## Quick Reference

| Issue | Check | Action |
|-------|-------|--------|
| API is down | `curl /health` | Check Render dashboard, redeploy |
| Frontend is down | Visit equityvalue.ai | Check Vercel dashboard |
| Pipeline failed | GitHub Actions tab | Re-run workflow |
| Database errors | Supabase dashboard | Check connection limits, disk |
| Slow responses | Sentry performance | Check cache hit rate, DB queries |

## When the API Is Down

1. **Check health endpoint:**
   ```bash
   curl https://your-backend-url.onrender.com/health
   ```

2. **Check Render dashboard:**
   - Go to render.com > your service.
   - Look at deploy logs and runtime logs for errors.
   - Common causes: failed deploy, out-of-memory, env var missing.

3. **Redeploy:**
   - In Render dashboard, click "Manual Deploy" > "Deploy latest commit".
   - Or push a fix to `main` to trigger auto-deploy.

4. **If Render is down entirely:**
   - Check status.render.com for platform outages.
   - Nothing to do but wait; consider fallback hosting if recurring.

## When the Pipeline Fails

1. **Check GitHub Actions:**
   - Repo > Actions > Select the failed workflow run.
   - Read the logs for the failing step.

2. **Common failures and fixes:**
   - **Secrets expired:** Re-generate and update in repo Settings > Secrets.
   - **Timeout:** Pipeline ran too long. Check for Supabase slowness.
   - **Script error:** Fix the code and re-run the workflow.

3. **Re-run:**
   - Click "Re-run all jobs" on the failed workflow run.
   - Or trigger manually via "Run workflow" button.

## When Supabase Has Issues

1. **Check Supabase dashboard:**
   - Go to supabase.com > your project > Database.
   - Check connection count, disk usage, and query performance.

2. **Connection pool exhaustion:**
   - The backend creates one Supabase client at startup.
   - If connections are maxed, check for leaked connections or reduce concurrent requests.

3. **Slow queries:**
   - Check the Query Performance section in Supabase dashboard.
   - Most tables are indexed on `ticker` — if a new query pattern is slow, add an index.

## Checking Sentry

1. Go to sentry.io > your project.
2. Look at **Issues** for new errors.
3. Look at **Performance** for slow transactions.
4. The backend sends traces at 10% sample rate (`traces_sample_rate=0.1`).

## Rollback Procedures

### Backend (Render)
1. Go to Render dashboard > your service > Deploys.
2. Find the last working deploy.
3. Click the three dots > "Rollback to this deploy".

### Frontend (Vercel)
1. Go to Vercel dashboard > your project > Deployments.
2. Find the last working deployment.
3. Click the three dots > "Promote to Production".

### Database (Supabase)
- Supabase does not have one-click rollback.
- For schema changes: keep migration scripts and write a reverse migration.
- For data issues: restore from Supabase's point-in-time recovery (available on paid plans).

## Escalation

If you cannot resolve the issue within 30 minutes:
1. Check all monitoring dashboards (Sentry, Render, Supabase, Vercel).
2. Document what you've tried.
3. If it's a third-party outage (Render, Supabase, FMP), monitor their status pages and wait.
