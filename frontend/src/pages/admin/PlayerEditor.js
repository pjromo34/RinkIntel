// src/pages/admin/PlayerEditor.js

import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

const API = "http://127.0.0.1:8000";

const TEAMS = [
  "Anaheim Ducks", "Arizona Coyotes", "Boston Bruins", "Buffalo Sabres",
  "Calgary Flames", "Carolina Hurricanes", "Chicago Blackhawks",
  "Colorado Avalanche", "Columbus Blue Jackets", "Dallas Stars",
  "Detroit Red Wings", "Edmonton Oilers", "Florida Panthers",
  "Los Angeles Kings", "Minnesota Wild", "Montreal Canadiens",
  "Nashville Predators", "New Jersey Devils", "New York Islanders",
  "New York Rangers", "Ottawa Senators", "Philadelphia Flyers",
  "Pittsburgh Penguins", "San Jose Sharks", "Seattle Kraken",
  "St. Louis Blues", "Tampa Bay Lightning", "Toronto Maple Leafs",
  "Utah Hockey Club", "Vancouver Canucks", "Vegas Golden Knights",
  "Washington Capitals", "Winnipeg Jets"
];

const POSITIONS = ["W", "C", "D"];

function formatMoney(val) {
  return "$" + Number(val || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export default function PlayerEditor() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch(`${API}/players/${id}`)
      .then(res => res.json())
      .then(data => {
        setPlayer(data);
        setLoading(false);
      });
  }, [id]);

  function update(field, value) {
    setPlayer(p => ({ ...p, [field]: value }));
  }

  async function save() {
    setSaving(true);

    const payload = {
      player_name: player.player_name,
      team: player.team,
      position: player.position,
      goals: player.goals,
      assists: player.assists,
      points: player.points,
      xg_all_situations: player.xg_all_situations,
      icetime: player.icetime,
      aav: player.aav
    };

    const res = await fetch(`${API}/admin/players/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    setSaving(false);

    if (res.ok) navigate("/admin/players");
    else alert("Save failed");
  }

  async function uploadHeadshot(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API}/admin/players/${id}/headshot`, {
      method: "POST",
      body: formData
    });

    setUploading(false);

    if (res.ok) {
      const data = await res.json();
      setPlayer(p => ({ ...p, headshot_url: data.headshot_url }));
    } else {
      alert("Upload failed");
    }
  }

  if (loading || !player) return <div style={{ padding: 40 }}>Loading…</div>;

  return (
    <div style={{ padding: "32px 40px" }}>
      <button
        onClick={() => navigate("/admin/players")}
        style={{
          background: "rgba(255,255,255,0.1)",
          border: "none",
          color: "#fff",
          padding: "8px 16px",
          borderRadius: "8px",
          fontWeight: 600,
          marginBottom: "24px",
          cursor: "pointer"
        }}
      >
        ← Back to Players
      </button>

      <div className="glass" style={{ padding: 32 }}>
        <div style={{ display: "flex", gap: 24 }}>
          <div>
            {player.headshot_url ? (
              <img
                src={player.headshot_url}
                alt={player.player_name}
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "3px solid rgba(255,255,255,0.2)"
                }}
              />
            ) : (
              <div
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "2rem"
                }}
              >
                {player.player_name[0]}
              </div>
            )}

            <input type="file" accept="image/*" onChange={uploadHeadshot} />
            {uploading && <div style={{ fontSize: 12 }}>Uploading…</div>}
          </div>

          <div style={{ flex: 1 }}>
            <label>Player Name</label>
            <input
              value={player.player_name}
              onChange={e => update("player_name", e.target.value)}
              style={{ width: "100%", padding: 8, marginBottom: 12 }}
            />

            <label>Team</label>
            <select
              value={player.team || ""}
              onChange={e => update("team", e.target.value)}
              style={{ width: "100%", padding: 8, marginBottom: 12 }}
            >
              <option value="">Select team…</option>
              {TEAMS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            <label>Position</label>
            <select
              value={player.position || ""}
              onChange={e => update("position", e.target.value)}
              style={{ width: "100%", padding: 8 }}
            >
              <option value="">Select position…</option>
              {POSITIONS.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
            marginTop: 32
          }}
        >
          <div>
            <label>Goals</label>
            <input
              type="number"
              value={player.goals}
              onChange={e => update("goals", Number(e.target.value))}
              style={{ width: "100%", padding: 8 }}
            />
          </div>

          <div>
            <label>Assists</label>
            <input
              type="number"
              value={player.assists}
              onChange={e => update("assists", Number(e.target.value))}
              style={{ width: "100%", padding: 8 }}
            />
          </div>

          <div>
            <label>Points</label>
            <input
              type="number"
              value={player.points}
              onChange={e => update("points", Number(e.target.value))}
              style={{ width: "100%", padding: 8 }}
            />
          </div>

          <div>
            <label>xG (all situations)</label>
            <input
              type="number"
              step="0.01"
              value={player.xg_all_situations}
              onChange={e => update("xg_all_situations", Number(e.target.value))}
              style={{ width: "100%", padding: 8 }}
            />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginTop: 32
          }}
        >
          <div>
            <label>AAV</label>
            <input
              type="number"
              value={player.aav}
              onChange={e => update("aav", Number(e.target.value))}
              style={{ width: "100%", padding: 8 }}
            />
          </div>

          <div>
            <label>Market Value (read‑only)</label>
            <div style={{ padding: 8, fontWeight: 700 }}>
              {formatMoney(player.market_value)}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 32, display: "flex", gap: 12 }}>
          <button
            onClick={save}
            disabled={saving}
            style={{
              padding: "10px 16px",
              background: "#ffd700",
              border: "none",
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>

          <button
            onClick={() => navigate("/admin/players")}
            style={{
              padding: "10px 16px",
              background: "rgba(255,255,255,0.1)",
              border: "none",
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
