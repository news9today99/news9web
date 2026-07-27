#!/usr/bin/env python3
"""
News 9 Today – Full Database Seed Script
=========================================

One-shot seed to (re)initialize MongoDB for the News 9 Today portal.

Usage
-----
    cd /app/backend
    python seed.py                  # add / upsert only (safe on prod)
    python seed.py --reset-admin    # force reset admin password
    python seed.py --wipe-news      # remove all news, then re-seed 12 samples
    python seed.py --full-reset     # wipe users, categories, settings, pages, news, ads, feed_sources

Environment (read from /app/backend/.env)
-----------------------------------------
    MONGO_URL, DB_NAME              (required)
    ADMIN_EMAIL, ADMIN_PASSWORD     (used to seed / reset admin — defaults: admin@news.com / admin123)
    SITE_DOMAIN                     (optional, default https://news9today.com — used in contact/social)

After seeding
-------------
    Admin login  : ADMIN_EMAIL / ADMIN_PASSWORD (default admin@news.com / admin123)
    Site domain  : SITE_DOMAIN (default https://news9today.com)
"""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import argparse
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone, timedelta

import bcrypt
from motor.motor_asyncio import AsyncIOMotorClient

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")
if not MONGO_URL or not DB_NAME:
    print("[seed] ERROR: MONGO_URL and DB_NAME must be set in backend/.env")
    sys.exit(1)

ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@news.com").lower()
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
SITE_DOMAIN = os.environ.get("SITE_DOMAIN", "https://news9today.com").rstrip("/")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def days_ago(n: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=n)).isoformat()


# ---------------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------------
CATEGORIES = [
    {"slug": "politics",   "name_en": "Politics",   "name_te": "రాజకీయాలు",   "name_hi": "राजनीति",     "order": 10},
    {"slug": "sports",     "name_en": "Sports",     "name_te": "క్రీడలు",       "name_hi": "खेल",         "order": 20},
    {"slug": "cinema",     "name_en": "Cinema",     "name_te": "సినిమా",       "name_hi": "सिनेमा",      "order": 30},
    {"slug": "business",   "name_en": "Business",   "name_te": "వ్యాపారం",      "name_hi": "व्यापार",     "order": 40},
    {"slug": "technology", "name_en": "Technology", "name_te": "టెక్నాలజీ",     "name_hi": "टेक्नोलॉजी",  "order": 50},
    {"slug": "health",     "name_en": "Health",     "name_te": "ఆరోగ్యం",       "name_hi": "स्वास्थ्य",   "order": 60},
    {"slug": "photos",     "name_en": "Photos",     "name_te": "ఫోటోలు",       "name_hi": "तस्वीरें",    "order": 70},
    {"slug": "videos",     "name_en": "Videos",     "name_te": "వీడియోలు",     "name_hi": "वीडियो",      "order": 80},
]

SETTINGS = {
    "livetv": {
        "url": "https://www.youtube.com/embed/jfKfPfyJRdk",
        "stream_type": "youtube",
        "title_en": "News 9 Today Live",
        "title_te": "న్యూస్ 9 టుడే లైవ్",
        "channels": [
            {
                "id": "ch1",
                "name_te": "న్యూస్ 9 మెయిన్",
                "name_en": "News 9 Main",
                "url": "https://www.youtube.com/embed/jfKfPfyJRdk",
                "stream_type": "youtube",
                "order": 10,
                "is_active": True,
            },
        ],
    },
    "contact": {
        "phone": "9393950505",
        "email": "news9today99@gmail.com",
        "address": "Hyderabad, Telangana",
        "website": SITE_DOMAIN,
        "twitter": f"{SITE_DOMAIN}",
        "instagram": f"{SITE_DOMAIN}",
        "facebook": f"{SITE_DOMAIN}",
        "whatsapp": "",
        "youtube": "",
    },
    "youtube": {"channel_id": "", "auto_import": True, "default_category": "videos"},
    "weather": {"city": "Hyderabad", "latitude": 17.385, "longitude": 78.4867},
    "theme": {
        "primary_color": "#E11D2E",
        "secondary_color": "#1E4B9C",
        "accent_color": "#0F2A5C",
        "logo_url": "/logo.png",
        "tagline_te": "నమ్మకమైన తెలుగు వార్తలు · 24×7",
        "tagline_en": "Trusted Telugu News · 24×7",
        "site_name_te": "న్యూస్ 9 టుడే",
        "site_name_en": "News 9 Today",
        "font_scale": 1.0,
        "default_language": "te",
    },
    "flash_config": {"category_slugs": ["politics", "sports"], "use_featured_only": False},
}

