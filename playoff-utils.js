// ══════════════════════════════════════════════
//  PCL PLAYOFF UTILITIES (shared)
//  Format: Seeds 2/3/4 round-robin (循環賽);
//  winner meets Seed 1 in the Final.
//  Regular-season data:  Firebase `results`
//  Playoff data:         Firebase `playoffResults`
// ══════════════════════════════════════════════

const PLAYOFF_ROUNDS = [
  { id: 'rr-2v3', stage: 'rr',    seeds: [2, 3], label: '循環賽 ① — #2 seed vs #3 seed' },
  { id: 'rr-2v4', stage: 'rr',    seeds: [2, 4], label: '循環賽 ② — #2 seed vs #4 seed' },
  { id: 'rr-3v4', stage: 'rr',    seeds: [3, 4], label: '循環賽 ③ — #3 seed vs #4 seed' },
  { id: 'final',  stage: 'final', seeds: [1, 0], label: '🏆 FINAL — #1 seed vs 循環賽 winner' }
];

// Final format: best of N (TBD — change here once decided)
const FINAL_BEST_OF = 3;

// ── Regular-season standings (same logic as leaderboard.html) ──
// results: array of {teamA, teamB, winsA, winsB, gameScores:[{scoreA,scoreB}]}
// teamNames: array of team keys
// Returns sorted array of [name, stats]
function computeRegularStandings(results, teamNames) {
  const teams = {};
  teamNames.forEach(t => {
    teams[t] = { wins: 0, losses: 0, pts: 0, matchWins: 0, matchLosses: 0, totalScored: 0, totalAllowed: 0 };
  });

  (results || []).forEach(r => {
    if (!teams[r.teamA] || !teams[r.teamB]) return;
    teams[r.teamA].wins += r.winsA;
    teams[r.teamA].losses += r.winsB;
    teams[r.teamB].wins += r.winsB;
    teams[r.teamB].losses += r.winsA;

    if (r.winsA >= 2) {
      teams[r.teamA].pts += 3;
      teams[r.teamA].matchWins++;
      teams[r.teamB].matchLosses++;
      teams[r.teamB].pts += r.winsB;
    } else if (r.winsB >= 2) {
      teams[r.teamB].pts += 3;
      teams[r.teamB].matchWins++;
      teams[r.teamA].matchLosses++;
      teams[r.teamA].pts += r.winsA;
    } else {
      teams[r.teamA].pts += r.winsA;
      teams[r.teamB].pts += r.winsB;
    }

    (r.gameScores || []).forEach(g => {
      teams[r.teamA].totalScored += g.scoreA;
      teams[r.teamA].totalAllowed += g.scoreB;
      teams[r.teamB].totalScored += g.scoreB;
      teams[r.teamB].totalAllowed += g.scoreA;
    });
  });

  return Object.entries(teams).sort((a, b) => {
    if (b[1].pts !== a[1].pts) return b[1].pts - a[1].pts;
    const wpA = a[1].wins / (a[1].wins + a[1].losses || 1);
    const wpB = b[1].wins / (b[1].wins + b[1].losses || 1);
    if (wpB !== wpA) return wpB - wpA;
    const diffA = a[1].totalScored - a[1].totalAllowed;
    const diffB = b[1].totalScored - b[1].totalAllowed;
    return diffB - diffA;
  });
}

// Returns { 1: teamName, 2: teamName, 3: teamName, 4: teamName }
function computeSeeds(results, teamNames) {
  const sorted = computeRegularStandings(results, teamNames);
  const seeds = {};
  sorted.slice(0, 4).forEach(([name], i) => { seeds[i + 1] = name; });
  return seeds;
}

// ── Round-robin (循環賽) standings for seeds 2/3/4 ──
// playoffResults: array of {round, teamA, teamB, winsA, winsB, gameScores}
// Tiebreak: pts → head-to-head → point differential
// Returns sorted array of [name, stats]
function computeRRStandings(playoffResults, seeds) {
  const rrTeams = [seeds[2], seeds[3], seeds[4]].filter(Boolean);
  const teams = {};
  rrTeams.forEach(t => {
    teams[t] = { wins: 0, losses: 0, pts: 0, matchWins: 0, matchLosses: 0, totalScored: 0, totalAllowed: 0, played: 0 };
  });

  const rrResults = (playoffResults || []).filter(r => r.round && r.round.startsWith('rr-'));
  rrResults.forEach(r => {
    if (!teams[r.teamA] || !teams[r.teamB]) return;
    teams[r.teamA].played++;
    teams[r.teamB].played++;
    teams[r.teamA].wins += r.winsA;
    teams[r.teamA].losses += r.winsB;
    teams[r.teamB].wins += r.winsB;
    teams[r.teamB].losses += r.winsA;

    if (r.winsA >= 2) {
      teams[r.teamA].pts += 3;
      teams[r.teamA].matchWins++;
      teams[r.teamB].matchLosses++;
      teams[r.teamB].pts += r.winsB;
    } else if (r.winsB >= 2) {
      teams[r.teamB].pts += 3;
      teams[r.teamB].matchWins++;
      teams[r.teamA].matchLosses++;
      teams[r.teamA].pts += r.winsA;
    } else {
      teams[r.teamA].pts += r.winsA;
      teams[r.teamB].pts += r.winsB;
    }

    (r.gameScores || []).forEach(g => {
      teams[r.teamA].totalScored += g.scoreA;
      teams[r.teamA].totalAllowed += g.scoreB;
      teams[r.teamB].totalScored += g.scoreB;
      teams[r.teamB].totalAllowed += g.scoreA;
    });
  });

  // head-to-head match winner between two teams (null if not played / no sweep either way)
  function h2h(a, b) {
    const m = rrResults.find(r =>
      (r.teamA === a && r.teamB === b) || (r.teamA === b && r.teamB === a));
    if (!m) return null;
    if (m.winsA > m.winsB) return m.teamA;
    if (m.winsB > m.winsA) return m.teamB;
    return null;
  }

  return Object.entries(teams).sort((a, b) => {
    if (b[1].pts !== a[1].pts) return b[1].pts - a[1].pts;
    const hw = h2h(a[0], b[0]);
    if (hw === a[0]) return -1;
    if (hw === b[0]) return 1;
    const diffA = a[1].totalScored - a[1].totalAllowed;
    const diffB = b[1].totalScored - b[1].totalAllowed;
    return diffB - diffA;
  });
}

// True once all 3 RR matches have results
function isRRComplete(playoffResults) {
  const done = new Set((playoffResults || []).map(r => r.round));
  return ['rr-2v3', 'rr-2v4', 'rr-3v4'].every(id => done.has(id));
}

// Team name of RR winner, or null if RR not complete
function getRRWinner(playoffResults, seeds) {
  if (!isRRComplete(playoffResults)) return null;
  const sorted = computeRRStandings(playoffResults, seeds);
  return sorted.length ? sorted[0][0] : null;
}

// Resolve the two team names for a playoff round id.
// Returns [teamA, teamB] — an entry is null if not yet determined.
function resolvePlayoffTeams(roundId, seeds, playoffResults) {
  const round = PLAYOFF_ROUNDS.find(r => r.id === roundId);
  if (!round) return [null, null];
  if (round.stage === 'rr') {
    return [seeds[round.seeds[0]] || null, seeds[round.seeds[1]] || null];
  }
  // final: seed 1 vs RR winner
  return [seeds[1] || null, getRRWinner(playoffResults, seeds)];
}
