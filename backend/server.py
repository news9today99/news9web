from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import bcrypt
import jwt
import requests
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File, Depends, Header, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# ---------- Config ----------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = os.environ.get("APP_NAME", "news-portal")

_storage_key = None

# ---------- Logging ----------
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ---------- Utility ----------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email,
               "exp": datetime.now(timezone.utc) + timedelta(hours=12),
               "type": "access"}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)

def init_storage():
    global _storage_key
    if _storage_key:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120
    )
    resp.raise_for_status()
    return resp.json()

def get_object(path: str):
    key = init_storage()
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

# ---------- Models ----------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str

class NewsCreate(BaseModel):
    title: str
    summary: str = ""
    body: str
    category: str  # sports, cinema, politics, business, photos, videos, technology, health
    image_url: Optional[str] = None
    youtube_url: Optional[str] = None
    is_featured: bool = False
    is_published: bool = True
    tags: List[str] = []

class NewsUpdate(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    body: Optional[str] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    youtube_url: Optional[str] = None
    is_featured: Optional[bool] = None
    is_published: Optional[bool] = None
    tags: Optional[List[str]] = None

class NewsOut(BaseModel):
    id: str
    title: str
    summary: str
    body: str
    category: str
    image_url: Optional[str] = None
    youtube_url: Optional[str] = None
    is_featured: bool
    is_published: bool
    tags: List[str]
    created_at: str
    author: str

# ---------- Auth Dep ----------
async def get_current_admin(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": payload["sub"]})
        if not user or user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin only")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ---------- Serialization ----------
def news_doc_to_out(doc: dict) -> dict:
    return {
        "id": doc["id"],
        "title": doc["title"],
        "summary": doc.get("summary", ""),
        "body": doc["body"],
        "category": doc["category"],
        "image_url": doc.get("image_url"),
        "youtube_url": doc.get("youtube_url"),
        "is_featured": doc.get("is_featured", False),
        "is_published": doc.get("is_published", True),
        "tags": doc.get("tags", []),
        "created_at": doc["created_at"],
        "author": doc.get("author", "ABN Desk"),
    }

# ---------- App ----------
app = FastAPI()
api_router = APIRouter(prefix="/api")

# ---- Auth ----
@api_router.post("/auth/login")
async def login(payload: LoginRequest, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], user["email"])
    response.set_cookie(key="access_token", value=token, httponly=True,
                        secure=False, samesite="lax", max_age=43200, path="/")
    return {"user": {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"]},
            "access_token": token}

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"success": True}

@api_router.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_admin)):
    return UserOut(id=user["id"], email=user["email"], name=user["name"], role=user["role"])

# ---- Categories ----
CATEGORIES = [
    {"slug": "politics", "name": "Politics"},
    {"slug": "sports", "name": "Sports"},
    {"slug": "cinema", "name": "Cinema"},
    {"slug": "business", "name": "Business"},
    {"slug": "technology", "name": "Technology"},
    {"slug": "health", "name": "Health"},
    {"slug": "photos", "name": "Photos"},
    {"slug": "videos", "name": "Videos"},
]

@api_router.get("/categories")
async def get_categories():
    return CATEGORIES

# ---- News Public ----
@api_router.get("/news")
async def list_news(category: Optional[str] = None, featured: Optional[bool] = None, limit: int = 50):
    q = {"is_published": True}
    if category:
        q["category"] = category
    if featured is not None:
        q["is_featured"] = featured
    docs = await db.news.find(q).sort("created_at", -1).limit(limit).to_list(limit)
    return [news_doc_to_out(d) for d in docs]

@api_router.get("/news/{news_id}")
async def get_news(news_id: str):
    doc = await db.news.find_one({"id": news_id})
    if not doc:
        raise HTTPException(status_code=404, detail="News not found")
    return news_doc_to_out(doc)

# ---- News Admin ----
@api_router.post("/admin/news")
async def create_news(payload: NewsCreate, user: dict = Depends(get_current_admin)):
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["author"] = user["name"]
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.news.insert_one(doc)
    return news_doc_to_out(doc)

