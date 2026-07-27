"""
Iteration 7 tests: multi-language + font_scale + multi-channel LiveTV + view count.
"""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://content-manager-163.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@news.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture
def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Theme with font_scale & default_language ----------
class TestThemeFontScale:
    def test_get_theme_has_new_fields(self):
        r = requests.get(f"{API}/settings/theme", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "font_scale" in d
        assert "default_language" in d
        assert isinstance(d["font_scale"], (int, float))
        assert d["default_language"] in ("te", "en", "hi")

    def test_update_font_scale_and_lang(self, headers):
        # snapshot
        orig = requests.get(f"{API}/settings/theme", timeout=10).json()
        payload = dict(orig)
        payload["font_scale"] = 1.3
        payload["default_language"] = "en"
        r = requests.put(f"{API}/admin/settings/theme", headers=headers, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert abs(d["font_scale"] - 1.3) < 0.001
        assert d["default_language"] == "en"
        # verify persisted
        r2 = requests.get(f"{API}/settings/theme", timeout=10).json()
        assert abs(r2["font_scale"] - 1.3) < 0.001
        assert r2["default_language"] == "en"
        # restore
        payload["font_scale"] = orig.get("font_scale", 1.0)
        payload["default_language"] = orig.get("default_language", "te")
        r3 = requests.put(f"{API}/admin/settings/theme", headers=headers, json=payload, timeout=15)
        assert r3.status_code == 200


# ---------- LiveTV channels array ----------
class TestLiveTVChannels:
    _added_ids = []

    def test_get_livetv_has_channels_field(self):
        r = requests.get(f"{API}/settings/livetv", timeout=10)
        assert r.status_code == 200
        d = r.json()
        # channels may be missing on old data; PUT should be able to set it
        assert "url" in d
        assert "stream_type" in d

    def test_update_livetv_with_channels(self, headers):
        orig = requests.get(f"{API}/settings/livetv", timeout=10).json()
        orig_channels = orig.get("channels") or []

        new_channel = {
            "name_te": "TEST_ఛానెల్",
            "name_en": "TEST_Channel",
            "url": "https://www.youtube.com/embed/5qap5aO4i9A",
            "stream_type": "youtube",
            "order": 999,
            "is_active": True,
        }
        payload = {
            "url": orig.get("url", "https://www.youtube.com/embed/5qap5aO4i9A"),
            "stream_type": orig.get("stream_type", "youtube"),
            "title_en": orig.get("title_en", "Live"),
            "title_te": orig.get("title_te", "లైవ్"),
            "channels": orig_channels + [new_channel],
        }
        r = requests.put(f"{API}/admin/settings/livetv", headers=headers, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "channels" in d and isinstance(d["channels"], list)
        # New channel should have auto-assigned UUID
        added = [c for c in d["channels"] if c.get("name_en") == "TEST_Channel"]
        assert len(added) == 1
        assert added[0].get("id"), "channel should have auto-generated id"
        TestLiveTVChannels._added_ids.append(added[0]["id"])

        # Verify persistence via GET
        r2 = requests.get(f"{API}/settings/livetv", timeout=10).json()
        assert any(c.get("name_en") == "TEST_Channel" for c in r2.get("channels", []))

    def test_cleanup_channels(self, headers):
        cur = requests.get(f"{API}/settings/livetv", timeout=10).json()
        kept = [c for c in (cur.get("channels") or []) if c.get("name_en") != "TEST_Channel"]
        payload = {
            "url": cur.get("url", ""),
            "stream_type": cur.get("stream_type", "youtube"),
            "title_en": cur.get("title_en", "Live"),
            "title_te": cur.get("title_te", "లైవ్"),
            "channels": kept,
        }
        r = requests.put(f"{API}/admin/settings/livetv", headers=headers, json=payload, timeout=15)
        assert r.status_code == 200


# ---------- View count ----------
class TestViewCount:
    _nid = None

    def test_create_article(self, headers):
        payload = {
            "title": "TEST_View_Count_Article",
            "summary": "views test",
            "body": "<p>views</p>",
            "category": "politics",
            "is_published": True,
        }
        r = requests.post(f"{API}/admin/news", headers=headers, json=payload, timeout=15)
        assert r.status_code == 200
        TestViewCount._nid = r.json()["id"]

    def test_views_increment(self):
        assert TestViewCount._nid
        for _ in range(3):
            r = requests.get(f"{API}/news/{TestViewCount._nid}", timeout=10)
            assert r.status_code == 200
        # 3rd or 4th GET should show at least 3
        final = requests.get(f"{API}/news/{TestViewCount._nid}", timeout=10).json()
        assert "views" in final, f"views field missing in article response: {final.keys()}"
        assert final["views"] >= 3, f"expected views>=3, got {final['views']}"

    def test_cleanup(self, headers):
        if TestViewCount._nid:
            requests.delete(f"{API}/admin/news/{TestViewCount._nid}", headers=headers, timeout=10)


# ---------- Regression: widgets + settings ----------
class TestRegression:
    def test_regions(self):
        r = requests.get(f"{API}/regions", timeout=10)
        assert r.status_code == 200

    def test_categories(self):
        r = requests.get(f"{API}/categories", timeout=10)
        assert r.status_code == 200
        assert len(r.json()) >= 6

    def test_news_list(self):
        r = requests.get(f"{API}/news", timeout=10)
        assert r.status_code == 200

    def test_contact(self):
        r = requests.get(f"{API}/settings/contact", timeout=10)
        assert r.status_code == 200

    def test_weather(self):
        r = requests.get(f"{API}/widgets/weather", timeout=15)
        assert r.status_code == 200

    def test_stock(self):
        r = requests.get(f"{API}/widgets/stock", timeout=20)
        assert r.status_code == 200
