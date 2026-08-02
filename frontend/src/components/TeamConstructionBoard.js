import React from 'react';
import { formatCapPct, playerCapPct } from '../utils/teamConstruction';
import { API_BASE_URL } from '../api';

const API = API_BASE_URL;
const DEFAULT_HEADSHOT = `${API}/static/team_logos/default.svg`;

function resolveImage(url) {
  if (!url) return DEFAULT_HEADSHOT;
  if (url.startsWith('/static/')) return `${API}${url}`;
  return url;
}

function splitName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: parts[0] || '', last: '' };
  return {
    first: parts.slice(0, -1).join(' '),
    last: parts[parts.length - 1],
  };
}

function playerCard(player, salaryCap, accentColor, horizontal) {
  if (!player) {
    return (
      <div
        className="glass"
        style={{
          minHeight: horizontal ? '88px' : '120px',
          border: '1px dashed rgba(255,255,255,0.22)',
          borderRadius: '10px',
          background: 'rgba(255,255,255,0.03)'
        }}
      />
    );
  }

  const capShare = formatCapPct(playerCapPct(player, salaryCap));
  const nameParts = splitName(player.player_name);

  return (
    <div>
      <div
        className="glass"
        style={{
          border: accentColor ? `1px solid ${accentColor}` : '1px solid rgba(255,255,255,0.2)',
          padding: horizontal ? '6px 8px' : '7px 8px 5px 8px',
          borderBottomLeftRadius: '0',
          borderBottomRightRadius: '0',
          minHeight: horizontal ? '70px' : '90px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img
            src={resolveImage(player.headshot_url)}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = DEFAULT_HEADSHOT;
            }}
            alt={player.player_name}
            style={{ width: horizontal ? 44 : 54, height: horizontal ? 44 : 54, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontWeight: 800,
                fontSize: horizontal ? '0.88rem' : '0.82rem',
                lineHeight: 1.05,
                color: '#fff'
              }}
              title={player.player_name}
            >
              <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nameParts.first || player.player_name}</div>
              {nameParts.last ? (
                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nameParts.last}</div>
              ) : null}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: horizontal ? '0.76rem' : '0.73rem', marginTop: '1px' }}>
              {capShare} of cap
            </div>
          </div>
        </div>
      </div>
      <div
        style={{
          border: accentColor ? `1px solid ${accentColor}` : '1px solid rgba(255,255,255,0.2)',
          borderTop: 'none',
          borderBottomLeftRadius: '10px',
          borderBottomRightRadius: '10px',
          background: 'rgba(15,25,35,0.9)',
          textAlign: 'center',
          fontSize: '0.78rem',
          letterSpacing: '0.05em',
          fontWeight: 700,
          padding: '2px 6px',
          color: '#fff'
        }}
      >
        {player.slotLabel}
      </div>
    </div>
  );
}

function ForwardGrid({ lineup, salaryCap, compareColors, horizontal }) {
  const rows = [0, 1, 2, 3];
  return (
    <div className={horizontal ? 'team-board-mobile-stack' : ''} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
      {rows.map((idx) => (
        <React.Fragment key={`f-${idx}`}>
          <div>{playerCard(lineup.forwards.LW[idx], salaryCap, compareColors?.[`LW${idx + 1}`], horizontal)}</div>
          <div>{playerCard(lineup.forwards.C[idx], salaryCap, compareColors?.[`C${idx + 1}`], horizontal)}</div>
          <div>{playerCard(lineup.forwards.RW[idx], salaryCap, compareColors?.[`RW${idx + 1}`], horizontal)}</div>
        </React.Fragment>
      ))}
    </div>
  );
}

