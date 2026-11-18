import { useEffect } from "react";
import { Link, NavLink, Outlet } from "react-router";
import { useDashboard, useHealth, useUsers } from "../services/queries";
import { useSession, useStrings } from "./session";

/** Shell: prototype banner, navigation, role switcher, language switch, connection dot. */
export function Layout() {
  const s = useStrings();
  const { lang, setLang, actorId, setActorId } = useSession();
  const users = useUsers();
  const health = useHealth();
  const dashboard = useDashboard();
  const pending = dashboard.data?.pendingAlerts.total ?? 0;

  // A remembered demo user that no longer exists (for example after a schema change) is dropped,
  // otherwise every request would be refused.
  useEffect(() => {
    if (users.data && actorId && !users.data.items.some((u) => u.id === actorId)) setActorId(null);
  }, [users.data, actorId, setActorId]);

  const links: [string, string][] = [
    ["/", s.nav.dashboard],
    ["/patients", s.nav.patients],
    ["/alerts", s.nav.alerts],
    ["/rules", s.nav.rules],
  ];
  const online = health.data?.db === "up";
  const dot = health.isPending ? "bg-slate-300" : online ? "bg-emerald-500" : "bg-red-500";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-900">
        {s.banner}
      </div>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <Link to="/" className="text-lg font-bold tracking-tight text-rose-800">
            Ona-Bola Signal
          </Link>
          <nav className="flex flex-wrap gap-1 text-sm">
            {links.map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-md px-3 py-1.5 ${
                    isActive
                      ? "bg-rose-50 font-semibold text-rose-800"
                      : "text-slate-600 hover:bg-slate-100"
                  }`
                }
              >
                {label}
                {to === "/alerts" && pending > 0 ? (
                  <span className="rounded-full bg-red-600 px-1.5 text-xs font-bold text-white">
                    {pending}
                  </span>
                ) : null}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex flex-wrap items-center gap-3 text-sm">
            <span
              className={`h-2.5 w-2.5 rounded-full ${dot}`}
              title={online ? "API · DB" : s.common.loadError}
            />
            <label className="flex items-center gap-2">
              <span className="text-slate-500">{s.role.label}</span>
              <select
                id="role-switcher"
                value={actorId ?? ""}
                onChange={(e) => setActorId(e.target.value || null)}
                className="max-w-64 rounded-md border border-slate-300 bg-white px-2 py-1"
              >
                <option value="">{s.role.choose}</option>
                {users.data?.items.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName} · {s.role[u.role]}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex overflow-hidden rounded-md border border-slate-300">
              {(["uz", "ru", "en"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={`px-2 py-1 text-xs font-semibold ${
                    lang === l
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
