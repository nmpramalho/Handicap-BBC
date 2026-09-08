import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock3,
  MapPin,
  RefreshCw,
} from "lucide-react";

import { supabase } from "../lib/supabase";
import "./LandingPage.css";

function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function formatDateTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Data inválida";
  }

  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function getMatchDescription(match) {
  const phase = match.phase || "initial";
  const matchType = match.match_type;

  if (phase === "diamond") {
    return "Fase Diamante - Jogo de Grupo";
  }

  if (phase === "diamond_knockout") {
    if (matchType === "diamond_quarterfinal") {
      return "Fase Diamante - Quartos de Final";
    }
    if (matchType === "diamond_semifinal") {
      return "Fase Diamante - Meia-Final";
    }
    return "Fase Diamante - Final";
  }

  if (phase === "platinum") {
    return "Fase Platina - Jogo de Grupo";
  }

  if (phase === "platinum_knockout") {
    if (matchType === "platinum_quarterfinal") {
      return "Fase Platina - Quartos de Final";
    }
    if (matchType === "platinum_semifinal") {
      return "Fase Platina - Meia-Final";
    }
    return "Fase Platina - Final";
  }

  if (phase === "knockout") {
    return "Fase Knockout";
  }

  const initialNames = {
    initial_1: "Fase Inicial - Jogo Inicial 1",
    initial_2: "Fase Inicial - Jogo Inicial 2",
    winners: "Fase Inicial - Jogo dos Vencedores",
    losers: "Fase Inicial - Jogo dos Derrotados",
    decisive: "Fase Inicial - Jogo Decisivo",
  };

  return initialNames[matchType] || "Fase Inicial - Jogo de Grupo";
}

function MatchCard({ match, showDate }) {
  return (
    <article className="home-match-card">
      <div className="home-match-heading">
        <span className="home-match-type">
          {getMatchDescription(match)}
        </span>

        <span className="home-match-group">
          Grupo {match.group?.group_name || "–"}
        </span>
      </div>

      <div className="home-match-schedule">
        <span>
          {showDate ? <CalendarDays size={16} /> : <Clock3 size={16} />}
          {formatDateTime(match.scheduled_at)}
        </span>

        {match.table_number && (
          <span>
            <MapPin size={16} />
            Mesa {match.table_number}
          </span>
        )}
      </div>

      <div className="home-match-players">
        <div>
          <strong>{match.player_a?.name || "Por decidir"}</strong>
          {match.player_a && <small>HC {match.player_a.handicap}</small>}
        </div>

        <span>vs</span>

        <div>
          <strong>{match.player_b?.name || "Por decidir"}</strong>
          {match.player_b && <small>HC {match.player_b.handicap}</small>}
        </div>
      </div>
    </article>
  );
}

function EmptySchedule({ children }) {
  return (
    <div className="home-empty">
      <CalendarDays size={25} />
      <p>{children}</p>
    </div>
  );
}

export default function ScheduledMatches({ embedded = false }) {
  const [matches, setMatches] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [error, setError] = useState("");

  async function loadScheduledMatches() {
    try {
      setLoadingSchedule(true);
      setError("");

      const now = new Date();
      const firstMoment = startOfDay(now);
      const lastMoment = endOfDay(
        new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7)
      );

      const { data: matchRows, error: matchError } = await supabase
        .from("matches")
        .select(
          "id, group_id, player_a_id, player_b_id, round, match_type, phase, scheduled_at, table_number, completed"
        )
        .not("scheduled_at", "is", null)
        .gte("scheduled_at", firstMoment.toISOString())
        .lte("scheduled_at", lastMoment.toISOString())
        .order("scheduled_at", { ascending: true });

      if (matchError) {
        throw matchError;
      }

      const groupIds = [
        ...new Set((matchRows || []).map((match) => match.group_id).filter(Boolean)),
      ];
      const playerIds = [
        ...new Set(
          (matchRows || [])
            .flatMap((match) => [match.player_a_id, match.player_b_id])
            .filter(Boolean)
        ),
      ];

      const groupsQuery = groupIds.length
        ? supabase.from("groups").select("id, group_name").in("id", groupIds)
        : Promise.resolve({ data: [], error: null });
      const playersQuery = playerIds.length
        ? supabase.from("players").select("id, name, handicap").in("id", playerIds)
        : Promise.resolve({ data: [], error: null });

      const [groupsResult, playersResult] = await Promise.all([
        groupsQuery,
        playersQuery,
      ]);

      if (groupsResult.error) {
        throw groupsResult.error;
      }
      if (playersResult.error) {
        throw playersResult.error;
      }

      const groupsById = Object.fromEntries(
        (groupsResult.data || []).map((group) => [group.id, group])
      );
      const playersById = Object.fromEntries(
        (playersResult.data || []).map((player) => [player.id, player])
      );

      setMatches(
        (matchRows || []).map((match) => ({
          ...match,
          group: groupsById[match.group_id] || null,
          player_a: playersById[match.player_a_id] || null,
          player_b: playersById[match.player_b_id] || null,
        }))
      );
    } catch (loadError) {
      console.error("Erro ao carregar o calendário:", loadError);
      setError("Não foi possível carregar os jogos agendados.");
    } finally {
      setLoadingSchedule(false);
    }
  }

  useEffect(() => {
    loadScheduledMatches();
  }, []);

  const todayMatches = useMemo(() => {
    const todayStart = startOfDay(new Date()).getTime();
    const todayEnd = endOfDay(new Date()).getTime();

    return matches.filter((match) => {
      const scheduledTime = new Date(match.scheduled_at).getTime();
      return scheduledTime >= todayStart && scheduledTime <= todayEnd;
    });
  }, [matches]);

  const nextSevenDaysMatches = useMemo(() => {
    const todayEnd = endOfDay(new Date()).getTime();
    return matches.filter(
      (match) => new Date(match.scheduled_at).getTime() > todayEnd
    );
  }, [matches]);

  return (
    <div className={embedded ? "scheduled-matches embedded-schedule" : "scheduled-matches"}>
      <section className="home-content">
        <div className="home-section-heading">
          <div>
            <span>Agenda</span>
            <h2>Jogos de hoje</h2>
          </div>

          <button
            type="button"
            className="home-refresh-button"
            onClick={loadScheduledMatches}
            disabled={loadingSchedule}
          >
            <RefreshCw
              size={17}
              className={loadingSchedule ? "home-spin" : ""}
            />
            <span>Atualizar</span>
          </button>
        </div>

        {error && <p className="home-error">{error}</p>}

        {loadingSchedule ? (
          <EmptySchedule>A carregar jogos...</EmptySchedule>
        ) : todayMatches.length > 0 ? (
          <div className="home-match-grid">
            {todayMatches.map((match) => (
              <MatchCard key={match.id} match={match} showDate={false} />
            ))}
          </div>
        ) : (
          <EmptySchedule>Não existem jogos agendados para hoje.</EmptySchedule>
        )}
      </section>

      <section className="home-content home-week-section">
        <div className="home-section-heading">
          <div>
            <span>Próximos dias</span>
            <h2>Jogos nos próximos 7 dias</h2>
          </div>
        </div>

        {!loadingSchedule && nextSevenDaysMatches.length > 0 ? (
          <div className="home-match-grid">
            {nextSevenDaysMatches.map((match) => (
              <MatchCard key={match.id} match={match} showDate />
            ))}
          </div>
        ) : (
          !loadingSchedule && (
            <EmptySchedule>
              Não existem jogos agendados para os próximos 7 dias.
            </EmptySchedule>
          )
        )}
      </section>
    </div>
  );
}
