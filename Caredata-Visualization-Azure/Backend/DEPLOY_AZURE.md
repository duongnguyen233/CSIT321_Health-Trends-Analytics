# Deploy backend to Azure App Service (`caredata-api-uow`)

## If you see `UvicornWorker invalid or not found`

Your log probably shows:

```text
Site's appCommandLine: gunicorn app.main:app -k uvicorn.workers.UvicornWorker ...
WARNING: Could not find virtual environment directory /home/site/wwwroot/antenv
```

That means **Azure is still using the old Startup Command** and **no Python packages** are on the server.

### Fix (Portal — required once)

Your log **proves** the old command is still active:

```text
Site's appCommandLine: gunicorn app.main:app -k uvicorn.workers.UvicornWorker ...
ModuleNotFoundError: No module named 'uvicorn'
```

Until that line changes, every deploy will fail the same way.

1. Azure Portal → **App Service** `caredata-api-uow` → **Configuration** → **General settings**
2. **Startup Command** — **delete** the entire `gunicorn app.main:app ...` line.
3. Paste **only**:

   ```bash
   bash startup.sh
   ```

4. Click **Save** at the top of Configuration (not just in the blade).
5. **Overview** → **Restart**.
6. **Log stream** — you must see `Installing Python dependencies` or `Using bundled packages`, then `Starting gunicorn`.  
   If you still see `Site's appCommandLine: gunicorn app.main:app` you did not save the startup command.

3. **Application settings** (optional but recommended):

   | Name | Value |
   |------|--------|
   | `VOICE_SKIP_SEED` | `1` |
   | `VOICE_DISABLE_CPD_LOOP` | `1` |
   | `SCM_DO_BUILD_DURING_DEPLOYMENT` | `false` |

4. **Save** → **Restart**
5. Open **Log stream** — after a new deploy you should see `deps ok` or gunicorn listening, not `antenv` missing.

### Fix (GitHub)

Push to `main` so workflow **Build and deploy Python app to Azure Web App - caredata-api-uow** runs.

The workflow installs packages into `.python_packages/lib/site-packages` (works with `WEBSITE_RUN_FROM_PACKAGE`).

Check the **build** job log ends with `deps ok`. Check **deploy** job is green.

### Verify

```text
GET https://caredata-api-uow.azurewebsites.net/
→ {"message":"API is running"}
```

## Log shows torch / faster-whisper / 25+ minutes with no output

The server is installing the **full** `requirements.txt` (~2 GB PyTorch + CUDA), not the slim Azure list.

**Fix:** Push and run GitHub workflow `main_caredata-api-uow.yml` (deploys `requirements-azure.txt` + pre-built `.python_packages`).

**Do not restart repeatedly** — each restart may restart a huge pip install.

**Optional (Kudu SSH):** delete `/home/site/packages` if a partial install exists, then redeploy.

**App setting:** `WEBSITES_CONTAINER_START_TIME_LIMIT` = `1800` (30 min) if you must pip-install on the server.

## Local full dependencies

For voice ML on a dev machine:

```bash
pip install -r requirements.txt
```

Azure uses `requirements-azure.txt` (smaller, faster deploy).
