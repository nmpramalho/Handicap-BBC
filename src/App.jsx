import { useCallback, useEffect, useState } from "react";

import AccessManagement from "./components/AccessManagement";
import LandingPage from "./components/LandingPage";
import TournamentSite from "./components/TournamentSite";
import { supabase } from "./lib/supabase";

export default function App() {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(undefined);
  const [profileError, setProfileError] = useState("");

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      setProfileError("");
      return;
    }

    setProfile(undefined);
    setProfileError("");

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, email, full_name, avatar_url, role, active, created_at, updated_at"
      )
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Erro ao carregar o perfil:", error);
      setProfile(null);
      setProfileError(
        "Não foi possível consultar o estado da conta. Tenta novamente."
      );
      return;
    }

    setProfile(data ?? null);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initializeAuthentication() {
      const { data, error } = await supabase.auth.getSession();

      if (!mounted) {
        return;
      }

      if (error) {
        console.error("Erro ao recuperar a sessão:", error);
        setSession(null);
        return;
      }

      setSession(data.session ?? null);
    }

    initializeAuthentication();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) {
        setSession(nextSession ?? null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    loadProfile(session?.user?.id);
  }, [session?.user?.id, loadProfile]);

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Erro ao terminar a sessão:", error);
      setProfileError("Não foi possível terminar a sessão.");
      return;
    }

    setSession(null);
    setProfile(null);
    setProfileError("");
  }

  if (session === undefined) {
    return (
      <main className="status-page">
        <section className="status-card">
          <div className="status-logo">BBC</div>
          <h1>Handicap BBC 2026</h1>
          <p>A verificar a sessão...</p>

          <div className="loading-indicator" aria-label="A carregar">
            <span />
            <span />
            <span />
          </div>
        </section>
      </main>
    );
  }

  if (!session) {
    return <LandingPage />;
  }

  if (profile === undefined) {
    return (
      <main className="status-page">
        <section className="status-card">
          <div className="status-logo">BBC</div>
          <h1>Handicap BBC 2026</h1>
          <p>A verificar a autorização...</p>

          <div className="loading-indicator" aria-label="A carregar">
            <span />
            <span />
            <span />
          </div>
        </section>
      </main>
    );
  }

  if (profileError) {
    return (
      <main className="status-page">
        <section className="status-card">
          <div className="status-icon status-icon-error">!</div>
          <h1>Erro ao verificar a conta</h1>
          <p>{profileError}</p>

          <div className="status-actions">
            <button
              type="button"
              onClick={() => loadProfile(session.user.id)}
            >
              Tentar novamente
            </button>

            <button
              type="button"
              className="secondary"
              onClick={handleLogout}
            >
              Terminar sessão
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="status-page">
        <section className="status-card">
          <div className="status-icon status-icon-error">!</div>
          <h1>Acesso não autorizado</h1>

          <p>
            Esta conta Google não está registada para aceder ao Handicap BBC
            2026.
          </p>

          <div className="account-details">
            <span>Conta Google</span>
            <strong>{session.user.email}</strong>
          </div>

          <button
            type="button"
            className="status-button secondary"
            onClick={handleLogout}
          >
            Terminar sessão
          </button>
        </section>
      </main>
    );
  }

  if (!profile.active) {
    const displayName = profile.full_name || profile.email || "Utilizador";
    const initial = displayName.trim().charAt(0).toUpperCase();

    return (
      <main className="status-page">
        <section className="status-card">
          {profile.avatar_url ? (
            <img
              className="profile-avatar"
              src={profile.avatar_url}
              alt="Fotografia da conta Google"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="profile-avatar-fallback" aria-hidden="true">
              {initial}
            </div>
          )}

          <span className="status-badge">Pendente</span>
          <h1>Conta pendente de aprovação</h1>

          <p>
            Olá, <strong>{displayName}</strong>.
          </p>

          <p>
            O pedido de acesso foi registado. A conta ficará disponível depois
            de ser aprovada por um administrador.
          </p>

          <div className="account-details">
            <span>Conta Google</span>
            <strong>{profile.email}</strong>
          </div>

          <div className="status-actions">
            <button
              type="button"
              onClick={() => loadProfile(session.user.id)}
            >
              Verificar aprovação
            </button>

            <button
              type="button"
              className="secondary"
              onClick={handleLogout}
            >
              Terminar sessão
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <>
      <TournamentSite profile={profile} onLogout={handleLogout} />

      {profile.role === "admin" && (
        <AccessManagement currentProfile={profile} />
      )}
    </>
  );
}
