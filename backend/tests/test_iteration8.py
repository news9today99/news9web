"""Iteration 8: name_hi backfill on categories + Social/RSS feed sources CRUD & sync."""
import os
import pytest
import requests

def _load_backend_url():
    p = "/app/frontend/.env"
    if os.path.exists(p):
        for line in open(p):
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip()
    return os.environ["REACT_APP_BACKEND_URL"]

BASE_URL = _load_backend_url().rstrip('/')
API = f"{BASE_URL}/api"

EXPECTED_HI = {
    "politics": "राजनीति", "sports": "खेल", "cinema": "सिनेमा",
    "business": "व्यापार", "technology": "टेक्नोलॉजी", "health": "स्वास्थ्य",
    "photos": "तस्वीरें", "videos": "वीडियो",
}

YT_FEED = "https://www.youtube.com/feeds/videos.xml?channel_id=UCBR8-60-B28hp2BmDPdntcQ"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login",
                      json={"email": "admin@news.com", "password": "admin123"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------- Category name_hi ----------
class TestCategoryHindi:
    def test_default_categories_have_name_hi(self):
        r = requests.get(f"{API}/categories", timeout=15)
        assert r.status_code == 200
        cats = {c["slug"]: c for c in r.json()}
        for slug, hi in EXPECTED_HI.items():
            assert slug in cats, f"Missing default category: {slug}"
            assert cats[slug].get("name_hi") == hi, (
                f"{slug}: expected name_hi={hi!r} got {cats[slug].get('name_hi')!r}")

    def test_create_category_with_name_hi_and_cleanup(self, h):
        payload = {"slug": "TEST-weather", "name_en": "Weather",
                   "name_te": "వాతావరణం", "name_hi": "मौसम", "order": 90}
        # cleanup any prior
        requests.delete(f"{API}/admin/categories/test-weather", headers=h)
        r = requests.post(f"{API}/admin/categories", json=payload, headers=h, timeout=10)
        assert r.status_code == 200, r.text
        slug = r.json()["slug"]
        try:
            g = requests.get(f"{API}/categories", timeout=10).json()
            found = next((c for c in g if c["slug"] == slug), None)
            assert found is not None
            assert found["name_hi"] == "मौसम"
        finally:
            d = requests.delete(f"{API}/admin/categories/{slug}", headers=h)
            assert d.status_code == 200


# ---------- Feed Sources ----------
class TestFeedSources:
    @pytest.fixture(scope="class")
    def feed_id(self, h):
        payload = {"name": "TEST_YT", "source_type": "youtube",
                   "feed_url": YT_FEED, "category": "videos", "is_active": True}
        r = requests.post(f"{API}/admin/feed-sources", json=payload, headers=h, timeout=15)
        assert r.status_code == 200, r.text
        fid = r.json()["id"]
        assert r.json()["source_type"] == "youtube"
        yield fid
        # teardown: delete feed + imported news items with source=youtube tagged with TEST_YT
        requests.delete(f"{API}/admin/feed-sources/{fid}", headers=h)
        # cleanup imported news whose author == TEST_YT
        news_all = requests.get(f"{API}/admin/news", headers=h, timeout=15).json()
        for n in news_all:
            if n.get("author") == "TEST_YT" or (
                n.get("source") == "youtube" and "TEST_YT".lower() in [t.lower() for t in n.get("tags", [])]
            ) or "test_yt" in [t.lower() for t in n.get("tags", [])]:
                requests.delete(f"{API}/admin/news/{n['id']}", headers=h)

    def test_list_includes_feed(self, h, feed_id):
        r = requests.get(f"{API}/admin/feed-sources", headers=h, timeout=10)
        assert r.status_code == 200
        ids = [f["id"] for f in r.json()]
        assert feed_id in ids

    def test_sync_first_imports(self, h, feed_id):
        r = requests.post(f"{API}/admin/feed-sources/{feed_id}/sync", headers=h, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "imported" in data and "skipped" in data
        # YouTube RSS may return 0 if network blocked; treat gracefully but expect no error
        assert data.get("error") is None or data.get("error") == None, f"sync error: {data.get('error')}"
        # Should have imported >= 1 (YouTube channel has videos)
        assert data["imported"] >= 1, f"Expected imports, got {data}"

    def test_sync_second_dedupes(self, h, feed_id):
        r = requests.post(f"{API}/admin/feed-sources/{feed_id}/sync", headers=h, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["imported"] == 0
        assert data["skipped"] >= 1

    def test_list_has_last_synced(self, h, feed_id):
        r = requests.get(f"{API}/admin/feed-sources", headers=h, timeout=10)
        f = next(x for x in r.json() if x["id"] == feed_id)
        assert f["last_synced_at"] is not None
        assert f["last_sync_result"] is not None
        assert "imported" in f["last_sync_result"]

    def test_news_has_source_youtube(self, h, feed_id):
        # public /news filter by source
        r = requests.get(f"{API}/news", params={"source": "youtube", "limit": 5}, timeout=10)
        assert r.status_code == 200
        items = r.json().get("items", [])
        assert len(items) >= 1
        for it in items:
            assert it["source"] == "youtube"

    def test_update_deactivate_and_sync_all_skips(self, h, feed_id):
        u = requests.put(f"{API}/admin/feed-sources/{feed_id}",
                         json={"is_active": False}, headers=h, timeout=10)
        assert u.status_code == 200
        assert u.json()["is_active"] is False
        r = requests.post(f"{API}/admin/feed-sources/sync-all", headers=h, timeout=30)
        assert r.status_code == 200
        result_ids = [x["id"] for x in r.json()["results"]]
        assert feed_id not in result_ids
        # reactivate for cleanup consistency
        requests.put(f"{API}/admin/feed-sources/{feed_id}",
                     json={"is_active": True}, headers=h)

    def test_delete_feed(self, h):
        # ephemeral feed just for delete test
        p = {"name": "TEST_DEL", "source_type": "rss",
             "feed_url": "https://example.com/rss.xml", "category": "videos"}
        c = requests.post(f"{API}/admin/feed-sources", json=p, headers=h, timeout=10)
        fid = c.json()["id"]
        d = requests.delete(f"{API}/admin/feed-sources/{fid}", headers=h, timeout=10)
        assert d.status_code == 200
        r = requests.get(f"{API}/admin/feed-sources", headers=h, timeout=10)
        assert fid not in [f["id"] for f in r.json()]


# ---------- Regression on core endpoints ----------
class TestRegression:
    @pytest.mark.parametrize("path", [
        "/regions", "/categories", "/news", "/settings/contact",
        "/settings/theme", "/settings/livetv", "/widgets/weather", "/widgets/stock",
        "/pages/privacy", "/pages/terms", "/ads",
    ])
    def test_public_endpoint(self, path):
        r = requests.get(f"{API}{path}", timeout=15)
        assert r.status_code == 200, f"{path} -> {r.status_code}"
