import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    setLoading(true);
    setErrorMessage("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      console.error("Erro no login Google:", error);
      setErrorMessage(error.message);
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <h1>Torneio de Bilhar</h1>

        <p>
          Inicia sessão com uma conta Google autorizada.
        </p>

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={loading}
        >
          {loading ? "A redirecionar..." : "Entrar com Google"}
        </button>

        {errorMessage && (
          <p className="error-message">
            {errorMessage}
          </p>
        )}
      </section>
    </main>
  );
}