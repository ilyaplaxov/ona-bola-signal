import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router";
import { LangSwitch } from "../components/LangSwitch";
import { LogoMark } from "../pages/home/icons";
import { useDashboard, useHealth, useInboxCounts } from "../services/queries";
import { useAuth } from "./auth";
import { useStrings } from "./session";

/** Doctor part of the site. Nobody signed in goes to the sign-in page and comes back afterwards. */
export function Layout() {
  const auth = useAuth();
  const s = useStrings();
  const location = useLocation();

  if (auth.status === "loading") {
    return <p className="app p-8 text-slate-500">{s.common.loading}</p>;
  }
  if (auth.status === "out") {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Shell />;
}

/** Banner, navigation, profile, language switch and connection dot around the page. */
function Shell() {
  const s = useStrings();
  const { user, logout } = useAuth();
  const location = useLocation();
  const health = useHealth();
  const dashboard = useDashboard();
  const counts = useInboxCounts();
  const pending = (dashboard.data?.pendingAlerts.total ?? 0) + counts.newSignals;
  const incoming = counts.incomingReferrals;

  const links: [string, string][] = [
    ["/dashboard", s.nav.dashboard],
    ["/patients", s.nav.patients],
    ["/alerts", s.nav.alerts],
    ["/referrals", s.nav.referrals],
    ["/rules", s.nav.rules],
  ];
  const online = health.data?.db === "up";
  const aiOn = health.data?.aiEnabled === true;
  const dot = health.isPending ? "bg-slate-300" : online ? "bg-emerald-500" : "bg-red-500";
  const initial = (user?.displayName.replace(/^dr\.?\s+/i, "").charAt(0) || "?").toUpperCase();

  return (
    <div className="app min-h-screen bg-slate-50 text-slate-800">
      <div className="bg-rose-100 px-4 py-1.5 text-center text-xs font-medium text-rose-900">
        {s.banner}
      </div>
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-2.5">
          <Link to="/dashboard" className="flex items-center gap-2.5 text-rose-800">
            <span className="block h-9 w-9">
              <LogoMark />
            </span>
            <span className="text-lg font-extrabold tracking-tight">Ona-Bola Signal</span>
          </Link>
          <nav className="flex flex-wrap gap-1 text-sm">
            {links.map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/dashboard"}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-lg px-3.5 py-2 transition-colors ${
                    isActive
                      ? "bg-rose-100 font-semibold text-rose-900"
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
                {to === "/referrals" && incoming > 0 ? (
                  <span className="rounded-full bg-amber-600 px-1.5 text-xs font-bold text-white">
                    {incoming}
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
            <span
              id="ai-status"
              data-ai-state={aiOn ? "on" : "off"}
              title={s.ai.statusTitle}
              className={`flex items-center gap-1.5 rounded-full border border-violet-300 py-0.5 pr-2.5 pl-0.5 text-xs font-semibold ${
                aiOn ? "bg-violet-50 text-violet-900" : "bg-white text-violet-700"
              }`}
            >
              <span
                className={`rounded-full px-2 py-0.5 font-bold text-white ${aiOn ? "bg-violet-700" : "bg-violet-400"}`}
              >
                AI
              </span>
              {aiOn ? s.ai.statusOn : s.ai.statusOff}
            </span>
            <LangSwitch />
            <Link
              to="/profile"
              id="profile-link"
              className="flex items-center gap-2.5 rounded-lg py-1 pr-2 pl-1 hover:bg-slate-100"
              title={s.auth.profile}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-800 font-bold text-white">
                {initial}
              </span>
              <span className="leading-tight">
                <span className="block font-semibold text-slate-900">{user?.displayName}</span>
                <span className="block text-xs text-slate-500">
                  {user ? [s.role[user.role], user.facility].filter(Boolean).join(" · ") : null}
                </span>
              </span>
            </Link>
            <button
              type="button"
              id="sign-out"
              onClick={() => void logout()}
              className="rounded-lg border border-slate-300 bg-white px-3.5 font-medium text-slate-700 hover:bg-slate-100"
            >
              {s.auth.signOut}
            </button>
          </div>
        </div>
      </header>
      {/* keyed by path: one short fade each time a page opens, no other motion */}
      <main key={location.pathname} className="page-in mx-auto max-w-7xl px-5 py-7">
        <Outlet />
      </main>
    </div>
  );
}
