import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../api';

const API = API_BASE_URL;
const DEFAULT_HEADSHOT = `${API}/static/team_logos/default.svg`;

function formatMoney(value) {
  return '$' + Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatPosition(position) {
  const normalized = String(position || '').trim().toUpperCase();
  if (normalized === 'L') return 'LW';
  if (normalized === 'R') return 'RW';
  return normalized || 'N/A';
}

export default function Arbitration() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [teamLogos, setTeamLogos] = useState({});
  const [query, setQuery] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [qoOffered, setQoOffered] = useState(true);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/arbitration/players`),
      axios.get(`${API}/players/teams`).catch(() => ({ data: [] })),
    ])
      .then(([playersRes, teamsRes]) => {
        setPlayers(playersRes.data || []);
        const map = {};
        (teamsRes.data || []).forEach((team) => {
          if (team?.team) map[team.team] = team.logo_url;
        });
        setTeamLogos(map);
      })
      .catch(() => setError('Unable to load arbitration player list.'));
  }, []);

  const playerByName = useMemo(() => {
    const map = {};
    (players || []).forEach((p) => {
      if (p?.player_name) map[p.player_name] = p;
    });
    return map;
  }, [players]);

  const defaultLogo = `${API}/static/team_logos/default.svg`;
  const resolveLogoUrl = (url) => {
    if (!url) return defaultLogo;
    if (url.startsWith('/static/')) return `${API}${url}`;
    return url;
  };

  const filteredPlayers = useMemo(() => {
    const text = String(query || '').trim().toLowerCase();
    const sorted = [...players].sort((a, b) => (a.player_name || '').localeCompare(b.player_name || ''));
    if (!text) return [];
    return sorted
      .filter((p) => {
        const name = String(p.player_name || '').toLowerCase();
        const team = String(p.team || '').toLowerCase();
        return name.includes(text) || team.includes(text);
      })
      .slice(0, 100);
  }, [players, query]);

  async function runProjection() {
    if (!selectedPlayer) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await axios.get(
        `${API}/arbitration/predict/${selectedPlayer.id}?qo_offered=${qoOffered}`
      );
      setResult(res.data);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Prediction failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: '32px 40px' }}>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '20px' }}>Arbitration Projector</h2>

      <div
        className="glass"
        style={{
          padding: '14px 16px',
          marginBottom: '14px',
          fontSize: '0.86rem',
          lineHeight: 1.5,
          color: 'rgba(255,255,255,0.86)'
        }}
      >
        The Arbitration Projector has been trained on historical arbitration case data. Very few high-profile
        players have gone all the way through arbitration hearings to an awarded contract, so this model is most
        representative of players whose value is often derived from a depth role. As a result, high-profile players
        may not be assessed accurately by this tool. Player comparables may be used to get an idea of what a
        potential award may look like for a given player.
      </div>

      <div className="glass" style={{ padding: '24px', marginBottom: '18px' }}>
        <div style={{ marginBottom: '12px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.68)' }}>PLAYER SEARCH</div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search player or team"
          style={{
            width: '100%',
            height: '40px',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.14)',
            background: 'rgba(255,255,255,0.08)',
            color: '#fff',
            padding: '0 12px',
            marginBottom: '12px'
          }}
        />

        <div style={{ maxHeight: '260px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}>
          {filteredPlayers.map((p) => {
            const selected = selectedPlayer?.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => {
                  setSelectedPlayer(p);
                  setResult(null);
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: selected ? 'rgba(255,215,0,0.2)' : 'transparent',
                  color: '#fff',
                  border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  padding: '10px 12px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontWeight: 700 }}>{p.player_name}</div>
                <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)' }}>
                  {p.team || 'N/A'} • {formatPosition(p.position)}
                </div>
              </button>
            );
          })}
          {!query.trim() && (
            <div style={{ padding: '12px', color: 'rgba(255,255,255,0.64)' }}>Start typing to search players.</div>
          )}
          {query.trim() && filteredPlayers.length === 0 && (
            <div style={{ padding: '12px', color: 'rgba(255,255,255,0.64)' }}>No players found.</div>
          )}
        </div>
      </div>

      <div className="glass" style={{ padding: '24px', marginBottom: '18px', textAlign: 'center' }}>
        <div style={{ marginBottom: '10px', fontWeight: 700 }}>QO Offered?</div>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', justifyContent: 'center' }}>
          <button
            onClick={() => setQoOffered(true)}
            style={{
              minWidth: '110px',
              height: '40px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.16)',
              background: qoOffered ? '#22c55e' : 'rgba(255,255,255,0.1)',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Yes
          </button>
          <button
            onClick={() => setQoOffered(false)}
            style={{
              minWidth: '110px',
              height: '40px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.16)',
              background: !qoOffered ? '#ef4444' : 'rgba(255,255,255,0.1)',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            No
          </button>
        </div>

        <button
          onClick={runProjection}
          disabled={!selectedPlayer || loading}
          style={{
            height: '42px',
            padding: '0 16px',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.16)',
            background: !selectedPlayer || loading ? 'rgba(255,255,255,0.12)' : '#ffd700',
            color: !selectedPlayer || loading ? 'rgba(255,255,255,0.7)' : '#0f1923',
            fontWeight: 800,
            cursor: !selectedPlayer || loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Calculating...' : 'Calculate Award'}
        </button>
      </div>

      {error && (
        <div className="glass" style={{ padding: '16px', color: '#fca5a5', fontWeight: 700, marginBottom: '18px' }}>
          {error}
        </div>
      )}

      {result && (
        <div className="glass" style={{ padding: '24px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 220px 1fr',
              alignItems: 'center',
              gap: '14px',
              marginBottom: '16px'
            }}
          >
            <div>
              <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.68)', marginBottom: '6px' }}>PREDICTED ARBITRATION AWARD</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#ffd700' }}>
                {formatMoney(result.predicted_award)}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src={selectedPlayer?.headshot_url || DEFAULT_HEADSHOT}
                onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_HEADSHOT; }}
                alt={selectedPlayer?.player_name || 'Selected player'}
                style={{ width: 84, height: 84, borderRadius: '50%', objectFit: 'cover', marginBottom: '8px' }}
              />
              <button
                onClick={() => navigate(`/player/${encodeURIComponent(selectedPlayer?.player_name || '')}?id=${selectedPlayer?.id || ''}`)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0
                }}
              >
                {selectedPlayer?.player_name}
              </button>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.68)', marginBottom: '6px' }}>LAST YEAR AAV</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{formatMoney(selectedPlayer?.aav || 0)}</div>
            </div>
          </div>

          <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.75)', marginBottom: '8px' }}>Comparable Players</div>
          <div style={{ display: 'grid', gap: '8px' }}>
            {(result.comparables || []).map((comp, idx) => (
              <div
                key={`${comp.player_name}-${idx}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.8fr 1.2fr auto',
                  gap: '10px',
                  padding: '10px 12px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <img
                    src={playerByName[comp.player_name]?.headshot_url || DEFAULT_HEADSHOT}
                    onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_HEADSHOT; }}
                    alt={comp.player_name}
                    style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                  />
                  <button
                    onClick={() => {
                      const targetId = comp?.id || playerByName[comp.player_name]?.id;
                      if (targetId) {
                        navigate(`/player/${encodeURIComponent(comp.player_name || '')}?id=${targetId}`);
                      } else {
                        navigate(`/player/${encodeURIComponent(comp.player_name || '')}`);
                      }
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#fff',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'left',
                      textDecoration: 'underline',
                      padding: 0
                    }}
                  >
                    {comp.player_name}
                  </button>
                </div>
                <button
                  onClick={() => navigate(`/team/${encodeURIComponent(comp.team || '')}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255,255,255,0.82)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    padding: 0,
                  }}
                >
                  <img
                    src={resolveLogoUrl(teamLogos[comp.team])}
                    onError={(e) => { e.target.onerror = null; e.target.src = defaultLogo; }}
                    alt={comp.team}
                    style={{ width: 28, height: 28, flexShrink: 0 }}
                  />
                  <span style={{ textDecoration: 'underline' }}>{comp.team}</span>
                </button>
                <div style={{ fontWeight: 700 }}>{formatMoney(comp.aav)}</div>
              </div>
            ))}
            {(result.comparables || []).length === 0 && (
              <div style={{ color: 'rgba(255,255,255,0.62)' }}>No comparables found for this player group.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