function DefenseGrid({ lineup, salaryCap, compareColors, horizontal }) {
  const rows = [0, 1, 2];
  return (
    <div className={horizontal ? 'team-board-mobile-stack' : ''} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
      {rows.map((row) => {
        const leftIdx = row * 2;
        const rightIdx = row * 2 + 1;
        return (
          <React.Fragment key={`d-${row}`}>
            <div>{playerCard(lineup.defense[leftIdx], salaryCap, compareColors?.[`D${leftIdx + 1}`], horizontal)}</div>
            <div>{playerCard(lineup.defense[rightIdx], salaryCap, compareColors?.[`D${rightIdx + 1}`], horizontal)}</div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function GoalieGrid({ lineup, salaryCap, horizontal }) {
  return (
    <div className={horizontal ? 'team-board-goalie-stack' : ''} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
      <div>{playerCard(lineup.goalies[0], salaryCap, null, horizontal)}</div>
      <div>{playerCard(lineup.goalies[1], salaryCap, null, horizontal)}</div>
    </div>
  );
}

export default function TeamConstructionBoard({
  title,
  logoUrl,
  lineup,
  salaryCap,
  breakdown,
  compact = false,
  compareColors,
}) {
  const lineupSection = compact ? (
    <div style={{ display: 'grid', gap: '12px' }}>
      <div>
        <div style={{ fontSize: '0.76rem', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.68)', marginBottom: '8px' }}>FORWARDS</div>
        <ForwardGrid lineup={lineup} salaryCap={salaryCap} compareColors={compareColors} horizontal={compact} />
      </div>

      <div>
        <div style={{ fontSize: '0.76rem', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.68)', marginBottom: '8px' }}>DEFENSE</div>
        <DefenseGrid lineup={lineup} salaryCap={salaryCap} compareColors={compareColors} horizontal={compact} />
      </div>

      <div>
        <div style={{ fontSize: '0.76rem', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.68)', marginBottom: '8px' }}>GOALIES</div>
        <GoalieGrid lineup={lineup} salaryCap={salaryCap} horizontal={compact} />
      </div>
    </div>
  ) : (
    <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr 1fr', gap: '12px', alignItems: 'start' }}>
      <div>
        <div style={{ fontSize: '0.76rem', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.68)', marginBottom: '8px' }}>FORWARDS</div>
        <ForwardGrid lineup={lineup} salaryCap={salaryCap} compareColors={compareColors} horizontal={compact} />
      </div>

      <div>
        <div style={{ fontSize: '0.76rem', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.68)', marginBottom: '8px' }}>DEFENSE</div>
        <DefenseGrid lineup={lineup} salaryCap={salaryCap} compareColors={compareColors} horizontal={compact} />
      </div>

      <div>
        <div style={{ fontSize: '0.76rem', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.68)', marginBottom: '8px' }}>GOALIES</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
          <div>{playerCard(lineup.goalies[0], salaryCap, null, compact)}</div>
          <div>{playerCard(lineup.goalies[1], salaryCap, null, compact)}</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="glass team-construction-board" style={{ padding: compact ? '14px' : '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        {logoUrl ? (
          <img src={resolveImage(logoUrl)} alt={title} style={{ width: compact ? 34 : 42, height: compact ? 34 : 42 }} />
        ) : null}
        <div style={{ fontSize: compact ? '1rem' : '1.08rem', fontWeight: 800 }}>{title}</div>
      </div>

      {lineupSection}

      {breakdown && (
        <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '8px' }}>
          <div className="glass" style={{ padding: '8px 10px' }}><div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)' }}>F CAP</div><div style={{ fontWeight: 800 }}>{formatCapPct(breakdown.forwards_cap_pct)}</div></div>
          <div className="glass" style={{ padding: '8px 10px' }}><div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)' }}>D CAP</div><div style={{ fontWeight: 800 }}>{formatCapPct(breakdown.defense_cap_pct)}</div></div>
          <div className="glass" style={{ padding: '8px 10px' }}><div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)' }}>G CAP</div><div style={{ fontWeight: 800 }}>{formatCapPct(breakdown.goalies_cap_pct)}</div></div>
          <div className="glass" style={{ padding: '8px 10px' }}><div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)' }}>TOP 3F</div><div style={{ fontWeight: 800 }}>{formatCapPct(breakdown.top3f_cap_pct)}</div></div>
          <div className="glass" style={{ padding: '8px 10px' }}><div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)' }}>TOP 2D</div><div style={{ fontWeight: 800 }}>{formatCapPct(breakdown.top2d_cap_pct)}</div></div>
          <div className="glass" style={{ padding: '8px 10px' }}><div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)' }}>TOP 6F</div><div style={{ fontWeight: 800 }}>{formatCapPct(breakdown.top6f_cap_pct)}</div></div>
          <div className="glass" style={{ padding: '8px 10px', gridColumn: '1 / span 2' }}><div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)' }}>BOTTOM 6F</div><div style={{ fontWeight: 800 }}>{formatCapPct(breakdown.bottom6f_cap_pct)}</div></div>
        </div>
      )}
    </div>
  );
}
