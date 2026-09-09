import { supabase } from "../lib/supabase";

const GROUP_COLUMNS = "id, group_name, phase, group_order, created_at";
const PLAYER_COLUMNS = "id, name, handicap, active, created_at, group_id";
const GROUP_MEMBER_COLUMNS = "id, group_id, player_id, position, created_at";
const PHASE_STANDING_COLUMNS = "group_id, group_name, group_order, player_id, player_name, handicap, played, wins, losses, total_caroms, carom_percentage, provisional_position";
const MATCH_COLUMNS = [
  "id",
  "group_id",
  "round",
  "match_type",
  "match_order",
  "player_a_id",
  "player_b_id",
  "score_a",
  "score_b",
  "completed",
  "created_at",
  "updated_at",
  "scheduled_at",
  "table_number",
  "phase",
  "secondary_group_id",
  "match_code",
  "penalty_winner_id",
].join(", ");

const MATCH_ORDER = {
  initial_1: 1,
  initial_2: 2,
  winners: 3,
  losers: 4,
  knockout: 5,
  diamond_group_1: 1,
  diamond_group_2: 2,
  diamond_group_3: 3,
  diamond_quarterfinal: 4,
  diamond_semifinal: 5,
  diamond_final: 6,
  platinum_group_1: 1,
  platinum_group_2: 2,
  platinum_group_3: 3,
  platinum_quarterfinal: 4,
  platinum_semifinal: 5,
  platinum_final: 6,
};

const MATCH_ROUND = {
  initial_1: 1,
  initial_2: 1,
  winners: 2,
  losers: 2,
  knockout: 1,
  diamond_group_1: 1,
  diamond_group_2: 2,
  diamond_group_3: 3,
  diamond_quarterfinal: 4,
  diamond_semifinal: 5,
  diamond_final: 6,
  platinum_group_1: 1,
  platinum_group_2: 2,
  platinum_group_3: 3,
  platinum_quarterfinal: 4,
  platinum_semifinal: 5,
  platinum_final: 6,
};

function throwIfError(error) {
  if (error) {
    throw error;
  }
}

function nullableNumber(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  return Number(value);
}

function getMatchOrder(matchType) {
  const matchOrder = MATCH_ORDER[matchType];

  if (!matchOrder) {
    throw new Error(`Tipo de jogo inválido: ${matchType}`);
  }

  return matchOrder;
}

function getMatchRound(matchType) {
  const round = MATCH_ROUND[matchType];

  if (!round) {
    throw new Error(`Tipo de jogo inválido: ${matchType}`);
  }

  return round;
}

function normalizedMatchPayload(match) {
  return {
    group_id: match.group_id,
    round: Number(match.round ?? getMatchRound(match.match_type)),
    match_type: match.match_type,
    match_order: Number(
      match.match_order ?? getMatchOrder(match.match_type)
    ),
    player_a_id: match.player_a_id,
    player_b_id: match.player_b_id,
    score_a: nullableNumber(match.score_a),
    score_b: nullableNumber(match.score_b),
    completed: Boolean(match.completed),
    scheduled_at: match.scheduled_at || null,
    table_number: nullableNumber(match.table_number),
    phase: match.phase || "initial",
    secondary_group_id: match.secondary_group_id || null,
    match_code: match.match_code || null,
    penalty_winner_id: match.penalty_winner_id || null,
    updated_at: new Date().toISOString(),
  };
}

export async function loadData() {
  const [
    groupsResult,
    playersResult,
    matchesResult,
    groupMembersResult,
    diamondStandingsResult,
    platinumStandingsResult,
  ] = await Promise.all([
    supabase
      .from("groups")
      .select(GROUP_COLUMNS)
      .order("group_name"),

    supabase
      .from("players")
      .select(PLAYER_COLUMNS)
      .order("group_id")
      .order("created_at")
      .order("name"),

    supabase
      .from("matches")
      .select(MATCH_COLUMNS)
      .order("group_id")
      .order("match_order"),
    supabase
      .from("group_members")
      .select(GROUP_MEMBER_COLUMNS)
      .order("group_id")
      .order("position"),
    supabase
      .from("diamond_group_standings")
      .select(PHASE_STANDING_COLUMNS)
      .order("group_order")
      .order("provisional_position"),

    supabase
      .from("platinum_group_standings")
      .select(PHASE_STANDING_COLUMNS)
      .order("group_order")
      .order("provisional_position"),
  ]);

  throwIfError(groupsResult.error);
  throwIfError(playersResult.error);
  throwIfError(matchesResult.error);
  throwIfError(groupMembersResult.error);
  throwIfError(diamondStandingsResult.error);
  throwIfError(platinumStandingsResult.error);

  return {
    groups: groupsResult.data || [],
    players: playersResult.data || [],
    matches: matchesResult.data || [],
    groupMembers: groupMembersResult.data || [],
    diamondStandings: diamondStandingsResult.data || [],
    platinumStandings: platinumStandingsResult.data || [],
  };
}

