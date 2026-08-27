import { supabase } from "../lib/supabase";

/**
 * Carrega todos os dados necessários para a aplicação.
 *
 * Retorna:
 * - groups: grupos ordenados pelo nome
 * - players: jogadores ordenados pelo nome
 * - matches: jogos ordenados pela jornada e data
 */
export async function loadData() {
  const [groupsResult, playersResult, matchesResult] = await Promise.all([
    supabase
      .from("groups")
      .select("*")
      .order("group_name"),

    supabase
      .from("players")
      .select("*")
      .order("name"),

    supabase
      .from("matches")
      .select("*")
      .order("round")
      .order("scheduled_at"),
  ]);

  const results = [
    groupsResult,
    playersResult,
    matchesResult,
  ];

  for (const result of results) {
    if (result.error) {
      throw result.error;
    }
  }

  return {
    groups: groupsResult.data,
    players: playersResult.data,
    matches: matchesResult.data,
  };
}

/**
 * Cria ou atualiza um jogador.
 */
export async function savePlayer(player) {
  const payload = {
    name: player.name,
    handicap: Number(player.handicap),
    group_id: player.group_id || null,
    active: player.active,
  };

  const query = player.id
    ? supabase
        .from("players")
        .update(payload)
        .eq("id", player.id)
    : supabase
        .from("players")
        .insert(payload);

  const { error } = await query;

  if (error) {
    throw error;
  }
}

/**
 * Elimina um jogador através do respetivo ID.
 */
export async function deletePlayer(id) {
  const { error } = await supabase
    .from("players")
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }
}

/**
 * Cria ou atualiza um grupo.
 */
export async function saveGroup(group) {
  const payload = {
    group_name: group.group_name.trim().toUpperCase(),
  };

  const query = group.id
    ? supabase
        .from("groups")
        .update(payload)
        .eq("id", group.id)
    : supabase
        .from("groups")
        .insert(payload);

  const { error } = await query;

  if (error) {
    throw error;
  }
}

/**
 * Elimina um grupo através do respetivo ID.
 */
export async function deleteGroup(id) {
  const { error } = await supabase
    .from("groups")
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }
}

/**
 * Cria ou atualiza um jogo.
 *
 * A propriedade "completed" é calculada no componente do torneio,
 * comparando o resultado de cada jogador com o respetivo handicap.
 */
export async function saveMatch(match) {
  const payload = {
    group_id: match.group_id,
    round: Number(match.round),

    player_a_id: match.player_a_id,
    player_b_id: match.player_b_id,

    score_a:
      match.score_a === "" ||
      match.score_a === null ||
      match.score_a === undefined
        ? null
        : Number(match.score_a),

    score_b:
      match.score_b === "" ||
      match.score_b === null ||
      match.score_b === undefined
        ? null
        : Number(match.score_b),

    completed: Boolean(match.completed),

    scheduled_at:
      match.scheduled_at === "" ||
      match.scheduled_at === null ||
      match.scheduled_at === undefined
        ? null
        : match.scheduled_at,

    table_number:
      match.table_number === "" ||
      match.table_number === null ||
      match.table_number === undefined
        ? null
        : Number(match.table_number),
  };

  const query = match.id
    ? supabase
        .from("matches")
        .update(payload)
        .eq("id", match.id)
    : supabase
        .from("matches")
        .insert(payload);

  const { error } = await query;

  if (error) {
    throw error;
  }
}

/**
 * Elimina um jogo através do respetivo ID.
 */
export async function deleteMatch(id) {
  const { error } = await supabase
    .from("matches")
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }
}

/**
 * Carrega todos os perfis para a gestão de acessos.
 *
 * Esta operação só é permitida a administradores
 * pelas políticas RLS do Supabase.
 */
export async function loadProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      `
        id,
        email,
        full_name,
        avatar_url,
        role,
        active,
        created_at,
        updated_at
      `
    )
    .order("active", {
      ascending: true,
    })
    .order("full_name", {
      ascending: true,
      nullsFirst: false,
    })
    .order("email", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  return data ?? [];
}


/**
 * Atualiza a função e o estado de acesso de um perfil.
 */
export async function updateProfileAccess(
  profileId,
  role,
  active
) {
  const allowedRoles = [
    "viewer",
    "referee",
    "admin",
  ];

  if (!allowedRoles.includes(role)) {
    throw new Error(
      "A função selecionada não é válida."
    );
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      role,
      active: Boolean(active),
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId)
    .select(
      `
        id,
        email,
        full_name,
        avatar_url,
        role,
        active,
        created_at,
        updated_at
      `
    )
    .single();

  if (error) {
    throw error;
  }

  return data;
}
