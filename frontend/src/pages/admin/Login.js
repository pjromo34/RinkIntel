import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const API = "http://127.0.0.1:8000";

export default function Login() {
  const [username, setUsername] = useState("admin@rinkintel.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    // Read from FormData to support password-manager autofill that can bypass React state updates.
    const submittedUsername = String(formData.get("username") || username || "").trim();
    const submittedPassword = String(formData.get("password") || password || "");

    if (!submittedUsername || !submittedPassword) {
      setError("Please enter both username and password.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: submittedUsername, password: submittedPassword })
      });

      if (!res.ok) {
        let message = `Login failed (${res.status})`;
        try {
          const payload = await res.json();
          message = payload?.detail || message;
        } catch {
          const txt = await res.text();
          if (txt) message = txt;
        }
        setError(message);
        setLoading(false);
        return;
      }

      const data = await res.json();
      localStorage.setItem("token", data.access_token);
      window.dispatchEvent(new Event("rinkintel-auth-changed"));
      navigate("/admin/articles");
    } catch (err) {
      setError("Network error");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 40, maxWidth: 520 }}>
      <div className="glass" style={{ padding: 28 }}>
        <h2 style={{ marginBottom: 18 }}>Admin Login</h2>

        <form onSubmit={submit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", marginBottom: 6 }}>Username</label>
            <input
              name="username"
              autoComplete="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              style={{ width: "100%", padding: 10 }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", marginBottom: 6 }}>Password</label>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ width: "100%", padding: 10 }}
            />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="submit"
              disabled={loading}
              style={{ padding: "10px 14px", background: "#ffd700", border: "none", fontWeight: 700, opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Logging in..." : "Login"}
            </button>

            <button
              type="button"
              onClick={() => { setUsername("admin@rinkintel.com"); setPassword(""); }}
              style={{ padding: "10px 14px" }}
            >
              Reset
            </button>
          </div>

          {error && <div style={{ color: "red", marginTop: 12 }}>{error}</div>}
        </form>
      </div>
    </div>
  );
}
