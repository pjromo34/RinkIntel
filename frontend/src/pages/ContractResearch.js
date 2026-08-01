import React, { useMemo, useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../api';

const API = API_BASE_URL;
const DEFAULT_HEADSHOT = `${API}/static/team_logos/default.svg`;

function money(value) {
  return '$' + Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function pct(value) {
  return `${Math.round(Number(value || 0))}%`;
}

function riskColor(percentile) {
  const p = Math.max(1, Math.min(99, Number(percentile) || 1));
  const hue = 120 - ((p - 1) / 98) * 120;
  return `hsl(${hue}, 75%, 48%)`;
}

function resolveImage(url) {
  if (!url) return DEFAULT_HEADSHOT;
  if (url.startsWith('/static/')) return `${API}${url}`;
  return url;
}

export default function ContractResearch() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    axios
      .get(`${API}/contract-research/players`)
      .then((res) => setPlayers(res.data || []))
      .catch(() => setError('Unable to load contract research players.'));
  }, []);

  const filtered = useMemo(() => {
    const text = String(query || '').trim().toLowerCase();
    if (!text) return [];
    return [...players]
      .filter((p) => {
        const name = String(p.player_name || '').toLowerCase();
        const team = String(p.team || '').toLowerCase();
        return name.includes(text) || team.includes(text);
      })
      .sort((a, b) => String(a.player_name || '').localeCompare(String(b.player_name || '')))
      .slice(0, 100);
  }, [players, query]);

  async function runReport() {
    if (!selected) return;
    setLoading(true);
    setError('');
    setReport(null);
    try {
      const res = await axios.get(`${API}/contract-research/report/${selected.id}`);
      setReport(res.data);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Unable to run contract report.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: '24px 30px' }}>
      <h2 style={{ fontSize: '1.45rem', fontWeight: 800, marginBottom: '12px' }}>Contract Research</h2>

      <div className="glass" style={{ padding: '16px', marginBottom: '14px' }}>
        <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.68)', marginBottom: '8px' }}>SEARCH PLAYER</div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search player or team"
          style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.08)', color: '#fff', padding: '0 12px', marginBottom: '10px' }}
        />

        <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px' }}>
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setSelected(p);
                setReport(null);
              }}
              style={{
                width: '100%',
                border: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                textAlign: 'left',
                background: selected?.id === p.id ? 'rgba(255,215,0,0.18)' : 'transparent',
                color: '#fff',
                padding: '10px 12px'
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <img src={resolveImage(p.headshot_url)} alt={p.player_name} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.player_name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.72)' }}>{money(p.aav)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)' }}>{p.team}</span>
                  <img src={resolveImage(p.team_logo_url)} alt={p.team} style={{ width: 18, height: 18 }} />
                </div>
              </div>
            </button>
          ))}
          {!query.trim() && <div style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.6)' }}>Start typing to search.</div>}
          {query.trim() && filtered.length === 0 && <div style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.6)' }}>No players found.</div>}
        </div>

        <button
          onClick={runReport}
          disabled={!selected || loading}
          style={{
            marginTop: '10px',
            height: '40px',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.18)',
            background: !selected || loading ? 'rgba(255,255,255,0.12)' : '#ffd700',
            color: !selected || loading ? 'rgba(255,255,255,0.68)' : '#0f1923',
            fontWeight: 800,
            padding: '0 14px'
          }}
        >
          {loading ? 'Building report...' : 'Run Contract Report'}
        </button>
      </div>

      {error && <div className="glass" style={{ padding: '12px', color: '#fca5a5', marginBottom: '14px' }}>{error}</div>}

      {report && (
        <div className="glass" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <img src={resolveImage(report.player.headshot_url)} alt={report.player.player_name} style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{report.player.player_name}</div>
              <div style={{ color: 'rgba(255,255,255,0.78)' }}>{report.player.team}</div>
              <div style={{ color: '#ffd700', fontWeight: 700, marginTop: '2px' }}>Current AAV: {money(report.player.aav)}</div>
            </div>
            <div className="glass" style={{ padding: '10px 12px', border: `1px solid ${riskColor(report.risk_percentile)}` }}>
              <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.72)' }}>RISK PERCENTILE</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: riskColor(report.risk_percentile), textAlign: 'center' }}>{pct(report.risk_percentile)}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0,1fr))', gap: '8px', marginBottom: '12px' }}>
            {[
              ['Goals', report.key_stats.goals],
              ['Assists', report.key_stats.assists],
              ['Points', report.key_stats.points],
              ['xG', Number(report.key_stats.xg_all_situations || 0).toFixed(2)],
              ['Shots', Math.round(report.key_stats.shots || 0)],
              ['PPG', Number(report.key_stats.points_per_game || 0).toFixed(2)],
              ['Hits', Math.round(report.key_stats.hits || 0)],
              ['Give/Take', `${Math.round(report.key_stats.giveaways || 0)}/${Math.round(report.key_stats.takeaways || 0)}`],
            ].map(([label, value]) => (
              <div key={label} className="glass" style={{ padding: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '1rem', fontWeight: 800 }}>{value}</div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.66)' }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '10px', marginBottom: '10px' }}>
            {['goals', 'assists', 'points'].map((statKey) => (
              <div key={statKey} className="glass" style={{ padding: '10px' }}>
                <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.68)', marginBottom: '6px', textTransform: 'uppercase' }}>{statKey} comparables</div>
                {(report.stat_comparables?.[statKey] || []).map((p) => (
                  <button
                    key={`${statKey}-${p.id}`}
                    onClick={() => navigate(`/player/${encodeURIComponent(p.player_name)}?id=${p.id}`)}
                    style={{ width: '100%', border: 'none', background: 'transparent', padding: 0, color: '#fff', cursor: 'pointer', font: 'inherit' }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px', alignItems: 'center', marginBottom: '6px', textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <img src={resolveImage(p.headshot_url)} alt={p.player_name} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.player_name}</span>
                      </div>
                      <span style={{ color: 'rgba(255,255,255,0.8)' }}>{Math.round(p.value)}</span>
                      <span style={{ color: '#ffd700', fontWeight: 700 }}>{money(p.aav)}</span>
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '10px', marginBottom: '12px' }}>
            {[
              ['xg_all_situations', 'xG'],
              ['shots', 'shots'],
              ['hits', 'hits'],
            ].map(([statKey, label]) => (
              <div key={statKey} className="glass" style={{ padding: '10px' }}>
                <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.68)', marginBottom: '6px', textTransform: 'uppercase' }}>{label} comparables</div>
                {(report.stat_comparables?.[statKey] || []).map((p) => (
                  <button
                    key={`${statKey}-${p.id}`}
                    onClick={() => navigate(`/player/${encodeURIComponent(p.player_name)}?id=${p.id}`)}
                    style={{ width: '100%', border: 'none', background: 'transparent', padding: 0, color: '#fff', cursor: 'pointer', font: 'inherit' }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px', alignItems: 'center', marginBottom: '6px', textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <img src={resolveImage(p.headshot_url)} alt={p.player_name} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.player_name}</span>
                      </div>
                      <span style={{ color: 'rgba(255,255,255,0.8)' }}>{statKey === 'xg_all_situations' ? Number(p.value || 0).toFixed(2) : Math.round(p.value)}</span>
                      <span style={{ color: '#ffd700', fontWeight: 700 }}>{money(p.aav)}</span>
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>

          <div className="glass" style={{ padding: '10px' }}>
            <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>Comparable Players</div>
            <div style={{ display: 'grid', gap: '8px' }}>
              {(report.overall_similars || []).map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/player/${encodeURIComponent(p.player_name)}?id=${p.id}`)}
                  style={{ width: '100%', border: 'none', background: 'transparent', padding: 0, color: '#fff', cursor: 'pointer', font: 'inherit' }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr auto', gap: '8px', alignItems: 'center', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '8px', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <img src={resolveImage(p.headshot_url)} alt={p.player_name} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 700 }}>{p.player_name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <img src={resolveImage(p.team_logo_url)} alt={p.team} style={{ width: 20, height: 20 }} />
                      <span style={{ fontSize: '0.84rem' }}>{p.team}</span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)' }}>{(p.similar_stats || []).join(', ')}</div>
                    <div style={{ color: '#ffd700', fontWeight: 800 }}>{money(p.aav)}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
