from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import BlogPost, DocPage
from app.serializers import blog_out, doc_out

router = APIRouter(tags=["content"])


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
