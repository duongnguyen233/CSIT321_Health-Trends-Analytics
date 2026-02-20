# ⚠️ ACTION REQUIRED: Deploy Backend to Fix CORS

## Current Status

❌ **CORS Error Still Happening**  
✅ **Code is Fixed Locally**  
❌ **Backend NOT Deployed to AWS**

## The Problem

Your code has the CORS fix, but **AWS Lambda is still running the OLD code** without CORS headers.

## Solution: Deploy Now

### Step 1: Open PowerShell/Terminal

```powershell
cd C:\Users\DELL\Desktop\CSIT321_Health-Trends-Analytics\Back-End
```

### Step 2: Check if SAM CLI is installed

```powershell
sam --version
```

**If you see a version number** → Go to Step 3  
**If you see "command not found"** → Install SAM CLI first (see below)

### Step 3: Build

```powershell
sam build
```

Expected output:
```
Building codeuri: C:\Users\DELL\...\Back-End runtime: python3.11 metadata: {} functions: ['ApiFunction']
...
Build Succeeded
```

### Step 4: Deploy

```powershell
sam deploy
```

**When prompted:**
- `Confirm changes before deploy [y/N]`: Type `y` and press Enter
- `Allow SAM CLI IAM role creation [Y/n]`: Type `Y` and press Enter
- `Disable rollback [y/N]`: Type `N` and press Enter

**Wait 2-5 minutes** for deployment to complete.

Expected output:
```
Successfully created/updated stack - caredata-api in ap-southeast-2
```

### Step 5: Wait 1-2 minutes

API Gateway needs time to propagate the CORS changes.

### Step 6: Test

1. Go to: https://care-data-portal.netlify.app
2. Open DevTools (F12) → Network tab
3. Try to login
4. Check the `/auth/me` request:
   - ✅ Should see `200 OK` status
   - ✅ Should see `Access-Control-Allow-Origin` header in response
   - ❌ If still CORS error → Wait 2 more minutes and try again

---

## If SAM CLI Not Installed

### Option 1: Install SAM CLI (Recommended)

1. Download: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html
2. Install the Windows installer
3. Restart terminal
4. Run `sam --version` to verify

### Option 2: Use AWS CloudShell

1. Go to: https://console.aws.amazon.com
2. Click **CloudShell** icon (top right, looks like `>_`)
3. Upload your `Back-End` folder:
   ```bash
   # In CloudShell, create directory
   mkdir caredata-backend
   cd caredata-backend
   ```
4. Use "Actions" → "Upload file" to upload your Back-End files
5. Run:
   ```bash
   sam build
   sam deploy --guided
   ```

### Option 3: Check AWS Console

1. Go to: https://console.aws.amazon.com/cloudformation
2. Find stack: `caredata-api`
3. Check if it exists and when it was last updated
4. If it exists but is old → You need to redeploy
5. If it doesn't exist → You need to deploy for the first time

---

## Troubleshooting

### "sam: command not found"
→ Install SAM CLI (see above)

### "Access Denied" or "Permission denied"
→ Check AWS credentials:
```powershell
aws configure
```
Make sure you have:
- AWS Access Key ID
- AWS Secret Access Key
- Region: `ap-southeast-2`

### "Stack already exists"
→ That's fine! Just redeploy:
```powershell
sam deploy
```

### Deployment succeeds but CORS still fails
1. Wait 2-3 more minutes (API Gateway propagation)
2. Clear browser cache
3. Try incognito/private window
4. Check Network tab → Look at the OPTIONS request (preflight)
   - Should return `200 OK` with CORS headers

---

## Quick Verification

After deployment, test the API directly:

```powershell
# Test OPTIONS request (preflight)
curl -X OPTIONS https://5f2fuubsod.execute-api.ap-southeast-2.amazonaws.com/dev/auth/me `
  -H "Origin: https://care-data-portal.netlify.app" `
  -H "Access-Control-Request-Method: GET" `
  -v
```

**Should see:**
```
< Access-Control-Allow-Origin: https://care-data-portal.netlify.app
< Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
```

If you see these headers → CORS is working! ✅
