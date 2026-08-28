import { supabase } from "../lib/supabase";

const GROUP_COLUMNS = "id, group_name, created_at";
const PLAYER_COLUMNS = "id, name, handicap, active, created_at, group_id";
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
].join(", ");

const MATCH_ORDER = {
  initial_1: 1,
  initial_2: 2,
  winners: 3,
  losers: 4,
  decisive: 5,
};

const MATCH_ROUND = {
  initial_1: 1,
  initial_2: 1,
  winners: 2,
  losers: 2,
  decisive: 3,
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
    round: getMatchRound(match.match_type),
    match_type: match.match_type,
    match_order: getMatchOrder(match.match_type),
    player_a_id: match.player_a_id,
    player_b_id: match.player_b_id,
    score_a: nullableNumber(match.score_a),
    score_b: nullableNumber(match.score_b),
    completed: Boolean(match.completed),
    scheduled_at: match.scheduled_at || null,
    table_number: nullableNumber(match.table_number),
    updated_at: new Date().toISOString(),
  };
}

export async function loadData() {
  const [groupsResult, playersResult, matchesResult] = await Promise.all([
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
  ]);

  throwIfError(groupsResult.error);
  throwIfError(playersResult.error);
  throwIfError(matchesResult.error);

  return {
    groups: groupsResult.data || [],
    players: playersResult.data || [],
    matches: matchesResult.data || [],
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

  return (
    hasReachedHandicap(match.score_a, playerA) !==
    hasReachedHandicap(match.score_b, playerB)
  );
}

function getWinnerId(match, playersById) {
  const playerA = playersById[match.player_a_id];

  return hasReachedHandicap(match.score_a, playerA)
    ? match.player_a_id
    : match.player_b_id;
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

  const refreshedMatchesResult = await supabase
    .from("matches")
    .select(MATCH_COLUMNS)
    .eq("group_id", groupId);

  throwIfError(refreshedMatchesResult.error);

  const refreshedByType = Object.fromEntries(
    (refreshedMatchesResult.data || []).map((match) => [
      match.match_type,
      match,
    ])
  );

  const winnersMatch = refreshedByType.winners;
  const losersMatch = refreshedByType.losers;

  if (
    !isCompleted(winnersMatch, playersById) ||
    !isCompleted(losersMatch, playersById)
  ) {
    return;
  }

  const decisivePlayers = {
    playerAId: getLoserId(winnersMatch, playersById),
    playerBId: getWinnerId(losersMatch, playersById),
  };

  if (!refreshedByType.decisive) {
    await createProgressionMatch({
      groupId,
      matchType: "decisive",
      ...decisivePlayers,
    });
  } else {
    await updatePendingProgressionMatch(
      refreshedByType.decisive,
      decisivePlayers.playerAId,
      decisivePlayers.playerBId
    );
  }
}
