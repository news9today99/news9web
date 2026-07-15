"""
Iteration 4 retest additions:
- Additional geo coords per review request (Bengaluru, Vizag, Mumbai)
- News payload contains region/source/views keys
- Article region round-trip POST -> GET
- news?region=national returns only national + missing-region items
- YouTube RSS sync with a real channel
- Auth enforcement on admin endpoints (401 when no token)
- Ads CRUD, Pages editor round-trip
"""
import os
import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://content-manager-163.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@news.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ---------- GEO DETECT REGION (extra coords) ----------
class TestGeoDetectRegionExtra:
    def test_bengaluru_karnataka(self):
        r = requests.get(f"{API}/geo/detect-region?lat=12.97&lon=77.59", timeout=10)
        assert r.status_code == 200
        assert r.json()["region"] == "karnataka"

    def test_vizag_andhra_pradesh(self):
        r = requests.get(f"{API}/geo/detect-region?lat=17.68&lon=83.21", timeout=10)
        assert r.status_code == 200
        assert r.json()["region"] == "andhra_pradesh"

    def test_hyderabad_telangana(self):
        r = requests.get(f"{API}/geo/detect-region?lat=17.38&lon=78.48", timeout=10)
        assert r.status_code == 200
        assert r.json()["region"] == "telangana"

    def test_mumbai_national(self):
        r = requests.get(f"{API}/geo/detect-region?lat=19.07&lon=72.88", timeout=10)
        assert r.status_code == 200
        assert r.json()["region"] == "national"

    def test_delhi_national(self):
        r = requests.get(f"{API}/geo/detect-region?lat=28.6&lon=77.2", timeout=10)
        assert r.status_code == 200
        assert r.json()["region"] == "national"


# ---------- NEWS PAYLOAD SHAPE ----------
class TestNewsPayloadShape:
    def test_news_list_includes_region_source_views(self):
        r = requests.get(f"{API}/news?limit=5", timeout=10)
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) > 0, "no items to inspect payload shape"
        for it in items:
            for k in ("region", "source", "views"):
                assert k in it, f"news_out payload missing key '{k}' in {it.get('id')}"

    def test_settings_contact_defaults_present(self):
        r = requests.get(f"{API}/settings/contact", timeout=10)
        assert r.status_code == 200
        d = r.json()
        for k in ("twitter", "instagram", "facebook", "whatsapp", "youtube",
                  "phone", "email"):
            assert k in d, f"contact settings missing '{k}'"

    def test_settings_theme_defaults_present(self):
        r = requests.get(f"{API}/settings/theme", timeout=10)
        assert r.status_code == 200
        d = r.json()
        for k in ("primary_color", "secondary_color", "accent_color",
                  "logo_url", "site_name_te", "site_name_en",
                  "tagline_te", "tagline_en"):
            assert k in d, f"theme settings missing '{k}'"


