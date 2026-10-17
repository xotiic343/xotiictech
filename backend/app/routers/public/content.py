from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import BlogPost, DocPage, PortfolioProject
from app.serializers import blog_out, doc_out, portfolio_out

router = APIRouter(tags=["content"])


@router.get("/portfolio")
def list_portfolio(
    db: Session = Depends(get_db),
    category: str | None = Query(None, max_length=60),
    featured: bool = False,
):
    stmt = select(PortfolioProject).where(PortfolioProject.is_published.is_(True))
    if category:
        stmt = stmt.where(PortfolioProject.category == category)
    if featured:
        stmt = stmt.where(PortfolioProject.is_featured.is_(True))
    items = db.scalars(stmt.order_by(PortfolioProject.sort_order, PortfolioProject.created_at.desc())).all()
    categories = sorted(
        {c for c in db.scalars(select(PortfolioProject.category).where(PortfolioProject.is_published.is_(True))) if c}
    )
    return {"items": [portfolio_out(p) for p in items], "categories": categories}


@router.get("/portfolio/{slug}")
def get_portfolio(slug: str, db: Session = Depends(get_db)):
    p = db.scalar(select(PortfolioProject).where(PortfolioProject.slug == slug, PortfolioProject.is_published.is_(True)))
    if not p:
        raise HTTPException(404, "Project not found")
    return portfolio_out(p, full=True)


@router.get("/blog")
def list_blog(
    db: Session = Depends(get_db),
    kind: Literal["announcement", "tutorial", "changelog"] | None = None,
    limit: int = Query(50, ge=1, le=200),
):
    stmt = select(BlogPost).where(BlogPost.is_published.is_(True))
    if kind:
        stmt = stmt.where(BlogPost.kind == kind)
    items = db.scalars(stmt.order_by(BlogPost.published_at.desc()).limit(limit)).all()
    return {"items": [blog_out(p, full=kind == "changelog") for p in items]}


@router.get("/blog/{slug}")
def get_blog(slug: str, db: Session = Depends(get_db)):
    p = db.scalar(select(BlogPost).where(BlogPost.slug == slug, BlogPost.is_published.is_(True)))
    if not p:
        raise HTTPException(404, "Post not found")
    return blog_out(p, full=True)


@router.get("/docs")
def list_docs(db: Session = Depends(get_db)):
    items = db.scalars(
        select(DocPage).where(DocPage.is_published.is_(True)).order_by(DocPage.section, DocPage.sort_order, DocPage.title)
    ).all()
    faq = [doc_out(d, full=True) for d in items if d.section == "faq"]
    sections: dict[str, list] = {}
    for d in items:
        if d.section != "faq":
            sections.setdefault(d.section, []).append(doc_out(d))
    return {"sections": sections, "faq": faq}


@router.get("/docs/{slug}")
def get_doc(slug: str, db: Session = Depends(get_db)):
    d = db.scalar(select(DocPage).where(DocPage.slug == slug, DocPage.is_published.is_(True)))
    if not d:
        raise HTTPException(404, "Doc not found")
    return doc_out(d, full=True)