export async function savePlayer(player) {
  const payload = {
    name: player.name.trim(),
    handicap: Number(player.handicap),
    group_id: player.group_id || null,
    active: Boolean(player.active),
  };

  const query = player.id
    ? supabase.from("players").update(payload).eq("id", player.id)
    : supabase.from("players").insert(payload);

  const { error } = await query;
  throwIfError(error);
}

export async function deletePlayer(id) {
  const { error } = await supabase
    .from("players")
    .delete()
    .eq("id", id);

  throwIfError(error);
}

export async function saveGroup(group) {
  const payload = {
    group_name: group.group_name.trim().toUpperCase(),
  };

  const query = group.id
    ? supabase.from("groups").update(payload).eq("id", group.id)
    : supabase.from("groups").insert(payload);

  const { error } = await query;
  throwIfError(error);
}

export async function deleteGroup(id) {
  const { error } = await supabase
    .from("groups")
    .delete()
    .eq("id", id);

  throwIfError(error);
}

export async function saveMatch(match) {
  const payload = normalizedMatchPayload(match);

  const query = match.id
    ? supabase.from("matches").update(payload).eq("id", match.id)
    : supabase.from("matches").insert(payload);

  const { error } = await query;
  throwIfError(error);
}

export async function deleteMatch(id) {
  const { error } = await supabase
    .from("matches")
    .delete()
    .eq("id", id);

  throwIfError(error);
}

function hasReachedHandicap(score, player) {
  return score !== null && Number(score) >= Number(player.handicap);
}

function isCompleted(match, playersById) {
  if (!match || match.score_a === null || match.score_b === null) {
    return false;
  }

  const playerA = playersById[match.player_a_id];
  const playerB = playersById[match.player_b_id];

  if (!playerA || !playerB) {
    return false;
  }

  const playerAReached = hasReachedHandicap(match.score_a, playerA);
  const playerBReached = hasReachedHandicap(match.score_b, playerB);

  if (playerAReached && playerBReached) {
    return (
      match.penalty_winner_id === match.player_a_id ||
      match.penalty_winner_id === match.player_b_id
    );
  }

  return playerAReached !== playerBReached;
}

function getWinnerId(match, playersById) {
  const playerA = playersById[match.player_a_id];
  const playerB = playersById[match.player_b_id];
  const playerAReached = hasReachedHandicap(match.score_a, playerA);
  const playerBReached = hasReachedHandicap(match.score_b, playerB);

  if (playerAReached && playerBReached) {
    return match.penalty_winner_id || null;
  }

  if (playerAReached) {
    return match.player_a_id;
  }

  if (playerBReached) {
    return match.player_b_id;
  }

  return null;
}

function getLoserId(match, playersById) {
  return getWinnerId(match, playersById) === match.player_a_id
    ? match.player_b_id
    : match.player_a_id;
}

async function createProgressionMatch({
  groupId,
  matchType,
  playerAId,
  playerBId,
}) {
  const { error } = await supabase.from("matches").insert({
    group_id: groupId,
    round: getMatchRound(matchType),
    match_type: matchType,
    match_order: getMatchOrder(matchType),
    player_a_id: playerAId,
    player_b_id: playerBId,
    score_a: null,
    score_b: null,
    completed: false,
    scheduled_at: null,
    table_number: null,
    penalty_winner_id: null,
  });

  throwIfError(error);
}