PAGES = {
    "privacy": {
        "title_en": "Privacy Policy",
        "title_te": "గోప్యతా విధానం",
        "content_en": (
            f"<h2>Privacy Policy</h2><p>This is the privacy policy for News 9 Today "
            f"({SITE_DOMAIN}). We respect your privacy and only collect information "
            f"necessary to provide our news services.</p>"
        ),
        "content_te": (
            "<h2>గోప్యతా విధానం</h2><p>న్యూస్ 9 టుడే మీ గోప్యతను గౌరవిస్తుంది. "
            "మేము వార్తా సేవలు అందించడానికి అవసరమైన సమాచారాన్ని మాత్రమే సేకరిస్తాము.</p>"
        ),
    },
    "terms": {
        "title_en": "Terms of Service",
        "title_te": "నిబంధనలు మరియు షరతులు",
        "content_en": (
            f"<h2>Terms of Service</h2><p>By accessing {SITE_DOMAIN}, you agree to be "
            f"bound by these terms. All content is the property of News 9 Today.</p>"
        ),
        "content_te": (
            "<h2>నిబంధనలు మరియు షరతులు</h2><p>న్యూస్ 9 టుడే వెబ్‌సైట్‌ను ఉపయోగించడం "
            "ద్వారా మీరు మా నిబంధనలకు అంగీకరిస్తారు.</p>"
        ),
    },
    "about": {
        "title_en": "About Us",
        "title_te": "మా గురించి",
        "content_en": (
            f"<h2>About News 9 Today</h2><p>News 9 Today ({SITE_DOMAIN}) is a Telugu-first "
            f"digital news portal covering politics, sports, cinema, business, technology "
            f"and more — trusted news 24×7.</p>"
        ),
        "content_te": (
            "<h2>న్యూస్ 9 టుడే గురించి</h2><p>న్యూస్ 9 టుడే తెలుగు వార్తా పోర్టల్. "
            "రాజకీయాలు, క్రీడలు, సినిమా, వ్యాపారం, టెక్నాలజీ మరియు మరిన్ని — 24×7 నమ్మకమైన వార్తలు.</p>"
        ),
    },
}

