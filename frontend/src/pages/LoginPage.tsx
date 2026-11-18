import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { useAuth, useDemoAccounts, useLogin } from "../app/auth";
import { useStrings } from "../app/session";
import { LangSwitch } from "../components/LangSwitch";
import { ApiError } from "../services/api";
import { LogoMark } from "./home/icons";

const field =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-rose-600";

/** Doctor sign-in. Accounts come from the facility; the jury gets a list of demo accounts to click. */
export function LoginPage() {
  const s = useStrings();
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const demo = useDemoAccounts();
  const login = useLogin();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";
  if (auth.status === "in") return <Navigate to={from} replace />;

  const failure =
    login.error instanceof ApiError && login.error.status === 401 ? s.auth.invalid : s.auth.failed;

  function submit(event: FormEvent) {
    event.preventDefault();
    login.mutate({ username: username.trim(), password }, { onSuccess: () => navigate(from) });
  }

  return (
    <div className="app relative min-h-screen overflow-hidden bg-slate-50 text-slate-800">
      {/* Static soft light, same family as the Home Page backdrop. Nothing moves here. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_40rem_at_85%_-10%,var(--color-rose-100),transparent),radial-gradient(40rem_30rem_at_0%_100%,#f6e3dc,transparent)]"
      />
      <header className="relative mx-auto flex max-w-5xl items-center justify-between px-6 pt-6">
        <Link to="/" className="text-sm font-semibold text-rose-800 hover:underline">
          {s.auth.backToSite}
        </Link>
        <LangSwitch />
      </header>

      <main className="page-in relative mx-auto grid max-w-5xl gap-8 px-6 py-10 lg:grid-cols-[1.05fr_1fr] lg:items-start">
        <section className="rounded-2xl border border-slate-200 bg-white/90 p-8 shadow-sm">
          <div className="flex items-center gap-3 text-rose-800">
            <span className="block h-11 w-11">
              <LogoMark />
            </span>
            <span className="text-xl font-extrabold tracking-tight">Ona-Bola Signal</span>
          </div>
          <p className="mt-7 text-sm font-semibold tracking-wide text-rose-600 uppercase">
            {s.auth.portal}
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">{s.auth.title}</h1>
          <p className="mt-2 text-slate-600">{s.auth.subtitle}</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              {s.auth.username}
              <input
                id="login-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                className={field}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              {s.auth.password}
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className={field}
              />
            </label>
            {login.isError ? (
              <p role="alert" className="text-sm font-medium text-red-700">
                {failure}
              </p>
            ) : null}
            <button
              id="login-submit"
              type="submit"
              disabled={login.isPending || username.trim() === "" || password === ""}
              className="w-full rounded-lg bg-rose-800 px-4 text-base font-semibold text-white hover:bg-rose-900 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {login.isPending ? s.auth.signingIn : s.auth.signIn}
            </button>
          </form>
          <p className="mt-5 text-sm text-slate-500">{s.auth.accountNote}</p>
        </section>

        {demo.data?.enabled ? (
          <aside className="rounded-2xl border border-slate-200 bg-white/70 p-6">
            <h2 className="text-lg font-semibold text-slate-900">{s.auth.demoTitle}</h2>
            <p className="mt-1 text-sm text-slate-600">{s.auth.demoHint}</p>
            <ul className="mt-4 space-y-2">
              {demo.data.items.map((account) => (
                <li key={account.username}>
                  <button
                    type="button"
                    data-demo-account={account.username}
                    onClick={() => {
                      setUsername(account.username);
                      setPassword(demo.data.password ?? "");
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-left hover:border-rose-400 hover:bg-rose-50"
                  >
                    <span>
                      <span className="block font-semibold text-slate-900">
                        {account.displayName}
                      </span>
                      <span className="block text-sm text-slate-500">
                        {[
                          s.role[account.role],
                          account.specialty ? s.specialty[account.specialty] : null,
                          account.district,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="font-mono text-xs text-slate-500">{account.username}</span>
                  </button>
                </li>
              ))}
            </ul>
            {demo.data.password ? (
              <p className="mt-4 text-sm text-slate-600">
                {s.auth.demoPassword}:{" "}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">
                  {demo.data.password}
                </code>
              </p>
            ) : null}
          </aside>
        ) : null}
      </main>
    </div>
  );
}
