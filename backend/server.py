from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import re
import logging
import bcrypt
import jwt
import requests
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = os.environ.get("APP_NAME", "news-portal")
_storage_key = None

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ---------- Utility ----------
def hash_password(p): return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()
def verify_password(p, h): return bcrypt.checkpw(p.encode(), h.encode())

def create_access_token(user_id, email):
    payload = {"sub": user_id, "email": email,
               "exp": datetime.now(timezone.utc) + timedelta(hours=12), "type": "access"}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)

def init_storage():
    global _storage_key
    if _storage_key: return _storage_key
    r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    r.raise_for_status()
    _storage_key = r.json()["storage_key"]
    return _storage_key

def put_object(path, data, ct):
    key = init_storage()
    r = requests.put(f"{STORAGE_URL}/objects/{path}",
                     headers={"X-Storage-Key": key, "Content-Type": ct},
                     data=data, timeout=120)
    r.raise_for_status()
    return r.json()

def get_object(path):
    key = init_storage()
    r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")

def slugify(s):
    s = s.lower().strip()
    s = re.sub(r'[^a-z0-9\s-]', '', s)
    s = re.sub(r'[\s-]+', '-', s)
    return s or str(uuid.uuid4())[:8]

# ---------- Models ----------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class NewsCreate(BaseModel):
    title: str
    summary: str = ""
    body: str
    category: str
    image_url: Optional[str] = None
    images: List[str] = []
    youtube_url: Optional[str] = None
    is_featured: bool = False
    is_flash: bool = False
    is_published: bool = True
    tags: List[str] = []
    body_font: Optional[str] = None
    region: Optional[str] = "national"  # national | andhra_pradesh | telangana | karnataka | tamil_nadu

class NewsUpdate(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    body: Optional[str] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    images: Optional[List[str]] = None
    youtube_url: Optional[str] = None
    is_featured: Optional[bool] = None
    is_flash: Optional[bool] = None
    is_published: Optional[bool] = None
    tags: Optional[List[str]] = None
    body_font: Optional[str] = None
    region: Optional[str] = None

class CategoryCreate(BaseModel):
    slug: str
    name_en: str
    name_te: str
    name_hi: Optional[str] = ""
    order: int = 100

class CategoryUpdate(BaseModel):
    name_en: Optional[str] = None
    name_te: Optional[str] = None
    name_hi: Optional[str] = None
    order: Optional[int] = None

class ContactUpdate(BaseModel):
    phone: str
    email: str
    address: Optional[str] = ""
    twitter: Optional[str] = ""
    instagram: Optional[str] = ""
    facebook: Optional[str] = ""
    whatsapp: Optional[str] = ""
    youtube: Optional[str] = ""

class ThemeUpdate(BaseModel):
    primary_color: str = "#E11D2E"
    secondary_color: str = "#1E4B9C"
    accent_color: str = "#0F2A5C"
    logo_url: str = "/logo.png"
    tagline_te: str = "నమ్మకమైన తెలుగు వార్తలు · 24×7"
    tagline_en: str = "Trusted Telugu News · 24×7"
    site_name_te: str = "న్యూస్ 9 టుడే"
    site_name_en: str = "News 9 Today"
    font_scale: float = 1.0  # 0.85 – 1.35
    default_language: str = "te"  # te | en | hi

class LiveChannel(BaseModel):
    id: Optional[str] = None
    name_te: str
    name_en: str
    url: str
    stream_type: str = "youtube"
    order: int = 100
    is_active: bool = True

class LiveTVUpdate(BaseModel):
    url: str
    stream_type: str
    title_en: Optional[str] = "News 9 Today"
    title_te: Optional[str] = "న్యూస్ 9 టుడే"
    channels: Optional[List[LiveChannel]] = None

class FlashConfigUpdate(BaseModel):
    category_slugs: List[str] = []  # empty = all categories
    use_featured_only: bool = False

class YoutubeUpdate(BaseModel):
    channel_id: str
    auto_import: bool = True
    default_category: str = "videos"

class AdCreate(BaseModel):
    name: str
    placement: str  # strip | image | video | sidebar
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    link_url: Optional[str] = ""
    is_active: bool = True
    order: int = 100

class AdUpdate(BaseModel):
    name: Optional[str] = None
    placement: Optional[str] = None
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    link_url: Optional[str] = None
    is_active: Optional[bool] = None
    order: Optional[int] = None

class PageUpdate(BaseModel):
    title_en: str
    title_te: str
    body: str

class FeedSourceCreate(BaseModel):
    name: str
    source_type: str  # facebook | twitter | instagram | youtube | rss
    feed_url: str  # any RSS/Atom URL — for FB/Twitter/IG use RSSHub proxy (e.g. https://rsshub.app/facebook/page/USERNAME)
    category: str = "videos"
    is_active: bool = True

class FeedSourceUpdate(BaseModel):
    name: Optional[str] = None
    source_type: Optional[str] = None
    feed_url: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None

# ---------- Auth Dep ----------
async def get_current_admin(request: Request):
    token = request.cookies.get("access_token")
    if not token:
        h = request.headers.get("Authorization", "")
        if h.startswith("Bearer "): token = h[7:]
    if not token: raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]})
        if not user or user.get("role") != "admin":
            raise HTTPException(403, "Admin only")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")

