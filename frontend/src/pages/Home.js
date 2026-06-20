import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = 'http://127.0.0.1:8000';

function formatMoney(val) {
  return '$' + Number(val).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function getVerdict(actual, market) {
  const delta = market - actual;
  if (delta > 1000000) return { label: 'Underpaid', className: 'overperforming' };
  if (delta < -1000000) return { label: 'Overpaid', className: 'underperforming' };
  return { label: 'Fair', className: 'meeting' };
}

export default function Home() {
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [articles, setArticles] = useState([]);
  const navigate = useNavigate();

 useEffect(() => {
  axios.get("http://127.0.0.1:8000/players").then(res => {
    const data = res.data;
    setPlayers(data);

    const teamMap = {};
    data.forEach(p => {
      if (!p.team) return;
      if (!teamMap[p.team]) {
        teamMap[p.team] = { team: p.team, totalActual: 0, totalMarket: 0 };
      }
      teamMap[p.team].totalActual += p.aav || 0;
      teamMap[p.team].totalMarket += p.market_value || 0;
    });

    setTeams(
      Object.values(teamMap).sort((a, b) => a.team.localeCompare(b.team))
    );
  });
  // fetch team logos / tri-code mapping
  axios.get("http://127.0.0.1:8000/players/teams").then(res => {
    const map = {};
    res.data.forEach(t => {
      if (t && t.team) map[t.team] = { tri_code: t.tri_code, logo_url: t.logo_url, display_name: t.display_name };
    });
    // merge logos into existing teams state if present
    setTeams(prev => prev.map(pt => ({ ...pt, ...map[pt.team], display_name: (map[pt.team] && map[pt.team].display_name) || pt.team })));
  }).catch(() => {});

  axios
    .get("http://127.0.0.1:8000/articles")
    .then(res => setArticles(res.data.slice(0, 5)));
}, []);

  return (
    <div style={{ display: 'flex', gap: '24px', padding: '32px 40px', alignItems: 'flex-start' }}>
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
                      {t.logo_url ? (
                        <img src={t.logo_url} onError={(e) => { e.target.onerror = null; e.target.src = '/static/team_logos/default.svg'; }} alt={t.display_name || t.team} style={{ width: 24, height: 24 }} />
                      ) : (
                        <img src="/static/team_logos/default.svg" alt={t.display_name || t.team} style={{ width: 24, height: 24 }} />
                      )}
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
            style={{ cursor: 'pointer', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{a.title}</div>
          </div>
        ))}
      </div>
    </div>
  );
}