"""
Backend API tests for ABN Andhra News portal - Iteration 2.
Covers: auth, news filters (flash/q/pagination), categories CRUD, live TV settings.
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
        assert r.json().get("message") == "News Portal API"


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
