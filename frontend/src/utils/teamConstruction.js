const FORWARD_LINES = 4;
const DEFENSE_SLOTS = 6;
const GOALIE_SLOTS = 2;

function num(value) {
  return Number(value) || 0;
}

function normalizePosition(position) {
  const pos = String(position || '').trim().toUpperCase();
  if (pos === 'L' || pos === 'LW') return 'LW';
  if (pos === 'R' || pos === 'RW') return 'RW';
  if (pos === 'C') return 'C';
  if (pos === 'D' || pos === 'LD' || pos === 'RD') return 'D';
  if (pos === 'G' || pos === 'GOALIE' || pos === 'GOALTENDER') return 'G';
  return 'F';
}

export function isGoaliePosition(position) {
  return normalizePosition(position) === 'G';
}

function sortPlayers(players) {
  return [...(players || [])].sort((a, b) => {
    const aAav = num(a?.aav);
    const bAav = num(b?.aav);
    if (bAav !== aAav) return bAav - aAav;
    const aIce = num(a?.icetime);
    const bIce = num(b?.icetime);
    if (bIce !== aIce) return bIce - aIce;
    return String(a?.player_name || '').localeCompare(String(b?.player_name || ''));
  });
}

function emptySlots(size) {
  return Array.from({ length: size }, () => null);
}

function placeFirstOpen(arr, player) {
  const idx = arr.findIndex((value) => value === null);
  if (idx >= 0) {
    arr[idx] = player;
    return true;
  }
  return false;
}

function filledCount(arr) {
  return arr.reduce((sum, p) => sum + (p ? 1 : 0), 0);
}

function attachSlotMeta(player, slotLabel) {
  if (!player) return null;
  return { ...player, slotLabel };
}

function distributeForwardOverflow(forwardSlots, player, origin) {
  if (origin === 'C') {
    if (placeFirstOpen(forwardSlots.C, player)) return true;

    const lwCount = filledCount(forwardSlots.LW);
    const rwCount = filledCount(forwardSlots.RW);

    if (lwCount <= rwCount) {
      if (placeFirstOpen(forwardSlots.LW, player)) return true;
      if (placeFirstOpen(forwardSlots.RW, player)) return true;
    } else {
      if (placeFirstOpen(forwardSlots.RW, player)) return true;
      if (placeFirstOpen(forwardSlots.LW, player)) return true;
    }

    return placeFirstOpen(forwardSlots.C, player);
  }

  if (origin === 'LW') {
    if (placeFirstOpen(forwardSlots.LW, player)) return true;
    if (placeFirstOpen(forwardSlots.RW, player)) return true;
    return placeFirstOpen(forwardSlots.C, player);
  }

  if (origin === 'RW') {
    if (placeFirstOpen(forwardSlots.RW, player)) return true;
    if (placeFirstOpen(forwardSlots.LW, player)) return true;
    return placeFirstOpen(forwardSlots.C, player);
  }

  if (placeFirstOpen(forwardSlots.C, player)) return true;
  const lwCount = filledCount(forwardSlots.LW);
  const rwCount = filledCount(forwardSlots.RW);
  if (lwCount <= rwCount) {
    if (placeFirstOpen(forwardSlots.LW, player)) return true;
    return placeFirstOpen(forwardSlots.RW, player);
  }
  if (placeFirstOpen(forwardSlots.RW, player)) return true;
  return placeFirstOpen(forwardSlots.LW, player);
}

function topNBySalary(players, n) {
  return sortPlayers(players).slice(0, n);
}

function sumAav(players) {
  return (players || []).reduce((sum, p) => sum + num(p?.aav), 0);
}

function capPct(amount, salaryCap) {
  if (!salaryCap) return 0;
  return (num(amount) / num(salaryCap)) * 100;
}

function listFilled(players) {
  return (players || []).filter(Boolean);
}

function buildSlotLookup(layout) {
  const map = {};

  for (let i = 0; i < FORWARD_LINES; i += 1) {
    map[`LW${i + 1}`] = layout.forwards.LW[i];
    map[`C${i + 1}`] = layout.forwards.C[i];
    map[`RW${i + 1}`] = layout.forwards.RW[i];
  }

  for (let i = 0; i < DEFENSE_SLOTS; i += 1) {
    map[`D${i + 1}`] = layout.defense[i];
  }

  for (let i = 0; i < GOALIE_SLOTS; i += 1) {
    map[`G${i + 1}`] = layout.goalies[i];
  }

  return map;
}

