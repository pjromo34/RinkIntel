import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../api';

const API = API_BASE_URL;

function formatMoney(val) {
  return '$' + Number(val).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function isGoalie(position) {
  const normalized = String(position || '').trim().toUpperCase();
  return normalized === 'G' || normalized === 'GOALIE' || normalized === 'GOALTENDER';
}

function formatPosition(position) {
  const normalized = String(position || '').trim().toUpperCase();
  if (normalized === 'L') return 'LW';
  if (normalized === 'R') return 'RW';
  return normalized || 'N/A';
}

function formatMarketValue(value) {
  return value === null || value === undefined ? '—' : formatMoney(value);
}

function formatRangeValue(value, formatter) {
  return formatter ? formatter(value) : String(value);
}

function getBounds(players, selector, roundMax = (value) => value) {
  const values = players.map(selector).map((value) => Number(value) || 0);
  const maxValue = values.length ? Math.max(...values) : 0;
  return { min: 0, max: roundMax(maxValue) };
}

function clampRange(nextMin, nextMax, minimum, maximum) {
  return [Math.max(minimum, Math.min(nextMin, nextMax)), Math.min(maximum, Math.max(nextMin, nextMax))];
}

function roundMoneyMax(value) {
  const bucket = 500000;
  return Math.max(bucket, Math.ceil((Number(value) || 0) / bucket) * bucket);
}

function roundXgMax(value) {
  const rounded = Math.ceil((Number(value) || 0) * 10) / 10;
  return Math.max(1, rounded);
}

function computePpsValue(player) {
  const points = Number(player?.points) || 0;
  const takeaways = Number(player?.takeaways) || 0;
  const giveaways = Number(player?.giveaways) || 0;
  return (points + (takeaways - giveaways)) / 60;
}

function DualRangeFilter({ label, min, max, step, value, onChange, formatValue }) {
  const [currentMin, currentMax] = value;
  const safeMax = Math.max(min, max);
  const span = Math.max(1, safeMax - min);
  const leftPct = ((currentMin - min) / span) * 100;
  const rightPct = ((currentMax - min) / span) * 100;

  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.65)', marginBottom: '6px' }}>
        {label}
      </label>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '0.78rem', color: 'rgba(255,255,255,0.88)', marginBottom: '8px' }}>
        <span>{formatRangeValue(currentMin, formatValue)}</span>
        <span>{formatRangeValue(currentMax, formatValue)}</span>
      </div>
      <div style={{ position: 'relative', height: '26px' }}>
        <div style={{ position: 'absolute', top: '11px', left: 0, right: 0, height: '4px', borderRadius: '999px', background: 'rgba(255,255,255,0.12)' }} />
        <div
          style={{
            position: 'absolute',
            top: '11px',
            left: `${leftPct}%`,
            width: `${Math.max(0, rightPct - leftPct)}%`,
            height: '4px',
            borderRadius: '999px',
            background: '#ffd700'
          }}
        />
        <input
          type="range"
          min={min}
          max={safeMax}
          step={step}
          value={currentMin}
          onChange={(e) => onChange(clampRange(Number(e.target.value), currentMax, min, safeMax))}
          style={{ position: 'absolute', inset: 0, width: '100%', background: 'transparent', pointerEvents: 'auto' }}
        />
        <input
          type="range"
          min={min}
          max={safeMax}
          step={step}
          value={currentMax}
          onChange={(e) => onChange(clampRange(currentMin, Number(e.target.value), min, safeMax))}
          style={{ position: 'absolute', inset: 0, width: '100%', background: 'transparent', pointerEvents: 'auto' }}
        />
      </div>
    </div>
  );
}

function getVerdict(actual, market) {
  const delta = market - actual;
  if (delta <= -2000000) return { label: 'Underperforming', className: 'underperforming' };
  if (delta < -1000000) return { label: 'Slightly Underperforming', className: 'slightly-underperforming' };
  if (delta <= 1000000) return { label: 'Meeting Expectations', className: 'meeting' };
  if (delta < 2000000) return { label: 'Slightly Overperforming', className: 'slightly-overperforming' };
  return { label: 'Overperforming', className: 'overperforming' };
}

