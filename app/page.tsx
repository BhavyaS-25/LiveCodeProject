"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Home() {
  const router = useRouter();

  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

    async function register(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const res = await fetch("http://localhost:8000/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      setError("Registration failed");
      return;
    }

    const data = await res.json();
    localStorage.setItem("token", data.access_token);
    router.push("/projects");
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className = "auth-title">CodeCollab</h1>

        <div className="auth-tabs">
          <button
            className="secondary"
            onClick={() => router.push("/login")}
          >
            Login
          </button>
          <button
            className="primary"
          >
            Register
          </button>
        </div>

        <form onSubmit={register} className="auth-form">
          <input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button type="submit" className="auth-submit">
            Create Account
          </button>
        </form>
      </div>
    </div>
  );
}
