from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.auth import (
    verify_password,
    hash_password,
    create_access_token,
    get_db,
)
from backend.models_user import User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
def login(data: dict, db: Session = Depends(get_db)):
    # Frontend sends: { "username": "...", "password": "..." }
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        raise HTTPException(status_code=400, detail="Email and password required")

    # Username maps to email
    user = db.query(User).filter(User.email == username).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/register-admin")
def register_admin(data: dict, db: Session = Depends(get_db)):
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password required")

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")

    admin = User(
        email=email,
        password_hash=hash_password(password),
        is_admin=True
    )

    db.add(admin)
    db.commit()

    return {"message": "Admin user created"}
