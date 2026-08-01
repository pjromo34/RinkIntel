import React, { useState, useEffect } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../api';

const API = API_BASE_URL;

function formatMoney(val) {
  return '$' + Number(val).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatDifference(val) {
  const amount = Number(val) || 0;
  return amount >= 0 ? `+${formatMoney(amount)}` : `-${formatMoney(Math.abs(amount))}`;
}

function isGoalie(position) {
  const normalized = String(position || '').trim().toUpperCase();
  return normalized === 'G' || normalized === 'GOALIE' || normalized === 'GOALTENDER';
}

function getVerdict(actual, market) {
  const delta = market - actual;
  if (delta >= 6000000) return { label: 'Overperforming', className: 'overperforming' };
  if (delta <= -6000000) return { label: 'Underperforming', className: 'underperforming' };
  return { label: 'Meeting Expectations', className: 'meeting' };
}

export default function Home() {
  const [teams, setTeams] = useState([]);
  const [articles, setArticles] = useState([]);
  const [apiError, setApiError] = useState('');
  const [sortBy, setSortBy] = useState('team');
  const [sortDir, setSortDir] = useState('asc');
  const navigate = useNavigate();
  const defaultLogo = `${API}/static/team_logos/default.svg`;

  const resolveLogoUrl = (url) => {
    if (!url) return defaultLogo;
    if (url.startsWith('/static/')) return `${API}${url}`;
    return url;
  };

 useEffect(() => {
  Promise.all([
    axios.get(`${API}/players`),
    axios.get(`${API}/players/teams`).catch(() => ({ data: [] })),
  ])
    .then(([playersRes, teamsRes]) => {
      const data = playersRes.data || [];
      const teamsMeta = teamsRes.data || [];

      const metaMap = {};
      teamsMeta.forEach(t => {
        if (t && t.team) {
          metaMap[t.team] = {
            tri_code: t.tri_code,
            logo_url: t.logo_url,
            display_name: t.display_name || t.team,
          };
        }
      });

      const teamMap = {};
      data.forEach(p => {
        if (!p.team) return;
        if (!teamMap[p.team]) {
          teamMap[p.team] = {
            team: p.team,
            totalActual: 0,
            totalMarket: 0,
            ...(metaMap[p.team] || { display_name: p.team }),
          };
        }
        if (!isGoalie(p.position)) {
          teamMap[p.team].totalActual += p.aav || 0;
          teamMap[p.team].totalMarket += p.market_value || 0;
        }
      });

      setTeams(Object.values(teamMap).sort((a, b) => a.team.localeCompare(b.team)));
      setApiError('');
    })
    .catch(() => {
      setTeams([]);
      setApiError('API unreachable at https://api.rinkintel.net. Start or redeploy the backend to load team data.');
    });

  axios
    .get(`${API}/articles`)
    .then(res => setArticles(res.data.slice(0, 5)))
    .catch(() => {
      setArticles([]);
      setApiError((prev) => prev || 'API unreachable at https://api.rinkintel.net. Start or redeploy the backend to load content.');
    });
}, []);

  function handleSort(col) {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir(col === 'team' ? 'asc' : 'desc');
    }
  }

  const sortedTeams = [...teams].sort((a, b) => {
    if (sortBy === 'team') {
      const aName = a.display_name || a.team || '';
      const bName = b.display_name || b.team || '';
      const cmp = aName.localeCompare(bName);
      return sortDir === 'asc' ? cmp : -cmp;
    }

    if (sortBy === 'difference') {
      const aDiff = (Number(a.totalMarket) || 0) - (Number(a.totalActual) || 0);
      const bDiff = (Number(b.totalMarket) || 0) - (Number(b.totalActual) || 0);
      return sortDir === 'asc' ? aDiff - bDiff : bDiff - aDiff;
    }

    if (sortBy === 'status') {
      const aVerdict = getVerdict(a.totalActual, a.totalMarket).label;
      const bVerdict = getVerdict(b.totalActual, b.totalMarket).label;
      const cmp = aVerdict.localeCompare(bVerdict);
      return sortDir === 'asc' ? cmp : -cmp;
    }

    const aNum = Number(a[sortBy]) || 0;
    const bNum = Number(b[sortBy]) || 0;
    return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
  });

  function SortHeader({ col, label }) {
    return (
      <th onClick={() => handleSort(col)} style={{ cursor: 'pointer', userSelect: 'none' }}>
        {label} {sortBy === col ? (sortDir === 'asc' ? '↑' : '↓') : ''}
      </th>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '32px 40px' }}>
      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
      <div className="glass" style={{ flex: 1, padding: '24px' }}>
        <h2 style={{ marginBottom: '20px', fontSize: '1.2rem', fontWeight: 700 }}>Team Market Valuations</h2>
        {apiError && (
          <div style={{
            marginBottom: '12px',
            padding: '10px 12px',
            borderRadius: '8px',
            background: 'rgba(239,68,68,0.14)',
            border: '1px solid rgba(239,68,68,0.45)',
            color: '#fecaca',
            fontSize: '0.9rem'
          }}>
            {apiError}
          </div>
        )}
        <table>
          <thead>
            <tr>
              <SortHeader col="team" label="Team" />
              <SortHeader col="totalActual" label="Actual Cap Hit" />
              <SortHeader col="totalMarket" label="Market Value" />
              <SortHeader col="difference" label="Difference" />
              <SortHeader col="status" label="Status" />
            </tr>
          </thead>
          <tbody>
            {sortedTeams.map(t => {
              const verdict = getVerdict(t.totalActual, t.totalMarket);
              const difference = (Number(t.totalMarket) || 0) - (Number(t.totalActual) || 0);
              return (
                <tr key={t.team} onClick={() => navigate(`/team/${t.team}`)}>
                    <td style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <img
                        src={resolveLogoUrl(t.logo_url)}
                        onError={(e) => { e.target.onerror = null; e.target.src = defaultLogo; }}
                        alt={t.display_name || t.team}
                        style={{ width: 40, height: 40 }}
                      />
                      <span>{t.display_name || t.team}</span>
                    </td>
                  <td>{formatMoney(t.totalActual)}</td>
                  <td>{formatMoney(t.totalMarket)}</td>
                    <td style={{ color: difference >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{formatDifference(difference)}</td>
                  <td><span className={verdict.className}>{verdict.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="glass" style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '8px' }}>
          <a href="/news" style={{ color: '#ffd700' }}>Articles</a>
        </h3>
        {articles.map(a => (
          <div key={a.id} onClick={() => navigate(`/news/${a.id}`)}
            style={{ cursor: 'pointer', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            {a.header_image && (
              <img
                src={a.header_image}
                alt={a.title}
                style={{ width: 56, height: 36, objectFit: 'contain', borderRadius: '6px', flexShrink: 0 }}
              />
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, lineHeight: 1.3 }}>{a.title}</div>
              {a.description && (
                <div
                  style={{
                    fontSize: '0.76rem',
                    color: 'rgba(255,255,255,0.6)',
                    marginTop: '4px',
                    lineHeight: 1.35,
                    whiteSpace: 'normal'
                  }}
                >
                  {a.description}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      </div>

      <div style={{ textAlign: 'center', opacity: 0.55 }}>
        <NavLink
          to="/admin/login"
          style={{
            fontSize: '0.72rem',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.6)'
          }}
        >
          Admin
        </NavLink>
        <div
          style={{
            marginTop: '6px',
            fontSize: '0.68rem',
            color: 'rgba(255,255,255,0.52)',
            letterSpacing: '0.02em'
          }}
        >
          Shot tracking data collected from MoneyPuck
        </div>
      </div>
    </div>
  );
}