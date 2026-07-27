import axios from "axios";

// Safely resolve backend URL. On local/self-hosted same-origin builds where
// REACT_APP_BACKEND_URL is not provided at build time, fall back to a relative
// "/api" so requests hit the reverse-proxied FastAPI on the same origin
// instead of resolving against the current route (e.g. /admin/undefined/api/...).
const RAW_BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const HAS_BACKEND_URL =
  typeof RAW_BACKEND_URL === "string" &&
  RAW_BACKEND_URL.trim() !== "" &&
  RAW_BACKEND_URL !== "undefined" &&
  RAW_BACKEND_URL !== "null";

export const BACKEND_URL = HAS_BACKEND_URL ? RAW_BACKEND_URL.replace(/\/$/, "") : "";
export const API = HAS_BACKEND_URL ? `${BACKEND_URL}/api` : "/api";

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    localStorage.setItem("news_admin_token", token);
  } else {
    delete api.defaults.headers.common["Authorization"];
    localStorage.removeItem("news_admin_token");
  }
}

// Restore token on load
const saved = typeof window !== "undefined" ? localStorage.getItem("news_admin_token") : null;
if (saved) {
  api.defaults.headers.common["Authorization"] = `Bearer ${saved}`;
}

export function resolveImageUrl(url) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  if (!BACKEND_URL) return url; // same-origin: return as-is (leading slash preserved)
  return `${BACKEND_URL}${url}`;
}

export function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}