@api_router.put("/admin/news/{news_id}")
async def update_news(news_id: str, payload: NewsUpdate, user: dict = Depends(get_current_admin)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.news.update_one({"id": news_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="News not found")
    doc = await db.news.find_one({"id": news_id})
    return news_doc_to_out(doc)

@api_router.delete("/admin/news/{news_id}")
async def delete_news(news_id: str, user: dict = Depends(get_current_admin)):
    result = await db.news.delete_one({"id": news_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="News not found")
    return {"success": True}

@api_router.get("/admin/news")
async def admin_list_news(user: dict = Depends(get_current_admin)):
    docs = await db.news.find({}).sort("created_at", -1).to_list(200)
    return [news_doc_to_out(d) for d in docs]

# ---- File Upload ----
MIME_MAP = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
            "gif": "image/gif", "webp": "image/webp"}

@api_router.post("/admin/upload")
async def upload_image(file: UploadFile = File(...), user: dict = Depends(get_current_admin)):
    ext = (file.filename or "img").split(".")[-1].lower()
    if ext not in MIME_MAP:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    file_id = str(uuid.uuid4())
    path = f"{APP_NAME}/uploads/{user['id']}/{file_id}.{ext}"
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")
    result = put_object(path, data, MIME_MAP[ext])
    await db.files.insert_one({
        "id": file_id,
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": MIME_MAP[ext],
        "size": result["size"],
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    backend_base = os.environ.get("BACKEND_PUBLIC_URL", "")
    public_url = f"/api/files/{result['path']}"
    return {"path": result["path"], "url": public_url}

@api_router.get("/files/{path:path}")
async def download_file(path: str):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    data, ct = get_object(path)
    return Response(content=data, media_type=record.get("content_type", ct))

# ---- Health ----
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
SAMPLE_NEWS = [
    {
        "title": "India Wins Historic Test Series Against Australia in Sydney",
        "summary": "In a nail-biting finish, the Indian cricket team clinched the Border-Gavaskar Trophy with a stunning victory at the SCG.",
        "body": "The Indian cricket team scripted history on Sunday by winning the Border-Gavaskar Trophy for the fourth consecutive time. Chasing a modest target on the final day, the team put up a solid batting display led by their in-form captain. Fans across the country celebrated as fireworks lit up the sky in every major city.\n\nThe man-of-the-series award went to the pace spearhead who took 32 wickets across the five matches. The victory is being hailed as one of the greatest overseas triumphs in Indian cricket history.",
        "category": "sports",
        "image_url": "https://images.pexels.com/photos/31723741/pexels-photo-31723741.jpeg",
        "youtube_url": "https://www.youtube.com/embed/dQw4w9WgXcQ",
        "is_featured": True,
        "tags": ["cricket", "india", "test"],
    },
    {
        "title": "Prabhas' Next Pan-India Blockbuster Announced with Rs 500 Cr Budget",
        "summary": "Rebel Star Prabhas teams up with a top director for a mythological action epic set to release next Sankranti.",
        "body": "Tollywood superstar Prabhas has officially announced his next project, a mythological action epic that is being touted as the biggest Indian film ever made. The film reportedly has a whopping budget of Rs 500 crore and will be shot in six languages simultaneously.\n\nThe first-look poster released this morning has gone viral, crossing 20 million views on social media within hours. Industry experts believe this could become the highest-grossing Indian film of the decade.",
        "category": "cinema",
        "image_url": "https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg",
        "is_featured": True,
        "tags": ["prabhas", "tollywood"],
    },
    {
        "title": "Andhra Pradesh CM Announces New Industrial Corridor",
        "summary": "The state government unveils a Rs 2 lakh crore investment plan to attract semiconductor and EV manufacturers.",
        "body": "The Chief Minister of Andhra Pradesh today announced a landmark industrial corridor stretching from Visakhapatnam to Amaravati. The corridor will house semiconductor fabs, electric vehicle factories, and green hydrogen plants.\n\nSpeaking at the industrial summit, the CM said the corridor is expected to create over 5 lakh jobs in the next 5 years. Several global companies have already signed MoUs worth Rs 60,000 crore.",
        "category": "politics",
        "image_url": "https://images.unsplash.com/photo-1771340592111-19ea0bcd77f3",
        "is_featured": True,
        "tags": ["andhra pradesh", "politics"],
    },
    {
        "title": "Sensex Crosses 90,000 Mark, Investors Gain Rs 6 Lakh Crore",
        "summary": "Indian stock markets hit an all-time high on strong FII inflows and robust corporate earnings.",
        "body": "The BSE Sensex crossed the historic 90,000 mark for the first time ever on Monday, adding over Rs 6 lakh crore to investor wealth in a single session. Banking, IT and auto stocks led the rally.\n\nAnalysts attribute the surge to record foreign institutional investor inflows, better than expected Q3 earnings, and easing global inflation concerns.",
        "category": "business",
        "image_url": "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3",
        "tags": ["stock market", "sensex"],
    },
    {
        "title": "ISRO Successfully Launches Chandrayaan-4 Mission",
        "summary": "India's ambitious lunar sample return mission blasts off from Sriharikota amid national celebrations.",
        "body": "The Indian Space Research Organisation (ISRO) successfully launched Chandrayaan-4 from the Satish Dhawan Space Centre. This mission aims to bring back lunar soil samples to Earth by 2027.\n\nThe launch marks another milestone in India's space program, cementing its position as a leading spacefaring nation. Congratulatory messages poured in from world leaders.",
        "category": "technology",
        "image_url": "https://images.unsplash.com/photo-1541185933-ef5d8ed016c2",
        "youtube_url": "https://www.youtube.com/embed/dQw4w9WgXcQ",
        "tags": ["isro", "space", "chandrayaan"],
    },
    {
        "title": "New AIIMS Facility Inaugurated in Guntur District",
        "summary": "State-of-the-art medical facility will serve over 2 crore people across coastal Andhra region.",
        "body": "A brand new AIIMS hospital was inaugurated today in Guntur district, boasting 1,200 beds, advanced cancer care wing, and a dedicated organ transplant unit.\n\nThe facility, built at a cost of Rs 1,800 crore, will provide free treatment to BPL families and cutting-edge specialty care at subsidised rates.",
        "category": "health",
        "image_url": "https://images.unsplash.com/photo-1587351021355-a479a299d2f9",
        "tags": ["aiims", "health"],
    },
    {
        "title": "Watch: Stunning Aerial Views of Araku Valley During Monsoon",
        "summary": "Drone footage captures the mesmerising beauty of Araku Valley shrouded in mist.",
        "body": "This stunning drone footage takes viewers on an aerial journey through the coffee plantations, waterfalls, and tribal villages of the picturesque Araku Valley. Shot during the peak monsoon season, the video showcases why Araku is considered one of India's hidden gems.",
        "category": "videos",
        "image_url": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4",
        "youtube_url": "https://www.youtube.com/embed/dQw4w9WgXcQ",
        "is_featured": True,
        "tags": ["araku", "travel"],
    },
    {
        "title": "In Pictures: Grand Sankranti Celebrations Across Andhra Pradesh",
        "summary": "A visual journey through the vibrant Sankranti festivities from villages to cities.",
        "body": "From colourful muggus at every doorstep to the thrilling rooster fights of Godavari districts, Sankranti in Andhra Pradesh is a feast for the eyes. Here is a curated collection of photographs from across the state.",
        "category": "photos",
        "image_url": "https://images.unsplash.com/photo-1610394663146-cb1eb63c93f0",
        "tags": ["sankranti", "festival"],
    },
    {
        "title": "Hyderabad FC Signs Star Brazilian Striker for Record Fee",
        "summary": "The ISL club breaks its transfer record to sign a former Copa Libertadores winner.",
        "body": "Hyderabad FC has announced the signing of star Brazilian striker for a record transfer fee, ahead of the new Indian Super League season. The 27-year-old forward brings with him experience of playing in the Brazilian Serie A and the Copa Libertadores.",
        "category": "sports",
        "image_url": "https://images.unsplash.com/photo-1543326727-cf6c39e8f84c",
        "tags": ["football", "isl"],
    },
    {
        "title": "SS Rajamouli's Next with Mahesh Babu Titled 'SSMB29 - Globetrotter'",
        "summary": "The RRR director confirms his next project is a globe-trotting adventure film.",
        "body": "Baahubali and RRR director SS Rajamouli today confirmed his next film with Superstar Mahesh Babu is titled 'Globetrotter'. The film will be shot across five continents and is being planned as a two-part epic action-adventure.",
        "category": "cinema",
        "image_url": "https://images.unsplash.com/photo-1440404653325-ab127d49abc1",
        "youtube_url": "https://www.youtube.com/embed/dQw4w9WgXcQ",
        "tags": ["rajamouli", "mahesh babu"],
    },
    {
        "title": "AI Revolution: Indian Startups Raise Record $12 Billion in 2025",
        "summary": "Homegrown AI companies attract unprecedented investment as India emerges as a global AI hub.",
        "body": "Indian AI startups collectively raised over $12 billion in 2025, a fivefold increase from the previous year. Bengaluru, Hyderabad and Chennai emerged as the top three AI hubs, with over 2,000 active AI startups.",
        "category": "technology",
        "image_url": "https://images.unsplash.com/photo-1677442136019-21780ecad995",
        "tags": ["ai", "startups"],
    },
    {
        "title": "Live TV: 24x7 Breaking News Coverage",
        "summary": "Watch our live news channel for real-time updates on breaking stories.",
        "body": "Stay tuned to our live news channel for continuous coverage of the day's most important stories. From politics to sports, cinema to business — we bring you news as it happens.",
        "category": "videos",
        "image_url": "https://images.unsplash.com/photo-1742805382149-3c2f0cd0f300",
        "youtube_url": "https://www.youtube.com/embed/dQw4w9WgXcQ",
        "tags": ["live", "tv"],
    },
]

async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@news.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Seeded admin user: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email},
                                  {"$set": {"password_hash": hash_password(admin_password)}})
        logger.info("Updated admin password")

async def seed_news():
    count = await db.news.count_documents({})
    if count > 0:
        return
    now = datetime.now(timezone.utc)
    for i, item in enumerate(SAMPLE_NEWS):
        doc = dict(item)
        doc["id"] = str(uuid.uuid4())
        doc["author"] = "ABN Desk"
        doc["is_published"] = True
        doc["is_featured"] = doc.get("is_featured", False)
        doc["tags"] = doc.get("tags", [])
        doc["summary"] = doc.get("summary", "")
        doc["youtube_url"] = doc.get("youtube_url")
        # Stagger created_at so ordering is stable
        doc["created_at"] = (now - timedelta(hours=i)).isoformat()
        await db.news.insert_one(doc)
    logger.info(f"Seeded {len(SAMPLE_NEWS)} sample news items")

@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.news.create_index("id", unique=True)
    await db.news.create_index("category")
    await db.news.create_index("created_at")
    await seed_admin()
    await seed_news()
    try:
        init_storage()
        logger.info("Emergent object storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