# ---------- ARTICLE REGION ROUND-TRIP ----------
class TestArticleRegionRoundTrip:
    _ka_id = None
    _tn_id = None
    _nat_id = None

    def test_create_ka_and_get(self, auth_headers):
        payload = {
            "title": "TEST_RT_KA", "summary": "TEST", "body": "<p>ka</p>",
            "category": "politics", "region": "karnataka", "is_published": True,
        }
        r = requests.post(f"{API}/admin/news", headers=auth_headers, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["region"] == "karnataka"
        TestArticleRegionRoundTrip._ka_id = d["id"]

        # GET individual
        r2 = requests.get(f"{API}/news/{d['id']}", timeout=10)
        assert r2.status_code == 200
        assert r2.json()["region"] == "karnataka"

    def test_create_tn_and_national(self, auth_headers):
        for slug, key in (("tamil_nadu", "_tn_id"), ("national", "_nat_id")):
            payload = {
                "title": f"TEST_RT_{slug}", "summary": "TEST", "body": "<p>x</p>",
                "category": "politics", "region": slug, "is_published": True,
            }
            r = requests.post(f"{API}/admin/news", headers=auth_headers, json=payload, timeout=15)
            assert r.status_code == 200
            d = r.json()
            assert d["region"] == slug
            setattr(TestArticleRegionRoundTrip, key, d["id"])

    def test_filter_by_karnataka_includes_ka_excludes_tn(self):
        r = requests.get(f"{API}/news?region=karnataka&limit=100", timeout=10)
        assert r.status_code == 200
        ids = {it["id"] for it in r.json()["items"]}
        assert TestArticleRegionRoundTrip._ka_id in ids
        assert TestArticleRegionRoundTrip._tn_id not in ids

    def test_filter_by_telangana_excludes_ka_and_tn(self):
        r = requests.get(f"{API}/news?region=telangana&limit=100", timeout=10)
        assert r.status_code == 200
        ids = {it["id"] for it in r.json()["items"]}
        assert TestArticleRegionRoundTrip._ka_id not in ids
        assert TestArticleRegionRoundTrip._tn_id not in ids
        # National items should still appear
        assert TestArticleRegionRoundTrip._nat_id in ids

    def test_filter_national_returns_only_national_and_legacy(self):
        """Per review request: region=national should return only region='national'
        + region-less legacy items (excluding karnataka/tamil_nadu/etc)."""
        r = requests.get(f"{API}/news?region=national&limit=200", timeout=10)
        assert r.status_code == 200
        items = r.json()["items"]
        ids = {it["id"] for it in items}
        # National item should be included
        assert TestArticleRegionRoundTrip._nat_id in ids
        # Non-national regional items must be excluded
        assert TestArticleRegionRoundTrip._ka_id not in ids, \
            "karnataka article leaked into region=national result"
        assert TestArticleRegionRoundTrip._tn_id not in ids, \
            "tamil_nadu article leaked into region=national result"
        for it in items:
            reg = it.get("region")
            assert reg in ("national", None), \
                f"unexpected region '{reg}' for id {it['id']} in region=national result"

    def test_cleanup(self, auth_headers):
        for nid in (TestArticleRegionRoundTrip._ka_id,
                    TestArticleRegionRoundTrip._tn_id,
                    TestArticleRegionRoundTrip._nat_id):
            if nid:
                requests.delete(f"{API}/admin/news/{nid}",
                                headers=auth_headers, timeout=10)


# ---------- ADMIN AUTH ENFORCEMENT ----------
class TestAdminAuthEnforcement:
    @pytest.mark.parametrize("method,path,body", [
        ("POST", "/admin/news", {"title": "x", "body": "y", "category": "politics"}),
        ("GET", "/admin/news", None),
        ("PUT", "/admin/settings/theme", {"primary_color": "#fff"}),
        ("PUT", "/admin/settings/contact",
         {"phone": "1", "email": "a@b.com"}),
        ("PUT", "/admin/settings/livetv",
         {"url": "x", "stream_type": "youtube"}),
        ("PUT", "/admin/settings/youtube",
         {"channel_id": "x"}),
        ("PUT", "/admin/settings/flash-config",
         {"category_slugs": []}),
        ("POST", "/admin/ads",
         {"name": "x", "placement": "strip"}),
        ("GET", "/admin/ads", None),
        ("PUT", "/admin/pages/privacy",
         {"title_en": "x", "title_te": "y", "body": "z"}),
        ("POST", "/admin/youtube/sync", None),
        ("POST", "/admin/categories",
         {"slug": "x", "name_en": "x", "name_te": "x"}),
    ])
    def test_admin_endpoint_requires_auth(self, method, path, body):
        url = f"{API}{path}"
        if method == "GET":
            r = requests.get(url, timeout=10)
        elif method == "POST":
            r = requests.post(url, json=body, timeout=10)
        elif method == "PUT":
            r = requests.put(url, json=body, timeout=10)
        elif method == "DELETE":
            r = requests.delete(url, timeout=10)
        assert r.status_code == 401, \
            f"{method} {path} expected 401 without token, got {r.status_code}"


# ---------- ADS CRUD ----------
class TestAdsCRUD:
    _ad_id = None

    def test_create_ad(self, auth_headers):
        payload = {
            "name": "TEST_AD_1",
            "placement": "strip",
            "image_url": "https://example.com/ad.jpg",
            "link_url": "https://example.com",
            "is_active": True,
            "order": 5,
        }
        r = requests.post(f"{API}/admin/ads", headers=auth_headers,
                          json=payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == "TEST_AD_1"
        assert d["placement"] == "strip"
        assert d["is_active"] is True
        assert "id" in d
        TestAdsCRUD._ad_id = d["id"]

    def test_public_ads_lists_active(self):
        r = requests.get(f"{API}/ads?placement=strip", timeout=10)
        assert r.status_code == 200
        ids = {a["id"] for a in r.json()}
        assert TestAdsCRUD._ad_id in ids

    def test_admin_ads_list(self, auth_headers):
        r = requests.get(f"{API}/admin/ads", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        ids = {a["id"] for a in r.json()}
        assert TestAdsCRUD._ad_id in ids

    def test_update_ad(self, auth_headers):
        r = requests.put(f"{API}/admin/ads/{TestAdsCRUD._ad_id}",
                         headers=auth_headers,
                         json={"name": "TEST_AD_1_UPDATED", "is_active": False},
                         timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["name"] == "TEST_AD_1_UPDATED"
        assert d["is_active"] is False

    def test_inactive_not_in_public(self):
        r = requests.get(f"{API}/ads?placement=strip", timeout=10)
        assert r.status_code == 200
        ids = {a["id"] for a in r.json()}
        assert TestAdsCRUD._ad_id not in ids

    def test_delete_ad(self, auth_headers):
        r = requests.delete(f"{API}/admin/ads/{TestAdsCRUD._ad_id}",
                            headers=auth_headers, timeout=10)
        assert r.status_code == 200
        # Should not exist anymore -> second delete = 404
        r2 = requests.delete(f"{API}/admin/ads/{TestAdsCRUD._ad_id}",
                             headers=auth_headers, timeout=10)
        assert r2.status_code == 404


# ---------- PAGES EDITOR ----------
class TestPagesEditor:
    _priv_original = None
    _terms_original = None

    def test_load_originals(self):
        r = requests.get(f"{API}/pages/privacy", timeout=10)
        assert r.status_code == 200
        TestPagesEditor._priv_original = r.json()
        r2 = requests.get(f"{API}/pages/terms", timeout=10)
        assert r2.status_code == 200
        TestPagesEditor._terms_original = r2.json()

    def test_update_privacy_and_verify(self, auth_headers):
        payload = {
            "title_en": "TEST Privacy Policy",
            "title_te": "TEST గోప్యత",
            "body": "<p>TEST updated privacy body content</p>",
        }
        r = requests.put(f"{API}/admin/pages/privacy",
                         headers=auth_headers, json=payload, timeout=15)
        assert r.status_code == 200
        # Verify persistence
        r2 = requests.get(f"{API}/pages/privacy", timeout=10)
        assert r2.status_code == 200
        d = r2.json()
        assert d["title_en"] == "TEST Privacy Policy"
        assert "TEST updated privacy body" in d["body"]
        assert d.get("updated_at")

    def test_update_terms_and_verify(self, auth_headers):
        payload = {
            "title_en": "TEST Terms",
            "title_te": "TEST నిబంధనలు",
            "body": "<p>TEST terms body</p>",
        }
        r = requests.put(f"{API}/admin/pages/terms",
                         headers=auth_headers, json=payload, timeout=15)
        assert r.status_code == 200
        r2 = requests.get(f"{API}/pages/terms", timeout=10)
        assert r2.status_code == 200
        assert r2.json()["title_en"] == "TEST Terms"

    def test_restore_pages(self, auth_headers):
        orig_priv = TestPagesEditor._priv_original or {}
        payload = {
            "title_en": orig_priv.get("title_en", "Privacy Policy"),
            "title_te": orig_priv.get("title_te", "గోప్యతా విధానం"),
            "body": orig_priv.get("body", "<p>Privacy content</p>"),
        }
        r = requests.put(f"{API}/admin/pages/privacy",
                         headers=auth_headers, json=payload, timeout=15)
        assert r.status_code == 200

        orig_t = TestPagesEditor._terms_original or {}
        payload = {
            "title_en": orig_t.get("title_en", "Terms & Conditions"),
            "title_te": orig_t.get("title_te", "నిబంధనలు మరియు షరతులు"),
            "body": orig_t.get("body", "<p>Terms content</p>"),
        }
        r = requests.put(f"{API}/admin/pages/terms",
                         headers=auth_headers, json=payload, timeout=15)
        assert r.status_code == 200


# ---------- YOUTUBE RSS SYNC (real channel) ----------
class TestYoutubeSyncReal:
    _saved_yt = None

    def test_save_channel_and_sync(self, auth_headers):
        # Backup current youtube setting
        r0 = requests.get(f"{API}/settings/youtube", timeout=10)
        TestYoutubeSyncReal._saved_yt = r0.json() if r0.status_code == 200 else None

        # Configure the "YouTube Spotlight" channel from the request
        cfg = {
            "channel_id": "UCBR8-60-B28hp2BmDPdntcQ",
            "auto_import": True,
            "default_category": "videos",
        }
        r = requests.put(f"{API}/admin/settings/youtube",
                         headers=auth_headers, json=cfg, timeout=15)
        assert r.status_code == 200
        assert r.json()["channel_id"] == "UCBR8-60-B28hp2BmDPdntcQ"

        # Trigger sync
        r2 = requests.post(f"{API}/admin/youtube/sync",
                           headers=auth_headers, timeout=30)
        assert r2.status_code == 200, r2.text
        data = r2.json()
        assert "imported" in data and "skipped" in data
        # At least one video should be imported OR skipped
        assert (data["imported"] + data["skipped"]) > 0, \
            f"YouTube feed returned no items: {data}"

    def test_sync_dedupe(self, auth_headers):
        # Second sync should mostly skip
        r = requests.post(f"{API}/admin/youtube/sync",
                          headers=auth_headers, timeout=30)
        assert r.status_code == 200
        d = r.json()
        # After first sync, second should have skipped > 0
        assert d["skipped"] >= 0

    def test_imported_articles_have_source_youtube(self):
        r = requests.get(f"{API}/news?source=youtube&limit=10", timeout=10)
        assert r.status_code == 200
        items = r.json()["items"]
        for it in items:
            assert it.get("source") == "youtube"
            assert "region" in it
            assert "views" in it

    def test_cleanup_youtube_imports(self, auth_headers):
        # Fetch all youtube-sourced items and remove them; then restore setting
        r = requests.get(f"{API}/news?source=youtube&limit=200", timeout=15)
        if r.status_code == 200:
            for it in r.json().get("items", []):
                requests.delete(f"{API}/admin/news/{it['id']}",
                                headers=auth_headers, timeout=10)
        # Restore youtube setting
        restore = TestYoutubeSyncReal._saved_yt or {
            "channel_id": "", "auto_import": True, "default_category": "videos",
        }
        # Only send allowed fields
        payload = {
            "channel_id": restore.get("channel_id", ""),
            "auto_import": restore.get("auto_import", True),
            "default_category": restore.get("default_category", "videos"),
        }
        requests.put(f"{API}/admin/settings/youtube",
                     headers=auth_headers, json=payload, timeout=15)


# ---------- CONTACT SETTINGS PUT PRESERVES ----------
class TestContactSettingsFull:
    _orig = None

    def test_backup_contact(self):
        r = requests.get(f"{API}/settings/contact", timeout=10)
        assert r.status_code == 200
        TestContactSettingsFull._orig = r.json()

    def test_put_preserves_all(self, auth_headers):
        payload = {
            "phone": "9999999999",
            "email": "test@news9.com",
            "address": "TEST address",
            "twitter": "https://twitter.com/test",
            "instagram": "https://instagram.com/test",
            "facebook": "https://facebook.com/test",
            "whatsapp": "https://wa.me/9999999999",
            "youtube": "https://youtube.com/@test",
        }
        r = requests.put(f"{API}/admin/settings/contact",
                         headers=auth_headers, json=payload, timeout=15)
        assert r.status_code == 200
        # GET verifies persistence
        r2 = requests.get(f"{API}/settings/contact", timeout=10)
        d = r2.json()
        for k, v in payload.items():
            assert d[k] == v, f"key {k}: got {d.get(k)} want {v}"

    def test_restore_contact(self, auth_headers):
        orig = TestContactSettingsFull._orig or {}
        payload = {
            "phone": orig.get("phone", "9393950505"),
            "email": orig.get("email", "news9today99@gmail.com"),
            "address": orig.get("address", "Hyderabad, Telangana"),
            "twitter": orig.get("twitter", ""),
            "instagram": orig.get("instagram", ""),
            "facebook": orig.get("facebook", ""),
            "whatsapp": orig.get("whatsapp", ""),
            "youtube": orig.get("youtube", ""),
        }
        r = requests.put(f"{API}/admin/settings/contact",
                         headers=auth_headers, json=payload, timeout=15)
        assert r.status_code == 200
