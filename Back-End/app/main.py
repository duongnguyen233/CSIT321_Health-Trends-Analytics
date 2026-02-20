from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth

app = FastAPI(title="CareData Backend (AWS Serverless)")

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://d2vw6ry5du4tco.cloudfront.net",
    "https://care-data-portal.netlify.app",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)


@app.get("/")
def read_root():
    return {"message": "API is running"}


# Lambda handler for AWS
def get_lambda_handler():
    try:
        from mangum import Mangum
        return Mangum(app, lifespan="off")
    except ImportError:
        return None


handler = get_lambda_handler()
