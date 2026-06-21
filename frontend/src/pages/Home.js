import React, { useState, useEffect } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
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

export default function Home() {
  const [teams, setTeams] = useState([]);
  const [articles, setArticles] = useState([]);
  const navigate = useNavigate();
  const defaultLogo = `${API}/static/team_logos/default.svg`;

  const resolveLogoUrl = (url) => {
    if (!url) return defaultLogo;
    if (url.startsWith('/static/')) return `${API}${url}`;
    return url;
  };

 useEffect(() => {
  Promise.all([
    axios.get("http://127.0.0.1:8000/players"),
    axios.get("http://127.0.0.1:8000/players/teams").catch(() => ({ data: [] })),
  ]).then(([playersRes, teamsRes]) => {
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
      teamMap[p.team].totalActual += p.aav || 0;
      teamMap[p.team].totalMarket += p.market_value || 0;
    });

    setTeams(Object.values(teamMap).sort((a, b) => a.team.localeCompare(b.team)));
  });

  axios
    .get("http://127.0.0.1:8000/articles")
    .then(res => setArticles(res.data.slice(0, 5)));
}, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '32px 40px' }}>
      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
      <div className="glass" style={{ flex: 1, padding: '24px' }}>
        <h2 style={{ marginBottom: '20px', fontSize: '1.2rem', fontWeight: 700 }}>Team Market Valuations</h2>
        <table>
          <thead>
            <tr>
              <th>Team</th>
              <th>Actual Cap Hit</th>
              <th>Market Value</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {teams.map(t => {
              const verdict = getVerdict(t.totalActual, t.totalMarket);
              return (
                <tr key={t.team} onClick={() => navigate(`/team/${t.team}`)}>
                    <td style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <img
                        src={resolveLogoUrl(t.logo_url)}
                        onError={(e) => { e.target.onerror = null; e.target.src = defaultLogo; }}
                        alt={t.display_name || t.team}
                        style={{ width: 24, height: 24 }}
                      />
                      <span>{t.display_name || t.team}</span>
                    </td>
                  <td>{formatMoney(t.totalActual)}</td>
                  <td>{formatMoney(t.totalMarket)}</td>
                  <td><span className={verdict.className}>{verdict.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
              <div style={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.25 }}>{a.title}</div>
              {a.description && (
                <div
                  style={{
                    fontSize: '0.72rem',
                    color: 'rgba(255,255,255,0.6)',
                    marginTop: '2px',
                    lineHeight: 1.25,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
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