export function buildTeamConstruction(players, salaryCap) {
  const sorted = sortPlayers(players || []);

  const forwardSlots = {
    LW: emptySlots(FORWARD_LINES),
    C: emptySlots(FORWARD_LINES),
    RW: emptySlots(FORWARD_LINES),
  };

  const defenseSlots = emptySlots(DEFENSE_SLOTS);
  const goalieSlots = emptySlots(GOALIE_SLOTS);

  const overflow = {
    C: [],
    LW: [],
    RW: [],
    F: [],
  };

  sorted.forEach((player) => {
    const pos = normalizePosition(player?.position);

    if (pos === 'D') {
      placeFirstOpen(defenseSlots, player);
      return;
    }

    if (pos === 'G') {
      placeFirstOpen(goalieSlots, player);
      return;
    }

    if (pos === 'C') {
      if (!placeFirstOpen(forwardSlots.C, player)) overflow.C.push(player);
      return;
    }

    if (pos === 'LW') {
      if (!placeFirstOpen(forwardSlots.LW, player)) overflow.LW.push(player);
      return;
    }

    if (pos === 'RW') {
      if (!placeFirstOpen(forwardSlots.RW, player)) overflow.RW.push(player);
      return;
    }

    overflow.F.push(player);
  });

  overflow.C.forEach((player) => {
    distributeForwardOverflow(forwardSlots, player, 'C');
  });
  overflow.LW.forEach((player) => {
    distributeForwardOverflow(forwardSlots, player, 'LW');
  });
  overflow.RW.forEach((player) => {
    distributeForwardOverflow(forwardSlots, player, 'RW');
  });
  overflow.F.forEach((player) => {
    distributeForwardOverflow(forwardSlots, player, 'F');
  });

  const forwards = {
    LW: forwardSlots.LW.map((p, idx) => attachSlotMeta(p, `LW${idx + 1}`)),
    C: forwardSlots.C.map((p, idx) => attachSlotMeta(p, `C${idx + 1}`)),
    RW: forwardSlots.RW.map((p, idx) => attachSlotMeta(p, `RW${idx + 1}`)),
  };

  const defense = defenseSlots.map((p, idx) => attachSlotMeta(p, `D${idx + 1}`));
  const goalies = goalieSlots.map((p, idx) => attachSlotMeta(p, `G${idx + 1}`));

  const lineupForwards = listFilled([...forwards.LW, ...forwards.C, ...forwards.RW]);
  const lineupDefense = listFilled(defense);
  const lineupGoalies = listFilled(goalies);

  const top3F = topNBySalary(lineupForwards, 3);
  const top2D = topNBySalary(lineupDefense, 2);
  const sortedForwards = sortPlayers(lineupForwards);
  const top6F = sortedForwards.slice(0, 6);
  const bottom6F = sortedForwards.slice(6, 12);

  const totals = {
    forwards: sumAav(lineupForwards),
    defense: sumAav(lineupDefense),
    goalies: sumAav(lineupGoalies),
  };

  const breakdown = {
    forwards_cap_pct: capPct(totals.forwards, salaryCap),
    defense_cap_pct: capPct(totals.defense, salaryCap),
    goalies_cap_pct: capPct(totals.goalies, salaryCap),
    top3f_cap_pct: capPct(sumAav(top3F), salaryCap),
    top2d_cap_pct: capPct(sumAav(top2D), salaryCap),
    top6f_cap_pct: capPct(sumAav(top6F), salaryCap),
    bottom6f_cap_pct: capPct(sumAav(bottom6F), salaryCap),
  };

  const layout = { forwards, defense, goalies };
  return {
    layout,
    slotMap: buildSlotLookup(layout),
    breakdown,
    salaryCap: num(salaryCap),
  };
}

export function allComparableSlots() {
  const slots = [];
  for (let i = 1; i <= FORWARD_LINES; i += 1) {
    slots.push(`LW${i}`, `C${i}`, `RW${i}`);
  }
  for (let i = 1; i <= DEFENSE_SLOTS; i += 1) {
    slots.push(`D${i}`);
  }
  return slots;
}

export function formatCapPct(value) {
  return `${(Number(value) || 0).toFixed(2)}%`;
}

export function playerCapPct(player, salaryCap) {
  return capPct(player?.aav, salaryCap);
}