# 12 sample articles across categories/regions
SAMPLE_NEWS = [
    {
        "title": "తెలంగాణ అసెంబ్లీ శీతాకాల సమావేశాలు నేటి నుండి ప్రారంభం",
        "summary": "హైదరాబాద్‌లో నేటి నుండి తెలంగాణ శాసనసభ శీతాకాల సమావేశాలు మొదలవుతున్నాయి.",
        "category": "politics", "region": "telangana",
        "image_url": "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=1200",
        "is_featured": True, "is_flash": True,
    },
    {
        "title": "IND vs AUS: విరాట్ కోహ్లి సెంచరీతో భారత్‌కు కీలక విజయం",
        "summary": "మెల్‌బోర్న్‌లో జరిగిన మ్యాచ్‌లో కోహ్లి 122 పరుగుల ఇన్నింగ్స్ ఆడారు.",
        "category": "sports", "region": "national",
        "image_url": "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=1200",
        "is_featured": True, "is_flash": True,
    },
    {
        "title": "‘పుష్ప 3’ షూటింగ్ ప్రారంభం — అల్లు అర్జున్ లుక్ లీక్",
        "summary": "సుకుమార్ దర్శకత్వంలోని పుష్ప 3 సినిమా షూటింగ్ హైదరాబాద్‌లో మొదలైంది.",
        "category": "cinema", "region": "telangana",
        "image_url": "https://images.unsplash.com/photo-1489599735734-79b4212bea36?w=1200",
        "is_featured": True, "is_flash": False,
    },
    {
        "title": "సెన్సెక్స్ 500 పాయింట్లు లాభంతో ముగింపు — నిఫ్టీ 22,800",
        "summary": "IT, బ్యాంకింగ్ షేర్లు లాభాలతో నేటి మార్కెట్ ముగిసింది.",
        "category": "business", "region": "national",
        "image_url": "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200",
        "is_featured": False, "is_flash": True,
    },
    {
        "title": "iPhone 17 Pro Max లాంచ్: ధరలు, ఫీచర్లు పూర్తి వివరాలు",
        "summary": "యాపిల్ కొత్త iPhone 17 సిరీస్‌ను భారత్‌లో ప్రారంభించింది.",
        "category": "technology", "region": "national",
        "image_url": "https://images.unsplash.com/photo-1592286927505-1def25115558?w=1200",
        "is_featured": False, "is_flash": False,
    },
    {
        "title": "శీతాకాలంలో గుండె ఆరోగ్యం: వైద్యుల సలహాలు",
        "summary": "చలికాలంలో గుండె జబ్బుల ప్రమాదం ఎక్కువ — నివారణ చిట్కాలు.",
        "category": "health", "region": "national",
        "image_url": "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=1200",
        "is_featured": False, "is_flash": False,
    },
    {
        "title": "ఆంధ్రప్రదేశ్: అమరావతి రాజధాని పనులు వేగవంతం",
        "summary": "కొత్త నిర్మాణ ప్రాజెక్టులు అమరావతిలో మళ్లీ మొదలయ్యాయి.",
        "category": "politics", "region": "andhra_pradesh",
        "image_url": "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200",
        "is_featured": True, "is_flash": False,
    },
    {
        "title": "ఐపీఎల్ 2026: SRH జట్టు కొత్త కెప్టెన్ ఎవరు?",
        "summary": "సన్‌రైజర్స్ హైదరాబాద్ కొత్త కెప్టెన్‌ను ప్రకటించనుంది.",
        "category": "sports", "region": "telangana",
        "image_url": "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=1200",
        "is_featured": False, "is_flash": False,
    },
    {
        "title": "పాన్ ఇండియా స్టార్ ప్రభాస్ కొత్త ప్రాజెక్ట్ ప్రకటన",
        "summary": "నితేష్ తివారీ దర్శకత్వంలో ప్రభాస్ కొత్త సినిమా.",
        "category": "cinema", "region": "national",
        "image_url": "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=1200",
        "is_featured": False, "is_flash": False,
    },
    {
        "title": "OpenAI GPT-5.2 విడుదల: తెలుగు భాషలో మెరుగైన సపోర్ట్",
        "summary": "కొత్త మోడల్‌లో భారతీయ భాషలకు మెరుగైన మద్దతు.",
        "category": "technology", "region": "national",
        "image_url": "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200",
        "is_featured": False, "is_flash": False,
    },
    {
        "title": "హైదరాబాద్ మెట్రో ఫేజ్ 2 పనులు ప్రారంభం",
        "summary": "మెట్రో రెండో దశ నిర్మాణ పనులకు ముఖ్యమంత్రి శంకుస్థాపన.",
        "category": "politics", "region": "telangana",
        "image_url": "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1200",
        "is_featured": False, "is_flash": False,
    },
    {
        "title": "కొత్త UPI ఫీచర్లు: 2026లో డిజిటల్ పేమెంట్స్‌లో మార్పులు",
        "summary": "NPCI కొత్త UPI ఫీచర్లను ప్రకటించింది.",
        "category": "business", "region": "national",
        "image_url": "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=1200",
        "is_featured": False, "is_flash": False,
    },
]


# ---------------------------------------------------------------------------
# Seeders
# ---------------------------------------------------------------------------
async def ensure_indexes():
    await db.users.create_index("email", unique=True)
    await db.news.create_index("id", unique=True)
    await db.news.create_index("category")
    await db.news.create_index("created_at")
    await db.categories.create_index("slug", unique=True)
    await db.settings.create_index("key", unique=True)
    await db.pages.create_index("slug", unique=True)
    await db.ads.create_index("placement")
    try:
        await db.feed_sources.create_index("id", unique=True)
    except Exception:
        pass
    print("[seed] indexes ensured")


