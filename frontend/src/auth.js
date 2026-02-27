export const API_BASE = "http://localhost:3001";

export function getToken() {
  return localStorage.getItem("token") || null;
}

export function setToken(token) {
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
}

export async function fetchMe(token) {
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("me_failed");
  const data = await res.json();
  return data?.user || null; // {id,email,role,name,...}
}