# ---------- Serializers ----------
def news_out(d):
    return {
        "id": d["id"], "title": d["title"], "summary": d.get("summary", ""),
        "body": d["body"], "category": d["category"],
        "image_url": d.get("image_url"), "images": d.get("images", []),
        "youtube_url": d.get("youtube_url"),
        "is_featured": d.get("is_featured", False),
        "is_flash": d.get("is_flash", False),
        "is_published": d.get("is_published", True),
        "tags": d.get("tags", []),
        "created_at": d["created_at"], "author": d.get("author", "News 9 Today"),
        "body_font": d.get("body_font"),
        "region": d.get("region", "national"),
        "source": d.get("source"),
        "views": d.get("views", 0),
    }

def cat_out(d):
    return {"slug": d["slug"], "name_en": d["name_en"], "name_te": d["name_te"],
            "name_hi": d.get("name_hi", ""), "order": d.get("order", 100)}

def ad_out(d):
    return {"id": d["id"], "name": d["name"], "placement": d["placement"],
            "image_url": d.get("image_url"), "video_url": d.get("video_url"),
            "link_url": d.get("link_url", ""), "is_active": d.get("is_active", True),
            "order": d.get("order", 100)}

# ---------- App ----------
app = FastAPI()
api_router = APIRouter(prefix="/api")

# ---- Auth ----
@api_router.post("/auth/login")
async def login(payload: LoginRequest, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    token = create_access_token(user["id"], user["email"])
    response.set_cookie("access_token", token, httponly=True, secure=False,
                        samesite="lax", max_age=43200, path="/")
    return {"user": {"id": user["id"], "email": user["email"],
                     "name": user["name"], "role": user["role"]},
            "access_token": token}

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"success": True}

