import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = 'http://127.0.0.1:8000';

function formatMoney(val) {
  return '$' + Number(val).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function getVerdict(actual, market) {
  const delta = market - actual;
  if (delta <= -2000000) return { label: 'Underperforming', className: 'underperforming' };
  if (delta < -1000000) return { label: 'Slightly Underperforming', className: 'slightly-underperforming' };
  if (delta <= 1000000) return { label: 'Meeting Expectations', className: 'meeting' };
  if (delta < 2000000) return { label: 'Slightly Overperforming', className: 'slightly-overperforming' };
  return { label: 'Overperforming', className: 'overperforming' };
}

export default function Teams() {
  const { teamCode } = useParams();
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [teamMeta, setTeamMeta] = useState(null);
  const [sortBy, setSortBy] = useState('player_name');
  const [sortDir, setSortDir] = useState('asc');

  const defaultLogo = `${API}/static/team_logos/default.svg`;
  const resolveLogoUrl = (url) => {
    if (!url) return defaultLogo;
    if (url.startsWith('/static/')) return `${API}${url}`;
    return url;
  };

  function splitNameParts(name = '') {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    const first = parts.slice(0, -1).join(' ');
    const last = parts.length ? parts[parts.length - 1] : '';
    return { first, last };
  }

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/players?team=${teamCode}`),
      axios.get(`${API}/players/teams`).catch(() => ({ data: [] })),
    ]).then(([playersRes, teamsRes]) => {
      setPlayers(playersRes.data || []);
      const found = (teamsRes.data || []).find(
        t => t.team === teamCode || t.display_name === teamCode
      );
      setTeamMeta(found || null);
    });
  }, [teamCode]);

  function handleSort(col) {
    if (sortBy === col) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(col);
      setSortDir('asc');
    }
  }

  const sorted = [...players].sort((a, b) => {
    const av = a[sortBy], bv = b[sortBy];
    if (sortBy === 'player_name') {
      const an = splitNameParts(av || '');
      const bn = splitNameParts(bv || '');
      const lastCmp = an.last.localeCompare(bn.last);
      const firstCmp = an.first.localeCompare(bn.first);
      const cmp = lastCmp !== 0 ? lastCmp : firstCmp;
      return sortDir === 'asc' ? cmp : -cmp;
    }
    if (typeof av === 'string') {
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  function SortHeader({ col, label }) {
    return (
      <th
        onClick={() => handleSort(col)}
        style={{ cursor: 'pointer', userSelect: 'none' }}
      >
        {label} {sortBy === col ? (sortDir === 'asc' ? '↑' : '↓') : ''}
      </th>
    );
  }

  return (
    <div style={{ padding: '32px 40px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '24px'
        }}
      >
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: '8px',
            fontWeight: 600
          }}
        >
          ← Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img
            src={resolveLogoUrl(teamMeta?.logo_url)}
            onError={(e) => { e.target.onerror = null; e.target.src = defaultLogo; }}
            alt={teamMeta?.display_name || teamCode}
            style={{ width: 40, height: 40 }}
          />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>
            {teamMeta?.display_name || teamCode}
          </h2>
        </div>
      </div>

      <div className="glass" style={{ padding: '24px' }}>
        <table>
          <thead>
            <tr>
              <SortHeader col="player_name" label="Player" />
              <SortHeader col="aav" label="Actual Cap Hit" />
              <SortHeader col="market_value" label="Market Value" />
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {sorted.map(p => {
              const verdict = getVerdict(p.aav || 0, p.market_value || 0);

              return (
                <tr
                  key={p.id}
                  onClick={() =>
                    navigate(`/player/${encodeURIComponent(p.player_name)}`)
                  }
                >
                  <td
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                  >
                    {p.headshot_url && (
                      <img
                        src={p.headshot_url}
                        alt={p.player_name}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          objectFit: 'cover'
                        }}
                      />
                    )}
                    <span style={{ fontWeight: 600 }}>{p.player_name}</span>
                  </td>

                  <td>{formatMoney(p.aav || 0)}</td>
                  <td>{formatMoney(p.market_value || 0)}</td>
                  <td>
                    <span className={verdict.className}>{verdict.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
