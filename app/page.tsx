"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiRequest, isValidUsername, setToken } from "../lib/api";

type AuthResponse = { access_token: string; token_type: string };

export default function Home() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedUsername = username.trim();
    if (!isValidUsername(trimmedUsername)) {
      setError("Username must be 3-32 letters, numbers, hyphens, or underscores.");
      return;
    }
    if (!password) {
      setError("Enter a password.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const data = await apiRequest<AuthResponse>("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmedUsername, password }),
      });
      if (!data.access_token) throw new Error("The server did not return a sign-in token.");
      setToken(data.access_token);
      router.replace("/projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return <div className="auth-container"><div className="auth-card">
    <h1 className="auth-title">CodeCollab</h1>
    <div className="auth-tabs"><button type="button" className="secondary" onClick={() => router.push("/login")}>Login</button><button type="button" className="primary">Register</button></div>
    <form onSubmit={register} className="auth-form">
      <input aria-label="Username" autoComplete="username" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} disabled={loading} />
      <input aria-label="Password" autoComplete="new-password" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button type="submit" className="auth-submit" disabled={loading}>{loading ? "Creating account..." : "Create Account"}</button>
    </form>
  </div></div>;
}
