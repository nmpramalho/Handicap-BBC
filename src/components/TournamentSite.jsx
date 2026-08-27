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
} from "../services/api";

const emptyPlayer = {
  name: "",
  handicap: 30,
  group_id: "",
  active: true,
};

const emptyGroup = {
  group_name: "",
};

const emptyMatch = {
  group_id: "",
  round: 1,
  player_a_id: "",
  player_b_id: "",
  score_a: "",
  score_b: "",
  completed: false,
  scheduled_at: "",
  table_number: "",
};

function formatDateTimeForInput(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const timezoneOffset = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - timezoneOffset)
    .toISOString()
    .slice(0, 16);
}

function formatDateTimeForDatabase(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export default function TournamentSite({ profile, onLogout }) {
  const [tab, setTab] = useState("groups");

  const [data, setData] = useState({
    groups: [],
    players: [],
    matches: [],
  });

  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [edit, setEdit] = useState(null);

  const admin = profile.role === "admin";
  const referee = admin || profile.role === "referee";

  async function refresh() {
    try {
      setBusy(true);
      setError("");

      const loadedData = await loadData();

      setData(loadedData);

      setSelected((currentSelection) => {
        if (
          currentSelection &&
          loadedData.groups.some(
            (group) => group.id === currentSelection
          )
        ) {
          return currentSelection;
        }

        return loadedData.groups[0]?.id || "";
      });
    } catch (loadError) {
      console.error("Erro ao carregar dados:", loadError);

      setError(
        loadError.message ||
          "Não foi possível carregar os dados do torneio."
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const playersById = useMemo(() => {
    return Object.fromEntries(
      data.players.map((player) => [
        player.id,
        player,
      ])
    );
  }, [data.players]);

  const selectedGroup = useMemo(() => {
    return data.groups.find(
      (group) => group.id === selected
    );
  }, [data.groups, selected]);

  const groupPlayers = useMemo(() => {
    return data.players.filter(
      (player) =>
        player.group_id === selected &&
        player.active
    );
  }, [data.players, selected]);

  const groupMatches = useMemo(() => {
    return data.matches
      .filter(
        (match) => match.group_id === selected
      )
      .sort((firstMatch, secondMatch) => {
        const roundDifference =
          firstMatch.round - secondMatch.round;

        if (roundDifference !== 0) {
          return roundDifference;
        }

        const firstDate = firstMatch.scheduled_at
          ? new Date(firstMatch.scheduled_at).getTime()
          : Number.MAX_SAFE_INTEGER;

        const secondDate = secondMatch.scheduled_at
          ? new Date(secondMatch.scheduled_at).getTime()
          : Number.MAX_SAFE_INTEGER;

        return firstDate - secondDate;
      });
  }, [data.matches, selected]);

  function isMatchComplete(match) {
    const playerA =
      playersById[match.player_a_id];

    const playerB =
      playersById[match.player_b_id];

    if (
      !playerA ||
      !playerB ||
      match.score_a === null ||
      match.score_a === undefined ||
      match.score_b === null ||
      match.score_b === undefined
    ) {
      return false;
    }

    const playerAReachedHandicap =
      Number(match.score_a) >=
      Number(playerA.handicap);

    const playerBReachedHandicap =
      Number(match.score_b) >=
      Number(playerB.handicap);

    return (
      playerAReachedHandicap !==
      playerBReachedHandicap
    );
  }

  function getMatchWinner(match) {
    if (!isMatchComplete(match)) {
      return null;
    }

    const playerA =
      playersById[match.player_a_id];

    if (
      Number(match.score_a) >=
      Number(playerA.handicap)
    ) {
      return match.player_a_id;
    }

    return match.player_b_id;
  }

  const standings = useMemo(() => {
    return groupPlayers
      .map((player) => {
        let played = 0;
        let wins = 0;
        let losses = 0;

        groupMatches
          .filter((match) =>
            isMatchComplete(match)
          )
          .forEach((match) => {
            const playerParticipated =
              match.player_a_id === player.id ||
              match.player_b_id === player.id;

            if (!playerParticipated) {
              return;
            }

            played += 1;

            if (
              getMatchWinner(match) === player.id
            ) {
              wins += 1;
            } else {
              losses += 1;
            }
          });

        let destination = "Por decidir";

        if (wins === 2) {
          destination = "Diamante";
        }

        if (losses === 2) {
          destination = "Platina";
        }

        return {
          ...player,
          played,
          wins,
          losses,
          destination,
        };
      })
      .sort((firstPlayer, secondPlayer) => {
        return (
          secondPlayer.wins - firstPlayer.wins ||
          firstPlayer.losses -
            secondPlayer.losses ||
          firstPlayer.name.localeCompare(
            secondPlayer.name
          )
        );
      });
  }, [
    groupPlayers,
    groupMatches,
    playersById,
  ]);

  function validatePlayer(player) {
    if (!player.name?.trim()) {
      throw new Error(
        "O nome do jogador é obrigatório."
      );
    }

    if (
      !Number.isInteger(Number(player.handicap)) ||
      Number(player.handicap) < 1
    ) {
      throw new Error(
        "O handicap deve ser um número inteiro superior a zero."
      );
    }
  }

  function validateGroup(group) {
    if (!group.group_name?.trim()) {
      throw new Error(
        "O nome do grupo é obrigatório."
      );
    }
  }

  function validateMatch(match) {
    if (!match.group_id) {
      throw new Error(
        "É obrigatório selecionar um grupo."
      );
    }

    if (
      !Number.isInteger(Number(match.round)) ||
      Number(match.round) < 1
    ) {
      throw new Error(
        "A jornada deve ser um número inteiro superior a zero."
      );
    }

    if (!match.player_a_id) {
      throw new Error(
        "É obrigatório selecionar o Jogador A."
      );
    }

    if (!match.player_b_id) {
      throw new Error(
        "É obrigatório selecionar o Jogador B."
      );
    }

    if (
      match.player_a_id ===
      match.player_b_id
    ) {
      throw new Error(
        "Os dois jogadores têm de ser diferentes."
      );
    }

    const playerA =
      playersById[match.player_a_id];

    const playerB =
      playersById[match.player_b_id];

    if (
      playerA?.group_id !== match.group_id ||
      playerB?.group_id !== match.group_id
    ) {
      throw new Error(
        "Os dois jogadores têm de pertencer ao grupo selecionado."
      );
    }

    if (
      match.table_number !== "" &&
      match.table_number !== null &&
      Number(match.table_number) < 1
    ) {
      throw new Error(
        "O número da mesa deve ser superior a zero."
      );
    }
  }

  async function submit(kind) {
    try {
      setSaving(true);
      setError("");

      if (kind === "player") {
        validatePlayer(edit);

        const playerToSave = {
          ...edit,
          name: edit.name.trim(),
          handicap: Number(edit.handicap),
          group_id: edit.group_id || null,
          active: Boolean(edit.active),
        };

        await savePlayer(playerToSave);
      }

      if (kind === "group") {
        validateGroup(edit);

        const groupToSave = {
          ...edit,
          group_name: edit.group_name
            .trim()
            .toUpperCase(),
        };

        await saveGroup(groupToSave);
      }

      if (kind === "match") {
        validateMatch(edit);

        const playerA =
          playersById[edit.player_a_id];

        const playerB =
          playersById[edit.player_b_id];

        const hasScoreA =
          edit.score_a !== "" &&
          edit.score_a !== null &&
          edit.score_a !== undefined;

        const hasScoreB =
          edit.score_b !== "" &&
          edit.score_b !== null &&
          edit.score_b !== undefined;

        const scoreA = hasScoreA
          ? Number(edit.score_a)
          : null;

        const scoreB = hasScoreB
          ? Number(edit.score_b)
          : null;

        const playerAReachedHandicap =
          hasScoreA &&
          scoreA >= Number(playerA.handicap);

        const playerBReachedHandicap =
          hasScoreB &&
          scoreB >= Number(playerB.handicap);

        const completed =
          hasScoreA &&
          hasScoreB &&
          playerAReachedHandicap !==
            playerBReachedHandicap;

        const matchToSave = {
          id: edit.id,
          group_id: edit.group_id,
          round: Number(edit.round),
          player_a_id: edit.player_a_id,
          player_b_id: edit.player_b_id,
          score_a: scoreA,
          score_b: scoreB,
          completed,
          scheduled_at:
            formatDateTimeForDatabase(
              edit.scheduled_at
            ),
          table_number:
            edit.table_number === "" ||
            edit.table_number === null ||
            edit.table_number === undefined
              ? null
              : Number(edit.table_number),
        };

        console.log(
          "Jogo enviado para gravação:",
          matchToSave
        );

        await saveMatch(matchToSave);
      }

      setEdit(null);
      await refresh();
    } catch (saveError) {
      console.error(
        "Erro ao guardar registo:",
        saveError
      );

      setError(
        saveError.message ||
          "Não foi possível guardar o registo."
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(kind, id) {
    const confirmed = window.confirm(
      "Eliminar este registo?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      if (kind === "player") {
        await deletePlayer(id);
      }

      if (kind === "group") {
        await deleteGroup(id);
      }

      if (kind === "match") {
        await deleteMatch(id);
      }

      await refresh();
    } catch (deleteError) {
      console.error(
        "Erro ao eliminar registo:",
        deleteError
      );

      setError(
        deleteError.message ||
          "Não foi possível eliminar o registo."
      );
    }
  }

  function openNewMatch() {
    setEdit({
      ...emptyMatch,
      group_id: selected,
    });
  }

  function openMatchForEditing(match) {
    setEdit({
      id: match.id,
      group_id: match.group_id,
      round: match.round,
      player_a_id: match.player_a_id,
      player_b_id: match.player_b_id,
      score_a: match.score_a ?? "",
      score_b: match.score_b ?? "",
      completed: match.completed,
      scheduled_at:
        formatDateTimeForInput(
          match.scheduled_at
        ),
      table_number:
        match.table_number ?? "",
    });
  }

  function getEditType() {
    if (!edit) {
      return null;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        edit,
        "player_a_id"
      )
    ) {
      return "match";
    }

    if (
      Object.prototype.hasOwnProperty.call(
        edit,
        "handicap"
      )
    ) {
      return "player";
    }

    return "group";
  }

  const editType = getEditType();

  return (
    <div>
      <header>
        <div>
          <h1>Handicap BBC</h1>

          <small>
            {profile.full_name || profile.email}
            {" · "}
            {profile.role}
          </small>
        </div>

        <div className="actions">
          <button
            type="button"
            className="secondary"
            onClick={refresh}
            disabled={busy}
          >
            <RefreshCw size={16} />
            Atualizar
          </button>

          <button
            type="button"
            className="secondary"
            onClick={onLogout}
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </header>

      <nav>
        {[
          ["groups", Trophy, "Grupos"],
          ["matches", Swords, "Jogos"],
          ["players", Users, "Jogadores"],
          [
            "admin",
            Settings,
            "Administração",
          ],
        ]
          .filter(
            ([id]) =>
              id !== "admin" || admin
          )
          .map(([id, Icon, label]) => (
            <button
              type="button"
              key={id}
              className={
                tab === id ? "active" : ""
              }
              onClick={() => setTab(id)}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
      </nav>

      <main>
        {error && (
          <p className="error">
            {error}
          </p>
        )}

        {busy ? (
          <div className="card">
            A carregar...
          </div>
        ) : (
          <>
            {tab !== "admin" && (
              <div className="groups">
                {data.groups.map((group) => (
                  <button
                    type="button"
                    key={group.id}
                    className={
                      selected === group.id
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setSelected(group.id)
                    }
                  >
                    {group.group_name}
                  </button>
                ))}
              </div>
            )}

            {tab === "groups" && (
              <section className="grid2">
                <div className="card">
                  <h2>
                    Classificação · Grupo{" "}
                    {selectedGroup?.group_name}
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
                        {standings.map(
                          (player) => (
                            <tr key={player.id}>
                              <td>
                                {player.name}
                              </td>

                              <td>
                                {player.handicap}
                              </td>

                              <td>
                                {player.played}
                              </td>

                              <td>
                                {player.wins}
                              </td>

                              <td>
                                {player.losses}
                              </td>

                              <td>
                                {
                                  player.destination
                                }
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="card">
                  <h2>Jogos do grupo</h2>

                  {groupMatches.length ===
                    0 && (
                    <p>
                      Ainda não existem jogos
                      neste grupo.
                    </p>
                  )}

                  {groupMatches.map((match) => {
                    const playerA =
                      playersById[
                        match.player_a_id
                      ];

                    const playerB =
                      playersById[
                        match.player_b_id
                      ];

                    return (
                      <div
                        className="matchline"
                        key={match.id}
                      >
                        <span>
                          Jornada {match.round}

                          <small>
                            {playerA?.name ||
                              "Jogador A"}{" "}
                            vs{" "}
                            {playerB?.name ||
                              "Jogador B"}
                          </small>
                        </span>

                        <b>
                          {isMatchComplete(match)
                            ? `${match.score_a}-${match.score_b}`
                            : "Pendente"}
                        </b>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {tab === "matches" && (
              <section>
                <div className="sectionhead">
                  <h2>
                    Jogos · Grupo{" "}
                    {selectedGroup?.group_name}
                  </h2>

                  {referee && (
                    <button
                      type="button"
                      onClick={openNewMatch}
                    >
                      <Plus size={16} />
                      Novo jogo
                    </button>
                  )}
                </div>

                <div className="cards">
                  {groupMatches.length ===
                    0 && (
                    <article className="card">
                      <p>
                        Ainda não existem jogos
                        neste grupo.
                      </p>
                    </article>
                  )}

                  {groupMatches.map((match) => {
                    const playerA =
                      playersById[
                        match.player_a_id
                      ];

                    const playerB =
                      playersById[
                        match.player_b_id
                      ];

                    const completed =
                      isMatchComplete(match);

                    const matchWinner =
                      getMatchWinner(match);

                    return (
                      <article
                        className="card"
                        key={match.id}
                      >
                        <h3>
                          Jornada {match.round}
                        </h3>

                        <small>
                          {match.scheduled_at
                            ? new Date(
                                match.scheduled_at
                              ).toLocaleString(
                                "pt-PT"
                              )
                            : "Sem horário"}

                          {match.table_number
                            ? ` · Mesa ${match.table_number}`
                            : ""}
                        </small>

                        <p
                          className={
                            completed &&
                            matchWinner ===
                              playerA?.id
                              ? "win"
                              : ""
                          }
                        >
                          {playerA?.name ||
                            "Jogador A"}{" "}
                          ({playerA?.handicap ?? "–"})
                          {" "}
                          <b>
                            {match.score_a ?? "–"}
                          </b>
                        </p>

                        <p
                          className={
                            completed &&
                            matchWinner ===
                              playerB?.id
                              ? "win"
                              : ""
                          }
                        >
                          {playerB?.name ||
                            "Jogador B"}{" "}
                          ({playerB?.handicap ?? "–"})
                          {" "}
                          <b>
                            {match.score_b ?? "–"}
                          </b>
                        </p>

                        {referee && (
                          <div className="actions">
                            <button
                              type="button"
                              onClick={() =>
                                openMatchForEditing(
                                  match
                                )
                              }
                            >
                              Editar
                            </button>

                            {admin && (
                              <button
                                type="button"
                                className="danger"
                                onClick={() =>
                                  remove(
                                    "match",
                                    match.id
                                  )
                                }
                                aria-label="Eliminar jogo"
                              >
                                <Trash2
                                  size={15}
                                />
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

            {tab === "players" && (
              <section>
                <div className="sectionhead">
                  <h2>Jogadores</h2>

                  {admin && (
                    <button
                      type="button"
                      onClick={() =>
                        setEdit({
                          ...emptyPlayer,
                        })
                      }
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

                        {admin && (
                          <th>Ações</th>
                        )}
                      </tr>
                    </thead>

                    <tbody>
                      {data.players.map(
                        (player) => (
                          <tr key={player.id}>
                            <td>
                              {player.name}
                            </td>

                            <td>
                              {data.groups.find(
                                (group) =>
                                  group.id ===
                                  player.group_id
                              )?.group_name || "–"}
                            </td>

                            <td>
                              {player.handicap}
                            </td>

                            <td>
                              {player.active
                                ? "Sim"
                                : "Não"}
                            </td>

                            {admin && (
                              <td>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEdit({
                                      ...player,
                                    })
                                  }
                                >
                                  Editar
                                </button>
                              </td>
                            )}
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {tab === "admin" && admin && (
              <section>
                <div className="sectionhead">
                  <h2>Grupos</h2>

                  <button
                    type="button"
                    onClick={() =>
                      setEdit({
                        ...emptyGroup,
                      })
                    }
                  >
                    <Plus size={16} />
                    Novo grupo
                  </button>
                </div>

                <div className="cards">
                  {data.groups.map((group) => (
                    <article
                      className="card"
                      key={group.id}
                    >
                      <h3>
                        Grupo {group.group_name}
                      </h3>

                      <div className="actions">
                        <button
                          type="button"
                          onClick={() =>
                            setEdit({
                              ...group,
                            })
                          }
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          className="danger"
                          onClick={() =>
                            remove(
                              "group",
                              group.id
                            )
                          }
                          aria-label="Eliminar grupo"
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
              {editType === "match"
                ? edit.id
                  ? "Editar jogo"
                  : "Novo jogo"
                : editType === "player"
                  ? edit.id
                    ? "Editar jogador"
                    : "Novo jogador"
                  : edit.id
                    ? "Editar grupo"
                    : "Novo grupo"}
            </h2>

            {editType === "group" && (
              <label>
                Nome do grupo

                <input
                  value={edit.group_name}
                  onChange={(event) =>
                    setEdit({
                      ...edit,
                      group_name:
                        event.target.value.toUpperCase(),
                    })
                  }
                />
              </label>
            )}

            {editType === "player" && (
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
                        handicap: Number(
                          event.target.value
                        ),
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
                        group_id:
                          event.target.value ||
                          null,
                      })
                    }
                  >
                    <option value="">
                      Sem grupo
                    </option>

                    {data.groups.map(
                      (group) => (
                        <option
                          key={group.id}
                          value={group.id}
                        >
                          {group.group_name}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={edit.active}
                    onChange={(event) =>
                      setEdit({
                        ...edit,
                        active:
                          event.target.checked,
                      })
                    }
                  />

                  {" "}Ativo
                </label>
              </>
            )}

            {editType === "match" && (
              <>
                <label>
                  Grupo

                  <select
                    value={edit.group_id}
                    onChange={(event) =>
                      setEdit({
                        ...edit,
                        group_id:
                          event.target.value,
                        player_a_id: "",
                        player_b_id: "",
                      })
                    }
                  >
                    <option value="">
                      Selecionar grupo
                    </option>

                    {data.groups.map(
                      (group) => (
                        <option
                          key={group.id}
                          value={group.id}
                        >
                          {group.group_name}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label>
                  Jornada

                  <input
                    type="number"
                    min="1"
                    value={edit.round}
                    onChange={(event) =>
                      setEdit({
                        ...edit,
                        round:
                          event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Jogador A

                  <select
                    value={edit.player_a_id}
                    onChange={(event) =>
                      setEdit({
                        ...edit,
                        player_a_id:
                          event.target.value,
                      })
                    }
                  >
                    <option value="">
                      Selecionar
                    </option>

                    {data.players
                      .filter(
                        (player) =>
                          player.group_id ===
                            edit.group_id &&
                          player.active
                      )
                      .map((player) => (
                        <option
                          key={player.id}
                          value={player.id}
                        >
                          {player.name}
                        </option>
                      ))}
                  </select>
                </label>

                <label>
                  Resultado A

                  <input
                    type="number"
                    min="0"
                    value={edit.score_a ?? ""}
                    onChange={(event) =>
                      setEdit({
                        ...edit,
                        score_a:
                          event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Jogador B

                  <select
                    value={edit.player_b_id}
                    onChange={(event) =>
                      setEdit({
                        ...edit,
                        player_b_id:
                          event.target.value,
                      })
                    }
                  >
                    <option value="">
                      Selecionar
                    </option>

                    {data.players
                      .filter(
                        (player) =>
                          player.group_id ===
                            edit.group_id &&
                          player.active
                      )
                      .map((player) => (
                        <option
                          key={player.id}
                          value={player.id}
                        >
                          {player.name}
                        </option>
                      ))}
                  </select>
                </label>

                <label>
                  Resultado B

                  <input
                    type="number"
                    min="0"
                    value={edit.score_b ?? ""}
                    onChange={(event) =>
                      setEdit({
                        ...edit,
                        score_b:
                          event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Data e hora

                  <input
                    type="datetime-local"
                    value={
                      edit.scheduled_at || ""
                    }
                    onChange={(event) =>
                      setEdit({
                        ...edit,
                        scheduled_at:
                          event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Mesa

                  <input
                    type="number"
                    min="1"
                    value={
                      edit.table_number ?? ""
                    }
                    onChange={(event) =>
                      setEdit({
                        ...edit,
                        table_number:
                          event.target.value,
                      })
                    }
                  />
                </label>
              </>
            )}

            <div className="actions">
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setEdit(null)
                }
                disabled={saving}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() =>
                  submit(editType)
                }
                disabled={saving}
              >
                {saving
                  ? "A guardar..."
                  : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}