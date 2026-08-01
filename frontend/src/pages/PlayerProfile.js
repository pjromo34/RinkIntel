import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { bonusProgressColor, computePerformanceBonusTracker } from '../utils/performanceBonuses';

const API = 'http://127.0.0.1:8000';

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

function formatDifference(value) {
  const amount = Number(value) || 0;
  return amount >= 0 ? `+${formatMoney(amount)}` : `-${formatMoney(Math.abs(amount))}`;
}

function getVerdict(actual, market) {
  const delta = market - actual;
  if (delta <= -2000000) return { label: 'Underperforming', className: 'underperforming' };
  if (delta < -1000000) return { label: 'Slightly Underperforming', className: 'slightly-underperforming' };
  if (delta <= 1000000) return { label: 'Meeting Expectations', className: 'meeting' };
  if (delta < 2000000) return { label: 'Slightly Overperforming', className: 'slightly-overperforming' };
  return { label: 'Overperforming', className: 'overperforming' };
}

function parseSeasonStart(season) {
  const match = String(season || '').match(/(\d{4})/);
  return match ? Number(match[1]) : 0;
}

function seasonLabelFromStart(startYear) {
  const endYearTwoDigits = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endYearTwoDigits}`;
}

function normalizeSeasonLabel(season) {
  const year = parseSeasonStart(season);
  if (!year) return season;
  return seasonLabelFromStart(year);
}

function expandContracts(contracts) {
  const seasonMap = new Map();
  (Array.isArray(contracts) ? contracts : []).forEach((c) => {
    const start = parseSeasonStart(c?.start_season || c?.season);
    const years = Math.max(0, Number(c?.years) || 0);
    const aav = Number(c?.aav) || 0;
    if (!start || !years) return;
    for (let i = 0; i < years; i += 1) {
      seasonMap.set(seasonLabelFromStart(start + i), aav);
    }
  });
  return seasonMap;
}

function formatMillions(value) {
  return `$${Math.round(value / 1000000)}M`;
}

function buildLinePath(points) {
  if (!points.length) return '';
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
}

function PlayerValueChart({ data }) {
  const width = 900;
  const height = 340;
  const margin = { top: 20, right: 20, bottom: 56, left: 72 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const yMin = 0;
  const maxActualSalary = data.reduce((maxValue, row) => {
    return Math.max(maxValue, Number(row?.actualContract) || 0);
  }, 0);
  const yMax = maxActualSalary > 14000000 ? 20000000 : 14000000;

  const yTicks = Array.from({ length: yMax / 2000000 + 1 }, (_, index) => index * 2000000);

  const xForIndex = (index, count) => {
    if (count <= 1) return margin.left + chartWidth / 2;
    return margin.left + (index / (count - 1)) * chartWidth;
  };

  const yForValue = (value) => {
    const clamped = Math.max(yMin, Number(value) || 0);
    const normalized = (clamped - yMin) / (yMax - yMin);
    return margin.top + chartHeight - normalized * chartHeight;
  };

  const marketPoints = data
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.marketValue !== null && row.marketValue !== undefined)
    .map(({ row, index }) => ({
      x: xForIndex(index, data.length),
      y: yForValue(row.marketValue),
      season: row.season,
      value: row.marketValue
    }));

  const actualPoints = data
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.actualContract !== null && row.actualContract !== undefined)
    .map(({ row, index }) => ({
      x: xForIndex(index, data.length),
      y: yForValue(row.actualContract),
      season: row.season,
      value: row.actualContract
    }));

  return (
    <div style={{ marginTop: '28px' }}>
      <div
        style={{
          fontSize: '0.8rem',
          color: 'rgba(255,255,255,0.6)',
          marginBottom: '12px',
          letterSpacing: '0.05em'
        }}
      >
        VALUE TREND BY SEASON
      </div>

      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '18px', height: '3px', background: '#ffd700', display: 'inline-block' }} />
          <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)' }}>Market Value</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '18px', height: '3px', background: '#ffffff', display: 'inline-block' }} />
          <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)' }}>Actual Contract</span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{
          width: '100%',
          height: '340px',
          display: 'block',
          background: 'transparent',
          overflow: 'visible'
        }}
      >
        {yTicks.map(tick => {
          const y = yForValue(tick);
          return (
            <g key={tick}>
              <line
                x1={margin.left}
                y1={y}
                x2={margin.left + chartWidth}
                y2={y}
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="1"
              />
              <text
                x={margin.left - 12}
                y={y + 4}
                textAnchor="end"
                fill="rgba(255,255,255,0.72)"
                fontSize="12"
                fontWeight="600"
              >
                {formatMillions(tick)}
              </text>
            </g>
          );
        })}

        <line
          x1={margin.left}
          y1={margin.top}
          x2={margin.left}
          y2={margin.top + chartHeight}
          stroke="rgba(255,255,255,0.45)"
          strokeWidth="1.5"
        />
        <line
          x1={margin.left}
          y1={margin.top + chartHeight}
          x2={margin.left + chartWidth}
          y2={margin.top + chartHeight}
          stroke="rgba(255,255,255,0.45)"
          strokeWidth="1.5"
        />

        {data.map((row, index) => {
          const x = xForIndex(index, data.length);
          return (
            <text
              key={row.season}
              x={x}
              y={margin.top + chartHeight + 24}
              textAnchor="middle"
              fill="rgba(255,255,255,0.8)"
              fontSize="12"
              fontWeight="600"
            >
              {row.season}
            </text>
          );
        })}

        <text
          x={margin.left + chartWidth / 2}
          y={height - 10}
          textAnchor="middle"
          fill="rgba(255,255,255,0.8)"
          fontSize="12"
          fontWeight="700"
        >
          Season
        </text>

        <text
          x={20}
          y={margin.top + chartHeight / 2}
          fill="rgba(255,255,255,0.8)"
          fontSize="12"
          fontWeight="700"
          transform={`rotate(-90, 20, ${margin.top + chartHeight / 2})`}
          textAnchor="middle"
        >
          Dollar Value
        </text>

        <path
          d={buildLinePath(marketPoints)}
          fill="none"
          stroke="#ffd700"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={buildLinePath(actualPoints)}
          fill="none"
          stroke="#ffffff"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {marketPoints.map((point, index) => (
          <circle key={`market-${index}`} cx={point.x} cy={point.y} r="4.5" fill="#ffd700" />
        ))}
        {actualPoints.map((point, index) => (
          <circle key={`actual-${index}`} cx={point.x} cy={point.y} r="4.5" fill="#ffffff" />
        ))}
      </svg>
    </div>
  );
}

export default function PlayerProfile() {
  const { playerName } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [player, setPlayer] = useState(null);
  const [allPlayers, setAllPlayers] = useState([]);
  const [teamLogos, setTeamLogos] = useState({});

  const defaultLogo = `${API}/static/team_logos/default.svg`;
  const resolveLogoUrl = (url) => {
    if (!url) return defaultLogo;
    if (url.startsWith('/static/')) return `${API}${url}`;
    return url;
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const playerId = params.get('id');
    const playerReq = playerId
      ? axios.get(`${API}/players/${encodeURIComponent(playerId)}`)
      : axios.get(`${API}/players/by-name/${encodeURIComponent(playerName)}`);

    playerReq
      .then(res => setPlayer(res.data))
      .catch(() => {
        if (playerName) {
          axios
            .get(`${API}/players/by-name/${encodeURIComponent(playerName)}`)
            .then(res => setPlayer(res.data))
            .catch(() => {});
        }
      });

    axios
      .get(`${API}/players`)
      .then(res => setAllPlayers(res.data || []))
      .catch(() => {});

    axios
      .get(`${API}/players/teams`)
      .then(res => {
        const map = {};
        res.data.forEach(t => {
          if (t?.team) map[t.team] = t.logo_url;
        });
        setTeamLogos(map);
      })
      .catch(() => {});
  }, [playerName, location.search]);

  if (!player) return <div style={{ padding: '40px' }}>Loading...</div>;

  const goalie = isGoalie(player.position);
  const verdict = goalie ? null : getVerdict(player.aav || 0, player.market_value || 0);
  const bonusTracker = computePerformanceBonusTracker(player, allPlayers, player.season);
  const historyRows = Array.isArray(player.value_history)
    ? player.value_history
        .map(row => ({
          season: row?.season,
          marketValue: row?.market_value === null || row?.market_value === undefined ? null : Number(row.market_value),
          actualContract: Number(row?.aav) || 0
        }))
        .filter(row => row.season)
    : [];

  const rowsBySeason = new Map(
    historyRows.map(row => [row.season, row])
  );
  const contractBySeason = expandContracts(player.contracts);

  const currentSeason = normalizeSeasonLabel(player.season || 'Current');
  const currentAav = Number(contractBySeason.get(currentSeason)) || Number(player.aav) || 0;
  if (!rowsBySeason.has(currentSeason)) {
    rowsBySeason.set(currentSeason, {
      season: currentSeason,
      marketValue: player.market_value === null || player.market_value === undefined ? null : Number(player.market_value),
      actualContract: currentAav
    });
  }

  contractBySeason.forEach((aav, season) => {
    const existing = rowsBySeason.get(season);
    if (existing) {
      rowsBySeason.set(season, { ...existing, actualContract: aav });
      return;
    }
    rowsBySeason.set(season, {
      season,
      marketValue: null,
      actualContract: aav,
    });
  });

  const chartRows = Array.from(rowsBySeason.values())
    .sort((a, b) => parseSeasonStart(a.season) - parseSeasonStart(b.season));
  const playerNumber = player.number === null || player.number === undefined || player.number === '' ? 'N/A' : player.number;
  const playerPosition = formatPosition(player.position);
  const valueDifference = goalie || player.market_value === null || player.market_value === undefined
    ? null
    : (Number(player.market_value) || 0) - (Number(currentAav) || 0);
  const historicalSnapshots = Array.isArray(player.historical_snapshots) ? player.historical_snapshots : [];

  return (
    <div style={{ padding: '32px 40px' }}>
      <button
        onClick={() => navigate(-1)}
        style={{
          background: 'rgba(255,255,255,0.1)',
          border: 'none',
          color: '#fff',
          padding: '8px 16px',
          borderRadius: '8px',
          fontWeight: 600,
          marginBottom: '24px'
        }}
      >
        ← Back
      </button>

      <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>
        <div className="glass" style={{ padding: '32px', flex: 1, position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              padding: '4px 10px',
              borderRadius: '999px',
              background: 'rgba(255,215,0,0.15)',
              color: '#ffd700',
              fontSize: '0.8rem',
              fontWeight: 700,
              letterSpacing: '0.3px'
            }}
          >
            {player.season || 'N/A'}
          </div>
          <div
            style={{
              display: 'flex',
              gap: '24px',
              alignItems: 'center',
              marginBottom: '32px'
            }}
          >
            {player.headshot_url ? (
              <img
                src={player.headshot_url}
                alt={player.name}
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid #ffffff'
                }}
              />
            ) : (
              <div
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem'
                }}
              >
                {player.name[0]}
              </div>
            )}

            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>{player.name}</h1>

              <div
                onClick={() => navigate(`/team/${player.team}`)}
                style={{
                  color: '#ffd700',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '1.1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <img
                  src={resolveLogoUrl(teamLogos[player.team])}
                  onError={(e) => { e.target.onerror = null; e.target.src = defaultLogo; }}
                  alt={player.team}
                  style={{ width: 38, height: 38 }}
                />
                <span>{player.team}</span>
              </div>

              <div
                style={{
                  marginTop: '8px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <div
                  style={{
                    background: 'rgba(255,255,255,0.12)',
                    border: '1px solid rgba(255,255,255,0.9)',
                    borderRadius: '8px',
                    padding: '4px 0',
                    display: 'inline-flex',
                    alignItems: 'center',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: '#ffffff',
                    letterSpacing: '0.3px'
                  }}
                >
                  <span style={{ padding: '0 12px' }}>{playerPosition}</span>
                  <span style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.9)' }} />
                  <span style={{ padding: '0 12px' }}>{playerNumber}</span>
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px',
              marginBottom: '32px'
            }}
          >
            {[
              { label: 'Goals', value: player.goals },
              { label: 'Assists', value: player.assists },
              { label: 'Points', value: player.points },
              { label: 'xG', value: player.xg_all_situations?.toFixed(2) }
            ].map(stat => (
              <div
                key={stat.label}
                className="glass"
                style={{ padding: '16px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.9)' }}
              >
                <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>
                  {stat.value}
                </div>
                <div
                  style={{
                    fontSize: '0.8rem',
                    color: 'rgba(255,255,255,0.6)',
                    marginTop: '4px'
                  }}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px'
            }}
          >
            <div className="glass" style={{ padding: '20px', border: '1px solid rgba(255,255,255,0.9)' }}>
              <div
                style={{
                  fontSize: '0.8rem',
                  color: 'rgba(255,255,255,0.6)',
                  marginBottom: '8px'
                }}
              >
                ACTUAL CAP HIT
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>
                {formatMoney(currentAav || 0)}
              </div>
            </div>

            <div className="glass" style={{ padding: '20px', border: '1px solid rgba(255,255,255,0.9)' }}>
              <div
                style={{
                  fontSize: '0.8rem',
                  color: 'rgba(255,255,255,0.6)',
                  marginBottom: '8px'
                }}
              >
                MARKET VALUE
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>
                {formatMarketValue(player.market_value)}
              </div>
            </div>

            <div className="glass" style={{ padding: '20px', border: '1px solid rgba(255,255,255,0.9)' }}>
              <div
                style={{
                  fontSize: '0.8rem',
                  color: 'rgba(255,255,255,0.6)',
                  marginBottom: '8px'
                }}
              >
                DIFFERENCE
              </div>
              <div
                style={{
                  fontSize: '1.4rem',
                  fontWeight: 700,
                  color: valueDifference === null ? 'rgba(255,255,255,0.65)' : (valueDifference >= 0 ? '#22c55e' : '#ef4444')
                }}
              >
                {valueDifference === null ? '—' : formatDifference(valueDifference)}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            {verdict ? (
              <span className={verdict.className} style={{ fontSize: '1.2rem' }}>
                {verdict.label}
              </span>
            ) : (
              <span style={{ fontSize: '1.2rem', color: 'rgba(255,255,255,0.6)' }}>
                No market value for goalies
              </span>
            )}
          </div>

          <PlayerValueChart data={chartRows} />

          {historicalSnapshots.length > 0 && (
            <div style={{ marginTop: '24px' }}>
              <h3 style={{ marginBottom: '10px', fontSize: '1.05rem' }}>Prior Seasons</h3>
              <div style={{ display: 'grid', gap: '12px' }}>
                {historicalSnapshots.map((row) => {
                  const prevDiff = goalie || row.market_value === null || row.market_value === undefined
                    ? null
                    : (Number(row.market_value) || 0) - (Number(row.aav) || 0);
                  return (
                    <div key={row.season} className="glass" style={{ padding: '14px', border: '1px solid rgba(255,255,255,0.2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <img
                            src={resolveLogoUrl(teamLogos[row.team])}
                            onError={(e) => { e.target.onerror = null; e.target.src = defaultLogo; }}
                            alt={row.team || 'Team'}
                            style={{ width: 24, height: 24 }}
                          />
                          <div style={{ fontWeight: 700 }}>{row.team || 'N/A'}</div>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#ffd700', fontWeight: 800 }}>{row.season}</div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: '8px', marginBottom: '8px' }}>
                        <div className="glass" style={{ padding: '8px', textAlign: 'center' }}><div style={{ fontSize: '1rem', fontWeight: 800 }}>{row.goals || 0}</div><div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.68)' }}>Goals</div></div>
                        <div className="glass" style={{ padding: '8px', textAlign: 'center' }}><div style={{ fontSize: '1rem', fontWeight: 800 }}>{row.assists || 0}</div><div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.68)' }}>Assists</div></div>
                        <div className="glass" style={{ padding: '8px', textAlign: 'center' }}><div style={{ fontSize: '1rem', fontWeight: 800 }}>{row.points || 0}</div><div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.68)' }}>Points</div></div>
                        <div className="glass" style={{ padding: '8px', textAlign: 'center' }}><div style={{ fontSize: '1rem', fontWeight: 800 }}>{Number(row.xg_all_situations || 0).toFixed(2)}</div><div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.68)' }}>xG</div></div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '8px' }}>
                        <div className="glass" style={{ padding: '8px' }}><div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.65)' }}>ACTUAL CAP HIT</div><div style={{ fontWeight: 800 }}>{formatMoney(row.aav || 0)}</div></div>
                        <div className="glass" style={{ padding: '8px' }}><div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.65)' }}>MARKET VALUE</div><div style={{ fontWeight: 800 }}>{formatMarketValue(row.market_value)}</div></div>
                        <div className="glass" style={{ padding: '8px' }}><div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.65)' }}>DIFFERENCE</div><div style={{ fontWeight: 800, color: prevDiff === null ? 'rgba(255,255,255,0.6)' : (prevDiff >= 0 ? '#22c55e' : '#ef4444') }}>{prevDiff === null ? '—' : formatDifference(prevDiff)}</div></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {bonusTracker && (
            <div style={{ marginTop: '26px' }}>
              <h3 style={{ marginBottom: '12px', fontSize: '1.05rem' }}>Performance Bonus Tracker</h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '12px' }}>
                <div className="glass" style={{ padding: '14px', border: '1px solid rgba(255,255,255,0.9)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>BONUS ELIGIBLE</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{formatMoney(bonusTracker.bonusTotal)}</div>
                </div>
                <div className="glass" style={{ padding: '14px', border: '1px solid rgba(255,255,255,0.9)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>BONUS EARNED</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{formatMoney(bonusTracker.earnedTotal)}</div>
                  {bonusTracker.maxedOut && <div style={{ fontSize: '0.78rem', color: '#22c55e', marginTop: '2px' }}>maxed out</div>}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="glass" style={{ padding: '14px', border: '1px solid rgba(255,255,255,0.9)' }}>
                  <div style={{ fontWeight: 700, marginBottom: '8px' }}>A Bonuses (up to {formatMoney(bonusTracker.aPool)})</div>
                  <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.68)', marginBottom: '8px' }}>
                    A bonuses are paid in $250,000 increments from the first $1,000,000 of total bonus incentives. If less than $250,000 remains in the A pool, the player can still earn that partial amount.
                  </div>
                  {bonusTracker.aItems.map((item) => {
                    const pct = Math.max(0, Math.min(1, item.progress || 0));
                    const color = bonusProgressColor(pct);
                    return (
                      <div key={item.key} style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '0.8rem', marginBottom: '2px' }}>{item.label}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1, height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
                            <div style={{ width: `${pct * 100}%`, height: '100%', background: color }} />
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.7)' }}>{item.current}/{item.needed}</div>
                        </div>
                      </div>
                    );
                  })}
                  {bonusTracker.unsupportedA.length > 0 && (
                    <div style={{ marginTop: '8px', fontSize: '0.74rem', color: 'rgba(255,255,255,0.62)' }}>
                      Unsupported: {bonusTracker.unsupportedA.join(', ')}
                    </div>
                  )}
                </div>

                <div className="glass" style={{ padding: '14px', border: '1px solid rgba(255,255,255,0.9)' }}>
                  <div style={{ fontWeight: 700, marginBottom: '8px' }}>B Bonuses (up to {formatMoney(bonusTracker.bPool)})</div>
                  <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.68)', marginBottom: '8px' }}>
                    B bonuses use the remaining bonus incentive amount after the A pool, up to $2,500,000. Only one B bonus can be achieved.
                  </div>
                  {bonusTracker.bItems.map((item) => {
                    const pct = Math.max(0, Math.min(1, item.progress || 0));
                    const color = bonusProgressColor(pct);
                    return (
                      <div key={item.key} style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '0.8rem', marginBottom: '2px' }}>{item.label}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1, height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
                            <div style={{ width: `${pct * 100}%`, height: '100%', background: color }} />
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.7)' }}>{item.current}/{item.needed}</div>
                        </div>
                      </div>
                    );
                  })}
                  {bonusTracker.unsupportedB.length > 0 && (
                    <div style={{ marginTop: '8px', fontSize: '0.74rem', color: 'rgba(255,255,255,0.62)' }}>
                      Unsupported: {bonusTracker.unsupportedB.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
