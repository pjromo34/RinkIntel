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
  "Utah Mammoth", "Vancouver Canucks", "Vegas Golden Knights",
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
  const [contracts, setContracts] = useState([]);

  useEffect(() => {
    fetch(`${API}/players/${id}`)
      .then(res => res.json())
      .then(data => {
        setPlayer(data);
        setContracts(Array.isArray(data.contracts) ? data.contracts : []);
        setLoading(false);
      });
  }, [id]);

  function update(field, value) {
    setPlayer(p => ({ ...p, [field]: value }));
  }

  function authHeaders(extra = {}) {
    const token = localStorage.getItem("token");
    return token
      ? { ...extra, Authorization: `Bearer ${token}` }
      : extra;
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
      aav: player.aav,
      contract_years_remaining: Number(player.contract_years_remaining) || 0,
      contract_start_season: player.contract_start_season || null,
      contracts,
    };

    const res = await fetch(`${API}/admin/players/${id}`, {
      method: "PATCH",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload)
    });

    setSaving(false);

    if (res.ok) navigate("/admin/players");
    else {
      const txt = await res.text();
      alert(`Save failed: ${txt || res.status}`);
    }
  }

  async function uploadHeadshot(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API}/admin/players/${id}/headshot`, {
      method: "POST",
      headers: authHeaders(),
      body: formData
    });

    setUploading(false);

    if (res.ok) {
      const data = await res.json();
      setPlayer(p => ({ ...p, headshot_url: data.headshot_url || data.uploaded_headshot_url || p.headshot_url }));
    } else {
      const txt = await res.text();
      alert(`Upload failed: ${txt || res.status}`);
    }
  }

  if (loading || !player) return <div style={{ padding: 40 }}>Loading…</div>;

  function updateContract(index, field, value) {
    setContracts(prev => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  }

  function addContract() {
    setContracts(prev => [...prev, { start_season: "", years: 1, aav: Number(player.aav) || 0, bonus_eligible: false, bonus_amount: 0 }]);
  }

  function removeContract(index) {
    setContracts(prev => prev.filter((_, i) => i !== index));
  }

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
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
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

          <div>
            <label>Contract Years Remaining</label>
            <input
              type="number"
              min="0"
              value={player.contract_years_remaining ?? 0}
              onChange={e => update("contract_years_remaining", Number(e.target.value))}
              style={{ width: "100%", padding: 8 }}
            />
          </div>

          <div>
            <label>Contract Start Season</label>
            <input
              type="text"
              placeholder="2026-27"
              value={player.contract_start_season || ""}
              onChange={e => update("contract_start_season", e.target.value)}
              style={{ width: "100%", padding: 8 }}
            />
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

        <div className="glass" style={{ padding: 18, marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Contracts</h3>
            <button
              type="button"
              onClick={addContract}
              style={{ padding: "6px 10px", background: "rgba(255,255,255,0.14)", border: "none", borderRadius: 6, color: "#fff", cursor: "pointer" }}
            >
              + Add Contract
            </button>
          </div>

          {contracts.length === 0 && (
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 13 }}>
              No contracts configured. Add one or more contracts by start season.
            </div>
          )}

          {contracts.map((c, idx) => (
            <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr auto", gap: 10, marginBottom: 10 }}>
              <input
                type="text"
                placeholder="Start season (e.g. 2026-27)"
                value={c.start_season || ""}
                onChange={e => updateContract(idx, "start_season", e.target.value)}
                style={{ width: "100%", padding: 8 }}
              />
              <input
                type="number"
                min="1"
                placeholder="Years"
                value={c.years ?? 1}
                onChange={e => updateContract(idx, "years", Number(e.target.value) || 1)}
                style={{ width: "100%", padding: 8 }}
              />
              <input
                type="number"
                min="0"
                placeholder="AAV"
                value={c.aav ?? 0}
                onChange={e => updateContract(idx, "aav", Number(e.target.value) || 0)}
                style={{ width: "100%", padding: 8 }}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={Boolean(c.bonus_eligible)}
                  onChange={e => updateContract(idx, "bonus_eligible", e.target.checked)}
                />
                Bonus Eligible
              </label>
              <input
                type="number"
                min="0"
                placeholder="Bonus Amount"
                value={c.bonus_amount ?? 0}
                onChange={e => updateContract(idx, "bonus_amount", Number(e.target.value) || 0)}
                style={{ width: "100%", padding: 8 }}
                disabled={!c.bonus_eligible}
              />
              <button
                type="button"
                onClick={() => removeContract(idx)}
                style={{ padding: "8px 10px", background: "#b91c1c", border: "none", color: "#fff", borderRadius: 6, cursor: "pointer" }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
