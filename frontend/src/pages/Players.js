import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

function getPerformanceKey(actual, market) {
  const delta = (market || 0) - (actual || 0);
  if (delta <= -2000000) return 'under';
  if (delta < -1000000) return 'slight-under';
  if (delta <= 1000000) return 'meeting';
  if (delta < 2000000) return 'slight-over';
  return 'over';
}

function splitNameParts(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  const first = parts.slice(0, -1).join(' ');
  const last = parts.length ? parts[parts.length - 1] : '';
  return { first, last };
}

function MultiSelectFilter({ label, options, selected, onChange }) {
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
              <span>{option}</span>
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

export default function Players() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [teamMetaByName, setTeamMetaByName] = useState({});
  const [sortBy, setSortBy] = useState('market_value');
  const [sortDir, setSortDir] = useState('desc');
  const [selectedPositions, setSelectedPositions] = useState([]);
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [performanceFilter, setPerformanceFilter] = useState('all');
  const [marketMin, setMarketMin] = useState('');
  const [marketMax, setMarketMax] = useState('');
  const [contractMin, setContractMin] = useState('');
  const [contractMax, setContractMax] = useState('');

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
      (teamsRes.data || []).forEach((team) => {
        if (team?.team) map[team.team] = team;
      });
      setTeamMetaByName(map);
    });
  }, []);

  function handleSort(col) {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir(col === 'market_value' ? 'desc' : 'asc');
    }
  }

  function sortCompare(a, b) {
    const av = a?.[sortBy];
    const bv = b?.[sortBy];

    if (sortBy === 'player_name') {
      const an = splitNameParts(av || '');
      const bn = splitNameParts(bv || '');
      const lastCmp = an.last.localeCompare(bn.last);
      const firstCmp = an.first.localeCompare(bn.first);
      const cmp = lastCmp !== 0 ? lastCmp : firstCmp;
      return sortDir === 'asc' ? cmp : -cmp;
    }

    if (typeof av === 'string') {
      const cmp = (av || '').localeCompare(bv || '');
      return sortDir === 'asc' ? cmp : -cmp;
    }

    const aNum = Number(av) || 0;
    const bNum = Number(bv) || 0;
    return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
  }

  const marketMinNum = marketMin === '' ? null : Number(marketMin);
  const marketMaxNum = marketMax === '' ? null : Number(marketMax);
  const contractMinNum = contractMin === '' ? null : Number(contractMin);
  const contractMaxNum = contractMax === '' ? null : Number(contractMax);

  const positionOptions = Array.from(
    new Set(players.map((p) => p.position).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const teamOptions = Array.from(
    new Set(players.map((p) => p.team).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const filteredPlayers = players.filter((p) => {
    const byPosition = selectedPositions.length === 0 || selectedPositions.includes(p.position);
    const byTeam = selectedTeams.length === 0 || selectedTeams.includes(p.team);

    const market = Number(p.market_value) || 0;
    const actual = Number(p.aav) || 0;

    const byMarketMin = marketMinNum === null || market >= marketMinNum;
    const byMarketMax = marketMaxNum === null || market <= marketMaxNum;
    const byContractMin = contractMinNum === null || actual >= contractMinNum;
    const byContractMax = contractMaxNum === null || actual <= contractMaxNum;

    const performanceKey = getPerformanceKey(actual, market);
    let byPerformance = true;
    if (performanceFilter === 'under') {
      byPerformance = performanceKey === 'under' || performanceKey === 'slight-under';
    } else if (performanceFilter === 'over') {
      byPerformance = performanceKey === 'over' || performanceKey === 'slight-over';
    } else if (performanceFilter === 'slightly') {
      byPerformance = performanceKey === 'slight-under' || performanceKey === 'slight-over';
    } else if (performanceFilter === 'meeting') {
      byPerformance = performanceKey === 'meeting';
    }

    return byPosition && byTeam && byMarketMin && byMarketMax && byContractMin && byContractMax && byPerformance;
  });

  const sorted = [...filteredPlayers].sort(sortCompare);

  function SortHeader({ col, label }) {
    return (
      <th onClick={() => handleSort(col)} style={{ cursor: 'pointer', userSelect: 'none' }}>
        {label} {sortBy === col ? (sortDir === 'asc' ? '↑' : '↓') : ''}
      </th>
    );
  }

  return (
    <div style={{ padding: '32px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
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
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>Players</h2>
      </div>

      <div className="glass" style={{ padding: '24px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(200px, 1fr))',
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
            />
          </div>

          <div>
            <MultiSelectFilter
              label="TEAM"
              options={teamOptions}
              selected={selectedTeams}
              onChange={setSelectedTeams}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.65)', marginBottom: '6px' }}>
              PERFORMANCE
            </label>
            <select
              value={performanceFilter}
              onChange={(e) => setPerformanceFilter(e.target.value)}
              style={{ width: '100%', height: '40px', background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '8px', padding: '8px' }}
            >
              <option value="all">All</option>
              <option value="under">Underperforming</option>
              <option value="over">Overperforming</option>
              <option value="slightly">Slightly Performing</option>
              <option value="meeting">Meeting Expectations</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.65)', marginBottom: '6px' }}>
              MARKET VALUE RANGE ($)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <input
                type="number"
                placeholder="Min"
                value={marketMin}
                onChange={(e) => setMarketMin(e.target.value)}
                style={{ width: '100%', height: '40px', background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '8px', padding: '8px' }}
              />
              <input
                type="number"
                placeholder="Max"
                value={marketMax}
                onChange={(e) => setMarketMax(e.target.value)}
                style={{ width: '100%', height: '40px', background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '8px', padding: '8px' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.65)', marginBottom: '6px' }}>
              ACTUAL CONTRACT RANGE ($)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <input
                type="number"
                placeholder="Min"
                value={contractMin}
                onChange={(e) => setContractMin(e.target.value)}
                style={{ width: '100%', height: '40px', background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '8px', padding: '8px' }}
              />
              <input
                type="number"
                placeholder="Max"
                value={contractMax}
                onChange={(e) => setContractMax(e.target.value)}
                style={{ width: '100%', height: '40px', background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '8px', padding: '8px' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              onClick={() => {
                setSelectedPositions([]);
                setSelectedTeams([]);
                setPerformanceFilter('all');
                setMarketMin('');
                setMarketMax('');
                setContractMin('');
                setContractMax('');
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
            {sorted.map((p) => {
              const verdict = getVerdict(p.aav || 0, p.market_value || 0);
              const teamMeta = teamMetaByName[p.team] || {};

              return (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/player/${encodeURIComponent(p.player_name)}`)}
                >
                  <td style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {p.headshot_url && (
                      <img
                        src={p.headshot_url}
                        alt={p.player_name}
                        style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
                      />
                    )}
                    <span style={{ fontWeight: 600 }}>{p.player_name}</span>
                    <img
                      src={resolveLogoUrl(teamMeta.logo_url)}
                      onError={(e) => { e.target.onerror = null; e.target.src = defaultLogo; }}
                      alt={teamMeta.display_name || p.team}
                      style={{ width: 20, height: 20 }}
                    />
                  </td>

                  <td>{formatMoney(p.aav || 0)}</td>
                  <td>{formatMoney(p.market_value || 0)}</td>
                  <td><span className={verdict.className}>{verdict.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
