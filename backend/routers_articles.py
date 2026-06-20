# backend/routers_articles.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict
from backend.database import SessionLocal
from backend.models import Article

router = APIRouter(prefix="/articles", tags=["articles"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("")
@router.get("/", response_model=List[Dict])
def get_all_articles(db: Session = Depends(get_db)):
    articles = db.query(Article).order_by(Article.created_at.desc()).all()
    return [
        {
            "id": a.id,
            "title": a.title,
            "description": a.description,
            "header_image": a.header_image,
            "author": a.author,
            "created_at": a.created_at,
        }
        for a in articles
    ]

@router.get("/recent")
@router.get("/recent/", response_model=List[Dict])
def get_recent_articles(db: Session = Depends(get_db)):
    articles = (
        db.query(Article)
        .order_by(Article.created_at.desc())
        .limit(5)
        .all()
    )
    return [
        {
            "id": a.id,
            "title": a.title,
            "description": a.description,
            "header_image": a.header_image,
            "author": a.author,
            "created_at": a.created_at,
        }
        for a in articles
    ]

@router.get("/{article_id}")
@router.get("/{article_id}/", response_model=Dict)
def get_article(article_id: int, db: Session = Depends(get_db)):
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    return {
        "id": article.id,
        "title": article.title,
        "description": article.description,
        "header_image": article.header_image,
        "author": article.author,
        "created_at": article.created_at,
    }
