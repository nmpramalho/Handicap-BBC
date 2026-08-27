import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import Login from "./components/Login";
import TournamentSite from "./components/TournamentSite";
import AccessManagement from "./components/AccessManagement";

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");

  async function loadProfile(userId) {
    if (!userId) {
      setProfile(null);
      setProfileError("");
      setLoadingProfile(false);
      return;
    }

    setLoadingProfile(true);
    setProfileError("");

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, avatar_url, role, active, created_at, updated_at")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Erro ao carregar o perfil:", error);
      setProfile(null);
      setProfileError("Não foi possível consultar o estado da conta.");
    } else {
      setProfile(data);
    }

    setLoadingProfile(false);
  }

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession();

      if (error) console.error("Erro ao carregar a sessão:", error);

      if (mounted) {
        setSession(data.session);
        setLoadingSession(false);
      }
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (mounted) {
        setSession(newSession);
        setLoadingSession(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    loadProfile(session?.user?.id);
  }, [session?.user?.id]);

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Erro ao terminar a sessão:", error);
      return;
    }
    setSession(null);
    setProfile(null);
    setProfileError("");
  }

  if (loadingSession || loadingProfile) {
    return (
      <main className="status-page">
        <section className="status-card">
          <div className="status-logo">BBC</div>
          <h1>Handicap BBC</h1>
          <p>A verificar a conta...</p>
          <div className="loading-indicator" aria-label="A carregar">
            <span /><span /><span />
          </div>
        </section>
      </main>
    );
  }

  if (!session) return <Login />;

  if (profileError) {
    return (
      <main className="status-page">
        <section className="status-card">
          <div className="status-icon status-icon-error">!</div>
          <h1>Erro ao verificar a conta</h1>
          <p>{profileError}</p>
          <div className="status-actions">
            <button type="button" onClick={() => loadProfile(session.user.id)}>Tentar novamente</button>
            <button type="button" className="secondary" onClick={handleLogout}>Terminar sessão</button>
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
          <h1>Pedido de acesso não encontrado</h1>
          <p>A autenticação Google foi concluída, mas ainda não existe um perfil associado.</p>
          <div className="account-details"><span>Conta Google</span><strong>{session.user.email}</strong></div>
          <div className="status-actions">
            <button type="button" onClick={() => loadProfile(session.user.id)}>Verificar novamente</button>
            <button type="button" className="secondary" onClick={handleLogout}>Terminar sessão</button>
          </div>
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
            <img className="profile-avatar" src={profile.avatar_url} alt="Fotografia da conta Google" referrerPolicy="no-referrer" />
          ) : (
            <div className="profile-avatar-fallback" aria-hidden="true">{initial}</div>
          )}
          <span className="status-badge">Pendente</span>
          <h1>Conta pendente de aprovação</h1>
          <p>Olá, <strong>{displayName}</strong>.</p>
          <p>O pedido foi registado. A conta ficará disponível depois de ser aprovada por um administrador.</p>
          <div className="account-details"><span>Conta Google</span><strong>{profile.email}</strong></div>
          <div className="status-actions">
            <button type="button" onClick={() => loadProfile(session.user.id)}>Verificar aprovação</button>
            <button type="button" className="secondary" onClick={handleLogout}>Terminar sessão</button>
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
