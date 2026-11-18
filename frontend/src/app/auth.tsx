import {
  DemoAccountsResponse,
  OkResponse,
  SessionResponse,
  can,
  type CurrentUser,
  type Permission,
} from "@ona-bola/shared";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { requestJson, sendJson } from "../services/api";

// Doctor sign-in (TEAM_PLAN item 12). POST /api/auth/login sets an httpOnly cookie, GET /api/auth/me
// tells the page who is signed in, POST /api/auth/logout ends the session.

export type AuthStatus = "loading" | "in" | "out";

interface Auth {
  status: AuthStatus;
  user: CurrentUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<Auth | null>(null);

/** Each user sees a different set of patients: drop everything the previous one loaded. */
function dropLoadedData(client: QueryClient) {
  client.removeQueries({
    predicate: (query) => query.queryKey[0] !== "me" && query.queryKey[0] !== "demo-accounts",
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();

  // retry: false, because a 401 here is the normal answer for "nobody is signed in".
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => requestJson("/api/auth/me", SessionResponse),
    retry: false,
    staleTime: 60_000,
  });

  const value = useMemo<Auth>(() => {
    const status: AuthStatus = me.isSuccess ? "in" : me.isPending ? "loading" : "out";
    return {
      status,
      user: me.isSuccess ? me.data.user : null,
      async login(username, password) {
        const session = await sendJson(
          "/api/auth/login",
          SessionResponse,
          { username, password },
          "POST",
        );
        dropLoadedData(client);
        client.setQueryData(["me"], session);
      },
      async logout() {
        await sendJson("/api/auth/logout", OkResponse, undefined, "POST").catch(() => undefined);
        dropLoadedData(client);
        // The next /api/auth/me answers 401, which sends the page to the sign-in screen.
        await client.invalidateQueries({ queryKey: ["me"] });
      },
    };
  }, [me.isSuccess, me.isPending, me.data, client]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used inside AuthProvider");
  return auth;
}

/** The signed-in user, or null. */
export const useCurrentUser = (): CurrentUser | null => useAuth().user;

/** Whether the signed-in user's role holds a permission (the server enforces it too). */
export function useCan(permission: Permission): boolean {
  const role = useCurrentUser()?.role;
  return role !== undefined && can(role, permission);
}

/** Demo accounts listed on the sign-in page for the jury. Empty when the server disables them. */
export const useDemoAccounts = () =>
  useQuery({
    queryKey: ["demo-accounts"],
    queryFn: () => requestJson("/api/auth/demo-accounts", DemoAccountsResponse),
    staleTime: Infinity,
    retry: false,
  });

/** Sign in from the form. */
export function useLogin() {
  const { login } = useAuth();
  return useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      login(username, password),
  });
}
