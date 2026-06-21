function seasonStart(season) {
  const match = String(season || '').match(/(\d{4})/);
  return match ? Number(match[1]) : 0;
}

function seasonLabel(startYear) {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

function normalizePosition(position) {
  const p = String(position || '').toUpperCase();
  if (p === 'D') return 'D';
  if (p === 'G') return 'G';
  return 'F';
}

function activeContract(player, season) {
  const contracts = Array.isArray(player?.contracts) ? player.contracts : [];
  const currentStart = seasonStart(season);
  for (const c of contracts) {
    const start = seasonStart(c?.start_season || c?.season);
    const years = Number(c?.years) || 0;
    if (!start || !years) continue;
    if (start <= currentStart && currentStart <= start + years - 1) return c;
  }
  return null;
}

function progressThreshold(current, needed) {
  if (!needed) return 0;
  return Math.max(0, Math.min(1, (Number(current) || 0) / needed));
}

function progressRank(rank, cutoff) {
  if (!rank || rank <= 0) return 0;
  if (rank <= cutoff) return 1;
  return Math.max(0, Math.min(0.99, cutoff / rank));
}

function topNRank(players, metric, targetPlayerId, minGames, positionFilter) {
  const filtered = players
    .filter((p) => (positionFilter ? positionFilter(p) : true))
    .filter((p) => (Number(p.games_played) || 0) >= (minGames || 0))
    .sort((a, b) => (Number(b[metric]) || 0) - (Number(a[metric]) || 0));
  const idx = filtered.findIndex((p) => p.id === targetPlayerId);
  return idx >= 0 ? idx + 1 : null;
}

function topNByComputed(players, targetPlayerId, minGames, positionFilter, compute) {
  const filtered = players
    .filter((p) => (positionFilter ? positionFilter(p) : true))
    .filter((p) => (Number(p.games_played) || 0) >= (minGames || 0))
    .map((p) => ({ ...p, __metric: compute(p) }))
    .sort((a, b) => (Number(b.__metric) || 0) - (Number(a.__metric) || 0));
  const idx = filtered.findIndex((p) => p.id === targetPlayerId);
  return idx >= 0 ? idx + 1 : null;
}

function teamRank(players, targetPlayerId, metric, minGames, positionFilter, teamName) {
  const filtered = players
    .filter((p) => (positionFilter ? positionFilter(p) : true))
    .filter((p) => (teamName ? p.team === teamName : true))
    .filter((p) => (Number(p.games_played) || 0) >= (minGames || 0))
    .sort((a, b) => (Number(b[metric]) || 0) - (Number(a[metric]) || 0));
  const idx = filtered.findIndex((p) => p.id === targetPlayerId);
  return idx >= 0 ? idx + 1 : null;
}

function calcPpg(player) {
  const gp = Number(player?.games_played) || 0;
  if (gp <= 0) return 0;
  return (Number(player?.points) || 0) / gp;
}

function buildTrackables(player, players, positionType) {
  const gp = Number(player.games_played) || 0;
  const goals = Number(player.goals) || 0;
  const assists = Number(player.assists) || 0;
  const points = Number(player.points) || 0;
  const ppg = calcPpg(player);

  const team = player.team;
  const onTeam = (p) => p.team === team;
  const forwards = (p) => normalizePosition(p.position) === 'F';
  const defense = (p) => normalizePosition(p.position) === 'D';

  const a = [];
  const b = [];

  if (positionType === 'F') {
    a.push({ key: 'a-goals', label: '20 goals', current: goals, needed: 20, progress: progressThreshold(goals, 20), achieved: goals >= 20 });
    a.push({ key: 'a-assists', label: '35 assists', current: assists, needed: 35, progress: progressThreshold(assists, 35), achieved: assists >= 35 });
    a.push({ key: 'a-points', label: '60 points', current: points, needed: 60, progress: progressThreshold(points, 60), achieved: points >= 60 });
    a.push({ key: 'a-ppg', label: '0.73 points per game (42+ GP)', current: ppg.toFixed(2), needed: '0.73', progress: gp >= 42 ? progressThreshold(ppg, 0.73) : progressThreshold(gp, 42) * 0.5, achieved: gp >= 42 && ppg >= 0.73 });
    const teamToiRank = teamRank(players, player.id, 'icetime', 42, forwards, team);
    a.push({ key: 'a-team-toi', label: 'Top 6 team forwards in TOI (42+ GP)', current: teamToiRank ? `#${teamToiRank}` : 'N/A', needed: 'Top 6', progress: progressRank(teamToiRank, 6), achieved: teamToiRank && teamToiRank <= 6 });

    const rankGoals = topNRank(players, 'goals', player.id, 0, forwards);
    const rankAssists = topNRank(players, 'assists', player.id, 0, forwards);
    const rankPoints = topNRank(players, 'points', player.id, 0, forwards);
    const rankPpg = topNByComputed(players, player.id, 42, forwards, calcPpg);

    b.push({ key: 'b-goals', label: 'Top 10 NHL forwards in goals', current: rankGoals ? `#${rankGoals}` : 'N/A', needed: 'Top 10', progress: progressRank(rankGoals, 10), achieved: rankGoals && rankGoals <= 10 });
    b.push({ key: 'b-assists', label: 'Top 10 NHL forwards in assists', current: rankAssists ? `#${rankAssists}` : 'N/A', needed: 'Top 10', progress: progressRank(rankAssists, 10), achieved: rankAssists && rankAssists <= 10 });
    b.push({ key: 'b-points', label: 'Top 10 NHL forwards in points', current: rankPoints ? `#${rankPoints}` : 'N/A', needed: 'Top 10', progress: progressRank(rankPoints, 10), achieved: rankPoints && rankPoints <= 10 });
    b.push({ key: 'b-ppg', label: 'Top 10 NHL forwards in PPG (42+ GP)', current: rankPpg ? `#${rankPpg}` : 'N/A', needed: 'Top 10', progress: progressRank(rankPpg, 10), achieved: rankPpg && rankPpg <= 10 });
  }

  if (positionType === 'D') {
    a.push({ key: 'a-goals', label: '10 goals', current: goals, needed: 10, progress: progressThreshold(goals, 10), achieved: goals >= 10 });
    a.push({ key: 'a-assists', label: '25 assists', current: assists, needed: 25, progress: progressThreshold(assists, 25), achieved: assists >= 25 });
    a.push({ key: 'a-points', label: '40 points', current: points, needed: 40, progress: progressThreshold(points, 40), achieved: points >= 40 });
    a.push({ key: 'a-ppg', label: '0.49 points per game (42+ GP)', current: ppg.toFixed(2), needed: '0.49', progress: gp >= 42 ? progressThreshold(ppg, 0.49) : progressThreshold(gp, 42) * 0.5, achieved: gp >= 42 && ppg >= 0.49 });
    const teamToiRank = teamRank(players, player.id, 'icetime', 42, defense, team);
    const teamBlockedRank = teamRank(players, player.id, 'blocked_shots', 0, defense, team);
    a.push({ key: 'a-team-toi', label: 'Top 4 team defensemen in TOI (42+ GP)', current: teamToiRank ? `#${teamToiRank}` : 'N/A', needed: 'Top 4', progress: progressRank(teamToiRank, 4), achieved: teamToiRank && teamToiRank <= 4 });
    a.push({ key: 'a-team-blocked', label: 'Top 2 team defensemen in blocked shots', current: teamBlockedRank ? `#${teamBlockedRank}` : 'N/A', needed: 'Top 2', progress: progressRank(teamBlockedRank, 2), achieved: teamBlockedRank && teamBlockedRank <= 2 });

    const rankGoals = topNRank(players, 'goals', player.id, 0, defense);
    const rankAssists = topNRank(players, 'assists', player.id, 0, defense);
    const rankPoints = topNRank(players, 'points', player.id, 0, defense);
    const rankIcetime = topNRank(players, 'icetime', player.id, 0, defense);
    const rankPpg = topNByComputed(players, player.id, 42, defense, calcPpg);

    b.push({ key: 'b-goals', label: 'Top 10 NHL defensemen in goals', current: rankGoals ? `#${rankGoals}` : 'N/A', needed: 'Top 10', progress: progressRank(rankGoals, 10), achieved: rankGoals && rankGoals <= 10 });
    b.push({ key: 'b-assists', label: 'Top 10 NHL defensemen in assists', current: rankAssists ? `#${rankAssists}` : 'N/A', needed: 'Top 10', progress: progressRank(rankAssists, 10), achieved: rankAssists && rankAssists <= 10 });
    b.push({ key: 'b-points', label: 'Top 10 NHL defensemen in points', current: rankPoints ? `#${rankPoints}` : 'N/A', needed: 'Top 10', progress: progressRank(rankPoints, 10), achieved: rankPoints && rankPoints <= 10 });
    b.push({ key: 'b-icetime', label: 'Top 10 NHL defensemen in ice time', current: rankIcetime ? `#${rankIcetime}` : 'N/A', needed: 'Top 10', progress: progressRank(rankIcetime, 10), achieved: rankIcetime && rankIcetime <= 10 });
    b.push({ key: 'b-ppg', label: 'Top 10 NHL defensemen in PPG (42+ GP)', current: rankPpg ? `#${rankPpg}` : 'N/A', needed: 'Top 10', progress: progressRank(rankPpg, 10), achieved: rankPpg && rankPpg <= 10 });
  }

  if (positionType === 'G') {
    // Goalie support is mostly unavailable with current tracked fields.
  }

  return { a, b };
}

export function computePerformanceBonusTracker(player, allPlayers, currentSeason) {
  const season = currentSeason || player?.season || null;
  if (!season) return null;
  const contract = activeContract(player, season);
  if (!contract || !contract.bonus_eligible) return null;

  const bonusTotal = Number(contract.bonus_amount) || 0;
  const aPool = Math.min(1000000, bonusTotal);
  const bPool = Math.min(2500000, Math.max(0, bonusTotal - aPool));

  const positionType = normalizePosition(player.position);
  const { a, b } = buildTrackables(player, allPlayers || [], positionType);

  const aAchieved = a.filter((x) => x.achieved).length;
  const bAchievedAny = b.some((x) => x.achieved);

  const slot = 250000;
  let remaining = aPool;
  let earnedA = 0;
  for (let i = 0; i < aAchieved && remaining > 0; i += 1) {
    const payout = Math.min(slot, remaining);
    earnedA += payout;
    remaining -= payout;
  }

  const earnedB = bAchievedAny ? bPool : 0;
  const earnedTotal = earnedA + earnedB;

  const unsupportedAByPos = {
    F: [
      'Top 3 +/- among team forwards (42+ GP)',
      'End-of-season All Rookie Team',
      'All-Star Selection',
      'All-Star MVP',
    ],
    D: [
      'Top 3 +/- among team defensemen (42+ GP)',
      'End-of-season All Rookie Team',
      'All-Star Selection',
      'All-Star MVP',
    ],
    G: [
      '1,800 minutes played',
      'GAA threshold vs league median (25+ GP)',
      'Save % threshold vs league median (25+ GP)',
      '20 wins',
      'Shutouts threshold vs league median (25+ GP)',
      'End-of-season All Rookie Team',
      'All-Star Selection',
      'All-Star MVP',
    ],
  };

  const unsupportedB = [
    'Hart Trophy',
    'Selke Trophy',
    'Rocket Richard Trophy',
    'Conn Smythe Trophy',
    'Norris Trophy',
    '1st Team All-Star',
    '2nd Team All-Star',
  ];

  const allTrackables = [...a, ...b].filter((x) => !x.achieved);
  allTrackables.sort((x, y) => (y.progress || 0) - (x.progress || 0));
  const closest = allTrackables[0] || null;

  return {
    contract,
    bonusTotal,
    aPool,
    bPool,
    earnedA,
    earnedB,
    earnedTotal,
    maxedOut: bonusTotal > 0 && earnedTotal >= bonusTotal,
    aItems: a,
    bItems: b,
    unsupportedA: unsupportedAByPos[positionType] || [],
    unsupportedB,
    closest,
  };
}

export function bonusProgressColor(progress) {
  if (progress >= 1) return '#22c55e';
  if (progress >= 0.85) return '#3b82f6';
  if (progress >= 0.5) return '#eab308';
  return '#ef4444';
}