async def seed_admin(force: bool = False):
    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    pwd_hash = hash_password(ADMIN_PASSWORD)
    if existing is None:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": ADMIN_EMAIL,
            "password_hash": pwd_hash,
            "name": "Admin",
            "role": "admin",
            "created_at": now_iso(),
        })
        print(f"[seed] admin created: {ADMIN_EMAIL}")
    elif force:
        await db.users.update_one(
            {"email": ADMIN_EMAIL},
            {"$set": {"password_hash": pwd_hash, "role": "admin", "name": "Admin"}},
        )
        print(f"[seed] admin password RESET: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
    else:
        # verify current password works; if not, reset
        try:
            ok = bcrypt.checkpw(ADMIN_PASSWORD.encode(), existing["password_hash"].encode())
        except Exception:
            ok = False
        if not ok:
            await db.users.update_one({"email": ADMIN_EMAIL}, {"$set": {"password_hash": pwd_hash}})
            print(f"[seed] admin password re-hashed for: {ADMIN_EMAIL}")
        else:
            print(f"[seed] admin already exists and password valid: {ADMIN_EMAIL}")


async def seed_categories():
    for cat in CATEGORIES:
        await db.categories.update_one(
            {"slug": cat["slug"]},
            {"$set": cat},
            upsert=True,
        )
    print(f"[seed] categories upserted: {len(CATEGORIES)}")


async def seed_settings():
    for key, val in SETTINGS.items():
        doc = dict(val)
        doc["key"] = key
        await db.settings.update_one({"key": key}, {"$set": doc}, upsert=True)
    print(f"[seed] settings upserted: {list(SETTINGS.keys())}")


async def seed_pages():
    for slug, page in PAGES.items():
        doc = dict(page)
        doc["slug"] = slug
        doc["updated_at"] = now_iso()
        await db.pages.update_one({"slug": slug}, {"$set": doc}, upsert=True)
    print(f"[seed] pages upserted: {list(PAGES.keys())}")


async def seed_news(wipe: bool = False):
    if wipe:
        result = await db.news.delete_many({})
        print(f"[seed] news wiped: {result.deleted_count} docs removed")

    count = await db.news.count_documents({})
    if count > 0:
        print(f"[seed] news already has {count} docs, skipping sample seed")
        return

    for i, item in enumerate(SAMPLE_NEWS):
        doc = {
            "id": str(uuid.uuid4()),
            "title": item["title"],
            "summary": item["summary"],
            "content": f"<p>{item['summary']}</p><p>మరిన్ని వివరాలు త్వరలో…</p>",
            "category": item["category"],
            "region": item.get("region", "national"),
            "image_url": item.get("image_url", ""),
            "images": [],
            "video_url": "",
            "is_featured": item.get("is_featured", False),
            "is_flash": item.get("is_flash", False),
            "is_published": True,
            "view_count": 0,
            "author": "Admin",
            "created_at": days_ago(i),
            "updated_at": days_ago(i),
        }
        await db.news.insert_one(doc)
    print(f"[seed] news seeded: {len(SAMPLE_NEWS)} sample articles")


async def full_reset():
    print("[seed] FULL RESET — dropping users, news, categories, settings, pages, ads, feed_sources")
    for coll in ("users", "news", "categories", "settings", "pages", "ads", "feed_sources", "files"):
        await db[coll].delete_many({})


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset-admin", action="store_true", help="Force reset admin password")
    parser.add_argument("--wipe-news", action="store_true", help="Wipe news then re-seed samples")
    parser.add_argument("--full-reset", action="store_true", help="Wipe all data then reseed everything")
    args = parser.parse_args()

    print(f"[seed] DB={DB_NAME}  MONGO={MONGO_URL}")
    print(f"[seed] Admin={ADMIN_EMAIL}  Domain={SITE_DOMAIN}")

    if args.full_reset:
        await full_reset()

    await ensure_indexes()
    await seed_admin(force=args.reset_admin or args.full_reset)
    await seed_categories()
    await seed_settings()
    await seed_pages()
    await seed_news(wipe=args.wipe_news or args.full_reset)

    print("\n[seed] ✅ done")
    print(f"[seed] Login → {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
    print(f"[seed] Site  → {SITE_DOMAIN}")


if __name__ == "__main__":
    asyncio.run(main())
