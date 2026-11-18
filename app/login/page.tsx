"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, isValidUsername, setToken } from "../../lib/api";

type AuthResponse = { access_token: string; token_type: string };

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedUsername = username.trim();
    if (!isValidUsername(trimmedUsername) || !password) {
      setError("Enter a valid username and password.");
      return;
    }
    setError(null); setLoading(true);
    try {
      const body = new URLSearchParams({ username: trimmedUsername, password });
      const data = await apiRequest<AuthResponse>("/auth/login", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
      if (!data.access_token) throw new Error("The server did not return a sign-in token.");
      setToken(data.access_token);
      router.replace("/projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally { setLoading(false); }
  }

  return <div className="auth-container"><div className="auth-card">
    <h1 className="auth-title">Welcome Back</h1>
    <form onSubmit={login}>
      <input className="auth-input" aria-label="Username" autoComplete="username" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} disabled={loading} />
      <input className="auth-input" aria-label="Password" autoComplete="current-password" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="auth-button" type="submit" disabled={loading}>{loading ? "Logging in..." : "Login"}</button>
    </form>
    <p className="notice">Need an account? <button type="button" onClick={() => router.push("/")}>Register</button></p>
  </div></div>;
}
