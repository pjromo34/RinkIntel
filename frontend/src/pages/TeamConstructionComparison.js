import React, { useMemo, useState, useEffect } from 'react';
import axios from 'axios';
import TeamConstructionBoard from '../components/TeamConstructionBoard';
import { allComparableSlots, buildTeamConstruction, formatCapPct } from '../utils/teamConstruction';
import { API_BASE_URL } from '../api';

const API = API_BASE_URL;
const DEFAULT_LOGO = `${API}/static/team_logos/default.svg`;

function resolveLogo(url) {
  if (!url) return DEFAULT_LOGO;
  if (url.startsWith('/static/')) return `${API}${url}`;
  return url;
}

function compareColors(layoutA, layoutB) {
  const colorsA = {};
  const colorsB = {};

  allComparableSlots().forEach((slot) => {
    const a = Number(layoutA?.slotMap?.[slot]?.aav) || 0;
    const b = Number(layoutB?.slotMap?.[slot]?.aav) || 0;

    if (!a && !b) return;
    if (a > b) {
      colorsA[slot] = 'rgba(239,68,68,0.95)';
      colorsB[slot] = 'rgba(34,197,94,0.95)';
    } else if (b > a) {
      colorsA[slot] = 'rgba(34,197,94,0.95)';
      colorsB[slot] = 'rgba(239,68,68,0.95)';
    }
  });

  return { colorsA, colorsB };
}

function StatRow({ label, left, right }) {
  const leftNum = Number(left) || 0;
  const rightNum = Number(right) || 0;
  const leftWinner = leftNum > rightNum;
  const rightWinner = rightNum > leftNum;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        alignItems: 'center',
        gap: '8px',
        fontSize: '0.92rem',
        padding: '8px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.08)'
      }}
    >
      <div style={{ textAlign: 'right', color: leftWinner ? '#fff' : 'rgba(255,255,255,0.74)', fontWeight: leftWinner ? 800 : 600 }}>{formatCapPct(left)}</div>
      <div style={{ textAlign: 'center', color: '#ffd700', fontWeight: 700 }}>{label}</div>
      <div style={{ textAlign: 'left', color: rightWinner ? '#fff' : 'rgba(255,255,255,0.74)', fontWeight: rightWinner ? 800 : 600 }}>{formatCapPct(right)}</div>
    </div>
  );
}

