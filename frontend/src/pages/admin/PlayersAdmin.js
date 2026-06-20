// src/pages/admin/PlayersAdmin.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminIndicator from "../../components/AdminIndicator";
import PlayerForm from "./PlayerForm";

const API = "http://127.0.0.1:8000";

function authHeaders() {
  const token = localStorage.getItem("token");
  return token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { "Content-Type": "application/json" };
}

export default function PlayersAdmin() {
  const navigate = useNavigate();

  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Load all players
  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/players`, { headers: authHeaders() });
      const data = await res.json();
      setPlayers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Derive display name that works with both `name` and `player_name`
  function getDisplayName(p) {
    return p.player_name || p.name || "";
  }

  // Only show results when something is typed
  const trimmedSearch = search.trim().toLowerCase();
  const filteredPlayers =
    trimmedSearch === ""
      ? []
      : players.filter(p =>
          getDisplayName(p).toLowerCase().includes(trimmedSearch)
        );

  async function remove(id) {
    if (!window.confirm("Delete player?")) return;
    await fetch(`${API}/admin/players/${id}`, {
      method: "DELETE",
      headers: authHeaders()
    });
    load();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <AdminIndicator />

      {/* CREATE PLAYER */}
      <div className="glass" style={{ padding: 16 }}>
        <h3 style={{ marginBottom: 12 }}>Create Player</h3>
        <PlayerForm
          onSaved={() => {
            load();
          }}
        />
      </div>

      {/* FIND PLAYER */}
      <div className="glass" style={{ padding: 16 }}>
        <h3 style={{ marginBottom: 12 }}>Find Player</h3>

        <input
          placeholder="Search by name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 12 }}
        />

        {loading && <div>Loading…</div>}

        {trimmedSearch === "" && !loading && (
          <div style={{ color: "#666" }}>Type a name to search.</div>
        )}

        {trimmedSearch !== "" &&
          filteredPlayers.map(p => {
            const displayName = getDisplayName(p);
            return (
              <div
                key={p.id}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: "rgba(0,0,0,0.04)",
                  marginBottom: 8,
                  cursor: "pointer"
                }}
                onClick={() => navigate(`/admin/players/${p.id}`)}
              >
                <div style={{ fontWeight: 700 }}>
                  {displayName || "(no name)"}
                </div>
                <div style={{ color: "#666", fontSize: 13 }}>
                  {(p.team || "—") + " • " + (p.position || "—")}
                </div>

                <button
                  onClick={e => {
                    e.stopPropagation();
                    remove(p.id);
                  }}
                  style={{
                    marginTop: 6,
                    padding: "4px 8px",
                    background: "#b91c1c",
                    color: "white",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer"
                  }}
                >
                  Delete
                </button>
              </div>
            );
          })}

        {trimmedSearch !== "" &&
          !loading &&
          filteredPlayers.length === 0 && (
            <div style={{ color: "#666" }}>No matching players.</div>
          )}
      </div>
    </div>
  );
}
