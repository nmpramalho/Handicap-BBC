import { useEffect, useMemo, useState } from "react";
import { Check, KeyRound, RefreshCw, Search, ShieldCheck, UserCheck, UserX, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import "./AccessManagement.css";

const ROLES = [
  { value: "viewer", label: "Consulta" },
  { value: "referee", label: "Árbitro" },
  { value: "admin", label: "Administrador" },
];

export default function AccessManagement({ currentProfile }) {
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("pending");
  const [search, setSearch] = useState("");

  async function loadProfiles() {
    setLoading(true);
    setError("");
    setMessage("");

    const { data, error: loadError } = await supabase
      .from("profiles")
      .select("id, email, full_name, avatar_url, role, active, created_at, updated_at")
      .order("active", { ascending: true })
      .order("created_at", { ascending: false });

    if (loadError) {
      console.error("Erro ao carregar acessos:", loadError);
      setError(loadError.message);
    } else {
      setProfiles(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (open) loadProfiles();
  }, [open]);

  const pendingCount = profiles.filter((profile) => !profile.active).length;

  const visibleProfiles = useMemo(() => {
    const term = search.trim().toLowerCase();

    return profiles.filter((profile) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "pending" && !profile.active) ||
        (filter === "active" && profile.active);

      const matchesSearch =
        !term ||
        (profile.full_name || "").toLowerCase().includes(term) ||
        (profile.email || "").toLowerCase().includes(term);

      return matchesFilter && matchesSearch;
    });
  }, [profiles, filter, search]);

  async function updateAccess(profile, changes) {
    if (profile.id === currentProfile.id && changes.active === false) {
      setError("Não podes desativar a tua própria conta.");
      return;
    }

    if (profile.id === currentProfile.id && changes.role && changes.role !== "admin") {
      setError("Não podes retirar a função de administrador à tua própria conta.");
      return;
    }

    setSavingId(profile.id);
    setError("");
    setMessage("");

    const payload = {
      ...changes,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", profile.id);

    if (updateError) {
      console.error("Erro ao atualizar acesso:", updateError);
      setError(updateError.message);
    } else {
      setProfiles((current) =>
        current.map((item) =>
          item.id === profile.id ? { ...item, ...payload } : item
        )
      );
      setMessage(`Acesso de ${profile.full_name || profile.email} atualizado.`);
    }

    setSavingId(null);
  }

  return (
    <>
      <button className="access-floating-button" type="button" onClick={() => setOpen(true)}>
        <KeyRound size={18} />
        <span>Gerir acessos</span>
        {pendingCount > 0 && <strong>{pendingCount}</strong>}
      </button>

      {open && (
        <div className="access-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}>
          <section className="access-dialog" role="dialog" aria-modal="true" aria-labelledby="access-title">
            <header className="access-header">
              <div>
                <p>Administração</p>
                <h2 id="access-title">Gestão de acessos</h2>
                <span>Aprova contas e define o nível de acesso.</span>
              </div>
              <button className="access-icon-button" type="button" onClick={() => setOpen(false)} aria-label="Fechar">
                <X size={20} />
              </button>
            </header>

            <div className="access-toolbar">
              <div className="access-search">
                <Search size={17} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar nome ou email" />
              </div>

              <button className="access-refresh" type="button" onClick={loadProfiles} disabled={loading}>
                <RefreshCw size={16} className={loading ? "access-spin" : ""} />
                Atualizar
              </button>
            </div>

            <div className="access-filters" role="tablist" aria-label="Filtrar contas">
              <button type="button" className={filter === "pending" ? "active" : ""} onClick={() => setFilter("pending")}>
                Pendentes <span>{pendingCount}</span>
              </button>
              <button type="button" className={filter === "active" ? "active" : ""} onClick={() => setFilter("active")}>
                Ativas <span>{profiles.length - pendingCount}</span>
              </button>
              <button type="button" className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>
                Todas <span>{profiles.length}</span>
              </button>
            </div>

            {error && <div className="access-alert error">{error}</div>}
            {message && <div className="access-alert success"><Check size={17} />{message}</div>}

            <div className="access-list">
              {loading ? (
                <div className="access-empty">A carregar utilizadores...</div>
              ) : visibleProfiles.length === 0 ? (
                <div className="access-empty">Não existem contas neste filtro.</div>
              ) : (
                visibleProfiles.map((profile) => {
                  const isSelf = profile.id === currentProfile.id;
                  const saving = savingId === profile.id;

                  return (
                    <article className="access-user" key={profile.id}>
                      <div className="access-user-identity">
                        {profile.avatar_url ? (
                          <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="access-avatar-fallback">
                            {(profile.full_name || profile.email || "?").charAt(0).toUpperCase()}
                          </div>
                        )}

                        <div>
                          <h3>{profile.full_name || "Sem nome"}{isSelf && <small>Tu</small>}</h3>
                          <p>{profile.email}</p>
                          <span className={profile.active ? "active" : "pending"}>
                            {profile.active ? "Conta ativa" : "Pendente de aprovação"}
                          </span>
                        </div>
                      </div>

                      <div className="access-user-controls">
                        <label>
                          Perfil
                          <select
                            value={profile.role}
                            disabled={saving || isSelf}
                            onChange={(event) => updateAccess(profile, { role: event.target.value })}
                          >
                            {ROLES.map((role) => (
                              <option key={role.value} value={role.value}>{role.label}</option>
                            ))}
                          </select>
                        </label>

                        {profile.active ? (
                          <button
                            className="access-deny"
                            type="button"
                            disabled={saving || isSelf}
                            onClick={() => updateAccess(profile, { active: false })}
                          >
                            <UserX size={17} />
                            Desativar
                          </button>
                        ) : (
                          <button
                            className="access-approve"
                            type="button"
                            disabled={saving}
                            onClick={() => updateAccess(profile, { active: true })}
                          >
                            <UserCheck size={17} />
                            Aprovar
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            <footer className="access-footer">
              <ShieldCheck size={17} />
              <span>Consulta: só leitura. Árbitro: gere jogos. Administrador: gestão total.</span>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
