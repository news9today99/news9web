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
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

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
               "exp": datetime.now(timezone.utc) + timedelta(hours=12),
               "type": "access"}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)

def init_storage():
    global _storage_key
    if _storage_key: return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
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
    r = requests.get(f"{STORAGE_URL}/objects/{path}",
                     headers={"X-Storage-Key": key}, timeout=60)
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

class CategoryCreate(BaseModel):
    slug: str
    name_en: str
    name_te: str
    order: int = 100

class CategoryUpdate(BaseModel):
    name_en: Optional[str] = None
    name_te: Optional[str] = None
    order: Optional[int] = None

class LiveTVUpdate(BaseModel):
    url: str
    stream_type: str  # youtube | hls | mp4
    title_en: Optional[str] = "Andhra News 24×7"
    title_te: Optional[str] = "ఆంధ్ర న్యూస్ 24×7"

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
        "created_at": d["created_at"], "author": d.get("author", "ABN Desk"),
    }

def cat_out(d):
    return {"slug": d["slug"], "name_en": d["name_en"], "name_te": d["name_te"], "order": d.get("order", 100)}

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

# ---- Categories (public) ----
@api_router.get("/categories")
async def list_categories():
    docs = await db.categories.find({}).sort("order", 1).to_list(200)
    return [cat_out(d) for d in docs]

# ---- Categories (admin) ----
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
    doc = await db.categories.find_one({"slug": slug})
    return cat_out(doc)

@api_router.delete("/admin/categories/{slug}")
async def delete_category(slug: str, user: dict = Depends(get_current_admin)):
    count = await db.news.count_documents({"category": slug})
    if count > 0:
        raise HTTPException(400, f"Cannot delete: {count} articles use this category")
    r = await db.categories.delete_one({"slug": slug})
    if r.deleted_count == 0: raise HTTPException(404, "Not found")
    return {"success": True}

