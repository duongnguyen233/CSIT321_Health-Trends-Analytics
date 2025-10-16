from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI
from fastapi import FastAPI
from app.api import auth
from app.db import database
from app.models import user

user.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="CareData Backend")

origins = [
    "http://localhost:5173",  # React dev server
    "http://127.0.0.1:5173"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # GET, POST, PUT, DELETE, etc.
    allow_headers=["*"],
)


app.include_router(auth.router)


@app.get("/")
def read_root():
  return {"message": "API is running"}
