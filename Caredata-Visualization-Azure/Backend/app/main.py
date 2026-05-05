from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.api import auth, health_scan, mydata, upload_csv, qi, gpms, voice_v2
from app.services.voice_seed_v2 import seed_v2_demo_data

app = FastAPI(title="CareData Backend (Azure)")

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://d2vw6ry5du4tco.cloudfront.net",
    "https://care-data-portal.netlify.app",
    "https://www.caredataportal.com",
    "https://caredataportal.com",
    "https://ashy-sky-00ee6c400.7.azurestaticapps.net",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://[\w-]+\.azurestaticapps\.net",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(health_scan.router)
app.include_router(mydata.router)
app.include_router(upload_csv.router)
app.include_router(qi.router)
app.include_router(gpms.router)
app.include_router(voice_v2.router)


# ---------------------------------------------------------------------------
# Legacy voice route aliases — temporary, removed in Phase 4 (frontend cutover)
#
# The frontend currently calls /api/voice/* directly (e.g. /api/voice/links).
# Phase 4 rewrites the frontend to call /api/voice/v2/*. Until then we 307-
# redirect the old paths to the new ones so the existing UI doesn't break.
# ---------------------------------------------------------------------------


@app.api_route(
    "/api/voice/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    include_in_schema=False,
)
async def _voice_legacy_alias(path: str, request: Request):
    if path.startswith("v2/"):
        # already pointed at v2 — let the v2 router handle it (FastAPI routes
        # this prefix-match before the wildcard, but be defensive).
        return RedirectResponse(url=f"/api/voice/{path}", status_code=307)
    target = f"/api/voice/v2/{path}"
    if request.url.query:
        target = f"{target}?{request.url.query}"
    return RedirectResponse(url=target, status_code=307)


@app.on_event("startup")
def startup_event():
    seed_v2_demo_data()


@app.get("/")
def read_root():
    return {"message": "API is running"}
