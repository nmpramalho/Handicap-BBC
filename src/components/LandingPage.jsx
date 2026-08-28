import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock3,
  LogIn,
  MapPin,
  RefreshCw,
  Trophy,
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

function formatTime(value) {
  return new Intl.DateTimeFormat("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDate(value) {
  return new Intl.DateTimeFormat("pt-PT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function getMatchTypeName(matchType) {
  const names = {
    initial_1: "Jogo inicial 1",
    initial_2: "Jogo inicial 2",
    winners: "Jogo dos vencedores",
    losers: "Jogo dos derrotados",
    decisive: "Jogo decisivo",
  };

  return names[matchType] || "Jogo do grupo";
}

function MatchCard({ match, showDate }) {
  return (
    <article className="home-match-card">
      <div className="home-match-heading">
        <span className="home-match-type">
          {getMatchTypeName(match.match_type)}
        </span>

        <span className="home-match-group">
          Grupo {match.group?.group_name || "–"}
        </span>
      </div>

      <div className="home-match-schedule">
        {showDate && (
          <span>
            <CalendarDays size={16} />
            {formatDate(match.scheduled_at)}
          </span>
        )}

        <span>
          <Clock3 size={16} />
          {formatTime(match.scheduled_at)}
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
          <strong>{match.player_a?.name || "Jogador por definir"}</strong>
          {match.player_a && <small>HC {match.player_a.handicap}</small>}
        </div>

        <span>vs</span>

        <div>
          <strong>{match.player_b?.name || "Jogador por definir"}</strong>
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

export default function LandingPage() {
  const [matches, setMatches] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
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

      const { data, error: queryError } = await supabase
        .from("matches")
        .select(`
          id,
          round,
          match_type,
          scheduled_at,
          table_number,
          completed,
          group:groups (
            id,
            group_name
          ),
          player_a:players!matches_player_a_id_fkey (
            id,
            name,
            handicap
          ),
          player_b:players!matches_player_b_id_fkey (
            id,
            name,
            handicap
          )
        `)
        .not("scheduled_at", "is", null)
        .gte("scheduled_at", firstMoment.toISOString())
        .lte("scheduled_at", lastMoment.toISOString())
        .eq("completed", false)
        .order("scheduled_at", { ascending: true });

      if (queryError) {
        throw queryError;
      }

      setMatches(data ?? []);
    } catch (loadError) {
      console.error("Erro ao carregar o calendário:", loadError);
      setError("Não foi possível carregar os jogos agendados.");
    } finally {
      setLoadingSchedule(false);
    }
  }

  async function signInWithGoogle() {
    if (loginLoading) {
      return;
    }

    setLoginLoading(true);
    setError("");

    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (signInError) {
      console.error("Erro no login Google:", signInError);
      setError("Não foi possível iniciar o login com a conta Google.");
      setLoginLoading(false);
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

  const weekMatches = useMemo(() => {
    const todayEnd = endOfDay(new Date()).getTime();

    return matches.filter(
      (match) => new Date(match.scheduled_at).getTime() > todayEnd
    );
  }, [matches]);

  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-brand">
          <div className="home-logo" aria-hidden="true">
            <Trophy size={31} />
          </div>

          <div>
            <span className="home-eyebrow">Torneio de bilhar</span>
            <h1>Handicap BBC 2026</h1>
            <p>Calendário, jogos e resultados oficiais do torneio.</p>
          </div>
        </div>

        <button
          type="button"
          className="home-login-button"
          onClick={signInWithGoogle}
          disabled={loginLoading}
        >
          <LogIn size={20} />
          {loginLoading ? "A abrir o Google..." : "Entrar com Conta Google"}
        </button>
      </section>

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
            <h2>Jogos desta semana</h2>
          </div>
        </div>

        {!loadingSchedule && weekMatches.length > 0 ? (
          <div className="home-match-grid">
            {weekMatches.map((match) => (
              <MatchCard key={match.id} match={match} showDate />
            ))}
          </div>
        ) : (
          !loadingSchedule && (
            <EmptySchedule>
              Não existem mais jogos agendados para os próximos sete dias.
            </EmptySchedule>
          )
        )}
      </section>

      <footer className="home-footer">
        <strong>Handicap BBC 2026</strong>
        <span>Resultados e calendário do torneio</span>
      </footer>
    </main>
  );
}
