from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth
from app.db import database
from app.models import user

# Create database tables
user.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="CareData Backend")

# ✅ Allow both dev and production frontends
origins = [
    "http://localhost:5173",                   # Local dev
    "http://127.0.0.1:5173",                   # Local dev
    "https://d2vw6ry5du4tco.cloudfront.net",   # Production CloudFront URL
    "https://3.27.185.109"                     # Optional: direct IP test
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,           # Explicit list of allowed origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)

@app.get("/")
def read_root():
    return {"message": "API is running"}
