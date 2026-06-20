import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const API = "http://127.0.0.1:8000";

export default function Login() {
  const [username, setUsername] = useState("admin@rinkintel.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) {
        const txt = await res.text();
        setError("Login failed: " + (txt || res.status));
        return;
      }

      const data = await res.json();
      localStorage.setItem("token", data.access_token);
      navigate("/admin/articles");
    } catch (err) {
      setError("Network error");
      console.error(err);
    }
  }

  return (
    <div style={{ padding: 40, maxWidth: 520 }}>
      <div className="glass" style={{ padding: 28 }}>
        <h2 style={{ marginBottom: 18 }}>Admin Login</h2>

        <form onSubmit={submit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", marginBottom: 6 }}>Username</label>
            <input value={username} onChange={e => setUsername(e.target.value)} style={{ width: "100%", padding: 10 }} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", marginBottom: 6 }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: "100%", padding: 10 }} />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" style={{ padding: "10px 14px", background: "#ffd700", border: "none", fontWeight: 700 }}>
              Login
            </button>

            <button type="button" onClick={() => { setUsername("admin@rinkintel.com"); setPassword(""); }} style={{ padding: "10px 14px" }}>
              Reset
            </button>
          </div>

          {error && <div style={{ color: "red", marginTop: 12 }}>{error}</div>}
        </form>
      </div>
    </div>
  );
}
