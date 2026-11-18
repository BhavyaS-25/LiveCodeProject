export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly data?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

export function getToken() {
  return typeof window === "undefined" ? null : window.localStorage.getItem("token");
}

export function setToken(token: string) {
  window.localStorage.setItem("token", token);
}

export function clearToken() {
  window.localStorage.removeItem("token");
}

function messageFrom(body: unknown, fallback: string) {
  if (typeof body === "object" && body !== null) {
    const value = (body as { detail?: unknown; message?: unknown }).detail ??
      (body as { message?: unknown }).message;
    if (typeof value === "string") return value;
  }
  return fallback;
}

export async function apiRequest<T>(
  pathname: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${pathname}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "Could not reach the server. Check your connection and try again.");
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, messageFrom(body, `Request failed (${response.status}).`), body);
  }
  return body as T;
}

export function websocketUrl(pathname: string) {
  const url = new URL(API_BASE);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/$/, "")}${pathname}`;
  url.search = "";
  return url.toString();
}

export function isValidUsername(value: string) {
  return /^[A-Za-z0-9_-]{3,32}$/.test(value);
}

export function isValidName(value: string, label: "project" | "file") {
  const name = value.trim();
  if (!name || name.length > 120) return false;
  return label === "project" || (!/[\\/]/.test(name) && name !== "." && name !== "..");
}
