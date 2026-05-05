from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, health_scan, mydata, upload_csv, qi, gpms, voice, voice_v2
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
app.include_router(voice.router)
app.include_router(voice_v2.router)


@app.on_event("startup")
def startup_event():
    seed_v2_demo_data()


@app.get("/")
def read_root():
    return {"message": "API is running"}


