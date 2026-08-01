import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../api';

import { bonusProgressColor, computePerformanceBonusTracker } from '../utils/performanceBonuses';

const API = API_BASE_URL;

function formatMoney(val) {
  return '$' + Number(val || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatMillionsCompact(val) {
  const millions = (Number(val || 0) / 1000000);
  const rounded = Math.round(millions * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/\.0$/, '');
  return `$${text} million`;
}

function formatPosition(position) {
  const normalized = String(position || '').trim().toUpperCase();
  if (normalized === 'L') return 'LW';
  if (normalized === 'R') return 'RW';
  return normalized || 'N/A';
}

function MultiSelectFilter({ label, options, selected, onChange, getOptionLabel = (option) => option }) {
  function toggle(value) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  const summaryText = selected.length ? `${selected.length} selected` : 'Select';

  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.65)', marginBottom: '6px' }}>
        {label}
      </label>
      <details
        style={{
          width: '100%',
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: '8px'
        }}
      >
        <summary
          style={{
            listStyle: 'none',
            cursor: 'pointer',
            padding: '10px 12px',
            fontSize: '0.92rem',
            color: '#fff'
          }}
        >
          {summaryText}
        </summary>
        <div style={{ maxHeight: '200px', overflowY: 'auto', padding: '6px 10px 10px 10px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          {options.map((option) => (
            <label
              key={option}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 0',
                cursor: 'pointer',
                color: 'rgba(255,255,255,0.92)'
              }}
            >
              <span>{getOptionLabel(option)}</span>
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={() => toggle(option)}
              />
            </label>
          ))}
          {options.length === 0 && (
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', paddingTop: '4px' }}>
              No options
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

export default function PerformanceBonuses() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [teamLogos, setTeamLogos] = useState({});
  const [selectedPositions, setSelectedPositions] = useState([]);
  const [selectedTeams, setSelectedTeams] = useState([]);

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

  const currentSeason = useMemo(() => {
    const firstWithSeason = (players || []).find((p) => p?.season);
    return firstWithSeason?.season || '2025-26';
  }, [players]);

  const seasonPlayers = useMemo(() => {
    return (players || []).filter((p) => (p?.season || currentSeason) === currentSeason);
  }, [players, currentSeason]);

  const positionOptions = useMemo(() => {
    return Array.from(new Set(seasonPlayers.map((p) => p.position).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [seasonPlayers]);

  const teamOptions = useMemo(() => {
    return Array.from(new Set(seasonPlayers.map((p) => p.team).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [seasonPlayers]);

  const rows = useMemo(() => {
    return seasonPlayers
      .filter((p) => selectedPositions.length === 0 || selectedPositions.includes(p.position))
      .filter((p) => selectedTeams.length === 0 || selectedTeams.includes(p.team))
      .map((p) => ({ player: p, tracker: computePerformanceBonusTracker(p, seasonPlayers, currentSeason) }))
      .filter((x) => x.tracker)
      .sort((a, b) => (b.tracker.earnedTotal || 0) - (a.tracker.earnedTotal || 0));
  }, [seasonPlayers, currentSeason, selectedPositions, selectedTeams]);

  return (
    <div style={{ padding: '32px 40px' }}>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '20px' }}>Performance Bonuses</h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(220px, 1fr))',
          gap: '14px',
          marginBottom: '18px'
        }}
      >
        <div>
          <MultiSelectFilter
            label="POSITION"
            options={positionOptions}
            selected={selectedPositions}
            onChange={setSelectedPositions}
            getOptionLabel={formatPosition}
          />
        </div>

        <div>
          <MultiSelectFilter
            label="TEAM"
            options={teamOptions}
            selected={selectedTeams}
            onChange={setSelectedTeams}
            getOptionLabel={(team) => (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <img
                  src={resolveLogoUrl(teamLogos[team])}
                  onError={(e) => { e.target.onerror = null; e.target.src = defaultLogo; }}
                  alt={team}
                  style={{ width: 18, height: 18, flexShrink: 0 }}
                />
                <span>{team}</span>
              </span>
            )}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            onClick={() => {
              setSelectedPositions([]);
              setSelectedTeams([]);
            }}
            style={{
              width: '100%',
              height: '40px',
              background: 'rgba(255,255,255,0.12)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.16)',
              borderRadius: '8px',
              fontWeight: 700
            }}
          >
            Clear Filters
          </button>
        </div>
      </div>

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
                <tr key={player.id} onClick={() => navigate(`/player/${encodeURIComponent(player.player_name || player.name)}?id=${player.id}`)}>
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
                        style={{ width: 40, height: 40 }}
                      />
                    </div>
                  </td>
                  <td>{formatMoney(tracker.bonusTotal)}</td>
                  <td style={{ fontSize: '0.78rem', lineHeight: 1.35, minWidth: 210 }}>
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span>A Bonuses</span>
                        <span>{formatMillionsCompact(tracker.earnedA)} / {formatMillionsCompact(tracker.aPool)}</span>
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
                        <span>{formatMillionsCompact(tracker.earnedB)} / {formatMillionsCompact(tracker.bPool)}</span>
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
                      <span style={{ color: 'rgba(255,255,255,0.58)', fontWeight: 700 }}>-</span>
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
