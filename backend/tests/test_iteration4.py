"""
Backend tests — Iteration 4 additions:
- Theme settings (GET/PUT roundtrip)
- Flash config (category filters, use_featured_only)
- Contact social links
- Regions list + geo detect-region
- News region filter + source filter
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
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ---------- THEME ----------
class TestTheme:
    _original = None

    def test_get_default_theme(self):
        r = requests.get(f"{API}/settings/theme", timeout=10)
        assert r.status_code == 200
        d = r.json()
        for k in ("primary_color", "secondary_color", "accent_color",
                  "logo_url", "site_name_te", "site_name_en",
                  "tagline_te", "tagline_en"):
            assert k in d, f"missing key {k}"
        assert d["primary_color"].startswith("#")
        TestTheme._original = d

    def test_put_theme_requires_auth(self):
        r = requests.put(f"{API}/admin/settings/theme",
                         json={"primary_color": "#123456"}, timeout=10)
        assert r.status_code == 401

    def test_put_theme_roundtrip(self, auth_headers):
        new_theme = {
            "primary_color": "#009688",
            "secondary_color": "#3F51B5",
            "accent_color": "#FF9800",
            "logo_url": "/test-logo.png",
            "tagline_te": "TEST_టెస్ట్",
            "tagline_en": "TEST_Tagline",
            "site_name_te": "TEST_సైట్",
            "site_name_en": "TEST_Site",
        }
        r = requests.put(f"{API}/admin/settings/theme", headers=auth_headers,
                         json=new_theme, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for k, v in new_theme.items():
            assert d[k] == v, f"key {k}: got {d[k]} want {v}"
        # Verify via GET
        r2 = requests.get(f"{API}/settings/theme", timeout=10)
        d2 = r2.json()
        assert d2["primary_color"] == "#009688"
        assert d2["site_name_en"] == "TEST_Site"

    def test_restore_theme(self, auth_headers):
        # Restore original or defaults
        restore = TestTheme._original or {
            "primary_color": "#E11D2E", "secondary_color": "#1E4B9C",
            "accent_color": "#0F2A5C", "logo_url": "/logo.png",
            "tagline_te": "నమ్మకమైన తెలుగు వార్తలు · 24×7",
            "tagline_en": "Trusted Telugu News · 24×7",
            "site_name_te": "న్యూస్ 9 టుడే", "site_name_en": "News 9 Today",
        }
        # Ensure clean colors even if module fetched a stale state
        restore["primary_color"] = "#E11D2E"
        restore["secondary_color"] = "#1E4B9C"
        restore["accent_color"] = "#0F2A5C"
        restore["site_name_en"] = "News 9 Today"
        restore["site_name_te"] = "న్యూస్ 9 టుడే"
        restore["tagline_te"] = "నమ్మకమైన తెలుగు వార్తలు · 24×7"
        restore["tagline_en"] = "Trusted Telugu News · 24×7"
        restore["logo_url"] = "/logo.png"
        r = requests.put(f"{API}/admin/settings/theme", headers=auth_headers,
                         json=restore, timeout=15)
        assert r.status_code == 200
        r2 = requests.get(f"{API}/settings/theme", timeout=10)
        assert r2.json()["primary_color"] == "#E11D2E"


# ---------- FLASH CONFIG ----------
class TestFlashConfig:
    _original = None

    def test_get_default_flash_config(self):
        r = requests.get(f"{API}/settings/flash-config", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "category_slugs" in d
        assert "use_featured_only" in d
        assert isinstance(d["category_slugs"], list)
        assert isinstance(d["use_featured_only"], bool)
        TestFlashConfig._original = d

    def test_put_flash_config_requires_auth(self):
        r = requests.put(f"{API}/admin/settings/flash-config",
                         json={"category_slugs": ["politics"]}, timeout=10)
        assert r.status_code == 401

    def test_put_flash_config_and_news_filter(self, auth_headers):
        # Set to politics + sports only
        payload = {"category_slugs": ["politics", "sports"], "use_featured_only": False}
        r = requests.put(f"{API}/admin/settings/flash-config",
                         headers=auth_headers, json=payload, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert set(d["category_slugs"]) == {"politics", "sports"}
        assert d["use_featured_only"] is False

        # Now GET /api/news?flash=true should only include politics/sports flash items
        r2 = requests.get(f"{API}/news?flash=true&limit=50", timeout=10)
        assert r2.status_code == 200
        items = r2.json()["items"]
        for it in items:
            assert it["category"] in ("politics", "sports"), \
                f"item {it['id']} has category {it['category']}"
            assert it["is_flash"] is True

    def test_use_featured_only_switch(self, auth_headers):
        # Enable use_featured_only with no category restriction
        payload = {"category_slugs": [], "use_featured_only": True}
        r = requests.put(f"{API}/admin/settings/flash-config",
                         headers=auth_headers, json=payload, timeout=15)
        assert r.status_code == 200
        r2 = requests.get(f"{API}/news?flash=true&limit=50", timeout=10)
        assert r2.status_code == 200
        for it in r2.json()["items"]:
            assert it["is_featured"] is True, \
                f"expected featured items; got {it['id']} featured={it['is_featured']}"

    def test_restore_flash_config(self, auth_headers):
        restore = TestFlashConfig._original or {"category_slugs": [], "use_featured_only": False}
        # Ensure empty defaults
        restore["category_slugs"] = []
        restore["use_featured_only"] = False
        r = requests.put(f"{API}/admin/settings/flash-config",
                         headers=auth_headers, json=restore, timeout=15)
        assert r.status_code == 200
        r2 = requests.get(f"{API}/settings/flash-config", timeout=10)
        assert r2.json()["category_slugs"] == []
        assert r2.json()["use_featured_only"] is False


# ---------- CONTACT WITH SOCIAL LINKS ----------
class TestContactSocial:
    _original = None

    def test_get_contact_has_social_fields(self):
        r = requests.get(f"{API}/settings/contact", timeout=10)
        assert r.status_code == 200
        d = r.json()
        for k in ("phone", "email", "twitter", "instagram",
                  "facebook", "whatsapp", "youtube"):
            assert k in d, f"missing key {k}"
        TestContactSocial._original = d

    def test_put_contact_preserves_socials(self, auth_headers):
        payload = {
            "phone": TestContactSocial._original.get("phone", "9393950505"),
            "email": TestContactSocial._original.get("email", "news9today99@gmail.com"),
            "address": TestContactSocial._original.get("address", ""),
            "twitter": "https://twitter.com/news9today",
            "instagram": "https://instagram.com/news9today",
            "facebook": "https://facebook.com/news9today",
            "whatsapp": "https://wa.me/919393950505",
            "youtube": "https://youtube.com/@news9today",
        }
        r = requests.put(f"{API}/admin/settings/contact",
                         headers=auth_headers, json=payload, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["twitter"] == "https://twitter.com/news9today"
        assert d["youtube"] == "https://youtube.com/@news9today"
        # Verify via GET
        r2 = requests.get(f"{API}/settings/contact", timeout=10)
        d2 = r2.json()
        assert d2["twitter"] == "https://twitter.com/news9today"
        assert d2["instagram"] == "https://instagram.com/news9today"

    def test_restore_contact(self, auth_headers):
        orig = TestContactSocial._original or {}
        restore = {
            "phone": orig.get("phone", "9393950505"),
            "email": orig.get("email", "news9today99@gmail.com"),
            "address": orig.get("address", "Hyderabad, Telangana"),
            "twitter": "", "instagram": "", "facebook": "",
            "whatsapp": "", "youtube": "",
        }
        r = requests.put(f"{API}/admin/settings/contact",
                         headers=auth_headers, json=restore, timeout=15)
        assert r.status_code == 200


# ---------- REGIONS ----------
class TestRegions:
    def test_list_regions(self):
        r = requests.get(f"{API}/regions", timeout=10)
        assert r.status_code == 200
        regions = r.json()
        assert isinstance(regions, list)
        assert len(regions) == 5
        slugs = {r["slug"] for r in regions}
        assert slugs == {"national", "telangana", "andhra_pradesh",
                         "karnataka", "tamil_nadu"}
        # Each region has required fields
        for reg in regions:
            assert "slug" in reg
            assert "name_en" in reg
            assert "name_te" in reg
            assert "bbox" in reg
            if reg["slug"] != "national":
                assert isinstance(reg["bbox"], list)
                assert len(reg["bbox"]) == 4

    def test_detect_region_hyderabad_telangana(self):
        r = requests.get(f"{API}/geo/detect-region?lat=17.38&lon=78.48", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["region"] == "telangana"

    def test_detect_region_chennai_tamil_nadu(self):
        r = requests.get(f"{API}/geo/detect-region?lat=13.08&lon=80.27", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["region"] == "tamil_nadu"

    def test_detect_region_delhi_national(self):
        r = requests.get(f"{API}/geo/detect-region?lat=28.6&lon=77.2", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["region"] == "national"


# ---------- NEWS REGION FILTER + SOURCE ----------
class TestNewsRegion:
    _created_ap = None
    _created_ka = None

    def test_create_articles_by_region(self, auth_headers):
        # Create AP-region article
        ap_payload = {
            "title": "TEST_AP_REGION_ARTICLE",
            "summary": "TEST", "body": "<p>ap body</p>",
            "category": "politics", "region": "andhra_pradesh",
            "is_published": True,
        }
        r = requests.post(f"{API}/admin/news",
                          headers=auth_headers, json=ap_payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["region"] == "andhra_pradesh"
        TestNewsRegion._created_ap = d["id"]

        # Create KA-region article
        ka_payload = {
            "title": "TEST_KA_REGION_ARTICLE",
            "summary": "TEST", "body": "<p>ka body</p>",
            "category": "politics", "region": "karnataka",
            "is_published": True,
        }
        r2 = requests.post(f"{API}/admin/news",
                           headers=auth_headers, json=ka_payload, timeout=15)
        assert r2.status_code == 200
        TestNewsRegion._created_ka = r2.json()["id"]

    def test_filter_news_by_region_ap(self):
        r = requests.get(f"{API}/news?region=andhra_pradesh&limit=100", timeout=10)
        assert r.status_code == 200
        items = r.json()["items"]
        ids = {it["id"] for it in items}
        assert TestNewsRegion._created_ap in ids
        assert TestNewsRegion._created_ka not in ids
        # All items should be andhra_pradesh, national, or missing region
        for it in items:
            reg = it.get("region")
            assert reg in ("andhra_pradesh", "national", None), \
                f"unexpected region {reg} for id {it['id']}"

    def test_filter_news_by_region_ka_excludes_ap(self):
        r = requests.get(f"{API}/news?region=karnataka&limit=100", timeout=10)
        assert r.status_code == 200
        items = r.json()["items"]
        ids = {it["id"] for it in items}
        assert TestNewsRegion._created_ka in ids
        assert TestNewsRegion._created_ap not in ids

    def test_filter_news_by_region_telangana(self):
        # Should include national/missing region seed articles at minimum
        r = requests.get(f"{API}/news?region=telangana&limit=100", timeout=10)
        assert r.status_code == 200
        items = r.json()["items"]
        # created AP/KA articles should NOT appear
        ids = {it["id"] for it in items}
        assert TestNewsRegion._created_ap not in ids
        assert TestNewsRegion._created_ka not in ids

    def test_news_source_filter(self):
        # Just ensure the endpoint accepts source param and returns 200
        r = requests.get(f"{API}/news?source=youtube&limit=20", timeout=10)
        assert r.status_code == 200
        items = r.json()["items"]
        for it in items:
            assert it.get("source") == "youtube" or it.get("source") is None or "source" not in it \
                or it.get("source") == "youtube"

    def test_cleanup(self, auth_headers):
        for nid in (TestNewsRegion._created_ap, TestNewsRegion._created_ka):
            if nid:
                requests.delete(f"{API}/admin/news/{nid}",
                                headers=auth_headers, timeout=10)
