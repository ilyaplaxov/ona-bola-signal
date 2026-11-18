import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Link, Outlet } from "react-router";
import { RouterProvider } from "react-router/dom";
import { AuthProvider } from "./app/auth";
import { Layout } from "./app/Layout";
import { SessionProvider, useStrings } from "./app/session";
import { AlertsPage } from "./pages/AlertsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { HomePage } from "./pages/home/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { PatientDetailsPage } from "./pages/PatientDetailsPage";
import { PatientsPage } from "./pages/PatientsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ReferralsPage } from "./pages/ReferralsPage";
import { RulesPage } from "./pages/RulesPage";
import { SignalPage } from "./pages/SignalPage";
import { ApiError } from "./services/api";
import "./index.css";

const queryClient: QueryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
  queryCache: new QueryCache({
    // A 401 from any list or card means the session ended (cookie expired, signed out elsewhere):
    // ask "who am I" again, which sends the page to the sign-in screen. /api/auth/me itself is
    // excluded, its 401 is the normal "nobody is signed in".
    onError: (error, query) => {
      if (error instanceof ApiError && error.status === 401 && query.queryKey[0] !== "me") {
        void queryClient.invalidateQueries({ queryKey: ["me"] });
      }
    },
  }),
});

function NotFound() {
  const s = useStrings();
  return (
    <p className="text-slate-600">
      {s.notFound}.{" "}
      <Link to="/dashboard" className="text-rose-800 hover:underline">
        {s.nav.dashboard}
      </Link>
    </p>
  );
}

/** Who is signed in is asked only on the doctor routes, so the public Home Page makes no API calls. */
function AuthRoot() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

const router = createBrowserRouter([
  // Public landing page: outside Layout and AuthRoot, so no prototype banner and no API calls.
  { path: "/", element: <HomePage /> },
  // The patient's page: no sign-in, no doctor shell, phone first.
  { path: "/signal", element: <SignalPage /> },
  {
    element: <AuthRoot />,
    children: [
      { path: "/login", element: <LoginPage /> },
      {
        element: <Layout />,
        children: [
          { path: "dashboard", element: <DashboardPage /> },
          { path: "profile", element: <ProfilePage /> },
          { path: "patients", element: <PatientsPage /> },
          { path: "patients/:id", element: <PatientDetailsPage /> },
          { path: "alerts", element: <AlertsPage /> },
          { path: "referrals", element: <ReferralsPage /> },
          { path: "rules", element: <RulesPage /> },
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
  },
]);

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element in index.html");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <RouterProvider router={router} />
      </SessionProvider>
    </QueryClientProvider>
  </StrictMode>,
);
