// frontend/src/lib/api.js
const BASE = "http://localhost:3001";

export function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
}

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  // 401: token geçersiz/süresi doldu → temizle
  if (res.status === 401) {
    clearAuth();
  }

  // JSON parse güvenli
  const data = await res.json().catch(() => ({}));
  return { res, data };
}