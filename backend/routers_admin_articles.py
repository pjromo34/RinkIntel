# backend/routers_admin_articles.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any
from backend.database import SessionLocal
from backend.models import Article
from backend.auth import get_current_user

router = APIRouter(prefix="/admin/articles", tags=["admin-articles"])

def admin_required(user=Depends(get_current_user)):
    if not getattr(user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("")
@router.get("/")
def list_articles(user=Depends(admin_required), db: Session = Depends(get_db)):
    articles = db.query(Article).order_by(Article.created_at.desc()).all()
    return [
        {
            "id": a.id,
            "title": a.title,
            "description": a.description,
            "content": a.content,
            "header_image": a.header_image,
            "author": a.author,
            "published": bool(a.published),
            "created_at": a.created_at,
        }
        for a in articles
    ]

@router.post("")
@router.post("/")
def create_article(payload: Dict[str, Any], user=Depends(admin_required), db: Session = Depends(get_db)):
    article = Article(**payload)
    db.add(article)
    db.commit()
    db.refresh(article)
    return {"id": article.id}

@router.patch("/{article_id}")
@router.patch("/{article_id}/")
def update_article(article_id: int, payload: Dict[str, Any], user=Depends(admin_required), db: Session = Depends(get_db)):
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    for k, v in payload.items():
        if hasattr(article, k):
            setattr(article, k, v)

    db.commit()
    db.refresh(article)
    return {"id": article.id}

@router.delete("/{article_id}", status_code=204)
@router.delete("/{article_id}/", status_code=204)
def delete_article(article_id: int, user=Depends(admin_required), db: Session = Depends(get_db)):
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    db.delete(article)
    db.commit()
    return None