@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_admin)):
    return {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"]}

# ---- Categories ----
@api_router.get("/categories")
async def list_categories():
    docs = await db.categories.find({}).sort("order", 1).to_list(200)
    return [cat_out(d) for d in docs]

@api_router.post("/admin/categories")
async def create_category(payload: CategoryCreate, user: dict = Depends(get_current_admin)):
    slug = slugify(payload.slug)
    if await db.categories.find_one({"slug": slug}):
        raise HTTPException(400, "Category slug already exists")
    doc = payload.model_dump()
    doc["slug"] = slug
    await db.categories.insert_one(doc)
    return cat_out(doc)

@api_router.put("/admin/categories/{slug}")
async def update_category(slug: str, payload: CategoryUpdate, user: dict = Depends(get_current_admin)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates: raise HTTPException(400, "No fields")
    r = await db.categories.update_one({"slug": slug}, {"$set": updates})
    if r.matched_count == 0: raise HTTPException(404, "Not found")
    return cat_out(await db.categories.find_one({"slug": slug}))

@api_router.delete("/admin/categories/{slug}")
async def delete_category(slug: str, user: dict = Depends(get_current_admin)):
    count = await db.news.count_documents({"category": slug})
    if count > 0:
        raise HTTPException(400, f"Cannot delete: {count} articles use this category")
    r = await db.categories.delete_one({"slug": slug})
    if r.deleted_count == 0: raise HTTPException(404, "Not found")
    return {"success": True}

# ---- News ----
@api_router.get("/news")
async def list_news(category: Optional[str] = None, featured: Optional[bool] = None,
                    flash: Optional[bool] = None, q: Optional[str] = None,
                    region: Optional[str] = None, source: Optional[str] = None,
                    page: int = 1, limit: int = 12):
    query = {"is_published": True}
    if category: query["category"] = category
    if featured is not None: query["is_featured"] = featured
    if source: query["source"] = source
    if region and region != "all":
        if region == "national":
            query["$or"] = [{"region": "national"}, {"region": {"$exists": False}}]
        else:
            query["$or"] = [{"region": region}, {"region": "national"}, {"region": {"$exists": False}}]
    if flash is not None:
        # Apply flash filter with flash_config override
        if flash is True:
            fc = await db.settings.find_one({"key": "flash_config"})
            cat_slugs = (fc or {}).get("category_slugs", [])
            use_featured = (fc or {}).get("use_featured_only", False)
            if use_featured:
                query["is_featured"] = True
            else:
                query["is_flash"] = True
            if cat_slugs:
                query["category"] = {"$in": cat_slugs}
        else:
            query["is_flash"] = False
    if q:
        q_or = [
            {"title": {"$regex": q, "$options": "i"}},
            {"summary": {"$regex": q, "$options": "i"}},
            {"body": {"$regex": q, "$options": "i"}},
        ]
        if "$or" in query:
            query = {"$and": [{"$or": query.pop("$or")}, {"$or": q_or}], **query}
        else:
            query["$or"] = q_or
    total = await db.news.count_documents(query)
    skip = max(0, (page - 1) * limit)
    docs = await db.news.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return {"items": [news_out(d) for d in docs], "total": total,
            "page": page, "limit": limit, "pages": (total + limit - 1) // limit}

@api_router.get("/news/{news_id}")
async def get_news(news_id: str):
    doc = await db.news.find_one({"id": news_id})
    if not doc: raise HTTPException(404, "News not found")
    # Increment view count (fire-and-forget)
    await db.news.update_one({"id": news_id}, {"$inc": {"views": 1}})
    return news_out(doc)

@api_router.post("/admin/news")
async def create_news(payload: NewsCreate, user: dict = Depends(get_current_admin)):
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["author"] = user["name"]
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    doc["views"] = 0
    await db.news.insert_one(doc)
    return news_out(doc)

@api_router.put("/admin/news/{news_id}")
async def update_news(news_id: str, payload: NewsUpdate, user: dict = Depends(get_current_admin)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates: raise HTTPException(400, "No fields")
    r = await db.news.update_one({"id": news_id}, {"$set": updates})
    if r.matched_count == 0: raise HTTPException(404, "Not found")
    return news_out(await db.news.find_one({"id": news_id}))

@api_router.delete("/admin/news/{news_id}")
async def delete_news(news_id: str, user: dict = Depends(get_current_admin)):
    r = await db.news.delete_one({"id": news_id})
    if r.deleted_count == 0: raise HTTPException(404, "Not found")
    return {"success": True}

@api_router.get("/admin/news")
async def admin_list_news(user: dict = Depends(get_current_admin)):
    docs = await db.news.find({}).sort("created_at", -1).to_list(500)
    return [news_out(d) for d in docs]

# ---- Generic Settings ----
DEFAULT_SETTINGS = {
    "livetv": {"url": "https://www.youtube.com/embed/jfKfPfyJRdk", "stream_type": "youtube",
               "title_en": "News 9 Today", "title_te": "న్యూస్ 9 టుడే",
               "channels": [
                   {"id": "ch1", "name_te": "న్యూస్ 9 మెయిన్", "name_en": "News 9 Main",
                    "url": "https://www.youtube.com/embed/jfKfPfyJRdk", "stream_type": "youtube",
                    "order": 10, "is_active": True},
               ]},
    "contact": {"phone": "9393950505", "email": "news9today99@gmail.com",
                "address": "Hyderabad, Telangana",
                "twitter": "", "instagram": "", "facebook": "",
                "whatsapp": "", "youtube": ""},
    "youtube": {"channel_id": "", "auto_import": True, "default_category": "videos"},
    "weather": {"city": "Hyderabad", "latitude": 17.385, "longitude": 78.4867},
    "theme": {"primary_color": "#E11D2E", "secondary_color": "#1E4B9C",
              "accent_color": "#0F2A5C", "logo_url": "/logo.png",
              "tagline_te": "నమ్మకమైన తెలుగు వార్తలు · 24×7",
              "tagline_en": "Trusted Telugu News · 24×7",
              "site_name_te": "న్యూస్ 9 టుడే", "site_name_en": "News 9 Today",
              "font_scale": 1.0, "default_language": "te"},
    "flash_config": {"category_slugs": [], "use_featured_only": False},
}

REGIONS = [
    {"slug": "national", "name_en": "National", "name_te": "జాతీయ", "bbox": None},
    {"slug": "telangana", "name_en": "Telangana", "name_te": "తెలంగాణ",
     "bbox": [15.83, 77.28, 19.92, 81.79]},
    {"slug": "andhra_pradesh", "name_en": "Andhra Pradesh", "name_te": "ఆంధ్ర ప్రదేశ్",
     "bbox": [12.62, 78.5, 19.0, 84.75]},
    {"slug": "karnataka", "name_en": "Karnataka", "name_te": "కర్ణాటక",
     "bbox": [11.6, 74.05, 18.45, 78.5]},
    {"slug": "tamil_nadu", "name_en": "Tamil Nadu", "name_te": "తమిళనాడు",
     "bbox": [8.08, 78.5, 13.5, 80.35]},
]

async def get_setting(key):
    doc = await db.settings.find_one({"key": key})
    base = DEFAULT_SETTINGS.get(key, {})
    if not doc:
        return dict(base) if base else None
    merged = {**base, **{k: v for k, v in doc.items() if k not in ("_id", "key")}}
    return merged

async def set_setting(key, data):
    doc = dict(data); doc["key"] = key
    await db.settings.update_one({"key": key}, {"$set": doc}, upsert=True)

@api_router.get("/settings/livetv")
async def get_livetv_setting(): return await get_setting("livetv")

@api_router.get("/settings/contact")
async def get_contact(): return await get_setting("contact")

@api_router.get("/settings/youtube")
async def get_youtube_setting(): return await get_setting("youtube")

@api_router.put("/admin/settings/livetv")
async def set_livetv(payload: LiveTVUpdate, user: dict = Depends(get_current_admin)):
    data = payload.model_dump(exclude_none=True)
    # Assign IDs to any new channels lacking one
    if "channels" in data and data["channels"]:
        for ch in data["channels"]:
            if not ch.get("id"):
                ch["id"] = str(uuid.uuid4())
    await set_setting("livetv", data)
    return await get_setting("livetv")

# ---- Social/RSS Feed Sources ----
def feed_out(d):
    return {
        "id": d["id"], "name": d["name"], "source_type": d["source_type"],
        "feed_url": d["feed_url"], "category": d.get("category", "videos"),
        "is_active": d.get("is_active", True),
        "last_synced_at": d.get("last_synced_at"),
        "last_sync_result": d.get("last_sync_result"),
    }

@api_router.get("/admin/feed-sources")
async def list_feed_sources(user: dict = Depends(get_current_admin)):
    docs = await db.feed_sources.find({}).sort("name", 1).to_list(100)
    return [feed_out(d) for d in docs]

@api_router.post("/admin/feed-sources")
async def create_feed_source(payload: FeedSourceCreate, user: dict = Depends(get_current_admin)):
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.feed_sources.insert_one(doc)
    return feed_out(doc)

@api_router.put("/admin/feed-sources/{fid}")
async def update_feed_source(fid: str, payload: FeedSourceUpdate, user: dict = Depends(get_current_admin)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates: raise HTTPException(400, "No fields")
    r = await db.feed_sources.update_one({"id": fid}, {"$set": updates})
    if r.matched_count == 0: raise HTTPException(404, "Not found")
    return feed_out(await db.feed_sources.find_one({"id": fid}))

@api_router.delete("/admin/feed-sources/{fid}")
async def delete_feed_source(fid: str, user: dict = Depends(get_current_admin)):
    r = await db.feed_sources.delete_one({"id": fid})
    if r.deleted_count == 0: raise HTTPException(404, "Not found")
    return {"success": True}

def _extract_first_img(html_text: str) -> str:
    m = re.search(r'<img[^>]+src="([^"]+)"', html_text or "")
    return m.group(1) if m else ""

async def _sync_feed(feed):
    """Fetch feed_url as RSS/Atom, import new items as news."""
    try:
        resp = requests.get(feed["feed_url"], timeout=15,
                            headers={"User-Agent": "Mozilla/5.0 (News9Today)"})
        resp.raise_for_status()
    except Exception as e:
        return {"imported": 0, "skipped": 0, "error": str(e)}

    root = ET.fromstring(resp.content)
    tag = lambda t: t.split("}")[-1]
    imported, skipped = 0, 0

    # Support both RSS 2.0 <item> and Atom <entry>
    items = root.findall(".//{*}item") + root.findall(".//{*}entry")
    for entry in items[:20]:
        title, link, desc, thumb, published = "", "", "", "", None
        for child in entry:
            t = tag(child.tag)
            if t == "title": title = (child.text or "").strip()
            elif t == "link":
                link = child.get("href") or (child.text or "").strip()
            elif t in ("description", "summary", "content"):
                desc = (child.text or "")
            elif t == "pubDate" or t == "published" or t == "updated":
                published = (child.text or "").strip()
            elif t == "thumbnail":
                thumb = child.get("url", "") or thumb
        if not title and not link: continue
        ext_id = link or title
        if await db.news.find_one({"external_id": ext_id}):
            skipped += 1
            continue
        if not thumb: thumb = _extract_first_img(desc)
        clean_desc = re.sub(r"<[^>]+>", "", desc or "")[:400]
        doc = {
            "id": str(uuid.uuid4()),
            "title": title[:200] or "Untitled",
            "summary": clean_desc[:280],
            "body": f'<p>{clean_desc}</p><p><a href="{link}" target="_blank" rel="noopener">View original</a></p>',
            "category": feed.get("category", "videos"),
            "image_url": thumb,
            "images": [],
            "youtube_url": link if "youtube.com" in (link or "") else None,
            "is_featured": False, "is_flash": False, "is_published": True,
            "tags": [feed["source_type"], feed["name"].lower().replace(" ", "-")],
            "author": feed["name"],
            "region": "national",
            "source": feed["source_type"],
            "external_id": ext_id,
            "external_url": link,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "views": 0,
        }
        await db.news.insert_one(doc)
        imported += 1

    await db.feed_sources.update_one(
        {"id": feed["id"]},
        {"$set": {"last_synced_at": datetime.now(timezone.utc).isoformat(),
                  "last_sync_result": {"imported": imported, "skipped": skipped}}}
    )
    return {"imported": imported, "skipped": skipped}

@api_router.post("/admin/feed-sources/{fid}/sync")
async def sync_feed_source(fid: str, user: dict = Depends(get_current_admin)):
    feed = await db.feed_sources.find_one({"id": fid})
    if not feed: raise HTTPException(404, "Not found")
    return await _sync_feed(feed)

@api_router.post("/admin/feed-sources/sync-all")
async def sync_all_feeds(user: dict = Depends(get_current_admin)):
    feeds = await db.feed_sources.find({"is_active": True}).to_list(100)
    results = []
    for f in feeds:
        r = await _sync_feed(f)
        results.append({"id": f["id"], "name": f["name"], **r})
    return {"total": len(feeds), "results": results}


@api_router.put("/admin/settings/contact")
async def set_contact(payload: ContactUpdate, user: dict = Depends(get_current_admin)):
    await set_setting("contact", payload.model_dump())
    return await get_setting("contact")

@api_router.put("/admin/settings/youtube")
async def set_youtube(payload: YoutubeUpdate, user: dict = Depends(get_current_admin)):
    await set_setting("youtube", payload.model_dump())
    return await get_setting("youtube")

# ---- Theme ----
@api_router.get("/settings/theme")
async def get_theme(): return await get_setting("theme")

@api_router.put("/admin/settings/theme")
async def set_theme(payload: ThemeUpdate, user: dict = Depends(get_current_admin)):
    await set_setting("theme", payload.model_dump())
    return await get_setting("theme")

# ---- Flash config ----
@api_router.get("/settings/flash-config")
async def get_flash_cfg(): return await get_setting("flash_config")

@api_router.put("/admin/settings/flash-config")
async def set_flash_cfg(payload: FlashConfigUpdate, user: dict = Depends(get_current_admin)):
    await set_setting("flash_config", payload.model_dump())
    return await get_setting("flash_config")

# ---- Regions ----
@api_router.get("/regions")
async def list_regions(): return REGIONS

# ---- Reverse geo to region ----
@api_router.get("/geo/detect-region")
async def detect_region(lat: float, lon: float):
    # Best-fit: pick the smallest matching bbox (most specific region)
    best = None
    best_area = float("inf")
    for r in REGIONS:
        bb = r.get("bbox")
        if bb and bb[0] <= lat <= bb[2] and bb[1] <= lon <= bb[3]:
            area = (bb[2] - bb[0]) * (bb[3] - bb[1])
            if area < best_area:
                best = r
                best_area = area
    if best:
        return {"region": best["slug"], "name_te": best["name_te"], "name_en": best["name_en"]}
    return {"region": "national", "name_te": "జాతీయ", "name_en": "National"}

# ---- YouTube auto-import ----
@api_router.post("/admin/youtube/sync")
async def youtube_sync(user: dict = Depends(get_current_admin)):
    yt = await get_setting("youtube")
    channel_id = yt.get("channel_id", "").strip() if yt else ""
    if not channel_id:
        raise HTTPException(400, "YouTube channel_id not configured")
    default_cat = (yt or {}).get("default_category", "videos") or "videos"
    try:
        r = requests.get(f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}", timeout=15)
        r.raise_for_status()
    except Exception as e:
        raise HTTPException(502, f"Failed to fetch YouTube feed: {e}")

    root = ET.fromstring(r.content)
    ns = {"atom": "http://www.w3.org/2005/Atom", "media": "http://search.yahoo.com/mrss/", "yt": "http://www.youtube.com/xml/schemas/2015"}
    imported = 0
    skipped = 0
    for entry in root.findall("atom:entry", ns):
        vid_el = entry.find("yt:videoId", ns)
        if vid_el is None: continue
        video_id = vid_el.text
        # dedupe
        existing = await db.news.find_one({"youtube_video_id": video_id})
        if existing:
            skipped += 1
            continue
        title = (entry.find("atom:title", ns).text or "Untitled").strip()
        published = entry.find("atom:published", ns).text
        link_el = entry.find("atom:link", ns)
        author_el = entry.find("atom:author/atom:name", ns)
        author = author_el.text if author_el is not None else "News 9 Today"
        group = entry.find("media:group", ns)
        desc = ""
        thumb = ""
        if group is not None:
            desc_el = group.find("media:description", ns)
            if desc_el is not None: desc = (desc_el.text or "")[:2000]
            thumb_el = group.find("media:thumbnail", ns)
            if thumb_el is not None: thumb = thumb_el.get("url", "")

        doc = {
            "id": str(uuid.uuid4()),
            "title": title,
            "summary": desc[:280] if desc else "",
            "body": f"<p>{desc}</p>" if desc else f"<p>Watch this video on our channel.</p>",
            "category": default_cat,
            "image_url": thumb,
            "images": [],
            "youtube_url": f"https://www.youtube.com/embed/{video_id}",
            "youtube_video_id": video_id,
            "is_featured": False,
            "is_flash": False,
            "is_published": True,
            "tags": ["youtube", "auto-import"],
            "author": author,
            "created_at": published or datetime.now(timezone.utc).isoformat(),
            "views": 0,
            "source": "youtube",
        }
        await db.news.insert_one(doc)
        imported += 1
    return {"imported": imported, "skipped": skipped, "channel_id": channel_id}

# ---- Ads ----
@api_router.get("/ads")
async def list_ads(placement: Optional[str] = None):
    q = {"is_active": True}
    if placement: q["placement"] = placement
    docs = await db.ads.find(q).sort("order", 1).to_list(50)
    return [ad_out(d) for d in docs]

@api_router.get("/admin/ads")
async def admin_list_ads(user: dict = Depends(get_current_admin)):
    docs = await db.ads.find({}).sort("order", 1).to_list(100)
    return [ad_out(d) for d in docs]

@api_router.post("/admin/ads")
async def create_ad(payload: AdCreate, user: dict = Depends(get_current_admin)):
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.ads.insert_one(doc)
    return ad_out(doc)

@api_router.put("/admin/ads/{ad_id}")
async def update_ad(ad_id: str, payload: AdUpdate, user: dict = Depends(get_current_admin)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates: raise HTTPException(400, "No fields")
    r = await db.ads.update_one({"id": ad_id}, {"$set": updates})
    if r.matched_count == 0: raise HTTPException(404, "Not found")
    return ad_out(await db.ads.find_one({"id": ad_id}))

@api_router.delete("/admin/ads/{ad_id}")
async def delete_ad(ad_id: str, user: dict = Depends(get_current_admin)):
    r = await db.ads.delete_one({"id": ad_id})
    if r.deleted_count == 0: raise HTTPException(404, "Not found")
    return {"success": True}

# ---- Pages (Privacy/Terms) ----
DEFAULT_PAGES = {
    "privacy": {
        "title_en": "Privacy Policy",
        "title_te": "గోప్యతా విధానం",
        "body": "<p>News 9 Today respects your privacy. This policy explains how we collect and use information.</p><h2>Information We Collect</h2><p>We may collect basic analytics like page views to improve your experience.</p><h2>Contact</h2><p>For privacy questions, email news9today99@gmail.com.</p>",
    },
    "terms": {
        "title_en": "Terms & Conditions",
        "title_te": "నిబంధనలు మరియు షరతులు",
        "body": "<p>Welcome to News 9 Today. By using this website, you agree to these terms.</p><h2>Content</h2><p>All content is provided for informational purposes.</p><h2>Contact</h2><p>news9today99@gmail.com · 9393950505</p>",
    },
}

@api_router.get("/pages/{slug}")
async def get_page(slug: str):
    doc = await db.pages.find_one({"slug": slug})
    if doc:
        return {"slug": slug, "title_en": doc["title_en"], "title_te": doc["title_te"],
                "body": doc["body"], "updated_at": doc.get("updated_at")}
    if slug in DEFAULT_PAGES:
        return {"slug": slug, **DEFAULT_PAGES[slug], "updated_at": None}
    raise HTTPException(404, "Page not found")

@api_router.put("/admin/pages/{slug}")
async def set_page(slug: str, payload: PageUpdate, user: dict = Depends(get_current_admin)):
    doc = payload.model_dump()
    doc["slug"] = slug
    doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.pages.update_one({"slug": slug}, {"$set": doc}, upsert=True)
    return {"slug": slug, **payload.model_dump(), "updated_at": doc["updated_at"]}

# ---- Widgets: Weather + Stock ----
@api_router.get("/widgets/weather")
async def widget_weather():
    s = await get_setting("weather") or DEFAULT_SETTINGS["weather"]
    lat, lon = s["latitude"], s["longitude"]
    city = s.get("city", "Hyderabad")
    try:
        r = requests.get("https://api.open-meteo.com/v1/forecast",
                         params={"latitude": lat, "longitude": lon,
                                 "current": "temperature_2m,weather_code,relative_humidity_2m",
                                 "timezone": "Asia/Kolkata"},
                         timeout=8)
        data = r.json()
        cur = data.get("current", {})
        return {
            "city": city,
            "temp": cur.get("temperature_2m"),
            "humidity": cur.get("relative_humidity_2m"),
            "weather_code": cur.get("weather_code"),
            "time": cur.get("time"),
        }
    except Exception as e:
        return {"city": city, "temp": None, "error": str(e)}

STOCK_SYMBOLS = [
    ("^NSEI", "NIFTY 50"),
    ("^BSESN", "SENSEX"),
    ("^NSEBANK", "BANK NIFTY"),
    ("INR=X", "USD/INR"),
]

@api_router.get("/widgets/stock")
async def widget_stock():
    results = []
    for sym, label in STOCK_SYMBOLS:
        try:
            r = requests.get(f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}",
                             params={"interval": "1d", "range": "5d"},
                             headers={"User-Agent": "Mozilla/5.0"},
                             timeout=6)
            data = r.json()
            result = data.get("chart", {}).get("result", [{}])[0]
            meta = result.get("meta", {})
            price = meta.get("regularMarketPrice")
            prev = meta.get("chartPreviousClose") or meta.get("previousClose")
            change = None
            change_pct = None
            if price is not None and prev:
                change = round(price - prev, 2)
                change_pct = round((change / prev) * 100, 2)
            results.append({
                "symbol": sym, "label": label,
                "price": round(price, 2) if price else None,
                "change": change, "change_pct": change_pct,
            })
        except Exception as e:
            results.append({"symbol": sym, "label": label, "price": None, "error": str(e)})
    return {"items": results, "updated_at": datetime.now(timezone.utc).isoformat()}

# ---- File Upload ----
MIME_MAP = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
            "gif": "image/gif", "webp": "image/webp"}

@api_router.post("/admin/upload")
async def upload_image(file: UploadFile = File(...), user: dict = Depends(get_current_admin)):
    ext = (file.filename or "img").split(".")[-1].lower()
    if ext not in MIME_MAP: raise HTTPException(400, "Unsupported file type")
    file_id = str(uuid.uuid4())
    path = f"{APP_NAME}/uploads/{user['id']}/{file_id}.{ext}"
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 10MB)")
    result = put_object(path, data, MIME_MAP[ext])
    await db.files.insert_one({
        "id": file_id, "storage_path": result["path"],
        "original_filename": file.filename, "content_type": MIME_MAP[ext],
        "size": result["size"], "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"path": result["path"], "url": f"/api/files/{result['path']}"}

@api_router.get("/files/{path:path}")
async def download_file(path: str):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not record: raise HTTPException(404, "File not found")
    data, ct = get_object(path)
    return Response(content=data, media_type=record.get("content_type", ct))

@api_router.get("/")
async def root():
    return {"message": "News 9 Today API"}

app.include_router(api_router)

# CORS: always allow both www and non-www news9today.com origins for all APIs.
# Any extra origins can be added via the CORS_ORIGINS env var (comma-separated).
# We do NOT use "*" here because `withCredentials: true` in the frontend
# requires a specific origin to be echoed back — browsers reject "*" + credentials.
DEFAULT_ALLOWED_ORIGINS = [
    "https://news9today.com",
    "https://www.news9today.com",
    "http://news9today.com",
    "http://www.news9today.com",
    "http://localhost:3000",
]
_extra = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip() and o.strip() != "*"]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=list(dict.fromkeys(DEFAULT_ALLOWED_ORIGINS + _extra)),
    allow_origin_regex=r"^https?://(www\.)?news9today\.com$",
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# ---------- Seed ----------
DEFAULT_CATEGORIES = [
    {"slug": "politics", "name_en": "Politics", "name_te": "రాజకీయాలు", "name_hi": "राजनीति", "order": 10},
    {"slug": "sports", "name_en": "Sports", "name_te": "క్రీడలు", "name_hi": "खेल", "order": 20},
    {"slug": "cinema", "name_en": "Cinema", "name_te": "సినిమా", "name_hi": "सिनेमा", "order": 30},
    {"slug": "business", "name_en": "Business", "name_te": "వ్యాపారం", "name_hi": "व्यापार", "order": 40},
    {"slug": "technology", "name_en": "Technology", "name_te": "టెక్నాలజీ", "name_hi": "टेक्नोलॉजी", "order": 50},
    {"slug": "health", "name_en": "Health", "name_te": "ఆరోగ్యం", "name_hi": "स्वास्थ्य", "order": 60},
    {"slug": "photos", "name_en": "Photos", "name_te": "ఫోటోలు", "name_hi": "तस्वीरें", "order": 70},
    {"slug": "videos", "name_en": "Videos", "name_te": "వీడియోలు", "name_hi": "वीडियो", "order": 80},
]

async def seed_admin():
    email = os.environ.get("ADMIN_EMAIL", "admin@news.com").lower()
    pwd = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": email})
    if existing is None:
        await db.users.insert_one({"id": str(uuid.uuid4()), "email": email,
            "password_hash": hash_password(pwd), "name": "Admin",
            "role": "admin", "created_at": datetime.now(timezone.utc).isoformat()})
    elif not verify_password(pwd, existing["password_hash"]):
        await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(pwd)}})

async def seed_categories():
    for cat in DEFAULT_CATEGORIES:
        await db.categories.update_one({"slug": cat["slug"]}, {"$setOnInsert": cat}, upsert=True)
        # Backfill name_hi if missing on legacy docs
        if cat.get("name_hi"):
            await db.categories.update_one(
                {"slug": cat["slug"], "$or": [{"name_hi": {"$exists": False}}, {"name_hi": ""}]},
                {"$set": {"name_hi": cat["name_hi"]}}
            )

async def seed_defaults():
    for key, val in DEFAULT_SETTINGS.items():
        if not await db.settings.find_one({"key": key}):
            doc = dict(val); doc["key"] = key
            await db.settings.insert_one(doc)
    for slug, page in DEFAULT_PAGES.items():
        if not await db.pages.find_one({"slug": slug}):
            doc = dict(page); doc["slug"] = slug
            doc["updated_at"] = datetime.now(timezone.utc).isoformat()
            await db.pages.insert_one(doc)

@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.news.create_index("id", unique=True)
    await db.news.create_index("category")
    await db.news.create_index("created_at")
    await db.news.create_index("youtube_video_id")
    await db.news.create_index("external_id")
    await db.feed_sources.create_index("id", unique=True)
    await db.categories.create_index("slug", unique=True)
    await db.settings.create_index("key", unique=True)
    await db.pages.create_index("slug", unique=True)
    await db.ads.create_index("placement")
    await seed_admin()
    await seed_categories()
    await seed_defaults()
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
