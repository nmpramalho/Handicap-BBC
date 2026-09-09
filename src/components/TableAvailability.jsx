import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  RefreshCw,
  Swords,
  Users,
} from "lucide-react";
import { loadTableAvailability } from "../services/api";

const START_DATE = "2026-08-01";
const END_DATE = "2026-10-18";
const DAY_START_MINUTES = 9 * 60;
const DAY_END_MINUTES = 24 * 60;
const GAME_DURATION_MINUTES = 90;
const TABLES = [1, 2, 3];
const HOUR_MARKS = Array.from({ length: 16 }, (_, index) => 9 + index);

function toDateKey(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateKeyToPortuguese(value) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("pt-PT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function formatTime(date) {
  return new Intl.DateTimeFormat("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function addDays(dateKey, numberOfDays) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + numberOfDays);
  return toDateKey(date);
}

function clampDate(dateKey) {
  if (dateKey < START_DATE) return START_DATE;
  if (dateKey > END_DATE) return END_DATE;
  return dateKey;
}

function getInitialDate() {
  return clampDate(toDateKey(new Date()));
}

function getPhaseLabel(match) {
  const phaseLabels = {
    initial: "Fase Inicial",
    knockout: "Fase Knockout",
    diamond: "Fase Diamante - Jogo de Grupo",
    diamond_knockout: "Fase Final Diamante",
    platinum: "Fase Platina - Jogo de Grupo",
    platinum_knockout: "Fase Final Platina",
  };
  return phaseLabels[match.phase || "initial"] || "Torneio";
}

function getMatchTypeLabel(match) {
  const labels = {
    initial_1: "Jogo inicial 1",
    initial_2: "Jogo inicial 2",
    winners: "Jogo dos vencedores",
    losers: "Jogo dos derrotados",
    knockout: "Jogo Knockout",
    diamond_group_1: "Jogo 1 do grupo",
    diamond_group_2: "Jogo 2 do grupo",
    diamond_group_3: "Jogo 3 do grupo",
    diamond_quarterfinal: "Quartos de final",
    diamond_semifinal: "Meia-final",
    diamond_final: "Final",
    platinum_group_1: "Jogo 1 do grupo",
    platinum_group_2: "Jogo 2 do grupo",
    platinum_group_3: "Jogo 3 do grupo",
    platinum_quarterfinal: "Quartos de final",
    platinum_semifinal: "Meia-final",
    platinum_final: "Final",
  };
  return labels[match.match_type] || "Jogo do torneio";
}

function hasConflict(match, allMatches) {
  const start = new Date(match.scheduled_at).getTime();
  const end = start + GAME_DURATION_MINUTES * 60 * 1000;

  return allMatches.some((candidate) => {
    if (candidate.id === match.id || Number(candidate.table_number) !== Number(match.table_number)) {
      return false;
    }
    const candidateStart = new Date(candidate.scheduled_at).getTime();
    const candidateEnd = candidateStart + GAME_DURATION_MINUTES * 60 * 1000;
    return start < candidateEnd && end > candidateStart;
  });
}

function MatchBar({ match, dayMatches }) {
  const start = new Date(match.scheduled_at);
  const end = new Date(start.getTime() + GAME_DURATION_MINUTES * 60 * 1000);
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const visibleStart = Math.max(startMinutes, DAY_START_MINUTES);
  const visibleEnd = Math.min(startMinutes + GAME_DURATION_MINUTES, DAY_END_MINUTES);
  const totalMinutes = DAY_END_MINUTES - DAY_START_MINUTES;
  const left = ((visibleStart - DAY_START_MINUTES) / totalMinutes) * 100;
  const width = Math.max(((visibleEnd - visibleStart) / totalMinutes) * 100, 1);
  const conflict = hasConflict(match, dayMatches);
  const playerA = match.player_a?.name || "Por decidir";
  const playerB = match.player_b?.name || "Por decidir";

  return (
    <div
      className={`availability-match ${conflict ? "conflict" : ""}`}
      style={{ left: `${left}%`, width: `${width}%` }}
      aria-label={`${playerA} contra ${playerB}`}
      tabIndex="0"
    >
      <span>{playerA} vs {playerB}</span>

      <div className="availability-popover" role="tooltip">
        <div className="availability-popover-header">
          <span>{getPhaseLabel(match)}</span>
          {conflict && <b>Conflito</b>}
        </div>
        <h4>{getMatchTypeLabel(match)}</h4>
        <div className="availability-popover-row">
          <Users size={15} />
          <strong>{playerA}</strong>
          <span>vs</span>
          <strong>{playerB}</strong>
        </div>
        <div className="availability-popover-grid">
          <span><CalendarDays size={15} /> {dateKeyToPortuguese(toDateKey(start))}</span>
          <span><Clock3 size={15} /> {formatTime(start)} - {formatTime(end)}</span>
          <span><MapPin size={15} /> Mesa {match.table_number}</span>
          <span><Swords size={15} /> {match.match_code || getMatchTypeLabel(match)}</span>
        </div>
      </div>
    </div>
  );
}

export default function TableAvailability() {
  const [selectedDate, setSelectedDate] = useState(getInitialDate);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [onlyDaysWithMatches, setOnlyDaysWithMatches] = useState(false);
  const datePickerRef = useRef(null);

  async function refresh() {
    try {
      setLoading(true);
      setError("");
      setMatches(await loadTableAvailability(START_DATE, END_DATE));
    } catch (loadError) {
      console.error(loadError);
      setError("Não foi possível carregar a disponibilidade das mesas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const datesWithMatches = useMemo(
    () => [...new Set(matches.map((match) => toDateKey(match.scheduled_at)))].sort(),
    [matches]
  );

  const dayMatches = useMemo(
    () => matches.filter((match) => toDateKey(match.scheduled_at) === selectedDate),
    [matches, selectedDate]
  );

  function moveDate(direction, normalDays = 1) {
    if (!onlyDaysWithMatches) {
      setSelectedDate(clampDate(addDays(selectedDate, direction * normalDays)));
      return;
    }

    const candidates = datesWithMatches.filter((date) =>
      direction > 0 ? date > selectedDate : date < selectedDate
    );
    const target = direction > 0 ? candidates[0] : candidates[candidates.length - 1];
    if (target) setSelectedDate(target);
  }

  function goToToday() {
    const today = getInitialDate();
    if (!onlyDaysWithMatches || datesWithMatches.includes(today)) {
      setSelectedDate(today);
      return;
    }
    const next = datesWithMatches.find((date) => date >= today);
    setSelectedDate(next || datesWithMatches[datesWithMatches.length - 1] || today);
  }

  function openDatePicker() {
    if (typeof datePickerRef.current?.showPicker === "function") {
      datePickerRef.current.showPicker();
    } else {
      datePickerRef.current?.click();
    }
  }

  const outsideSchedule = dayMatches.filter((match) => {
    const date = new Date(match.scheduled_at);
    const minutes = date.getHours() * 60 + date.getMinutes();
    return minutes < DAY_START_MINUTES || minutes + GAME_DURATION_MINUTES > DAY_END_MINUTES;
  });

  return (
    <section className="availability-page">
      <div className="availability-header">
        <div>
          <span className="availability-kicker">Planeamento</span>
          <h2>Disponibilidade de Mesas</h2>
          <p>Cada jogo ocupa 1h30. Período disponível: 01/08/2026 a 18/10/2026, das 09:00 às 00:00.</p>
        </div>
        <button type="button" className="secondary" onClick={refresh} disabled={loading}>
          <RefreshCw size={16} className={loading ? "availability-spin" : ""} />
          Atualizar
        </button>
      </div>

      <div className="availability-controls card">
        <button type="button" className="secondary" onClick={() => moveDate(-1, 7)}>
          <ChevronLeft size={16} /> 7 dias
        </button>
        <button type="button" className="secondary" onClick={() => moveDate(-1)}>
          <ChevronLeft size={16} /> Dia
        </button>

        <div className="availability-date-control">
          <button type="button" className="availability-date-button" onClick={openDatePicker}>
            <CalendarDays size={17} />
            {dateKeyToPortuguese(selectedDate)}
          </button>
          <input
            ref={datePickerRef}
            className="availability-hidden-date"
            type="date"
            min={START_DATE}
            max={END_DATE}
            value={selectedDate}
            onChange={(event) => setSelectedDate(clampDate(event.target.value))}
            aria-label="Selecionar data"
          />
        </div>

        <button type="button" className="secondary" onClick={() => moveDate(1)}>
          Dia <ChevronRight size={16} />
        </button>
        <button type="button" className="secondary" onClick={() => moveDate(1, 7)}>
          7 dias <ChevronRight size={16} />
        </button>

        <button type="button" className="secondary availability-today" onClick={goToToday}>
          Hoje
        </button>

        <label className="availability-filter">
          <input
            type="checkbox"
            checked={onlyDaysWithMatches}
            onChange={(event) => setOnlyDaysWithMatches(event.target.checked)}
          />
          Apenas dias com jogos
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="availability-day card">
        <div className="availability-day-title">
          <h3>{formatDate(selectedDate)}</h3>
          <span>{dayMatches.length} {dayMatches.length === 1 ? "jogo marcado" : "jogos marcados"}</span>
        </div>

        <div className="availability-scroll">
          <div className="availability-grid">
            <div className="availability-corner">Mesa</div>
            <div className="availability-hours">
              {HOUR_MARKS.map((hour) => (
                <span key={hour} style={{ left: `${((hour - 9) / 15) * 100}%` }}>
                  {String(hour % 24).padStart(2, "0")}:00
                </span>
              ))}
            </div>

            {TABLES.map((tableNumber) => {
              const tableMatches = dayMatches.filter((match) => Number(match.table_number) === tableNumber);
              return (
                <div className="availability-row" key={tableNumber}>
                  <div className="availability-table-label">Mesa {tableNumber}</div>
                  <div className="availability-timeline">
                    {HOUR_MARKS.map((hour) => (
                      <i key={hour} style={{ left: `${((hour - 9) / 15) * 100}%` }} />
                    ))}
                    {tableMatches.map((match) => (
                      <MatchBar key={match.id} match={match} dayMatches={tableMatches} />
                    ))}
                    {tableMatches.length === 0 && <span className="availability-free">Livre</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="availability-legend">
          <span><i className="occupied" /> Ocupado</span>
          <span><i className="conflict" /> Conflito</span>
          <span><i className="free" /> Livre</span>
        </div>
      </div>

      {outsideSchedule.length > 0 && (
        <div className="availability-warning">
          Existem {outsideSchedule.length} marcações que começam antes das 09:00 ou terminam depois das 00:00.
        </div>
      )}
    </section>
  );
}