async function updatePendingProgressionMatch(
  match,
  playerAId,
  playerBId
) {
  if (match.completed || match.score_a !== null || match.score_b !== null) {
    return;
  }

  const expectedOrder = getMatchOrder(match.match_type);
  const expectedRound = getMatchRound(match.match_type);

  if (
    match.player_a_id === playerAId &&
    match.player_b_id === playerBId &&
    match.match_order === expectedOrder &&
    match.round === expectedRound
  ) {
    return;
  }

  const { error } = await supabase
    .from("matches")
    .update({
      round: expectedRound,
      match_order: expectedOrder,
      player_a_id: playerAId,
      player_b_id: playerBId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", match.id);

  throwIfError(error);
}

export async function ensureInitialMatches(groupId) {
  const [playersResult, matchesResult] = await Promise.all([
    supabase
      .from("players")
      .select(PLAYER_COLUMNS)
      .eq("group_id", groupId)
      .eq("active", true)
      .order("created_at")
      .order("name"),

    supabase
      .from("matches")
      .select(MATCH_COLUMNS)
      .eq("group_id", groupId),
  ]);

  throwIfError(playersResult.error);
  throwIfError(matchesResult.error);

  const players = playersResult.data || [];
  const matches = matchesResult.data || [];

  if (players.length !== 4) {
    return;
  }

  const initialOne = matches.find(
    (match) => match.match_type === "initial_1"
  );
  const initialTwo = matches.find(
    (match) => match.match_type === "initial_2"
  );

  if (!initialOne) {
    await createProgressionMatch({
      groupId,
      matchType: "initial_1",
      playerAId: players[0].id,
      playerBId: players[1].id,
    });
  }

  if (!initialTwo) {
    await createProgressionMatch({
      groupId,
      matchType: "initial_2",
      playerAId: players[2].id,
      playerBId: players[3].id,
    });
  }
}

export async function synchronizeGroupProgression(groupId) {
  await ensureInitialMatches(groupId);

  const [playersResult, matchesResult] = await Promise.all([
    supabase
      .from("players")
      .select(PLAYER_COLUMNS)
      .eq("group_id", groupId),

    supabase
      .from("matches")
      .select(MATCH_COLUMNS)
      .eq("group_id", groupId),
  ]);

  throwIfError(playersResult.error);
  throwIfError(matchesResult.error);

  const players = playersResult.data || [];
  const matches = matchesResult.data || [];
  const playersById = Object.fromEntries(
    players.map((player) => [player.id, player])
  );
  const matchesByType = Object.fromEntries(
    matches.map((match) => [match.match_type, match])
  );

  const initialOne = matchesByType.initial_1;
  const initialTwo = matchesByType.initial_2;

  if (
    !isCompleted(initialOne, playersById) ||
    !isCompleted(initialTwo, playersById)
  ) {
    return;
  }

  const winnersPlayers = {
    playerAId: getWinnerId(initialOne, playersById),
    playerBId: getWinnerId(initialTwo, playersById),
  };

  const losersPlayers = {
    playerAId: getLoserId(initialOne, playersById),
    playerBId: getLoserId(initialTwo, playersById),
  };

  if (!matchesByType.winners) {
    await createProgressionMatch({
      groupId,
      matchType: "winners",
      ...winnersPlayers,
    });
  } else {
    await updatePendingProgressionMatch(
      matchesByType.winners,
      winnersPlayers.playerAId,
      winnersPlayers.playerBId
    );
  }

  if (!matchesByType.losers) {
    await createProgressionMatch({
      groupId,
      matchType: "losers",
      ...losersPlayers,
    });
  } else {
    await updatePendingProgressionMatch(
      matchesByType.losers,
      losersPlayers.playerAId,
      losersPlayers.playerBId
    );
  }

  // O cruzamento seguinte pertence à fase knockout.
  // Não é criado um jogo decisivo dentro da série inicial.
}

export async function synchronizeKnockoutMatches() {
  const { data, error } = await supabase.rpc(
    "synchronize_knockout_matches"
  );

  throwIfError(error);
  return data ?? 0;
}

export async function synchronizeDiamondPhase() {
  const { data, error } = await supabase.rpc("synchronize_diamond_phase");
  throwIfError(error);
  return data ?? 0;
}


export async function synchronizePlatinumPhase() {
  const { data, error } = await supabase.rpc(
    "synchronize_platinum_phase"
  );

  throwIfError(error);
  return data ?? 0;
}


export async function loadTableAvailability(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59.999`);

  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select(MATCH_COLUMNS)
    .not("scheduled_at", "is", null)
    .not("table_number", "is", null)
    .gte("scheduled_at", start.toISOString())
    .lte("scheduled_at", end.toISOString())
    .in("table_number", [1, 2, 3])
    .order("scheduled_at", { ascending: true });

  throwIfError(matchesError);

  const playerIds = [
    ...new Set(
      (matches || [])
        .flatMap((match) => [match.player_a_id, match.player_b_id])
        .filter(Boolean)
    ),
  ];

  if (playerIds.length === 0) {
    return [];
  }

  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id, name, handicap")
    .in("id", playerIds);

  throwIfError(playersError);

  const playersById = Object.fromEntries(
    (players || []).map((player) => [player.id, player])
  );

  return (matches || []).map((match) => ({
    ...match,
    player_a: playersById[match.player_a_id] || null,
    player_b: playersById[match.player_b_id] || null,
  }));
}
