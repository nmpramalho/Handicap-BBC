import { useState } from "react";
import { LogIn, Trophy } from "lucide-react";
import { supabase } from "../lib/supabase";
import "./Login.css";

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function signInWithGoogle() {
    if (loading) {
      return;
    }

    setLoading(true);
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
      setLoading(false);
    }
  }

  return (
    <main className="landing-page">
      <section className="landing-card">
        <div className="landing-logo" aria-hidden="true">
          <Trophy size={34} />
        </div>

        <p className="landing-eyebrow">Competição 2026</p>
        <h1>Handicap BBC</h1>

        <p className="landing-description">
          Consulta os grupos, acompanha os jogos e vê os resultados do torneio.
        </p>

        <button
          type="button"
          className="google-login-button"
          onClick={signInWithGoogle}
          disabled={loading}
        >
          <LogIn size={20} />
          {loading ? "A abrir o Google..." : "Entrar com Conta Google"}
        </button>

        {error && (
          <p className="landing-error" role="alert">
            {error}
          </p>
        )}

        <p className="landing-note">
          O acesso ao site está sujeito a aprovação de um administrador.
        </p>
      </section>
    </main>
  );
}
