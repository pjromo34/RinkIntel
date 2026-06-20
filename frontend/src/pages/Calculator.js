import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = 'http://127.0.0.1:8000';

function formatMoney(val) {
  return '$' + Number(val).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export default function Calculator() {
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected, setSelected] = useState(null);
  const [goals, setGoals] = useState('');
  const [assists, setAssists] = useState('');
  const [gamesPlayed, setGamesPlayed] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.get(`${API}/players`).then(res => setPlayers(res.data));
  }, []);

  // FIXED: use p.name instead of p.player_name
  const filtered = players
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 8);

  function handleSelect(player) {
    setSelected(player);
    setSearch(player.name); // FIXED
    setShowDropdown(false);
    setGoals(player.goals || '');
    setAssists(player.assists || '');
    setGamesPlayed(player.games_played || '');
  }

  async function handleSubmit() {
    if (!selected) return;
    setLoading(true);

    try {
      const gp = parseFloat(gamesPlayed) || 82;
      const g = parseFloat(goals) || 0;
      const a = parseFloat(assists) || 0;
      const pts = g + a;

      const primaryAssists = a * 0.6;
      const secondaryAssists = a * 0.4;

      const icetime = selected.icetime || 60000;

      const res = await axios.post(`${API}/simulate`, {
        position: selected.position || 'C',
        goals: g,
        assists: a,
        points: pts,
        primary_assists: primaryAssists,
        secondary_assists: secondaryAssists,
        icetime: icetime,
        xg_all_situations: selected.xg_all_situations || 0,
        age: selected.age || 25,
        games_played: gp,
      });

      setResult(res.data);
    } catch (e) {
      console.error(e);
    }

    setLoading(false);
  }

  const aav = selected?.aav || 0;
  const marketValue = result?.predicted_aav || 0;
  const delta = marketValue - aav;

  let verdict = null;
  if (result) {
    if (delta > 1000000) verdict = { label: 'Overperforming', className: 'overperforming' };
    else if (delta < -1000000) verdict = { label: 'Underperforming', className: 'underperforming' };
    else verdict = { label: 'Meeting Expectations', className: 'meeting' };
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '8px',
    padding: '10px 12px',
    color: '#fff',
    fontSize: '0.9rem',
    width: '100%',
  };

  const labelStyle = {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    display: 'block',
    marginBottom: '6px',
  };

  return (
    <div style={{ padding: '32px 40px' }}>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '8px' }}>
        Performance Calculator
      </h2>

      <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>
        <div className="glass" style={{ flex: 1, padding: '28px' }}>
          <div style={{ marginBottom: '24px', position: 'relative' }}>
            <label style={labelStyle}>Search Player</label>

            <input
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Type player name..."
              style={inputStyle}
            />

            {showDropdown && search && filtered.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 50,
                  background: '#1a2f45',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '8px',
                  marginTop: '4px',
                  overflow: 'hidden',
                }}
              >
                {filtered.map(p => (
                  <div
                    key={p.id}
                    onClick={() => handleSelect(p)}
                    style={{
                      padding: '10px 14px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{p.name}</span> {/* FIXED */}
                    <span
                      style={{
                        color: 'rgba(255,255,255,0.4)',
                        marginLeft: '8px',
                        fontSize: '0.8rem',
                      }}
                    >
                      {p.team} · {p.position}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selected && (
            <div
              style={{
                display: 'flex',
                gap: '16px',
                marginBottom: '24px',
                padding: '16px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '10px',
              }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>
                  {selected.name} {/* FIXED */}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
                  {selected.team} · {selected.position}
                </div>
                <div style={{ color: '#ffd700', fontWeight: 600, marginTop: '4px' }}>
                  Current AAV: {formatMoney(selected.aav || 0)}
                </div>
              </div>
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px',
              marginBottom: '28px',
            }}
          >
            <div>
              <label style={labelStyle}>Goals</label>
              <input
                type="number"
                value={goals}
                onChange={e => setGoals(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Assists</label>
              <input
                type="number"
                value={assists}
                onChange={e => setAssists(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Games Played</label>
              <input
                type="number"
                value={gamesPlayed}
                onChange={e => setGamesPlayed(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !selected}
            style={{
              background: selected ? '#ffd700' : 'rgba(255,255,255,0.1)',
              color: selected ? '#0f1923' : 'rgba(255,255,255,0.3)',
              border: 'none',
              padding: '14px 32px',
              borderRadius: '10px',
              fontWeight: 800,
              fontSize: '1rem',
              width: '100%',
            }}
          >
            {loading ? 'Calculating...' : 'Calculate Market Value'}
          </button>
        </div>

        {result && (
          <div className="glass" style={{ width: '280px', padding: '28px' }}>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '16px' }}>
              {selected?.name} {/* FIXED */}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                ACTUAL CAP HIT
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{formatMoney(aav)}</div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                MARKET VALUE
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>
                {formatMoney(marketValue)}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                DELTA
              </div>
              <div
                style={{
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  color:
                    delta > 0 ? '#a855f7' : delta < 0 ? '#ef4444' : '#22c55e',
                }}
              >
                {delta > 0 ? '+' : ''}
                {formatMoney(delta)}
              </div>
            </div>

            {verdict && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '12px',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '8px',
                }}
              >
                <span className={verdict.className} style={{ fontSize: '1.1rem' }}>
                  {verdict.label}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
