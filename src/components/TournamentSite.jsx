import { useEffect, useMemo, useState } from "react";
import {
  LogOut,
  Home,
  RefreshCw,
  Users,
  Trophy,
  Swords,
  Settings,
  Plus,
  Trash2,
  CalendarDays,
  CalendarRange,
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
  synchronizeKnockoutMatches,
  synchronizeDiamondPhase,
  synchronizePlatinumPhase,
} from "../services/api";
import ScheduledMatches from "./ScheduledMatches";
import TableAvailability from "./TableAvailability";

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
  diamond_group_1: "Jogo 1",
  diamond_group_2: "Jogo 2",
  diamond_group_3: "Jogo 3",
  diamond_quarterfinal: "Quartos de final",
  diamond_semifinal: "Meia-final",
  diamond_final: "Final",
  platinum_group_1: "Jogo 1",
  platinum_group_2: "Jogo 2",
  platinum_group_3: "Jogo 3",
  platinum_quarterfinal: "Quartos de final",
  platinum_semifinal: "Meia-final",
  platinum_final: "Final",
};

const DIAMOND_GROUP_NAMES = ["A", "B", "C", "D", "E", "F", "G", "H"];
const DIAMOND_GROUP_MATCH_TYPES = [
  "diamond_group_1",
  "diamond_group_2",
  "diamond_group_3",
];
const DIAMOND_FINAL_ROUNDS = [
  {
    title: "Quartos de final",
    matches: [
      { code: "DQ1", label: "Q1", sourceA: "Vencedor do Grupo A", sourceB: "Vencedor do Grupo H" },
      { code: "DQ2", label: "Q2", sourceA: "Vencedor do Grupo C", sourceB: "Vencedor do Grupo F" },
      { code: "DQ3", label: "Q3", sourceA: "Vencedor do Grupo B", sourceB: "Vencedor do Grupo G" },
      { code: "DQ4", label: "Q4", sourceA: "Vencedor do Grupo D", sourceB: "Vencedor do Grupo E" },
    ],
  },
  {
    title: "Meias-finais",
    matches: [
      { code: "DMF1", label: "MF1", sourceA: "Vencedor de Q2", sourceB: "Vencedor de Q3" },
      { code: "DMF2", label: "MF2", sourceA: "Vencedor de Q1", sourceB: "Vencedor de Q4" },
    ],
  },
  {
    title: "Final",
    matches: [
      { code: "DF", label: "Final", sourceA: "Vencedor de MF2", sourceB: "Vencedor de MF1" },
    ],
  },
];

const PLATINUM_GROUP_MATCH_TYPES = [
  "platinum_group_1",
  "platinum_group_2",
  "platinum_group_3",
];
const PLATINUM_FINAL_ROUNDS = DIAMOND_FINAL_ROUNDS.map((round) => ({
  ...round,
  matches: round.matches.map((match) => ({
    ...match,
    code: match.code.replace(/^D/, "P"),
  })),
}));