function splitNameParts(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  const first = parts.slice(0, -1).join(' ');
  const last = parts.length ? parts[parts.length - 1] : '';
  return { first, last };
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

export default function Players() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [teamMetaByName, setTeamMetaByName] = useState({});
  const [sortBy, setSortBy] = useState('xg_all_situations');
  const [sortDir, setSortDir] = useState('desc');
  const [playerSearch, setPlayerSearch] = useState('');
  const [selectedPositions, setSelectedPositions] = useState([]);
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [marketRange, setMarketRange] = useState([0, 0]);
  const [contractRange, setContractRange] = useState([0, 0]);
  const [goalRange, setGoalRange] = useState([0, 0]);
  const [assistRange, setAssistRange] = useState([0, 0]);
  const [pointRange, setPointRange] = useState([0, 0]);
  const [xgRange, setXgRange] = useState([0, 0]);

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
      const loadedPlayers = (playersRes.data || []).map((player) => ({
        ...player,
        pps: computePpsValue(player),
      }));
      setPlayers(loadedPlayers);
      const map = {};
      (teamsRes.data || []).forEach((team) => {
        if (team?.team) map[team.team] = team;
      });
      setTeamMetaByName(map);

      const marketBounds = getBounds(loadedPlayers, (p) => p.market_value, roundMoneyMax);
      const contractBounds = getBounds(loadedPlayers, (p) => p.aav, roundMoneyMax);
      const goalBounds = getBounds(loadedPlayers, (p) => p.goals, (value) => Math.max(1, Math.ceil(value)));
      const assistBounds = getBounds(loadedPlayers, (p) => p.assists, (value) => Math.max(1, Math.ceil(value)));
      const pointBounds = getBounds(loadedPlayers, (p) => p.points, (value) => Math.max(1, Math.ceil(value)));
      const xgBounds = getBounds(loadedPlayers, (p) => p.xg_all_situations, roundXgMax);

      setMarketRange([marketBounds.min, marketBounds.max]);
      setContractRange([contractBounds.min, contractBounds.max]);
      setGoalRange([goalBounds.min, goalBounds.max]);
      setAssistRange([assistBounds.min, assistBounds.max]);
      setPointRange([pointBounds.min, pointBounds.max]);
      setXgRange([xgBounds.min, xgBounds.max]);
    });
  }, []);

  const marketBounds = getBounds(players, (p) => p.market_value, roundMoneyMax);
  const contractBounds = getBounds(players, (p) => p.aav, roundMoneyMax);
  const goalBounds = getBounds(players, (p) => p.goals, (value) => Math.max(1, Math.ceil(value)));
  const assistBounds = getBounds(players, (p) => p.assists, (value) => Math.max(1, Math.ceil(value)));
  const pointBounds = getBounds(players, (p) => p.points, (value) => Math.max(1, Math.ceil(value)));
  const xgBounds = getBounds(players, (p) => p.xg_all_situations, roundXgMax);

  function handleSort(col) {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir(['market_value', 'aav', 'goals', 'assists', 'points', 'xg_all_situations', 'pps'].includes(col) ? 'desc' : 'asc');
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

  const positionOptions = Array.from(
    new Set(players.map((p) => p.position).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const teamOptions = Array.from(
    new Set(players.map((p) => p.team).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const filteredPlayers = players.filter((p) => {
    const searchText = String(playerSearch || '').trim().toLowerCase();
    const nameText = String(p.player_name || '').toLowerCase();
    const teamText = String(p.team || '').toLowerCase();
    const bySearch = !searchText || nameText.includes(searchText) || teamText.includes(searchText);

    const byPosition = selectedPositions.length === 0 || selectedPositions.includes(p.position);
    const byTeam = selectedTeams.length === 0 || selectedTeams.includes(p.team);

    const market = Number(p.market_value) || 0;
    const actual = Number(p.aav) || 0;
    const goals = Number(p.goals) || 0;
    const assists = Number(p.assists) || 0;
    const points = Number(p.points) || 0;
    const xg = Number(p.xg_all_situations) || 0;

    const byMarketRange = market >= marketRange[0] && market <= marketRange[1];
    const byContractRange = actual >= contractRange[0] && actual <= contractRange[1];
    const byGoalRange = goals >= goalRange[0] && goals <= goalRange[1];
    const byAssistRange = assists >= assistRange[0] && assists <= assistRange[1];
    const byPointRange = points >= pointRange[0] && points <= pointRange[1];
    const byXgRange = xg >= xgRange[0] && xg <= xgRange[1];

    return bySearch && byPosition && byTeam && byMarketRange && byContractRange && byGoalRange && byAssistRange && byPointRange && byXgRange;
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
    <div className="players-page" style={{ padding: '32px 40px' }}>
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
          className="players-filters-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(220px, 1fr))',
            gap: '14px',
            marginBottom: '18px'
          }}
        >
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.65)', marginBottom: '6px' }}>
              PLAYER SEARCH
            </label>
            <input
              type="text"
              value={playerSearch}
              onChange={(e) => setPlayerSearch(e.target.value)}
              placeholder="Search player or team"
              style={{ width: '100%', height: '40px', background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '8px', padding: '8px 12px' }}
            />
          </div>

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
                    src={resolveLogoUrl((teamMetaByName[team] || {}).logo_url)}
                    onError={(e) => { e.target.onerror = null; e.target.src = defaultLogo; }}
                    alt={team}
                    style={{ width: 18, height: 18, flexShrink: 0 }}
                  />
                  <span>{team}</span>
                </span>
              )}
            />
          </div>

          <div>
            <DualRangeFilter
              label="MARKET VALUE RANGE ($)"
              min={marketBounds.min}
              max={marketBounds.max}
              step={100000}
              value={marketRange}
              onChange={setMarketRange}
              formatValue={formatMoney}
            />
          </div>

          <div>
            <DualRangeFilter
              label="ACTUAL CONTRACT RANGE ($)"
              min={contractBounds.min}
              max={contractBounds.max}
              step={100000}
              value={contractRange}
              onChange={setContractRange}
              formatValue={formatMoney}
            />
          </div>

          <div>
            <DualRangeFilter
              label="GOALS"
              min={goalBounds.min}
              max={goalBounds.max}
              step={1}
              value={goalRange}
              onChange={setGoalRange}
            />
          </div>

          <div>
            <DualRangeFilter
              label="ASSISTS"
              min={assistBounds.min}
              max={assistBounds.max}
              step={1}
              value={assistRange}
              onChange={setAssistRange}
            />
          </div>

          <div>
            <DualRangeFilter
              label="POINTS"
              min={pointBounds.min}
              max={pointBounds.max}
              step={1}
              value={pointRange}
              onChange={setPointRange}
            />
          </div>

          <div>
            <DualRangeFilter
              label="EXPECTED GOALS"
              min={xgBounds.min}
              max={xgBounds.max}
              step={0.1}
              value={xgRange}
              onChange={setXgRange}
              formatValue={(value) => Number(value).toFixed(1)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              onClick={() => {
                setPlayerSearch('');
                setSelectedPositions([]);
                setSelectedTeams([]);
                setMarketRange([marketBounds.min, marketBounds.max]);
                setContractRange([contractBounds.min, contractBounds.max]);
                setGoalRange([goalBounds.min, goalBounds.max]);
                setAssistRange([assistBounds.min, assistBounds.max]);
                setPointRange([pointBounds.min, pointBounds.max]);
                setXgRange([xgBounds.min, xgBounds.max]);
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

        <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <SortHeader col="player_name" label="Player" />
              <SortHeader col="aav" label="Actual Cap Hit" />
              <SortHeader col="market_value" label="Market Value" />
              <th>Status</th>
              <SortHeader col="goals" label="Goals" />
              <SortHeader col="assists" label="Assists" />
              <SortHeader col="points" label="Points" />
              <SortHeader col="pps" label="PPS" />
              <SortHeader col="xg_all_situations" label="xG" />
            </tr>
          </thead>

          <tbody>
            {sorted.map((p) => {
              const goalie = isGoalie(p.position);
              const verdict = goalie ? null : getVerdict(p.aav || 0, p.market_value || 0);
              const teamMeta = teamMetaByName[p.team] || {};

              return (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/player/${encodeURIComponent(p.player_name)}?id=${p.id}`)}
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
                      style={{ width: 40, height: 40 }}
                    />
                  </td>

                  <td>{formatMoney(p.aav || 0)}</td>
                  <td>{formatMarketValue(p.market_value)}</td>
                  <td>{verdict ? <span className={verdict.className}>{verdict.label}</span> : '—'}</td>
                  <td>{Number(p.goals) || 0}</td>
                  <td>{Number(p.assists) || 0}</td>
                  <td>{Number(p.points) || 0}</td>
                  <td>{Number(p.pps || 0).toFixed(2)}</td>
                  <td>{Number(p.xg_all_situations || 0).toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
