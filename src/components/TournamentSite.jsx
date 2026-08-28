import { useEffect, useMemo, useState } from "react";
import {
  LogOut,
  RefreshCw,
  Users,
  Trophy,
  Swords,
  Settings,
  Plus,
  Trash2,
} from "lucide-react";
import {
  loadData,
  savePlayer,
  deletePlayer,
  saveGroup,
  deleteGroup,
  saveMatch,
  deleteMatch,
  ensureInitialMatches,
  synchronizeGroupProgression,
} from "../services/api";

const EMPTY_PLAYER = {
  name: "",
  handicap: 30,
  group_id: "",
  active: true,
};

const EMPTY_GROUP = {
  group_name: "",
};

const MATCH_TYPE_LABELS = {
  initial_1: "Jogo inicial 1",
  initial_2: "Jogo inicial 2",
  winners: "Jogo dos vencedores",
  losers: "Jogo dos derrotados",
  decisive: "Jogo decisivo",
};

const MATCH_TYPE_ORDER = {
  initial_1: 1,
  initial_2: 2,
  winners: 3,
  losers: 4,
  decisive: 5,
};

function formatDateTimeForInput(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);

  return localDate.toISOString().slice(0, 16);
}

function hasReachedHandicap(score, player) {
  return score !== null && Number(score) >= Number(player.handicap);
}

