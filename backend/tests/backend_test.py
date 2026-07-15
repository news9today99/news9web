"""
Backend API tests for News 9 Today portal - Iteration 3.
Covers: auth, news filters (flash/q/pagination), categories CRUD, live TV settings,
contact/youtube settings, ads CRUD, pages (privacy/terms), widgets (weather/stock),
YouTube RSS sync, and body_font on articles.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://content-manager-163.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@news.com"
ADMIN_PASSWORD = "admin123"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data
    return data["access_token"]


@pytest.fixture
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ---------- Health ----------
class TestHealth:
    def test_root(self):
        r = requests.get(f"{API}/", timeout=10)
        assert r.status_code == 200
        assert r.json().get("message") == "News 9 Today API"


# ---------- Auth ----------
class TestAuth:
    def test_login_success(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["email"] == ADMIN_EMAIL
        assert d["user"]["role"] == "admin"
        assert isinstance(d["access_token"], str) and len(d["access_token"]) > 20

    def test_login_bad_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_me_requires_auth(self):
        r = requests.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 401

    def test_me_with_token(self, auth_headers):
        r = requests.get(f"{API}/auth/me", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL


# ---------- Categories ----------
class TestCategories:
    def test_list_public(self):
        r = requests.get(f"{API}/categories", timeout=10)
        assert r.status_code == 200
        cats = r.json()
        assert isinstance(cats, list)
        assert len(cats) >= 8
        slugs = {c["slug"] for c in cats}
        for s in ["politics", "sports", "cinema", "business", "technology", "health", "photos", "videos"]:
            assert s in slugs, f"missing category {s}"
        # Telugu names present
        sports = [c for c in cats if c["slug"] == "sports"][0]
        assert sports["name_te"] == "క్రీడలు"

    def test_create_update_delete_category(self, auth_headers):
        slug = f"test-weather-{uuid.uuid4().hex[:6]}"
        # CREATE
        r = requests.post(f"{API}/admin/categories", headers=auth_headers,
                          json={"slug": slug, "name_en": "TestWeather", "name_te": "వాతావరణం", "order": 90},
                          timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["slug"] == slug
        assert d["name_te"] == "వాతావరణం"

        # Verify persisted via public list
        r2 = requests.get(f"{API}/categories", timeout=10)
        assert any(c["slug"] == slug for c in r2.json())

        # UPDATE
        r3 = requests.put(f"{API}/admin/categories/{slug}", headers=auth_headers,
                          json={"name_te": "వాతావరణ నివేదిక"}, timeout=15)
        assert r3.status_code == 200
        assert r3.json()["name_te"] == "వాతావరణ నివేదిక"

        # DELETE
        r4 = requests.delete(f"{API}/admin/categories/{slug}", headers=auth_headers, timeout=15)
        assert r4.status_code == 200
        # Confirm gone
        r5 = requests.get(f"{API}/categories", timeout=10)
        assert not any(c["slug"] == slug for c in r5.json())

    def test_create_duplicate_category_fails(self, auth_headers):
        # sports already exists → should fail
        r = requests.post(f"{API}/admin/categories", headers=auth_headers,
                          json={"slug": "sports", "name_en": "Sports2", "name_te": "క్రీడలు2", "order": 20},
                          timeout=15)
        assert r.status_code == 400
        assert "exists" in r.text.lower()

    def test_delete_category_with_articles_fails(self, auth_headers):
        # sports has seeded articles
        r = requests.delete(f"{API}/admin/categories/sports", headers=auth_headers, timeout=15)
        assert r.status_code == 400
        assert "cannot delete" in r.text.lower() or "articles" in r.text.lower()

    def test_admin_requires_auth(self):
        r = requests.post(f"{API}/admin/categories",
                          json={"slug": "hack", "name_en": "x", "name_te": "y"},
                          timeout=10)
        assert r.status_code == 401


# ---------- News (public) ----------
class TestNewsPublic:
    def test_list_default(self):
        r = requests.get(f"{API}/news", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "items" in d and "total" in d and "page" in d and "pages" in d and "limit" in d
        assert isinstance(d["items"], list)
        assert d["total"] >= 1

    def test_flash_filter(self):
        r = requests.get(f"{API}/news?flash=true&limit=50", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["total"] >= 1, "expected at least one flash item after migration"
        for it in d["items"]:
            assert it["is_flash"] is True

    def test_search_query(self):
        r = requests.get(f"{API}/news?q=Prabhas", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["total"] >= 1
        # At least one item should contain 'Prabhas' in title/summary/body
        matched = any("prabhas" in (it["title"] + it.get("summary", "") + it.get("body", "")).lower()
                      for it in d["items"])
        assert matched

    def test_pagination(self):
        r = requests.get(f"{API}/news?page=1&limit=5", timeout=10)
        assert r.status_code == 200
        d1 = r.json()
        assert d1["page"] == 1
        assert d1["limit"] == 5
        assert len(d1["items"]) <= 5
        assert d1["pages"] == (d1["total"] + 4) // 5

        if d1["pages"] >= 2:
            r2 = requests.get(f"{API}/news?page=2&limit=5", timeout=10)
            d2 = r2.json()
            assert d2["page"] == 2
            # Different items across pages
            ids1 = {i["id"] for i in d1["items"]}
            ids2 = {i["id"] for i in d2["items"]}
            assert not (ids1 & ids2)

    def test_category_filter(self):
        r = requests.get(f"{API}/news?category=sports&limit=50", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert all(it["category"] == "sports" for it in d["items"])


# ---------- News CRUD ----------
class TestNewsAdmin:
    _created_ids = []

    def test_create_article_with_flash_and_gallery(self, auth_headers):
        payload = {
            "title": "TEST_కొత్త ఫోటో గ్యాలరీ వార్త",
            "summary": "TEST summary",
            "body": "<p><strong>Bold body text</strong> for testing.</p>",
            "category": "photos",
            "image_url": "https://images.unsplash.com/photo-1610394663146-cb1eb63c93f0",
            "images": [
                "https://images.unsplash.com/photo-1610394663146-cb1eb63c93f0",
                "https://images.unsplash.com/photo-1541185933-ef5d8ed016c2",
                "https://images.unsplash.com/photo-1506905925346-21bda4d32df4",
            ],
            "is_featured": False, "is_flash": True, "is_published": True,
            "tags": ["test"],
        }
        r = requests.post(f"{API}/admin/news", headers=auth_headers, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["title"] == payload["title"]
        assert d["is_flash"] is True
        assert len(d["images"]) == 3
        TestNewsAdmin._created_ids.append(d["id"])

        # Verify persisted
        r2 = requests.get(f"{API}/news/{d['id']}", timeout=10)
        assert r2.status_code == 200
        assert r2.json()["is_flash"] is True

        # Appears in flash filter
        r3 = requests.get(f"{API}/news?flash=true&limit=50", timeout=10)
        assert any(it["id"] == d["id"] for it in r3.json()["items"])

    def test_cleanup(self, auth_headers):
        for nid in TestNewsAdmin._created_ids:
            requests.delete(f"{API}/admin/news/{nid}", headers=auth_headers, timeout=10)


# ---------- Live TV Settings ----------
class TestLiveTV:
    _original = None

    def test_get_settings(self):
        r = requests.get(f"{API}/settings/livetv", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "url" in d and "stream_type" in d
        assert d["stream_type"] in ["youtube", "hls", "mp4"]
        TestLiveTV._original = d

    def test_update_settings_youtube(self, auth_headers):
        payload = {
            "url": "https://www.youtube.com/embed/5qap5aO4i9A",
            "stream_type": "youtube",
            "title_en": "Andhra News Live",
            "title_te": "ఆంధ్ర న్యూస్ లైవ్",
        }
        r = requests.put(f"{API}/admin/settings/livetv", headers=auth_headers, json=payload, timeout=15)
        assert r.status_code == 200
        assert r.json()["url"] == payload["url"]

        # Verify persisted
        r2 = requests.get(f"{API}/settings/livetv", timeout=10)
        assert r2.json()["url"] == payload["url"]

    def test_update_settings_mp4(self, auth_headers):
        payload = {
            "url": "https://commondelivery.net/sample.mp4",
            "stream_type": "mp4",
            "title_en": "Live", "title_te": "లైవ్",
        }
        r = requests.put(f"{API}/admin/settings/livetv", headers=auth_headers, json=payload, timeout=15)
        assert r.status_code == 200
        assert r.json()["stream_type"] == "mp4"

    def test_restore_original(self, auth_headers):
        if TestLiveTV._original:
            r = requests.put(f"{API}/admin/settings/livetv", headers=auth_headers,
                             json=TestLiveTV._original, timeout=15)
            assert r.status_code == 200


# ---------- Contact Settings ----------
class TestContact:
    _original = None

    def test_get_contact(self):
        r = requests.get(f"{API}/settings/contact", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "phone" in d and "email" in d
        # Default values from spec
        assert d["phone"] == "9393950505"
        assert d["email"] == "news9today99@gmail.com"
        TestContact._original = d

    def test_update_contact_persist_and_restore(self, auth_headers):
        new_payload = {"phone": "9999999999", "email": "test_news9@example.com", "address": "TEST_addr"}
        r = requests.put(f"{API}/admin/settings/contact", headers=auth_headers, json=new_payload, timeout=15)
        assert r.status_code == 200
        assert r.json()["phone"] == "9999999999"
        # verify via GET
        r2 = requests.get(f"{API}/settings/contact", timeout=10)
        assert r2.json()["phone"] == "9999999999"
        # RESTORE original
        if TestContact._original:
            restore = {
                "phone": TestContact._original["phone"],
                "email": TestContact._original["email"],
                "address": TestContact._original.get("address", ""),
            }
        else:
            restore = {"phone": "9393950505", "email": "news9today99@gmail.com", "address": "Hyderabad, Telangana"}
        r3 = requests.put(f"{API}/admin/settings/contact", headers=auth_headers, json=restore, timeout=15)
        assert r3.status_code == 200
        r4 = requests.get(f"{API}/settings/contact", timeout=10)
        assert r4.json()["phone"] == "9393950505"
        assert r4.json()["email"] == "news9today99@gmail.com"


# ---------- YouTube Settings + Sync ----------
class TestYoutube:
    _original = None

    def test_get_youtube_settings(self):
        r = requests.get(f"{API}/settings/youtube", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "channel_id" in d and "auto_import" in d and "default_category" in d
        TestYoutube._original = d

    def test_sync_requires_channel_id(self, auth_headers):
        # First clear channel_id
        r = requests.put(f"{API}/admin/settings/youtube", headers=auth_headers,
                         json={"channel_id": "", "auto_import": True, "default_category": "videos"}, timeout=15)
        assert r.status_code == 200
        # Sync should fail
        r2 = requests.post(f"{API}/admin/youtube/sync", headers=auth_headers, timeout=30)
        assert r2.status_code == 400
        assert "channel_id" in r2.text.lower()

    def test_sync_imports_and_dedupes(self, auth_headers):
        # Set a real public channel (Google Developers)
        channel = "UC_x5XG1OV2P6uZZ5FSM9Ttw"
        r = requests.put(f"{API}/admin/settings/youtube", headers=auth_headers,
                         json={"channel_id": channel, "auto_import": True, "default_category": "videos"}, timeout=15)
        assert r.status_code == 200
        # First sync
        r2 = requests.post(f"{API}/admin/youtube/sync", headers=auth_headers, timeout=60)
        assert r2.status_code == 200, r2.text
        d = r2.json()
        assert "imported" in d and "skipped" in d
        first_imported = d["imported"]
        # Second sync → should dedupe (skipped > 0 if there were entries)
        r3 = requests.post(f"{API}/admin/youtube/sync", headers=auth_headers, timeout=60)
        assert r3.status_code == 200
        d3 = r3.json()
        # imported this time should be 0 or less than first (all deduped)
        assert d3["imported"] == 0
        assert d3["skipped"] >= first_imported

        # Verify news items with youtube source appear in videos category
        r4 = requests.get(f"{API}/news?category=videos&limit=50", timeout=10)
        assert r4.status_code == 200
        items = r4.json()["items"]
        # at least one should have youtube_url
        has_yt = any(it.get("youtube_url") for it in items)
        assert has_yt, "No youtube-sourced items in videos category after sync"

    def test_restore_youtube_settings(self, auth_headers):
        restore = TestYoutube._original or {"channel_id": "", "auto_import": True, "default_category": "videos"}
        r = requests.put(f"{API}/admin/settings/youtube", headers=auth_headers, json=restore, timeout=15)
        assert r.status_code == 200


# ---------- Ads CRUD ----------
class TestAds:
    _created_id = None

    def test_public_list_ads(self):
        r = requests.get(f"{API}/ads", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_ad(self, auth_headers):
        payload = {
            "name": "TEST_Strip Ad",
            "placement": "strip",
            "image_url": "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1600&h=100&fit=crop",
            "link_url": "https://example.com",
            "is_active": True,
            "order": 5,
        }
        r = requests.post(f"{API}/admin/ads", headers=auth_headers, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == payload["name"]
        assert d["placement"] == "strip"
        assert d["is_active"] is True
        TestAds._created_id = d["id"]

        # Verify appears in public list
        r2 = requests.get(f"{API}/ads?placement=strip", timeout=10)
        assert any(a["id"] == d["id"] for a in r2.json())

    def test_toggle_ad_inactive(self, auth_headers):
        assert TestAds._created_id
        r = requests.put(f"{API}/admin/ads/{TestAds._created_id}", headers=auth_headers,
                         json={"is_active": False}, timeout=15)
        assert r.status_code == 200
        assert r.json()["is_active"] is False
        # public list should NOT return it
        r2 = requests.get(f"{API}/ads?placement=strip", timeout=10)
        assert not any(a["id"] == TestAds._created_id for a in r2.json())

    def test_delete_ad(self, auth_headers):
        assert TestAds._created_id
        r = requests.delete(f"{API}/admin/ads/{TestAds._created_id}", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        # Verify gone from admin list
        r2 = requests.get(f"{API}/admin/ads", headers=auth_headers, timeout=10)
        assert not any(a["id"] == TestAds._created_id for a in r2.json())


# ---------- Pages ----------
class TestPages:
    _orig_privacy = None
    _orig_terms = None

    def test_get_privacy_default(self):
        r = requests.get(f"{API}/pages/privacy", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["title_te"] == "గోప్యతా విధానం"
        assert "body" in d
        TestPages._orig_privacy = d

    def test_get_terms_default(self):
        r = requests.get(f"{API}/pages/terms", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["title_te"] == "నిబంధనలు మరియు షరతులు"
        TestPages._orig_terms = d

    def test_update_privacy_and_restore(self, auth_headers):
        new_body = "<p>TEST_UPDATED_PRIVACY_BODY_XYZ</p>"
        payload = {"title_en": "Privacy Policy", "title_te": "గోప్యతా విధానం", "body": new_body}
        r = requests.put(f"{API}/admin/pages/privacy", headers=auth_headers, json=payload, timeout=15)
        assert r.status_code == 200
        # verify persisted
        r2 = requests.get(f"{API}/pages/privacy", timeout=10)
        assert "TEST_UPDATED_PRIVACY_BODY_XYZ" in r2.json()["body"]
        # restore
        if TestPages._orig_privacy:
            restore = {
                "title_en": TestPages._orig_privacy["title_en"],
                "title_te": TestPages._orig_privacy["title_te"],
                "body": TestPages._orig_privacy["body"],
            }
            r3 = requests.put(f"{API}/admin/pages/privacy", headers=auth_headers, json=restore, timeout=15)
            assert r3.status_code == 200

    def test_page_not_found(self):
        r = requests.get(f"{API}/pages/nonexistent-slug-xyz", timeout=10)
        assert r.status_code == 404


# ---------- Widgets ----------
class TestWidgets:
    def test_weather(self):
        r = requests.get(f"{API}/widgets/weather", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d.get("city") == "Hyderabad"
        # temp may be None if API down; retry once
        if d.get("temp") is None:
            r2 = requests.get(f"{API}/widgets/weather", timeout=15)
            d = r2.json()
        assert d.get("temp") is not None, f"Weather API returned no temp: {d}"
        assert isinstance(d["temp"], (int, float))

    def test_stock(self):
        r = requests.get(f"{API}/widgets/stock", timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "items" in d
        assert len(d["items"]) == 4
        labels = [it["label"] for it in d["items"]]
        for expected in ["NIFTY 50", "SENSEX", "BANK NIFTY", "USD/INR"]:
            assert expected in labels
        # At least one should have a price (Yahoo occasionally rate-limits)
        prices = [it.get("price") for it in d["items"] if it.get("price") is not None]
        assert len(prices) >= 1, f"No stock prices returned: {d}"


# ---------- Body Font on Articles ----------
class TestBodyFont:
    _created_id = None

    def test_create_article_with_body_font(self, auth_headers):
        payload = {
            "title": "TEST_Font Article Ramabhadra",
            "summary": "TEST font test",
            "body": "<p>Sample telugu body</p>",
            "category": "politics",
            "is_flash": True,
            "is_published": True,
            "body_font": "ramabhadra",
        }
        r = requests.post(f"{API}/admin/news", headers=auth_headers, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["body_font"] == "ramabhadra"
        assert d["is_flash"] is True
        TestBodyFont._created_id = d["id"]

        # Verify GET persists font
        r2 = requests.get(f"{API}/news/{d['id']}", timeout=10)
        assert r2.json()["body_font"] == "ramabhadra"

    def test_view_count_increment(self, auth_headers):
        assert TestBodyFont._created_id
        # trigger GETs — view count increments in DB but not returned in serializer;
        # just ensure GET succeeds multiple times
        for _ in range(3):
            r = requests.get(f"{API}/news/{TestBodyFont._created_id}", timeout=10)
            assert r.status_code == 200

    def test_cleanup(self, auth_headers):
        if TestBodyFont._created_id:
            requests.delete(f"{API}/admin/news/{TestBodyFont._created_id}",
                            headers=auth_headers, timeout=10)

