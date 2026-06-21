import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

import { bonusProgressColor, computePerformanceBonusTracker } from '../utils/performanceBonuses';

const API = 'http://127.0.0.1:8000';

function formatMoney(val) {
  return '$' + Number(val || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatMillionsCompact(val) {
  const millions = (Number(val || 0) / 1000000);
  const rounded = Math.round(millions * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/\.0$/, '');
  return `$${text} million`;
}

export default function PerformanceBonuses() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [teamLogos, setTeamLogos] = useState({});

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
    ]).then(([playersRes, teamsRes]) => {
      setPlayers(playersRes.data || []);
      const map = {};
      (teamsRes.data || []).forEach((t) => {
        if (t?.team) map[t.team] = t.logo_url;
      });
      setTeamLogos(map);
    });
  }, []);

  const rows = useMemo(() => {
    return (players || [])
      .map((p) => ({ player: p, tracker: computePerformanceBonusTracker(p, players, p.season) }))
      .filter((x) => x.tracker)
      .sort((a, b) => (b.tracker.earnedTotal || 0) - (a.tracker.earnedTotal || 0));
  }, [players]);

  return (
    <div style={{ padding: '32px 40px' }}>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '20px' }}>Performance Bonuses</h2>

      <div className="glass" style={{ padding: '24px' }}>
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Bonus Eligible</th>
              <th>Amount of A/B bonuses earned</th>
              <th>Bonus Earned</th>
              <th>Closest Bonus</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ player, tracker }) => {
              const closestProgress = tracker.closest ? (tracker.closest.progress || 0) : 1;
              const barColor = bonusProgressColor(closestProgress);

              return (
                <tr key={player.id} onClick={() => navigate(`/player/${encodeURIComponent(player.player_name || player.name)}`)}>
                  <td style={{ fontSize: '0.9rem', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img
                        src={player.headshot_url || defaultLogo}
                        onError={(e) => { e.target.onerror = null; e.target.src = defaultLogo; }}
                        alt={player.name}
                        style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }}
                      />
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{player.name}</span>
                      <img
                        src={resolveLogoUrl(teamLogos[player.team])}
                        onError={(e) => { e.target.onerror = null; e.target.src = defaultLogo; }}
                        alt={player.team}
                        style={{ width: 22, height: 22 }}
                      />
                    </div>
                  </td>
                  <td>{formatMoney(tracker.bonusTotal)}</td>
                  <td style={{ fontSize: '0.78rem', lineHeight: 1.35, minWidth: 210 }}>
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span>A Bonuses</span>
                        <span>{formatMillionsCompact(tracker.earnedA)} / {formatMillionsCompact(tracker.aPool || 1000000)}</span>
                      </div>
                      <div style={{ height: 7, borderRadius: 999, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${Math.max(0, Math.min(100, ((Number(tracker.earnedA) || 0) / Math.max(1, Number(tracker.aPool) || 0)) * 100))}%`,
                            height: '100%',
                            background: '#38bdf8',
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span>B Bonuses</span>
                        <span>{formatMillionsCompact(tracker.earnedB)} / {formatMillionsCompact(tracker.bPool || 2500000)}</span>
                      </div>
                      <div style={{ height: 7, borderRadius: 999, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${Math.max(0, Math.min(100, ((Number(tracker.earnedB) || 0) / Math.max(1, Number(tracker.bPool) || 0)) * 100))}%`,
                            height: '100%',
                            background: '#22c55e',
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td>{formatMoney(tracker.earnedTotal)}</td>
                  <td>
                    {tracker.closest ? (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: '4px' }}>
                          <div style={{ fontSize: '0.8rem' }}>{tracker.closest.label}</div>
                          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgba(255,255,255,0.82)', whiteSpace: 'nowrap' }}>
                            {Math.round(Math.max(0, Math.min(100, closestProgress * 100)))}%
                          </div>
                        </div>
                        <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.max(0, Math.min(100, closestProgress * 100))}%`, height: '100%', background: barColor }} />
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: '#22c55e', fontWeight: 700 }}>Maxed Out</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center', padding: '30px 0 8px' }}>
            No bonus-eligible contracts configured.
          </div>
        )}
      </div>
    </div>
  );
}