function isMatchComplete(match, playersById) {
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

function getQualification(wins, losses) {
  if (wins >= 2) {
    return "Diamante";
  }

  if (losses >= 2) {
    return "Platina";
  }

  if (wins === 1 && losses === 1) {
    return "Jogo decisivo";
  }

  return "Por decidir";
}

export default function TournamentSite({ profile, onLogout }) {
  const [activeTab, setActiveTab] = useState("groups");
  const [data, setData] = useState({
    groups: [],
    players: [],
    matches: [],
  });
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [edit, setEdit] = useState(null);

  const isAdmin = profile.role === "admin";
  const canManageMatches = isAdmin || profile.role === "referee";

  async function refreshData() {
    try {
      setBusy(true);
      setError("");

      const newData = await loadData();

      setData(newData);
      setSelectedGroupId((current) => {
        if (
          current &&
          newData.groups.some((group) => group.id === current)
        ) {
          return current;
        }

        return newData.groups[0]?.id || "";
      });
    } catch (refreshError) {
      console.error(refreshError);
      setError(refreshError.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
    async function prepareSelectedGroup() {
      if (!selectedGroupId || busy) {
        return;
      }

      try {
        await ensureInitialMatches(selectedGroupId);
        await synchronizeGroupProgression(selectedGroupId);

        const newData = await loadData();
        setData(newData);
      } catch (preparationError) {
        console.error(preparationError);
        setError(preparationError.message);
      }
    }

    prepareSelectedGroup();
  }, [selectedGroupId]);

  const playersById = useMemo(
    () =>
      Object.fromEntries(
        data.players.map((player) => [player.id, player])
      ),
    [data.players]
  );

  const selectedGroup = data.groups.find(
    (group) => group.id === selectedGroupId
  );

  const groupPlayers = data.players.filter(
    (player) =>
      player.group_id === selectedGroupId && player.active
  );

  const groupMatches = useMemo(
    () =>
      data.matches
        .filter((match) => match.group_id === selectedGroupId)
        .sort(
          (first, second) =>
            (MATCH_TYPE_ORDER[first.match_type] || 99) -
            (MATCH_TYPE_ORDER[second.match_type] || 99)
        ),
    [data.matches, selectedGroupId]
  );

  const standings = useMemo(() => {
    return groupPlayers
      .map((player) => {
        let played = 0;
        let wins = 0;
        let losses = 0;

        groupMatches
          .filter((match) =>
            isMatchComplete(match, playersById)
          )
          .forEach((match) => {
            const participated =
              match.player_a_id === player.id ||
              match.player_b_id === player.id;

            if (!participated) {
              return;
            }

            played += 1;

            if (getWinnerId(match, playersById) === player.id) {
              wins += 1;
            } else {
              losses += 1;
            }
          });

        return {
          ...player,
          played,
          wins,
          losses,
          qualification: getQualification(wins, losses),
        };
      })
      .sort(
        (first, second) =>
          second.wins - first.wins ||
          first.losses - second.losses ||
          first.name.localeCompare(second.name)
      );
  }, [groupPlayers, groupMatches, playersById]);

  function openMatchForEditing(match) {
    setEdit({
      id: match.id,
      group_id: match.group_id,
      round: match.round,
      match_type: match.match_type,
      player_a_id: match.player_a_id,
      player_b_id: match.player_b_id,
      score_a: match.score_a ?? "",
      score_b: match.score_b ?? "",
      completed: match.completed,
      scheduled_at: formatDateTimeForInput(
        match.scheduled_at
      ),
      table_number: match.table_number ?? "",
    });
  }

  async function submitEdit() {
    try {
      setError("");

      if (edit.group_name !== undefined) {
        await saveGroup(edit);
      } else if (edit.handicap !== undefined) {
        await savePlayer(edit);
      } else {
        const playerA = playersById[edit.player_a_id];
        const playerB = playersById[edit.player_b_id];

        if (!playerA || !playerB) {
          throw new Error("Os jogadores do jogo não são válidos.");
        }

        const scoreA =
          edit.score_a === "" ? null : Number(edit.score_a);
        const scoreB =
          edit.score_b === "" ? null : Number(edit.score_b);

        const playerAReached = hasReachedHandicap(scoreA, playerA);
        const playerBReached = hasReachedHandicap(scoreB, playerB);

        const completed =
          scoreA !== null &&
          scoreB !== null &&
          playerAReached !== playerBReached;

        if (
          scoreA !== null &&
          scoreB !== null &&
          !completed
        ) {
          throw new Error(
            "Para concluir o jogo, exatamente um jogador tem de atingir o respetivo handicap."
          );
        }

        await saveMatch({
          ...edit,
          completed,
        });

        await synchronizeGroupProgression(edit.group_id);
      }

      setEdit(null);
      await refreshData();
    } catch (submitError) {
      console.error(submitError);
      setError(submitError.message);
    }
  }

  async function removeRecord(type, id) {
    const confirmed = window.confirm(
      "Tens a certeza de que queres eliminar este registo?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      if (type === "player") {
        await deletePlayer(id);
      }

      if (type === "group") {
        await deleteGroup(id);
      }

      if (type === "match") {
        await deleteMatch(id);
      }

      await refreshData();
    } catch (removeError) {
      console.error(removeError);
      setError(removeError.message);
    }
  }

  return (
    <div>
      <header>
        <div>
          <h1>Handicap BBC</h1>
          <small>
            {profile.full_name || profile.email} · {profile.role}
          </small>
        </div>

        <div className="actions">
          <button
            className="secondary"
            type="button"
            onClick={refreshData}
          >
            <RefreshCw size={16} />
            Atualizar
          </button>

          <button
            className="secondary"
            type="button"
            onClick={onLogout}
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </header>

      <nav>
        <button
          type="button"
          className={activeTab === "groups" ? "active" : ""}
          onClick={() => setActiveTab("groups")}
        >
          <Trophy size={18} />
          Grupos
        </button>

        <button
          type="button"
          className={activeTab === "matches" ? "active" : ""}
          onClick={() => setActiveTab("matches")}
        >
          <Swords size={18} />
          Jogos
        </button>

        <button
          type="button"
          className={activeTab === "players" ? "active" : ""}
          onClick={() => setActiveTab("players")}
        >
          <Users size={18} />
          Jogadores
        </button>

        {isAdmin && (
          <button
            type="button"
            className={activeTab === "admin" ? "active" : ""}
            onClick={() => setActiveTab("admin")}
          >
            <Settings size={18} />
            Administração
          </button>
        )}
      </nav>

      <main>
        {error && <p className="error">{error}</p>}

        {busy ? (
          <div className="card">A carregar...</div>
        ) : (
          <>
            {activeTab !== "admin" && (
              <div className="groups">
                {data.groups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    className={
                      selectedGroupId === group.id ? "active" : ""
                    }
                    onClick={() => setSelectedGroupId(group.id)}
                  >
                    {group.group_name}
                  </button>
                ))}
              </div>
            )}

            {activeTab === "groups" && (
              <section className="grid2">
                <div className="card">
                  <h2>
                    Classificação · Grupo {selectedGroup?.group_name}
                  </h2>

                  <div className="tablewrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Jogador</th>
                          <th>HC</th>
                          <th>J</th>
                          <th>V</th>
                          <th>D</th>
                          <th>Destino</th>
                        </tr>
                      </thead>

                      <tbody>
                        {standings.map((player) => (
                          <tr key={player.id}>
                            <td>{player.name}</td>
                            <td>{player.handicap}</td>
                            <td>{player.played}</td>
                            <td>{player.wins}</td>
                            <td>{player.losses}</td>
                            <td>{player.qualification}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="card">
                  <h2>Jogos do grupo</h2>

                  {groupMatches.map((match) => {
                    const playerA = playersById[match.player_a_id];
                    const playerB = playersById[match.player_b_id];
                    const completed = isMatchComplete(
                      match,
                      playersById
                    );

                    return (
                      <div className="matchline" key={match.id}>
                        <span>
                          {MATCH_TYPE_LABELS[match.match_type] ||
                            `Jornada ${match.round}`}
                          <small>
                            {playerA?.name} vs {playerB?.name}
                          </small>
                        </span>

                        <b>
                          {completed
                            ? `${match.score_a}-${match.score_b}`
                            : "Pendente"}
                        </b>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {activeTab === "matches" && (
              <section>
                <div className="sectionhead">
                  <h2>Jogos · Grupo {selectedGroup?.group_name}</h2>
                </div>

                <div className="cards">
                  {groupMatches.map((match) => {
                    const playerA = playersById[match.player_a_id];
                    const playerB = playersById[match.player_b_id];
                    const completed = isMatchComplete(
                      match,
                      playersById
                    );
                    const winnerId = completed
                      ? getWinnerId(match, playersById)
                      : null;

                    return (
                      <article className="card" key={match.id}>
                        <h3>
                          {MATCH_TYPE_LABELS[match.match_type] ||
                            `Jornada ${match.round}`}
                        </h3>

                        <small>
                          Jornada {match.round}
                          {match.scheduled_at
                            ? ` · ${new Date(
                                match.scheduled_at
                              ).toLocaleString("pt-PT")}`
                            : " · Sem horário"}
                          {match.table_number
                            ? ` · Mesa ${match.table_number}`
                            : ""}
                        </small>

                        <p
                          className={
                            winnerId === playerA?.id ? "win" : ""
                          }
                        >
                          {playerA?.name} ({playerA?.handicap})
                          <b>{match.score_a ?? "–"}</b>
                        </p>

                        <p
                          className={
                            winnerId === playerB?.id ? "win" : ""
                          }
                        >
                          {playerB?.name} ({playerB?.handicap})
                          <b>{match.score_b ?? "–"}</b>
                        </p>

                        {canManageMatches && (
                          <div className="actions">
                            <button
                              type="button"
                              onClick={() => openMatchForEditing(match)}
                            >
                              Editar
                            </button>

                            {isAdmin && (
                              <button
                                className="danger"
                                type="button"
                                onClick={() =>
                                  removeRecord("match", match.id)
                                }
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {activeTab === "players" && (
              <section>
                <div className="sectionhead">
                  <h2>Jogadores</h2>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setEdit({ ...EMPTY_PLAYER })}
                    >
                      <Plus size={16} />
                      Novo jogador
                    </button>
                  )}
                </div>

                <div className="tablewrap card">
                  <table>
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Grupo</th>
                        <th>Handicap</th>
                        <th>Ativo</th>
                        {isAdmin && <th>Ações</th>}
                      </tr>
                    </thead>

                    <tbody>
                      {data.players.map((player) => (
                        <tr key={player.id}>
                          <td>{player.name}</td>
                          <td>
                            {data.groups.find(
                              (group) => group.id === player.group_id
                            )?.group_name || "–"}
                          </td>
                          <td>{player.handicap}</td>
                          <td>{player.active ? "Sim" : "Não"}</td>
                          {isAdmin && (
                            <td>
                              <button
                                type="button"
                                onClick={() => setEdit({ ...player })}
                              >
                                Editar
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {activeTab === "admin" && isAdmin && (
              <section>
                <div className="sectionhead">
                  <h2>Grupos</h2>

                  <button
                    type="button"
                    onClick={() => setEdit({ ...EMPTY_GROUP })}
                  >
                    <Plus size={16} />
                    Novo grupo
                  </button>
                </div>

                <div className="cards">
                  {data.groups.map((group) => (
                    <article className="card" key={group.id}>
                      <h3>Grupo {group.group_name}</h3>

                      <div className="actions">
                        <button
                          type="button"
                          onClick={() => setEdit({ ...group })}
                        >
                          Editar
                        </button>

                        <button
                          className="danger"
                          type="button"
                          onClick={() =>
                            removeRecord("group", group.id)
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {edit && (
        <div className="modal">
          <div className="card dialog">
            <h2>
              {edit.match_type !== undefined
                ? "Editar jogo"
                : edit.handicap !== undefined
                  ? "Editar jogador"
                  : "Editar grupo"}
            </h2>

            {edit.group_name !== undefined && (
              <label>
                Nome do grupo
                <input
                  value={edit.group_name}
                  onChange={(event) =>
                    setEdit({
                      ...edit,
                      group_name: event.target.value.toUpperCase(),
                    })
                  }
                />
              </label>
            )}

            {edit.handicap !== undefined && (
              <>
                <label>
                  Nome
                  <input
                    value={edit.name}
                    onChange={(event) =>
                      setEdit({
                        ...edit,
                        name: event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Handicap
                  <input
                    type="number"
                    min="1"
                    value={edit.handicap}
                    onChange={(event) =>
                      setEdit({
                        ...edit,
                        handicap: Number(event.target.value),
                      })
                    }
                  />
                </label>

                <label>
                  Grupo
                  <select
                    value={edit.group_id || ""}
                    onChange={(event) =>
                      setEdit({
                        ...edit,
                        group_id: event.target.value || null,
                      })
                    }
                  >
                    <option value="">Sem grupo</option>
                    {data.groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.group_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={edit.active}
                    onChange={(event) =>
                      setEdit({
                        ...edit,
                        active: event.target.checked,
                      })
                    }
                  />
                  Ativo
                </label>
              </>
            )}

            {edit.match_type !== undefined && (
              <>
                <label>
                  Tipo de jogo
                  <input
                    value={
                      MATCH_TYPE_LABELS[edit.match_type] ||
                      edit.match_type
                    }
                    disabled
                  />
                </label>

                <label>
                  Jogador A
                  <input
                    value={playersById[edit.player_a_id]?.name || ""}
                    disabled
                  />
                </label>

                <label>
                  Resultado A
                  <input
                    type="number"
                    min="0"
                    max={playersById[edit.player_a_id]?.handicap}
                    value={edit.score_a}
                    onChange={(event) =>
                      setEdit({
                        ...edit,
                        score_a: event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Jogador B
                  <input
                    value={playersById[edit.player_b_id]?.name || ""}
                    disabled
                  />
                </label>

                <label>
                  Resultado B
                  <input
                    type="number"
                    min="0"
                    max={playersById[edit.player_b_id]?.handicap}
                    value={edit.score_b}
                    onChange={(event) =>
                      setEdit({
                        ...edit,
                        score_b: event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Data e hora
                  <input
                    type="datetime-local"
                    value={edit.scheduled_at}
                    onChange={(event) =>
                      setEdit({
                        ...edit,
                        scheduled_at: event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Mesa
                  <input
                    type="number"
                    min="1"
                    value={edit.table_number}
                    onChange={(event) =>
                      setEdit({
                        ...edit,
                        table_number: event.target.value,
                      })
                    }
                  />
                </label>
              </>
            )}

            <div className="actions">
              <button
                className="secondary"
                type="button"
                onClick={() => setEdit(null)}
              >
                Cancelar
              </button>

              <button type="button" onClick={submitEdit}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
