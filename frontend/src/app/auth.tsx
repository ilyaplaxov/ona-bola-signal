import {
  DemoAccountsResponse,
  OkResponse,
  SessionResponse,
  UserListResponse,
  can,
  type CurrentUser,
  type Permission,
} from "@ona-bola/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { ApiError, isMissingRoute, requestJson, sendJson, setApiActor } from "../services/api";
import { useSession } from "./session";

// Doctor sign-in (TEAM_PLAN item 12). The real flow is the server's: POST /api/auth/login sets an
// httpOnly cookie and GET /api/auth/me tells the page who is signed in.
//
// TEMP(auth): participant 1 has not shipped /api/auth/* yet (the running API answers 404 "No route").
// Until it does, sign-in falls back to the old demo-actor header: the username is the display name
// in lower case ("aziza.karimova") and the password is TEMP_PASSWORD. Once /api/auth/me answers,
// this fallback is never used; delete `tempUsername`, `TEMP_PASSWORD` and the `temp` branches then.

export const TEMP_PASSWORD = "demo1234";

/** TEMP(auth): "Dr. Aziza Karimova" -> "aziza.karimova". */
export const tempUsername = (displayName: string): string =>
  displayName
    .replace(/^dr\.?\s+/i, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".");

export type AuthStatus = "loading" | "in" | "out";

interface Auth {
  status: AuthStatus;
  user: CurrentUser | null;
  /** "session": the server's cookie. "temp": the TEMP(auth) fallback above. */
  mode: "session" | "temp";
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const { actorId, setActorId } = useSession();

  // retry: false, because a 401 here is the normal answer for "nobody is signed in".
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => requestJson("/api/auth/me", SessionResponse),
    retry: false,
    staleTime: 60_000,
  });
  // Sticky: a refetch of an errored query goes back to "pending" and drops its error, which would
  // flip the whole app to "loading" and reset the open page each time any data is invalidated.
  const [temp, setTemp] = useState(false);
  if (!temp && isMissingRoute(me.error)) setTemp(true);
  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => requestJson("/api/users", UserListResponse),
    enabled: temp,
    staleTime: Infinity,
  });

  const value = useMemo<Auth>(() => {
    let user: CurrentUser | null = null;
    let status: AuthStatus = "loading";
    if (temp) {
      const found = users.data?.items.find((u) => u.id === actorId);
      user = found ? { ...found, username: tempUsername(found.displayName) } : null;
      status = users.isPending ? "loading" : user ? "in" : "out";
    } else if (me.isSuccess) {
      user = me.data.user;
      status = "in";
    } else if (!me.isPending) {
      status = "out";
    }

    return {
      status,
      user,
      mode: temp ? "temp" : "session",
      async login(username, password) {
        try {
          await sendJson("/api/auth/login", SessionResponse, { username, password }, "POST");
        } catch (error) {
          if (!isMissingRoute(error)) throw error;
          // TEMP(auth): no auth API yet, check against the demo users instead.
          const list = await requestJson("/api/users", UserListResponse);
          const match = list.items.find((u) => tempUsername(u.displayName) === username);
          if (!match || password !== TEMP_PASSWORD) {
            throw new ApiError(401, "INVALID_CREDENTIALS", "Wrong username or password");
          }
          setActorId(match.id);
        }
        await client.invalidateQueries({ queryKey: ["me"] });
        await client.invalidateQueries({ queryKey: ["users"] });
      },
      async logout() {
        if (temp) {
          setActorId(null);
          setApiActor(null);
        } else {
          await sendJson("/api/auth/logout", OkResponse, undefined, "POST").catch(() => undefined);
        }
        client.clear();
        await client.invalidateQueries({ queryKey: ["me"] });
      },
    };
  }, [
    temp,
    users.data,
    users.isPending,
    me.isSuccess,
    me.isPending,
    me.data,
    actorId,
    client,
    setActorId,
  ]);

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

/** Demo accounts listed on the sign-in page for the jury. */
export function useDemoAccounts() {
  return useQuery({
    queryKey: ["demo-accounts"],
    queryFn: async (): Promise<DemoAccountsResponse> => {
      try {
        return await requestJson("/api/auth/demo-accounts", DemoAccountsResponse);
      } catch (error) {
        if (!isMissingRoute(error)) throw error;
        // TEMP(auth): build the list from the demo users until the endpoint exists.
        const list = await requestJson("/api/users", UserListResponse);
        return {
          enabled: true,
          password: TEMP_PASSWORD,
          items: list.items.map((u) => ({
            username: tempUsername(u.displayName),
            displayName: u.displayName,
            role: u.role,
            specialty: u.specialty ?? null,
            district: u.district,
          })),
        };
      }
    },
    staleTime: Infinity,
    retry: false,
  });
}

/** Sign in from the form. */
export function useLogin() {
  const { login } = useAuth();
  return useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      login(username, password),
  });
}
