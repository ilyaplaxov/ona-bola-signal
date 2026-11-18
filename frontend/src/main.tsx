import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Link } from "react-router";
import { RouterProvider } from "react-router/dom";
import { Layout } from "./app/Layout";
import { SessionProvider, useStrings } from "./app/session";
import { AlertsPage } from "./pages/AlertsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { PatientDetailsPage } from "./pages/PatientDetailsPage";
import { PatientsPage } from "./pages/PatientsPage";
import { RulesPage } from "./pages/RulesPage";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function NotFound() {
  const s = useStrings();
  return (
    <p className="text-slate-600">
      {s.notFound}.{" "}
      <Link to="/" className="text-rose-800 hover:underline">
        {s.nav.dashboard}
      </Link>
    </p>
  );
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "patients", element: <PatientsPage /> },
      { path: "patients/:id", element: <PatientDetailsPage /> },
      { path: "alerts", element: <AlertsPage /> },
      { path: "rules", element: <RulesPage /> },
      { path: "*", element: <NotFound /> },
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
