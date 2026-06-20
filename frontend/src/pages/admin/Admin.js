import React from "react";
import { Link, Routes, Route, Navigate } from "react-router-dom";
import Login from "./Login";
import ArticlesAdmin from "./ArticlesAdmin";
import PlayersAdmin from "./PlayersAdmin";
import PlayerEditor from "./PlayerEditor";
import AdminIndicator from "../../components/AdminIndicator";

export default function Admin() {
  const tabs = [
    { to: "/admin/login", label: "Login" },
    { to: "/admin/articles", label: "Articles" },
    { to: "/admin/players", label: "Players" }
  ];

  return (
    <div style={{ padding: 24 }}>
      <AdminIndicator />

      <h1 style={{ marginBottom: 12 }}>Admin</h1>

      <div style={{ display: "flex", gap: 12, borderBottom: "1px solid #e6e6e6", paddingBottom: 8 }}>
        {tabs.map(t => (
          <Link key={t.to} to={t.to} style={{ textDecoration: "none", padding: 8 }}>
            <div style={{ fontWeight: 700 }}>{t.label}</div>
          </Link>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        <Routes>
          <Route path="/" element={<Navigate to="login" replace />} />
          <Route path="login" element={<Login />} />
          <Route path="articles" element={<ArticlesAdmin />} />
          <Route path="players" element={<PlayersAdmin />} />
          <Route path="players/:id" element={<PlayerEditor />} />
        </Routes>
      </div>
    </div>
  );
}
