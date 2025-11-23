from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth
from app.db import database
from app.models import user
from app.db.database import SessionLocal
from app.core.config import settings
from app.core.security import hash_password

# Create database tables
user.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="CareData Backend")

# Allow both dev and production frontends
origins = [
    "http://localhost:5173",                   # Local dev
    "http://127.0.0.1:5173",                   # Local dev
    "https://d2vw6ry5du4tco.cloudfront.net",   # Production CloudFront URL
    "https://3.27.185.109",                    # Optional: direct IP test
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


def ensure_admin_user():
    db = SessionLocal()
    try:
        admin = db.query(user.User).filter(user.User.email == settings.ADMIN_EMAIL).first()
        if not admin:
            admin = user.User(
                first_name=settings.ADMIN_FIRST_NAME,
                last_name=settings.ADMIN_LAST_NAME,
                email=settings.ADMIN_EMAIL,
                hashed_password=hash_password(settings.ADMIN_PASSWORD),
                role="admin",
            )
            db.add(admin)
            db.commit()
            print(f"Created admin user: {settings.ADMIN_EMAIL}")
        else:
            # make sure role is admin
            if admin.role != "admin":
                admin.role = "admin"
                db.commit()
    finally:
        db.close()


@app.on_event("startup")
def startup_event():
    ensure_admin_user()


@app.get("/")
def read_root():
    return {"message": "API is running"}