# ---- News Public ----
@api_router.get("/news")
async def list_news(category: Optional[str] = None, featured: Optional[bool] = None,
                    flash: Optional[bool] = None, q: Optional[str] = None,
                    page: int = 1, limit: int = 12):
    query = {"is_published": True}
    if category: query["category"] = category
    if featured is not None: query["is_featured"] = featured
    if flash is not None: query["is_flash"] = flash
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"summary": {"$regex": q, "$options": "i"}},
            {"body": {"$regex": q, "$options": "i"}},
        ]
    total = await db.news.count_documents(query)
    skip = max(0, (page - 1) * limit)
    docs = await db.news.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return {"items": [news_out(d) for d in docs], "total": total,
            "page": page, "limit": limit, "pages": (total + limit - 1) // limit}

@api_router.get("/news/{news_id}")
async def get_news(news_id: str):
    doc = await db.news.find_one({"id": news_id})
    if not doc: raise HTTPException(404, "News not found")
    return news_out(doc)

# ---- News Admin ----
@api_router.post("/admin/news")
async def create_news(payload: NewsCreate, user: dict = Depends(get_current_admin)):
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["author"] = user["name"]
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.news.insert_one(doc)
    return news_out(doc)

@api_router.put("/admin/news/{news_id}")
async def update_news(news_id: str, payload: NewsUpdate, user: dict = Depends(get_current_admin)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates: raise HTTPException(400, "No fields")
    r = await db.news.update_one({"id": news_id}, {"$set": updates})
    if r.matched_count == 0: raise HTTPException(404, "Not found")
    doc = await db.news.find_one({"id": news_id})
    return news_out(doc)

@api_router.delete("/admin/news/{news_id}")
async def delete_news(news_id: str, user: dict = Depends(get_current_admin)):
    r = await db.news.delete_one({"id": news_id})
    if r.deleted_count == 0: raise HTTPException(404, "Not found")
    return {"success": True}

@api_router.get("/admin/news")
async def admin_list_news(user: dict = Depends(get_current_admin)):
    docs = await db.news.find({}).sort("created_at", -1).to_list(500)
    return [news_out(d) for d in docs]

# ---- Settings (Live TV) ----
DEFAULT_LIVETV = {
    "key": "livetv",
    "url": "https://www.youtube.com/embed/jfKfPfyJRdk",
    "stream_type": "youtube",
    "title_en": "Andhra News 24×7",
    "title_te": "ఆంధ్ర న్యూస్ 24×7",
}

@api_router.get("/settings/livetv")
async def get_livetv():
    doc = await db.settings.find_one({"key": "livetv"})
    if not doc:
        return {k: v for k, v in DEFAULT_LIVETV.items() if k != "key"}
    return {"url": doc["url"], "stream_type": doc["stream_type"],
            "title_en": doc.get("title_en", "Live TV"), "title_te": doc.get("title_te", "లైవ్ టీవీ")}

@api_router.put("/admin/settings/livetv")
async def set_livetv(payload: LiveTVUpdate, user: dict = Depends(get_current_admin)):
    doc = payload.model_dump()
    doc["key"] = "livetv"
    await db.settings.update_one({"key": "livetv"}, {"$set": doc}, upsert=True)
    return {"url": doc["url"], "stream_type": doc["stream_type"],
            "title_en": doc["title_en"], "title_te": doc["title_te"]}

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
    return {"message": "News Portal API"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Seed ----------
DEFAULT_CATEGORIES = [
    {"slug": "politics", "name_en": "Politics", "name_te": "రాజకీయాలు", "order": 10},
    {"slug": "sports", "name_en": "Sports", "name_te": "క్రీడలు", "order": 20},
    {"slug": "cinema", "name_en": "Cinema", "name_te": "సినిమా", "order": 30},
    {"slug": "business", "name_en": "Business", "name_te": "వ్యాపారం", "order": 40},
    {"slug": "technology", "name_en": "Technology", "name_te": "టెక్నాలజీ", "order": 50},
    {"slug": "health", "name_en": "Health", "name_te": "ఆరోగ్యం", "order": 60},
    {"slug": "photos", "name_en": "Photos", "name_te": "ఫోటోలు", "order": 70},
    {"slug": "videos", "name_en": "Videos", "name_te": "వీడియోలు", "order": 80},
]

SAMPLE_NEWS = [
    {"title": "India Wins Historic Test Series Against Australia in Sydney",
     "summary": "In a nail-biting finish, the Indian cricket team clinched the Border-Gavaskar Trophy with a stunning victory at the SCG.",
     "body": "<p>The Indian cricket team scripted history on Sunday by winning the Border-Gavaskar Trophy for the fourth consecutive time.</p><p>Chasing a modest target on the final day, the team put up a solid batting display led by their in-form captain.</p>",
     "category": "sports",
     "image_url": "https://images.pexels.com/photos/31723741/pexels-photo-31723741.jpeg",
     "youtube_url": "https://www.youtube.com/embed/dQw4w9WgXcQ",
     "is_featured": True, "is_flash": True, "tags": ["cricket", "india"]},
    {"title": "Prabhas' Next Pan-India Blockbuster Announced with Rs 500 Cr Budget",
     "summary": "Rebel Star Prabhas teams up with a top director for a mythological action epic.",
     "body": "<p>Tollywood superstar Prabhas has officially announced his next project. The film reportedly has a whopping budget of Rs 500 crore.</p>",
     "category": "cinema",
     "image_url": "https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg",
     "is_featured": True, "is_flash": True, "tags": ["prabhas"]},
    {"title": "Andhra Pradesh CM Announces New Industrial Corridor",
     "summary": "The state government unveils a Rs 2 lakh crore investment plan.",
     "body": "<p>The Chief Minister of Andhra Pradesh today announced a landmark industrial corridor stretching from Visakhapatnam to Amaravati.</p>",
     "category": "politics",
     "image_url": "https://images.unsplash.com/photo-1771340592111-19ea0bcd77f3",
     "is_featured": True, "is_flash": True, "tags": ["andhra"]},
    {"title": "Sensex Crosses 90,000 Mark, Investors Gain Rs 6 Lakh Crore",
     "summary": "Indian stock markets hit an all-time high on strong FII inflows.",
     "body": "<p>The BSE Sensex crossed the historic 90,000 mark for the first time ever on Monday.</p>",
     "category": "business",
     "image_url": "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3",
     "tags": ["sensex"]},
    {"title": "ISRO Successfully Launches Chandrayaan-4 Mission",
     "summary": "India's ambitious lunar sample return mission blasts off from Sriharikota.",
     "body": "<p>ISRO successfully launched Chandrayaan-4 from Sriharikota. This mission aims to bring back lunar soil samples to Earth by 2027.</p>",
     "category": "technology",
     "image_url": "https://images.unsplash.com/photo-1541185933-ef5d8ed016c2",
     "youtube_url": "https://www.youtube.com/embed/dQw4w9WgXcQ",
     "is_flash": True, "tags": ["isro"]},
    {"title": "New AIIMS Facility Inaugurated in Guntur District",
     "summary": "State-of-the-art medical facility serves over 2 crore people.",
     "body": "<p>A brand new AIIMS hospital was inaugurated today in Guntur district.</p>",
     "category": "health",
     "image_url": "https://images.unsplash.com/photo-1587351021355-a479a299d2f9",
     "tags": ["aiims"]},
    {"title": "Watch: Stunning Aerial Views of Araku Valley During Monsoon",
     "summary": "Drone footage captures the mesmerising beauty of Araku Valley.",
     "body": "<p>This stunning drone footage takes viewers on an aerial journey through the coffee plantations of Araku Valley.</p>",
     "category": "videos",
     "image_url": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4",
     "youtube_url": "https://www.youtube.com/embed/dQw4w9WgXcQ",
     "is_featured": True, "tags": ["araku"]},
    {"title": "In Pictures: Grand Sankranti Celebrations Across Andhra Pradesh",
     "summary": "A visual journey through the vibrant Sankranti festivities.",
     "body": "<p>From colourful muggus at every doorstep to the thrilling rooster fights of Godavari districts, Sankranti in Andhra Pradesh is a feast for the eyes.</p>",
     "category": "photos",
     "image_url": "https://images.unsplash.com/photo-1610394663146-cb1eb63c93f0",
     "images": ["https://images.unsplash.com/photo-1610394663146-cb1eb63c93f0",
                "https://images.unsplash.com/photo-1541185933-ef5d8ed016c2",
                "https://images.unsplash.com/photo-1506905925346-21bda4d32df4"],
     "tags": ["sankranti"]},
    {"title": "Hyderabad FC Signs Star Brazilian Striker for Record Fee",
     "summary": "The ISL club breaks its transfer record.",
     "body": "<p>Hyderabad FC has announced the signing of star Brazilian striker for a record transfer fee.</p>",
     "category": "sports",
     "image_url": "https://images.unsplash.com/photo-1543326727-cf6c39e8f84c",
     "tags": ["football"]},
    {"title": "SS Rajamouli's Next with Mahesh Babu Titled 'Globetrotter'",
     "summary": "The RRR director confirms his next project is a globe-trotting adventure film.",
     "body": "<p>Baahubali and RRR director SS Rajamouli today confirmed his next film with Superstar Mahesh Babu.</p>",
     "category": "cinema",
     "image_url": "https://images.unsplash.com/photo-1440404653325-ab127d49abc1",
     "youtube_url": "https://www.youtube.com/embed/dQw4w9WgXcQ",
     "tags": ["rajamouli"]},
    {"title": "AI Revolution: Indian Startups Raise Record $12 Billion in 2025",
     "summary": "Homegrown AI companies attract unprecedented investment.",
     "body": "<p>Indian AI startups collectively raised over $12 billion in 2025, a fivefold increase from the previous year.</p>",
     "category": "technology",
     "image_url": "https://images.unsplash.com/photo-1677442136019-21780ecad995",
     "tags": ["ai"]},
    {"title": "Live TV: 24×7 Breaking News Coverage",
     "summary": "Watch our live news channel for real-time updates.",
     "body": "<p>Stay tuned to our live news channel for continuous coverage of the day's most important stories.</p>",
     "category": "videos",
     "image_url": "https://images.unsplash.com/photo-1742805382149-3c2f0cd0f300",
     "youtube_url": "https://www.youtube.com/embed/dQw4w9WgXcQ",
     "tags": ["live"]},
]

async def seed_admin():
    email = os.environ.get("ADMIN_EMAIL", "admin@news.com").lower()
    pwd = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": email})
    if existing is None:
        await db.users.insert_one({"id": str(uuid.uuid4()), "email": email,
            "password_hash": hash_password(pwd), "name": "Admin",
            "role": "admin", "created_at": datetime.now(timezone.utc).isoformat()})
        logger.info(f"Seeded admin: {email}")
    elif not verify_password(pwd, existing["password_hash"]):
        await db.users.update_one({"email": email},
            {"$set": {"password_hash": hash_password(pwd)}})

async def seed_categories():
    for cat in DEFAULT_CATEGORIES:
        await db.categories.update_one({"slug": cat["slug"]},
                                        {"$setOnInsert": cat}, upsert=True)
    logger.info("Categories seeded")

async def seed_news():
    if await db.news.count_documents({}) > 0: return
    now = datetime.now(timezone.utc)
    for i, item in enumerate(SAMPLE_NEWS):
        doc = dict(item)
        doc["id"] = str(uuid.uuid4())
        doc["author"] = "ABN Desk"
        doc["is_published"] = True
        doc["is_featured"] = doc.get("is_featured", False)
        doc["is_flash"] = doc.get("is_flash", False)
        doc["tags"] = doc.get("tags", [])
        doc["summary"] = doc.get("summary", "")
        doc["images"] = doc.get("images", [])
        doc["youtube_url"] = doc.get("youtube_url")
        doc["created_at"] = (now - timedelta(hours=i)).isoformat()
        await db.news.insert_one(doc)
    logger.info(f"Seeded {len(SAMPLE_NEWS)} news")

async def seed_livetv():
    if not await db.settings.find_one({"key": "livetv"}):
        await db.settings.insert_one(dict(DEFAULT_LIVETV))
        logger.info("Live TV settings seeded")

@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.news.create_index("id", unique=True)
    await db.news.create_index("category")
    await db.news.create_index("created_at")
    await db.categories.create_index("slug", unique=True)
    await db.settings.create_index("key", unique=True)
    await seed_admin()
    await seed_categories()
    await seed_news()
    await seed_livetv()
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
