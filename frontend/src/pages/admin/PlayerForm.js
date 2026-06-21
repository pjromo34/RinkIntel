import React, { useState } from "react";

export default function PlayerForm({ initial = {}, onSaved }) {
  const [player_name, setPlayerName] = useState(initial.player_name || "");
  const [team, setTeam] = useState(initial.team || "");
  const [position, setPosition] = useState(initial.position || "");
  const [contract_years_remaining, setContractYearsRemaining] = useState(initial.contract_years_remaining || 0);
  const [contract_start_season, setContractStartSeason] = useState(initial.contract_start_season || "");

  async function handleSubmit(e) {
    e.preventDefault();

    const payload = {
      player_name,
      team,
      position,
      contract_years_remaining: Number(contract_years_remaining) || 0,
      contract_start_season: contract_start_season || null,
    };

    const method = initial.id ? "PUT" : "POST";
    const url = initial.id
      ? `http://127.0.0.1:8000/admin/players/${initial.id}`
      : `http://127.0.0.1:8000/admin/players`;

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok && onSaved) onSaved();
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <input
        placeholder="Player Name"
        value={player_name}
        onChange={e => setPlayerName(e.target.value)}
      />
      <input
        placeholder="Team"
        value={team}
        onChange={e => setTeam(e.target.value)}
      />
      <input
        placeholder="Position"
        value={position}
        onChange={e => setPosition(e.target.value)}
      />
      <input
        type="number"
        min="0"
        placeholder="Contract Years Remaining"
        value={contract_years_remaining}
        onChange={e => setContractYearsRemaining(e.target.value)}
      />
      <input
        placeholder="Contract Start Season (e.g. 2026-27)"
        value={contract_start_season}
        onChange={e => setContractStartSeason(e.target.value)}
      />

      <button type="submit" style={{ padding: "8px 12px", fontWeight: 700 }}>
        {initial.id ? "Update Player" : "Create Player"}
      </button>
    </form>
  );
}
