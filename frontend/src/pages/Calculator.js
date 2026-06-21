import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = 'http://127.0.0.1:8000';

function formatMoney(val) {
  return '$' + Number(val).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export default function Calculator() {
  const MODEL_DEFAULTS = {
    primary_assists: 0,
    secondary_assists: 0,
    high_danger_goals: 0,
    dzone_giveaways: 0,
    blocked_shot_attempts: 0,
    onice_a_xgoals: 0,
    onice_a_goals: 0,
    onice_xgoals_pct: 50,
    onice_corsi_pct: 50,
    icetime: 60000,
    age: 25,
  };

  const [players, setPlayers] = useState([]);
  const [teamLogos, setTeamLogos] = useState({});
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({
    goals: '',
    assists: '',
    points: '',
    high_danger_shots: '',
    hits: '',
    takeaways: '',
    giveaways: '',
    games_played: '',
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const defaultLogo = `${API}/static/team_logos/default.svg`;
  const resolveLogoUrl = (url) => {
    if (!url) return defaultLogo;
    if (url.startsWith('/static/')) return `${API}${url}`;
    return url;
  };

  useEffect(() => {
    axios.get(`${API}/players`).then(res => setPlayers(res.data));
    axios
      .get(`${API}/players/teams`)
      .then(res => {
        const map = {};
        res.data.forEach(t => {
          if (t?.team) map[t.team] = t.logo_url;
        });
        setTeamLogos(map);
      })
      .catch(() => {});
  }, []);

  // FIXED: use p.name instead of p.player_name
  const filtered = players
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 8);

  function handleSelect(player) {
    const getNum = (fallback, ...keys) => {
      for (const key of keys) {
        const value = player?.[key];
        if (value !== undefined && value !== null && value !== '') {
          const parsed = Number(value);
          if (!Number.isNaN(parsed)) return parsed;
        }
      }
      return fallback;
    };

    setSelected(player);
    setSearch(player.name); // FIXED
    setShowDropdown(false);
    const goalsVal = getNum(0, 'goals', 'I_F_goals');
    const assistsVal = getNum(0, 'assists');
    const pointsVal = getNum(goalsVal + assistsVal, 'points', 'I_F_points');
    setForm({
      goals: String(goalsVal),
      assists: String(assistsVal),
      points: String(pointsVal),
      high_danger_shots: String(getNum(0, 'high_danger_shots', 'I_F_highDangerShots')),
      hits: String(getNum(0, 'hits', 'I_F_hits')),
      takeaways: String(getNum(0, 'takeaways', 'I_F_takeaways')),
      giveaways: String(getNum(0, 'giveaways', 'I_F_giveaways')),
      games_played: String(player.games_played || 82),
    });
  }

  function updateField(name, value) {
    setForm(prev => {
      const next = { ...prev, [name]: value };
      if (name === 'goals' || name === 'assists') {
        const g = Number(name === 'goals' ? value : next.goals) || 0;
        const a = Number(name === 'assists' ? value : next.assists) || 0;
        next.points = String(g + a);
      }
      return next;
    });
  }

  async function handleSubmit() {
    if (!selected) return;
    setLoading(true);

    try {
      const g = parseFloat(form.goals) || 0;
      const a = parseFloat(form.assists) || 0;

      const res = await axios.post(`${API}/simulate`, {
        position: selected.position || 'C',
        goals: g,
        assists: a,
        points: g + a,
        primary_assists: MODEL_DEFAULTS.primary_assists,
        secondary_assists: MODEL_DEFAULTS.secondary_assists,
        high_danger_shots: parseFloat(form.high_danger_shots) || 0,
        high_danger_goals: MODEL_DEFAULTS.high_danger_goals,
        hits: parseFloat(form.hits) || 0,
        takeaways: parseFloat(form.takeaways) || 0,
        giveaways: parseFloat(form.giveaways) || 0,
        dzone_giveaways: MODEL_DEFAULTS.dzone_giveaways,
        blocked_shot_attempts: MODEL_DEFAULTS.blocked_shot_attempts,
        onice_a_xgoals: MODEL_DEFAULTS.onice_a_xgoals,
        onice_a_goals: MODEL_DEFAULTS.onice_a_goals,
        onice_xgoals_pct: MODEL_DEFAULTS.onice_xgoals_pct,
        onice_corsi_pct: MODEL_DEFAULTS.onice_corsi_pct,
        icetime: MODEL_DEFAULTS.icetime,
        age: MODEL_DEFAULTS.age,
        games_played: parseFloat(form.games_played) || 82,
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
    if (delta <= -2000000) verdict = { label: 'Underperforming', className: 'underperforming' };
    else if (delta < -1000000) verdict = { label: 'Slightly Underperforming', className: 'slightly-underperforming' };
    else if (delta <= 1000000) verdict = { label: 'Meeting Expectations', className: 'meeting' };
    else if (delta < 2000000) verdict = { label: 'Slightly Overperforming', className: 'slightly-overperforming' };
    else verdict = { label: 'Overperforming', className: 'overperforming' };
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
      <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.68)', marginBottom: '20px', maxWidth: '760px' }}>
        Use our performance calculator to determine what a player must do to meet expectations on their contract. Create a hypothetical statline to obtain a contract value.
      </p>

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
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <img
                        src={resolveLogoUrl(teamLogos[p.team])}
                        onError={(e) => { e.target.onerror = null; e.target.src = defaultLogo; }}
                        alt={p.team}
                        style={{ width: 16, height: 16 }}
                      />
                      <span>{p.team} · {p.position}</span>
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
                alignItems: 'center',
                marginBottom: '24px',
                padding: '16px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '10px',
              }}
            >
              <img
                src={selected.headshot_url || defaultLogo}
                onError={(e) => { e.target.onerror = null; e.target.src = defaultLogo; }}
                alt={selected.name}
                style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
              />
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>
                  {selected.name} {/* FIXED */}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <img
                    src={resolveLogoUrl(teamLogos[selected.team])}
                    onError={(e) => { e.target.onerror = null; e.target.src = defaultLogo; }}
                    alt={selected.team}
                    style={{ width: 16, height: 16 }}
                  />
                  <span>{selected.team}</span>
                  <span>·</span>
                  <span>{selected.position}</span>
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
                value={form.goals}
                onChange={e => updateField('goals', e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Assists</label>
              <input
                type="number"
                value={form.assists}
                onChange={e => updateField('assists', e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Points</label>
              <input
                type="number"
                value={form.points}
                readOnly
                style={{ ...inputStyle, opacity: 0.7, cursor: 'not-allowed' }}
              />
            </div>

            <div>
              <label style={labelStyle}>High Danger Shots</label>
              <input type="number" value={form.high_danger_shots} onChange={e => updateField('high_danger_shots', e.target.value)} style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Hits</label>
              <input type="number" value={form.hits} onChange={e => updateField('hits', e.target.value)} style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Takeaways</label>
              <input type="number" value={form.takeaways} onChange={e => updateField('takeaways', e.target.value)} style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Giveaways</label>
              <input type="number" value={form.giveaways} onChange={e => updateField('giveaways', e.target.value)} style={inputStyle} />
            </div>


            <div>
              <label style={labelStyle}>Games Played</label>
              <input type="number" value={form.games_played} onChange={e => updateField('games_played', e.target.value)} style={inputStyle} />
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '16px' }}>
              <img
                src={selected?.headshot_url || defaultLogo}
                onError={(e) => { e.target.onerror = null; e.target.src = defaultLogo; }}
                alt={selected?.name}
                style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', marginBottom: '10px' }}
              />
              <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>
                {selected?.name} {/* FIXED */}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <img
                  src={resolveLogoUrl(teamLogos[selected?.team])}
                  onError={(e) => { e.target.onerror = null; e.target.src = defaultLogo; }}
                  alt={selected?.team}
                  style={{ width: 15, height: 15 }}
                />
                <span>{selected?.team}</span>
              </div>
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
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }} className={verdict?.className || ''}>
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
