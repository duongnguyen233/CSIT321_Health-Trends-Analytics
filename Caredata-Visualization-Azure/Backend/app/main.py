import asyncio
import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


# Make sure our app-level loggers actually surface in stdout. Without this
# uvicorn's default config drops everything below WARNING from third-party
# loggers, which silently swallowed background-task tracebacks during
# debugging. INFO is the right floor for production too.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
# uvicorn's access log already handles its own formatting; downgrade so we
# don't get duplicate request rows.
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

from app.api import auth, health_scan, mydata, upload_csv, qi, gpms, voice_v2
from app.services.voice_changepoint import cpd_loop_forever
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


@app.on_event("startup")
async def startup_event():
    seed_v2_demo_data()
    # Schedule the nightly change-point scan unless explicitly disabled
    # (tests set VOICE_DISABLE_CPD_LOOP=1 to keep test runs deterministic).
    if not os.environ.get("VOICE_DISABLE_CPD_LOOP"):
        asyncio.create_task(cpd_loop_forever())


@app.get("/")
def read_root():
    return {"message": "API is running"}