function TeamPicker({ label, teams, selected, onSelect }) {
  const [open, setOpen] = useState(false);
  const current = teams.find((t) => t.team === selected);

  return (
    <div style={{ position: 'relative', zIndex: open ? 1200 : 2 }}>
      <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', marginBottom: '6px' }}>{label}</div>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          height: '40px',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.18)',
          background: 'rgba(255,255,255,0.08)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 10px',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <img src={resolveLogo(current?.logo_url)} alt={current?.team || 'Team'} style={{ width: 18, height: 18, flexShrink: 0 }} />
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{current?.display_name || current?.team || 'Select team'}</span>
        </span>
        <span style={{ color: '#ffd700' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div
          className="glass"
          style={{
            position: 'absolute',
            zIndex: 1300,
            left: 0,
            right: 0,
            top: '46px',
            maxHeight: '260px',
            overflowY: 'auto',
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(10, 18, 28, 0.98)',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
          }}
        >
          {teams.map((t) => (
            <button
              key={t.team}
              onClick={() => {
                onSelect(t.team);
                setOpen(false);
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                border: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                background: selected === t.team ? 'rgba(255,215,0,0.18)' : 'rgba(10, 18, 28, 0.98)',
                color: '#fff',
                padding: '8px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
              }}
            >
              <img src={resolveLogo(t.logo_url)} alt={t.team} style={{ width: 18, height: 18, flexShrink: 0 }} />
              <span>{t.display_name || t.team}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TeamConstructionComparison() {
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [salaryCap, setSalaryCap] = useState(95500000);
  const [teamA, setTeamA] = useState('');
  const [teamB, setTeamB] = useState('');
  const [activePair, setActivePair] = useState({ a: '', b: '' });

  const teamMetaByName = useMemo(() => {
    const map = {};
    (teams || []).forEach((t) => {
      if (t?.team) map[t.team] = t;
    });
    return map;
  }, [teams]);

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/players`),
      axios.get(`${API}/players/teams`),
      axios.get(`${API}/players/meta`).catch(() => ({ data: {} })),
    ]).then(([playersRes, teamsRes, metaRes]) => {
      const allPlayers = playersRes.data || [];
      const allTeams = teamsRes.data || [];
      setPlayers(allPlayers);
      setTeams([...allTeams].sort((a, b) => String(a?.display_name || a?.team || '').localeCompare(String(b?.display_name || b?.team || ''))));

      const sortedTeams = [...allTeams].sort((a, b) => String(a?.display_name || a?.team || '').localeCompare(String(b?.display_name || b?.team || '')));
      const initialA = sortedTeams[0]?.team || '';
      const initialB = sortedTeams[1]?.team || sortedTeams[0]?.team || '';
      setTeamA(initialA);
      setTeamB(initialB);
      setActivePair({ a: initialA, b: initialB });

      const cap = Number(metaRes?.data?.salary_cap) || 95500000;
      setSalaryCap(cap);
    });
  }, []);

  const playersByTeam = useMemo(() => {
    const map = {};
    (players || []).forEach((p) => {
      const team = p?.team;
      if (!team) return;
      if (!map[team]) map[team] = [];
      map[team].push(p);
    });
    return map;
  }, [players]);

  const lineupA = useMemo(() => buildTeamConstruction(playersByTeam[activePair.a] || [], salaryCap), [playersByTeam, activePair, salaryCap]);
  const lineupB = useMemo(() => buildTeamConstruction(playersByTeam[activePair.b] || [], salaryCap), [playersByTeam, activePair, salaryCap]);

  const { colorsA, colorsB } = useMemo(() => compareColors(lineupA, lineupB), [lineupA, lineupB]);

  const canCompare = teamA && teamB;

  return (
    <div style={{ padding: '24px 30px' }}>
      <h2 style={{ fontSize: '1.45rem', fontWeight: 800, marginBottom: '14px' }}>Team Construction Comparison</h2>

      <div className="glass" style={{ padding: '14px', marginBottom: '14px', overflow: 'visible', position: 'relative', zIndex: 30 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '10px', alignItems: 'end', overflow: 'visible' }}>
          <TeamPicker label="Team A" teams={teams} selected={teamA} onSelect={setTeamA} />

          <TeamPicker label="Team B" teams={teams} selected={teamB} onSelect={setTeamB} />

          <button
            disabled={!canCompare}
            onClick={() => setActivePair({ a: teamA, b: teamB })}
            style={{
              height: '40px',
              minWidth: '120px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: canCompare ? '#ffd700' : 'rgba(255,255,255,0.12)',
              color: canCompare ? '#0f1923' : 'rgba(255,255,255,0.6)',
              fontWeight: 800,
            }}
          >
            Compare
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px 1fr', gap: '14px', alignItems: 'start' }}>
        <TeamConstructionBoard
          title={activePair.a || 'Team A'}
          logoUrl={teamMetaByName[activePair.a]?.logo_url}
          lineup={lineupA.layout}
          salaryCap={salaryCap}
          compareColors={colorsA}
          compact
        />

        <div className="glass" style={{ padding: '14px' }}>
          <h3 style={{ textAlign: 'center', fontSize: '0.98rem', marginBottom: '8px', color: '#ffd700' }}>Cap Allocation Comparison</h3>
          <StatRow label="Forwards" left={lineupA.breakdown.forwards_cap_pct} right={lineupB.breakdown.forwards_cap_pct} />
          <StatRow label="Defense" left={lineupA.breakdown.defense_cap_pct} right={lineupB.breakdown.defense_cap_pct} />
          <StatRow label="Goalies" left={lineupA.breakdown.goalies_cap_pct} right={lineupB.breakdown.goalies_cap_pct} />
          <StatRow label="Top 3 F" left={lineupA.breakdown.top3f_cap_pct} right={lineupB.breakdown.top3f_cap_pct} />
          <StatRow label="Top 2 D" left={lineupA.breakdown.top2d_cap_pct} right={lineupB.breakdown.top2d_cap_pct} />
          <StatRow label="Top 6 F" left={lineupA.breakdown.top6f_cap_pct} right={lineupB.breakdown.top6f_cap_pct} />
          <StatRow label="Bottom 6 F" left={lineupA.breakdown.bottom6f_cap_pct} right={lineupB.breakdown.bottom6f_cap_pct} />
        </div>

        <TeamConstructionBoard
          title={activePair.b || 'Team B'}
          logoUrl={teamMetaByName[activePair.b]?.logo_url}
          lineup={lineupB.layout}
          salaryCap={salaryCap}
          compareColors={colorsB}
          compact
        />
      </div>
    </div>
  );
}
