from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.auth import (
    verify_password,
    hash_password,
    create_access_token,
    get_db,
    get_current_user,
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

    try:
        password_ok = verify_password(password, user.password_hash)
    except Exception:
        password_ok = False

    if not password_ok:
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


@router.post("/change-password")
def change_password(data: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_password = data.get("current_password")
    new_password = data.get("new_password")

    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Current password and new password are required")

    if len(str(new_password)) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    try:
        password_ok = verify_password(current_password, user.password_hash)
    except Exception:
        password_ok = False

    if not password_ok:
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    user.password_hash = hash_password(str(new_password))
    db.add(user)
    db.commit()

    return {"message": "Password updated"}
