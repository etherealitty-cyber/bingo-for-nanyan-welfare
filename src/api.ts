import type { Draft } from "../shared/game";
import type { LockedSubmission, Participant, Person, Ranking } from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_KEY);
const TOKEN_KEY = "interest-bingo-session";
const ADMIN_TOKEN_KEY = "interest-bingo-admin";

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 30_000);
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("连接服务器超时，请切换网络后重试");
    }
    throw new Error("无法连接服务器，请检查手机网络后重试");
  } finally {
    window.clearTimeout(timeoutId);
  }
  const data = await response.json().catch(() => ({ error: "服务器返回了无法识别的内容" }));
  if (!response.ok) throw new Error(data.error ?? data.message ?? "请求失败");
  return data as T;
}

async function request<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  return fetchJson<T>(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
}

async function rpc<T>(name: string, parameters: Record<string, unknown> = {}): Promise<T> {
  return fetchJson<T>(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY ?? "",
      "content-type": "application/json",
    },
    body: JSON.stringify(parameters),
  });
}

export const session = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const adminSession = {
  get: () => sessionStorage.getItem(ADMIN_TOKEN_KEY),
  set: (token: string) => sessionStorage.setItem(ADMIN_TOKEN_KEY, token),
  clear: () => sessionStorage.removeItem(ADMIN_TOKEN_KEY),
};

export async function login(code: string) {
  if (USE_SUPABASE) return rpc<{ token: string; participant: Participant }>("bingo_login", { p_code: code });
  return request<{ token: string; participant: Participant }>("/api/login", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function getGame(token: string) {
  if (USE_SUPABASE) {
    return rpc<{ participant: Participant; people: Person[]; submission: LockedSubmission | null }>("bingo_game", { p_token: token });
  }
  return request<{ participant: Participant; people: Person[]; submission: LockedSubmission | null }>(
    "/api/game", {}, token,
  );
}

export async function submitGame(token: string, lineId: string, draft: Draft) {
  if (USE_SUPABASE) {
    return rpc<{ submission: LockedSubmission }>("bingo_submit", {
      p_token: token,
      p_line_id: lineId,
      p_entries: draft,
    });
  }
  return request<{ submission: LockedSubmission }>("/api/submit", {
    method: "POST",
    body: JSON.stringify({ lineId, entries: draft }),
  }, token);
}

export async function getLeaderboard() {
  if (USE_SUPABASE) return rpc<{ generatedAt: string; rankings: Ranking[] }>("bingo_leaderboard");
  return request<{ generatedAt: string; rankings: Ranking[] }>("/api/leaderboard");
}

export async function adminLogin(password: string) {
  if (USE_SUPABASE) return rpc<{ token: string }>("bingo_admin_login", { p_password: password });
  return request<{ token: string }>("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function getAdminOverview(token: string) {
  if (USE_SUPABASE) {
    return rpc<{
      stats: { participant_count: number; submission_count: number; valid_count: number };
      submissions: Array<{
        id: string;
        nickname: string;
        role: string;
        line_id: string;
        correct_count: number;
        total_count: number;
        accuracy: number;
        valid: number;
        submitted_at: string;
      }>;
    }>("bingo_admin_overview", { p_token: token });
  }
  return request<{
    stats: { participant_count: number; submission_count: number; valid_count: number };
    submissions: Array<{
      id: string;
      nickname: string;
      role: string;
      line_id: string;
      correct_count: number;
      total_count: number;
      accuracy: number;
      valid: number;
      submitted_at: string;
    }>;
  }>("/api/admin/overview", {}, token);
}