const MATCH_TYPE_ORDER = {
  initial_1: 1,
  initial_2: 2,
  winners: 3,
  losers: 4,
  decisive: 5,
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

function formatDateTimeForInput(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function parseDateTimeInput(value) {
  if (!value || !value.trim()) {
    return null;
  }

  const match = value.trim().match(
    /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/
  );

  if (!match) {
    throw new Error(
      "A data e hora deve ter o formato dd/mm/aaaa hh:mm."
    );
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const hours = Number(match[4]);
  const minutes = Number(match[5]);
  const date = new Date(year, month - 1, day, hours, minutes, 0, 0);

  const validDate =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hours &&
    date.getMinutes() === minutes;

  if (!validDate) {
    throw new Error("A data e hora introduzida não é válida.");
  }

  return date.toISOString();
}

function getDateValue(value) {
  const match = String(value || "").trim().match(
    /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/
  );

  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}

function getTimePart(value, part) {
  const match = String(value || "").trim().match(
    /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/
  );

  if (!match) {
    return "00";
  }

  return part === "hour" ? match[4] : match[5];
}

function updateDateTimeText(currentValue, changes) {
  const match = String(currentValue || "").trim().match(
    /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/
  );
  const now = new Date();

  let day = match?.[1] || String(now.getDate()).padStart(2, "0");
  let month = match?.[2] || String(now.getMonth() + 1).padStart(2, "0");
  let year = match?.[3] || String(now.getFullYear());
  let hour = match?.[4] || "00";
  let minute = match?.[5] || "00";

  if (changes.dateValue) {
    const dateMatch = changes.dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (dateMatch) {
      year = dateMatch[1];
      month = dateMatch[2];
      day = dateMatch[3];
    }
  }

  if (changes.hour !== undefined) {
    hour = String(changes.hour).padStart(2, "0");
  }

  if (changes.minute !== undefined) {
    minute = String(changes.minute).padStart(2, "0");
  }

  return `${day}/${month}/${year} ${hour}:${minute}`;
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
  const [activeTab, setActiveTab] = useState("home");
  const [matchPhase, setMatchPhase] = useState("initial");
  const [data, setData] = useState({
    groups: [],
    players: [],
    matches: [],
    groupMembers: [],
    diamondStandings: [],
    platinumStandings: [],
  });
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedDiamondSection, setSelectedDiamondSection] = useState("A");
  const [selectedPlatinumSection, setSelectedPlatinumSection] = useState("A");
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
      if (!selectedGroupId || busy || matchPhase !== "initial") {
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
  }, [selectedGroupId, matchPhase]);

  const playersById = useMemo(
    () =>
      Object.fromEntries(
        data.players.map((player) => [player.id, player])
      ),
    [data.players]
  );

  const phaseGroups = useMemo(() => {
    if (matchPhase === "knockout") {
      return [];
    }

    return data.groups
      .filter((group) => (group.phase || "initial") === matchPhase)
      .sort((first, second) =>
        (first.group_order || 99) - (second.group_order || 99)
      );
  }, [data.groups, matchPhase]);

  const phaseMatches = useMemo(() => {
    const acceptedPhases = matchPhase === "knockout"
      ? ["knockout"]
      : [matchPhase];

    return data.matches.filter((match) =>
      acceptedPhases.includes(match.phase || "initial")
    );
  }, [data.matches, matchPhase]);

  const selectedGroup = data.groups.find(
    (group) => group.id === selectedGroupId
  );

  const selectedDiamondGroup = useMemo(
    () =>
      data.groups.find(
        (group) =>
          group.phase === "diamond" &&
          group.group_name === selectedDiamondSection
      ) || null,
    [data.groups, selectedDiamondSection]
  );

  const diamondMatchesByCode = useMemo(
    () =>
      Object.fromEntries(
        data.matches
          .filter((match) => match.phase === "diamond_knockout")
          .map((match) => [match.match_code, match])
      ),
    [data.matches]
  );

  const selectedPlatinumGroup = useMemo(
    () =>
      data.groups.find(
        (group) =>
          group.phase === "platinum" &&
          group.group_name === selectedPlatinumSection
      ) || null,
    [data.groups, selectedPlatinumSection]
  );

  const platinumMatchesByCode = useMemo(
    () =>
      Object.fromEntries(
        data.matches
          .filter((match) => match.phase === "platinum_knockout")
          .map((match) => [match.match_code, match])
      ),
    [data.matches]
  );

  const selectedChampionshipSection =
    matchPhase === "platinum" ? selectedPlatinumSection : selectedDiamondSection;
  const selectedChampionshipGroup =
    matchPhase === "platinum" ? selectedPlatinumGroup : selectedDiamondGroup;

  const groupPlayers = useMemo(() => {
    if (!["diamond", "platinum"].includes(matchPhase)) {
      return data.players.filter(
        (player) => player.group_id === selectedGroupId && player.active
      );
    }

    const memberIds = new Set(
      (data.groupMembers || [])
        .filter(
          (member) =>
            member.group_id ===
            (["diamond", "platinum"].includes(matchPhase)
              ? selectedChampionshipGroup?.id
              : selectedGroupId)
        )
        .map((member) => member.player_id)
    );

    return data.players.filter((player) => memberIds.has(player.id));
  }, [
    data.players,
    data.groupMembers,
    selectedGroupId,
    selectedDiamondGroup,
    selectedPlatinumGroup,
    selectedChampionshipGroup,
    matchPhase,
  ]);

  const diamondStandings = useMemo(
    () =>
      (data.diamondStandings || []).filter(
        (standing) => standing.group_id === selectedDiamondGroup?.id
      ),
    [data.diamondStandings, selectedDiamondGroup]
  );

  const platinumStandings = useMemo(
    () =>
      (data.platinumStandings || []).filter(
        (standing) => standing.group_id === selectedPlatinumGroup?.id
      ),
    [data.platinumStandings, selectedPlatinumGroup]
  );

  const championshipStandings =
    matchPhase === "platinum" ? platinumStandings : diamondStandings;

  const championshipGroupRows = useMemo(() => {
    const groupId = selectedChampionshipGroup?.id;

    if (!groupId) {
      return [1, 2, 3].map((position) => ({
        position,
        standing: null,
      }));
    }

    const membersByPosition = Object.fromEntries(
      (data.groupMembers || [])
        .filter((member) => member.group_id === groupId)
        .map((member) => [Number(member.position), member])
    );

    const standingsByPlayerId = Object.fromEntries(
      championshipStandings.map((standing) => [
        standing.player_id,
        standing,
      ])
    );

    const completedGroupMatches = data.matches.filter(
      (match) =>
        match.group_id === groupId &&
        match.phase === matchPhase &&
        [
          `${matchPhase}_group_1`,
          `${matchPhase}_group_2`,
          `${matchPhase}_group_3`,
        ].includes(match.match_type) &&
        match.completed
    ).length;

    if (completedGroupMatches === 3 && championshipStandings.length === 3) {
      return [...championshipStandings]
        .sort(
          (first, second) =>
            first.provisional_position - second.provisional_position
        )
        .map((standing) => ({
          position: standing.provisional_position,
          standing,
        }));
    }

    return [1, 2, 3].map((position) => {
      const member = membersByPosition[position];
      return {
        position,
        standing: member
          ? standingsByPlayerId[member.player_id] || null
          : null,
      };
    });
  }, [
    championshipStandings,
    data.groupMembers,
    data.matches,
    matchPhase,
    selectedChampionshipGroup,
  ]);
  const championshipMatchesByCode =
    matchPhase === "platinum" ? platinumMatchesByCode : diamondMatchesByCode;
  const championshipGroupMatchTypes =
    matchPhase === "platinum"
      ? PLATINUM_GROUP_MATCH_TYPES
      : DIAMOND_GROUP_MATCH_TYPES;
  const championshipFinalRounds =
    matchPhase === "platinum" ? PLATINUM_FINAL_ROUNDS : DIAMOND_FINAL_ROUNDS;

  const diamondKnockoutMatches = useMemo(
    () =>
      data.matches
        .filter((match) => match.phase === "diamond_knockout")
        .sort((first, second) =>
          (first.match_order || 99) - (second.match_order || 99)
        ),
    [data.matches]
  );

  const groupMatches = useMemo(
    () =>
      phaseMatches
        .filter(
          (match) =>
            match.group_id ===
            (["diamond", "platinum"].includes(matchPhase)
              ? selectedChampionshipGroup?.id
              : selectedGroupId)
        )
        .sort(
          (first, second) =>
            (MATCH_TYPE_ORDER[first.match_type] || 99) -
            (MATCH_TYPE_ORDER[second.match_type] || 99)
        ),
    [phaseMatches, selectedGroupId, selectedDiamondGroup, selectedPlatinumGroup, selectedChampionshipGroup, matchPhase]
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
      match_order: match.match_order,
      phase: match.phase || "initial",
      secondary_group_id: match.secondary_group_id || null,
      match_code: match.match_code || null,
      player_a_id: match.player_a_id,
      player_b_id: match.player_b_id,
      score_a: match.score_a ?? "",
      score_b: match.score_b ?? "",
      completed: match.completed,
      scheduled_at: formatDateTimeForInput(
        match.scheduled_at
      ),
      table_number: match.table_number ?? "",
      penalty_winner_id: match.penalty_winner_id ?? "",
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

        const bothReached = playerAReached && playerBReached;
        const onlyOneReached = playerAReached !== playerBReached;

        if (
          scoreA !== null &&
          scoreB !== null &&
          !playerAReached &&
          !playerBReached
        ) {
          throw new Error(
            "O jogo só pode ser concluído quando pelo menos um jogador atingir o respetivo handicap."
          );
        }

        if (
          bothReached &&
          edit.penalty_winner_id !== edit.player_a_id &&
          edit.penalty_winner_id !== edit.player_b_id
        ) {
          throw new Error(
            "Ambos os jogadores atingiram o handicap. Indica o vencedor das grandes penalidades."
          );
        }

        const completed =
          scoreA !== null &&
          scoreB !== null &&
          (onlyOneReached || bothReached);

        const scheduledAt = parseDateTimeInput(edit.scheduled_at);

        await saveMatch({
          ...edit,
          score_a: scoreA,
          score_b: scoreB,
          completed,
          scheduled_at: scheduledAt,
          penalty_winner_id: bothReached
            ? edit.penalty_winner_id
            : null,
        });

        if ((edit.phase || "initial") === "initial") {
          await synchronizeGroupProgression(edit.group_id);
          await synchronizeKnockoutMatches();
          await synchronizeDiamondPhase();
          await synchronizePlatinumPhase();
        }

        if (["knockout", "diamond", "diamond_knockout"].includes(edit.phase)) {
          await synchronizeDiamondPhase();
        }

        if (["knockout", "platinum", "platinum_knockout"].includes(edit.phase)) {
          await synchronizePlatinumPhase();
        }
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
          <h1>2º Handicap BBC 2026</h1>
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

          {isAdmin && (
            <button
              className={activeTab === "availability" ? "active header-availability-button" : "secondary header-availability-button"}
              type="button"
              onClick={() => setActiveTab("availability")}
            >
              <CalendarRange size={16} />
              Disponibilidade
            </button>
          )}

          {isAdmin && (
            <button
              className={activeTab === "admin" ? "active header-admin-button" : "secondary header-admin-button"}
              type="button"
              onClick={() => setActiveTab("admin")}
            >
              <Settings size={16} />
              Administração
            </button>
          )}

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
          className={activeTab === "home" ? "active" : ""}
          onClick={() => setActiveTab("home")}
        >
          <Home size={17} />
          Início
        </button>

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

      </nav>

      <main>
        {error && <p className="error">{error}</p>}

        {busy ? (
          <div className="card">A carregar...</div>
        ) : (
          <>
            {activeTab === "availability" && isAdmin && (
              <TableAvailability />
            )}

            {activeTab === "home" && (
              <section className="authenticated-home">
                <ScheduledMatches embedded />
              </section>
            )}

            {activeTab === "matches" && (
              <div className="match-phase-tabs">
                {[
                  ["initial", "Fase Inicial"],
                  ["knockout", "Fase Knockout"],
                  ["diamond", "Fase Diamante"],
                  ["platinum", "Fase Platina"],
                ].map(([phaseId, phaseName]) => (
                  <button
                    type="button"
                    key={phaseId}
                    className={matchPhase === phaseId ? "active" : "secondary"}
                    onClick={() => {
                      setMatchPhase(phaseId);

                      if (phaseId === "diamond") {
                        setSelectedDiamondSection("A");
                        const diamondGroupA = data.groups.find(
                          (group) =>
                            group.phase === "diamond" && group.group_name === "A"
                        );
                        setSelectedGroupId(diamondGroupA?.id || "");
                        return;
                      }

                      if (phaseId === "platinum") {
                        setSelectedPlatinumSection("A");
                        const platinumGroupA = data.groups.find(
                          (group) =>
                            group.phase === "platinum" && group.group_name === "A"
                        );
                        setSelectedGroupId(platinumGroupA?.id || "");
                        return;
                      }

                      const firstGroup = data.groups
                        .filter((group) => (group.phase || "initial") === phaseId)
                        .sort((first, second) =>
                          (first.group_order || 99) - (second.group_order || 99)
                        )[0];
                      setSelectedGroupId(firstGroup?.id || "");
                    }}
                  >
                    {phaseName}
                  </button>
                ))}
              </div>
            )}

            {activeTab === "matches" && ["diamond", "platinum"].includes(matchPhase) && (
              <div className="groups diamond-navigation">
                {[...DIAMOND_GROUP_NAMES, "final"].map((section) => {
                  const isFinal = section === "final";
                  const label = isFinal ? "Fase Final" : section;
                  const active = selectedChampionshipSection === section;

                  return (
                    <button
                      key={section}
                      type="button"
                      className={`${active ? "active" : ""} ${
                        isFinal ? "diamond-final-button" : ""
                      }`.trim()}
                      onClick={() => {
                        matchPhase === "platinum"
                          ? setSelectedPlatinumSection(section)
                          : setSelectedDiamondSection(section);

                        if (isFinal) {
                          setSelectedGroupId("");
                          return;
                        }

                        const diamondGroup = data.groups.find(
                          (group) =>
                            group.phase === matchPhase &&
                            group.group_name === section
                        );
                        setSelectedGroupId(diamondGroup?.id || "");
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {activeTab !== "admin" &&
              matchPhase !== "knockout" &&
              !(activeTab === "matches" && ["diamond", "platinum"].includes(matchPhase)) && (
                <div className="groups">
                  {(activeTab === "matches"
                    ? phaseGroups
                    : data.groups.filter(
                        (group) => (group.phase || "initial") === "initial"
                      )
                  ).map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      className={selectedGroupId === group.id ? "active" : ""}
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
                  <h2>
                    {matchPhase === "initial" &&
                      `Fase Inicial · Grupo ${selectedGroup?.group_name || "–"}`}
                    {matchPhase === "knockout" && "Fase Knockout"}
                    {matchPhase === "diamond" &&
                      (selectedDiamondSection === "final"
                        ? "Fase Diamante · Fase Final"
                        : `Fase Diamante · Grupo ${selectedDiamondSection}`)}
                    {matchPhase === "platinum" &&
                      (selectedPlatinumSection === "final"
                        ? "Fase Platina · Fase Final"
                        : `Fase Platina · Grupo ${selectedPlatinumSection}`)}
                  </h2>
                </div>

                {["diamond", "platinum"].includes(matchPhase) && selectedChampionshipSection !== "final" ? (
                  <>
                    <div className="card diamond-standings-card">
                      <h3>Classificação do Grupo {selectedChampionshipSection}</h3>
                      <div className="tablewrap">
                        <table className="diamond-standings-table">
                          <thead>
                            <tr>
                              <th>Pos.</th>
                              <th>Jogador</th>
                              <th>HC</th>
                              <th>J</th>
                              <th>V</th>
                              <th>D</th>
                              <th>Car.</th>
                              <th>%</th>
                            </tr>
                          </thead>
                          <tbody>
                            {championshipGroupRows.map(({ position, standing }) => {
                              return standing ? (
                                <tr
                                  key={`${position}-${standing.player_id}`}
                                  className={
                                    standing.played === 2 &&
                                    standing.provisional_position === 1
                                      ? "diamond-leader"
                                      : ""
                                  }
                                >
                                  <td>{position}</td>
                                  <td>{standing.player_name}</td>
                                  <td>{standing.handicap}</td>
                                  <td>{standing.played}</td>
                                  <td>{standing.wins}</td>
                                  <td>{standing.losses}</td>
                                  <td>{standing.total_caroms}</td>
                                  <td>
                                    {Number(standing.carom_percentage).toFixed(2)}%
                                  </td>
                                </tr>
                              ) : (
                                <tr key={`pending-standing-${position}`} className="diamond-pending-row">
                                  <td>{position}</td>
                                  <td>Por decidir</td>
                                  <td>–</td>
                                  <td>–</td>
                                  <td>–</td>
                                  <td>–</td>
                                  <td>–</td>
                                  <td>–</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="cards diamond-group-matches">
                      {championshipGroupMatchTypes.map((matchType, index) => {
                        const match = groupMatches.find(
                          (candidate) => candidate.match_type === matchType
                        );
                        const playerA = match
                          ? playersById[match.player_a_id]
                          : null;
                        const playerB = match
                          ? playersById[match.player_b_id]
                          : null;
                        const winnerId = match && isMatchComplete(match, playersById)
                          ? getWinnerId(match, playersById)
                          : null;

                        return (
                          <article
                            className={`card ${match ? "" : "diamond-placeholder-card"}`.trim()}
                            key={matchType}
                          >
                            <h3>Jogo {index + 1}</h3>
                            <small>
                              {match?.scheduled_at
                                ? new Date(match.scheduled_at).toLocaleString("pt-PT", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: false,
                                  })
                                : "Sem horário"}
                              {match?.table_number
                                ? ` · Mesa ${match.table_number}`
                                : ""}
                            </small>
                            <p className={winnerId === playerA?.id ? "win" : ""}>
                              {playerA?.name || "Por decidir"}
                              {playerA ? ` (${playerA.handicap})` : ""}
                              <b>{match?.score_a ?? "–"}</b>
                            </p>
                            <p className={winnerId === playerB?.id ? "win" : ""}>
                              {playerB?.name || "Por decidir"}
                              {playerB ? ` (${playerB.handicap})` : ""}
                              <b>{match?.score_b ?? "–"}</b>
                            </p>
                            {match && canManageMatches && (
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
                                    onClick={() => removeRecord("match", match.id)}
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
                  </>
                ) : ["diamond", "platinum"].includes(matchPhase) ? (
                  <div className="diamond-final-layout">
                    {championshipFinalRounds.map((round) => (
                      <section className="diamond-final-round" key={round.title}>
                        <h3>{round.title}</h3>
                        <div className="cards">
                          {round.matches.map((definition) => {
                            const match = championshipMatchesByCode[definition.code];
                            const playerA = match
                              ? playersById[match.player_a_id]
                              : null;
                            const playerB = match
                              ? playersById[match.player_b_id]
                              : null;
                            const winnerId = match && isMatchComplete(match, playersById)
                              ? getWinnerId(match, playersById)
                              : null;

                            return (
                              <article
                                className={`card ${match ? "" : "diamond-placeholder-card"}`.trim()}
                                key={definition.code}
                              >
                                <h3>{definition.label}</h3>
                                <small>
                                  {match?.scheduled_at
                                    ? new Date(match.scheduled_at).toLocaleString("pt-PT", {
                                        day: "2-digit",
                                        month: "2-digit",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        hour12: false,
                                      })
                                    : "Sem horário"}
                                  {match?.table_number
                                    ? ` · Mesa ${match.table_number}`
                                    : ""}
                                </small>
                                <p className={winnerId === playerA?.id ? "win" : ""}>
                                  <span>
                                    {playerA?.name || "Por decidir"}
                                    {!playerA && (
                                      <small className="diamond-source-label">
                                        {definition.sourceA}
                                      </small>
                                    )}
                                  </span>
                                  <b>{match?.score_a ?? "–"}</b>
                                </p>
                                <p className={winnerId === playerB?.id ? "win" : ""}>
                                  <span>
                                    {playerB?.name || "Por decidir"}
                                    {!playerB && (
                                      <small className="diamond-source-label">
                                        {definition.sourceB}
                                      </small>
                                    )}
                                  </span>
                                  <b>{match?.score_b ?? "–"}</b>
                                </p>
                                {match && canManageMatches && (
                                  <div className="actions">
                                    <button
                                      type="button"
                                      onClick={() => openMatchForEditing(match)}
                                    >
                                      Editar
                                    </button>
                                  </div>
                                )}
                              </article>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : (
                  <>
                    {(matchPhase === "knockout" ? phaseMatches : groupMatches)
                      .length === 0 && (
                      <div className="card phase-empty">
                        Esta fase ainda não tem jogos criados.
                      </div>
                    )}
                    <div className="cards">
                      {(matchPhase === "knockout" ? phaseMatches : groupMatches).map(
                        (match) => {
                          const playerA = playersById[match.player_a_id];
                          const playerB = playersById[match.player_b_id];
                          const completed = isMatchComplete(match, playersById);
                          const winnerId = completed
                            ? getWinnerId(match, playersById)
                            : null;

                          return (
                            <article className="card" key={match.id}>
                              {match.phase !== "knockout" && (
                                <h3>
                                  {MATCH_TYPE_LABELS[match.match_type] ||
                                    `Jornada ${match.round}`}
                                </h3>
                              )}
                              <small>
                                {match.phase === "knockout"
                                  ? match.scheduled_at
                                    ? new Date(match.scheduled_at).toLocaleString(
                                        "pt-PT",
                                        {
                                          day: "2-digit",
                                          month: "2-digit",
                                          year: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                          hour12: false,
                                        }
                                      )
                                    : "Sem horário"
                                  : `Jornada ${match.round}${
                                      match.scheduled_at
                                        ? ` · ${new Date(
                                            match.scheduled_at
                                          ).toLocaleString("pt-PT", {
                                            day: "2-digit",
                                            month: "2-digit",
                                            year: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                            hour12: false,
                                          })}`
                                        : " · Sem horário"
                                    }`}
                                {match.table_number
                                  ? ` · Mesa ${match.table_number}`
                                  : ""}
                              </small>
                              <p className={winnerId === playerA?.id ? "win" : ""}>
                                {playerA?.name} ({playerA?.handicap})
                                <b>{match.score_a ?? "–"}</b>
                              </p>
                              <p className={winnerId === playerB?.id ? "win" : ""}>
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
                                      onClick={() => removeRecord("match", match.id)}
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  )}
                                </div>
                              )}
                            </article>
                          );
                        }
                      )}
                    </div>
                  </>
                )}
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

                {edit.score_a !== "" &&
                  edit.score_b !== "" &&
                  hasReachedHandicap(
                    Number(edit.score_a),
                    playersById[edit.player_a_id]
                  ) &&
                  hasReachedHandicap(
                    Number(edit.score_b),
                    playersById[edit.player_b_id]
                  ) && (
                    <label>
                      Vencedor das grandes penalidades
                      <select
                        value={edit.penalty_winner_id || ""}
                        onChange={(event) =>
                          setEdit({
                            ...edit,
                            penalty_winner_id: event.target.value,
                          })
                        }
                      >
                        <option value="">Selecionar vencedor</option>
                        <option value={edit.player_a_id}>
                          {playersById[edit.player_a_id]?.name}
                        </option>
                        <option value={edit.player_b_id}>
                          {playersById[edit.player_b_id]?.name}
                        </option>
                      </select>
                      <small>
                        O empate vale 1 ponto para cada jogador. Esta escolha
                        regista apenas o vencedor das grandes penalidades.
                      </small>
                    </label>
                  )}

                <label>
                  Data e hora
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) 48px",
                      gap: "8px",
                      alignItems: "end",
                    }}
                  >
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="dd/mm/aaaa hh:mm"
                      value={edit.scheduled_at}
                      onChange={(event) =>
                        setEdit({
                          ...edit,
                          scheduled_at: event.target.value,
                        })
                      }
                      onBlur={() => {
                        if (edit.scheduled_at.trim()) {
                          try {
                            parseDateTimeInput(edit.scheduled_at);
                            setError("");
                          } catch (dateError) {
                            setError(dateError.message);
                          }
                        }
                      }}
                      aria-describedby="scheduled-at-help"
                    />

                    <label
                      title="Abrir calendário"
                      aria-label="Abrir calendário"
                      style={{
                        position: "relative",
                        display: "grid",
                        placeItems: "center",
                        width: "48px",
                        height: "44px",
                        margin: 0,
                        color: "#111827",
                        background: "#fbbf24",
                        borderRadius: "10px",
                        cursor: "pointer",
                        overflow: "hidden",
                      }}
                    >
                      <CalendarDays size={20} />
                      <input
                        type="date"
                        value={getDateValue(edit.scheduled_at)}
                        onChange={(event) =>
                          setEdit({
                            ...edit,
                            scheduled_at: updateDateTimeText(
                              edit.scheduled_at,
                              { dateValue: event.target.value }
                            ),
                          })
                        }
                        style={{
                          position: "absolute",
                          inset: 0,
                          width: "100%",
                          height: "100%",
                          opacity: 0,
                          cursor: "pointer",
                        }}
                      />
                    </label>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "10px",
                      marginTop: "10px",
                    }}
                  >
                    <label style={{ margin: 0 }}>
                      Hora
                      <select
                        value={getTimePart(edit.scheduled_at, "hour")}
                        onChange={(event) =>
                          setEdit({
                            ...edit,
                            scheduled_at: updateDateTimeText(
                              edit.scheduled_at,
                              { hour: event.target.value }
                            ),
                          })
                        }
                      >
                        {Array.from({ length: 24 }, (_, value) => {
                          const hour = String(value).padStart(2, "0");
                          return (
                            <option key={hour} value={hour}>
                              {hour}
                            </option>
                          );
                        })}
                      </select>
                    </label>

                    <label style={{ margin: 0 }}>
                      Minutos
                      <select
                        value={getTimePart(edit.scheduled_at, "minute")}
                        onChange={(event) =>
                          setEdit({
                            ...edit,
                            scheduled_at: updateDateTimeText(
                              edit.scheduled_at,
                              { minute: event.target.value }
                            ),
                          })
                        }
                      >
                        {["00", "15", "30", "45"].map((minute) => (
                          <option key={minute} value={minute}>
                            {minute}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <small id="scheduled-at-help">
                    Escreve no formato 01/09/2026 19:00 ou usa o calendário,
                    a hora e os minutos. Formato de 24 horas.
                  </small>
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
