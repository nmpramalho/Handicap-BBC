import { useState } from "react";
import { LogIn, Trophy } from "lucide-react";

import { supabase } from "../lib/supabase";
import ScheduledMatches from "./ScheduledMatches";
import "./LandingPage.css";

export default function LandingPage() {
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState("");

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

  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-brand">
          <div className="home-logo" aria-hidden="true">
            <Trophy size={31} />
          </div>

          <div>
            <span className="home-eyebrow">Torneio de bilhar</span>
            <h1>2º Handicap BBC 2026</h1>
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

      {error && <p className="home-error home-login-error">{error}</p>}
      <ScheduledMatches />

      <footer className="home-footer">
        <strong>2º Handicap BBC 2026</strong>
        <span>Resultados e calendário do torneio</span>
      </footer>
    </main>
  );
}
