import {
  minimumCorrect,
  requiredCellIds,
  topics,
  totalSlots,
  validLines,
  type CellEntry,
  type Role,
} from "../../shared/game";

type Env = {
  DB: D1Database;
  ALLOWED_ORIGIN: string;
  ADMIN_PASSWORD: string;
};

type Participant = {
  id: string;
  nickname: string;
  role: Role;
  eligible_for_prize: number;
};

type SubmissionPayload = {
  lineId: string;
  entries: Record<string, CellEntry>;
};

type AuthContext = { participant: Participant; tokenHash: string };

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const ADMIN_TTL_SECONDS = 60 * 60 * 8;
const LOGIN_WINDOW_SECONDS = 60 * 10;
const LOGIN_ATTEMPT_LIMIT = 12;

function json(data: unknown, status = 200, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extraHeaders },
  });
}

function corsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get("origin") ?? "";
  const configuredOrigins = env.ALLOWED_ORIGIN.split(",").map((value) => value.trim()).filter(Boolean);
  const allowed = new Set([...configuredOrigins, "http://localhost:5173", "http://127.0.0.1:5173"]);
  return {
    "access-control-allow-origin": allowed.has(origin) ? origin : configuredOrigins[0],
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function readJson<T>(request: Request): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) throw new Error("INVALID_CONTENT_TYPE");
  return request.json<T>();
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : null;
}

async function authenticate(request: Request, env: Env): Promise<AuthContext | null> {
  const token = bearerToken(request);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const participant = await env.DB.prepare(`
    SELECT p.id, p.nickname, p.role, p.eligible_for_prize
    FROM sessions s
    JOIN participants p ON p.id = s.participant_id
    WHERE s.token_hash = ?1 AND s.expires_at > CURRENT_TIMESTAMP AND p.active = 1
  `).bind(tokenHash).first<Participant>();
  return participant ? { participant, tokenHash } : null;
}

function roleLabel(role: Role): string {
  return role === "camper" ? "营员" : role === "counselor" ? "辅导员" : "工作人员";
}

async function login(request: Request, env: Env): Promise<Response> {
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-real-ip") ?? "local";
  const now = Math.floor(Date.now() / 1000);
  const attempt = await env.DB.prepare("SELECT window_start, attempts FROM login_attempts WHERE ip = ?1")
    .bind(ip).first<{ window_start: number; attempts: number }>();
  if (attempt && attempt.window_start > now - LOGIN_WINDOW_SECONDS && attempt.attempts >= LOGIN_ATTEMPT_LIMIT) {
    return json({ error: "尝试次数过多，请10分钟后再试" }, 429);
  }

  const { code } = await readJson<{ code?: string }>(request);
  const normalizedCode = code?.trim() ?? "";
  if (!/^\d{6}$/.test(normalizedCode)) return json({ error: "请输入6位邀请码" }, 400);

  const codeHash = await sha256(normalizedCode);
  const participant = await env.DB.prepare(`
    SELECT id, nickname, role, eligible_for_prize
    FROM participants WHERE invite_code_hash = ?1 AND active = 1
  `).bind(codeHash).first<Participant>();
  if (!participant) {
    await env.DB.prepare(`
      INSERT INTO login_attempts (ip, window_start, attempts) VALUES (?1, ?2, 1)
      ON CONFLICT(ip) DO UPDATE SET
        attempts = CASE WHEN window_start <= ?3 THEN 1 ELSE attempts + 1 END,
        window_start = CASE WHEN window_start <= ?3 THEN ?2 ELSE window_start END
    `).bind(ip, now, now - LOGIN_WINDOW_SECONDS).run();
    return json({ error: "邀请码无效，请联系工作人员" }, 401);
  }

  await env.DB.prepare("DELETE FROM login_attempts WHERE ip = ?1").bind(ip).run();

  const token = randomToken();
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  await env.DB.prepare("INSERT INTO sessions (token_hash, participant_id, expires_at) VALUES (?1, ?2, ?3)")
    .bind(tokenHash, participant.id, expiresAt).run();

  return json({ token, participant: { ...participant, roleLabel: roleLabel(participant.role) } });
}

async function gameState(auth: AuthContext, env: Env): Promise<Response> {
  const people = await env.DB.prepare(`
    SELECT id, nickname, role FROM participants WHERE active = 1 ORDER BY nickname COLLATE NOCASE
  `).all<{ id: string; nickname: string; role: Role }>();
  const submission = await env.DB.prepare(`
    SELECT line_id, correct_count, total_count, accuracy, valid, submitted_at
    FROM submissions WHERE participant_id = ?1
  `).bind(auth.participant.id).first();
  return json({
    participant: { ...auth.participant, roleLabel: roleLabel(auth.participant.role) },
    people: people.results.map((person) => ({ ...person, roleLabel: roleLabel(person.role) })),
    submission,
  });
}

type AnswerRow = { participant_id: string; topic_id: string; interested: number };

async function submit(request: Request, auth: AuthContext, env: Env): Promise<Response> {
  const existing = await env.DB.prepare("SELECT id FROM submissions WHERE participant_id = ?1")
    .bind(auth.participant.id).first();
  if (existing) return json({ error: "你已经正式提交，成绩已锁定" }, 409);

  const payload = await readJson<SubmissionPayload>(request);
  const line = validLines.find((candidate) => candidate.id === payload.lineId);
  if (!line) return json({ error: "参赛线路无效" }, 400);

  const cellIds = requiredCellIds(line);
  const entries = cellIds.map((topicId) => ({ topicId, entry: payload.entries?.[topicId] }));
  if (entries.some(({ entry }) => !entry?.yesParticipantId || !entry?.noParticipantId)) {
    return json({ error: "参赛线路尚未填写完整" }, 400);
  }

  const selectedIds = entries.flatMap(({ entry }) => [entry.yesParticipantId, entry.noParticipantId]);
  if (new Set(selectedIds).size !== selectedIds.length) {
    return json({ error: "同一条参赛线路不能重复填写同一个人" }, 400);
  }

  const specialTopicIds = new Set(topics.filter((topic) => topic.special).map((topic) => topic.id));
  const participantPlaceholders = selectedIds.map(() => "?").join(",");
  const selectedPeople = await env.DB.prepare(`
    SELECT id, role FROM participants WHERE active = 1 AND id IN (${participantPlaceholders})
  `).bind(...selectedIds).all<{ id: string; role: Role }>();
  if (selectedPeople.results.length !== selectedIds.length) return json({ error: "填写人员不存在或已停用" }, 400);
  const peopleById = new Map(selectedPeople.results.map((person) => [person.id, person]));
  for (const { topicId, entry } of entries) {
    if (!specialTopicIds.has(topicId)) continue;
    const roles = [peopleById.get(entry.yesParticipantId)?.role, peopleById.get(entry.noParticipantId)?.role];
    if (roles.some((role) => role === "camper")) return json({ error: "蓝色特殊格只能填写辅导员或工作人员" }, 400);
  }

  const topicPlaceholders = cellIds.map(() => "?").join(",");
  const answerRows = await env.DB.prepare(`
    SELECT participant_id, topic_id, interested FROM answers
    WHERE participant_id IN (${participantPlaceholders}) AND topic_id IN (${topicPlaceholders})
  `).bind(...selectedIds, ...cellIds).all<AnswerRow>();
  const answerMap = new Map(answerRows.results.map((answer) => [`${answer.participant_id}:${answer.topic_id}`, answer.interested]));
  if (entries.some(({ topicId, entry }) =>
    !answerMap.has(`${entry.yesParticipantId}:${topicId}`) || !answerMap.has(`${entry.noParticipantId}:${topicId}`))) {
    return json({ error: "有人未回答该兴趣题，请更换填写人员" }, 400);
  }

  const checkedEntries = entries.map(({ topicId, entry }) => ({
    topicId,
    entry,
    yesCorrect: Number(answerMap.get(`${entry.yesParticipantId}:${topicId}`) === 1),
    noCorrect: Number(answerMap.get(`${entry.noParticipantId}:${topicId}`) === 0),
  }));
  const correctCount = checkedEntries.reduce((sum, entry) => sum + entry.yesCorrect + entry.noCorrect, 0);
  const totalCount = totalSlots(line);
  const accuracy = correctCount / totalCount;
  const valid = correctCount >= minimumCorrect(line);
  const submissionId = crypto.randomUUID();

  const statements = [
    env.DB.prepare(`
      INSERT INTO submissions (id, participant_id, line_id, correct_count, total_count, accuracy, valid)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
    `).bind(submissionId, auth.participant.id, line.id, correctCount, totalCount, accuracy, Number(valid)),
    ...checkedEntries.map(({ topicId, entry, yesCorrect, noCorrect }) => env.DB.prepare(`
      INSERT INTO submission_entries
        (submission_id, topic_id, yes_participant_id, no_participant_id, yes_correct, no_correct)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6)
    `).bind(submissionId, topicId, entry.yesParticipantId, entry.noParticipantId, yesCorrect, noCorrect)),
  ];

  try {
    await env.DB.batch(statements);
  } catch (error) {
    const duplicate = await env.DB.prepare("SELECT id FROM submissions WHERE participant_id = ?1")
      .bind(auth.participant.id).first();
    if (duplicate) return json({ error: "你已经正式提交，成绩已锁定" }, 409);
    console.error(error);
    return json({ error: "提交失败，请稍后重试" }, 500);
  }

  return json({
    submission: {
      lineId: line.id,
      lineLabel: line.label,
      correctCount,
      totalCount,
      accuracy,
      valid,
      submittedAt: new Date().toISOString(),
    },
  }, 201);
}

async function leaderboard(env: Env): Promise<Response> {
  const result = await env.DB.prepare(`
    SELECT p.nickname, s.accuracy, s.submitted_at
    FROM submissions s
    JOIN participants p ON p.id = s.participant_id
    WHERE s.valid = 1 AND p.role = 'camper' AND p.eligible_for_prize = 1
    ORDER BY s.submitted_at ASC
    LIMIT 10
  `).all<{ nickname: string; accuracy: number; submitted_at: string }>();
  return json({
    generatedAt: new Date().toISOString(),
    rankings: result.results.map((row, index) => ({ rank: index + 1, ...row })),
  });
}

async function hmac(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(signature))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function createAdminToken(secret: string): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + ADMIN_TTL_SECONDS;
  const payload = String(expiresAt);
  return `${payload}.${await hmac(payload, secret)}`;
}

async function verifyAdmin(request: Request, env: Env): Promise<boolean> {
  const token = bearerToken(request);
  if (!token) return false;
  const [expiresAt, signature] = token.split(".");
  if (!expiresAt || !signature || Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false;
  const expected = await hmac(expiresAt, env.ADMIN_PASSWORD);
  if (signature.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < signature.length; index += 1) mismatch |= signature.charCodeAt(index) ^ expected.charCodeAt(index);
  return mismatch === 0;
}

async function adminLogin(request: Request, env: Env): Promise<Response> {
  const { password } = await readJson<{ password?: string }>(request);
  if (!env.ADMIN_PASSWORD || password !== env.ADMIN_PASSWORD) return json({ error: "管理密码错误" }, 401);
  return json({ token: await createAdminToken(env.ADMIN_PASSWORD) });
}

async function adminOverview(env: Env): Promise<Response> {
  const stats = await env.DB.prepare(`
    SELECT
      (SELECT COUNT(*) FROM participants WHERE active = 1) AS participant_count,
      (SELECT COUNT(*) FROM submissions) AS submission_count,
      (SELECT COUNT(*) FROM submissions WHERE valid = 1) AS valid_count
  `).first();
  const submissions = await env.DB.prepare(`
    SELECT s.id, p.nickname, p.role, s.line_id, s.correct_count, s.total_count,
      s.accuracy, s.valid, s.submitted_at
    FROM submissions s JOIN participants p ON p.id = s.participant_id
    ORDER BY s.submitted_at ASC
  `).all();
  return json({ stats, submissions: submissions.results });
}

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method === "GET" && url.pathname === "/api/health") return json({ ok: true });
  if (request.method === "POST" && url.pathname === "/api/login") return login(request, env);
  if (request.method === "GET" && url.pathname === "/api/leaderboard") return leaderboard(env);
  if (request.method === "POST" && url.pathname === "/api/admin/login") return adminLogin(request, env);
  if (request.method === "GET" && url.pathname === "/api/admin/overview") {
    if (!await verifyAdmin(request, env)) return json({ error: "管理登录已失效" }, 401);
    return adminOverview(env);
  }

  const auth = await authenticate(request, env);
  if (!auth) return json({ error: "请重新登录" }, 401);
  if (request.method === "GET" && url.pathname === "/api/game") return gameState(auth, env);
  if (request.method === "POST" && url.pathname === "/api/submit") return submit(request, auth, env);
  return json({ error: "接口不存在" }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const headers = corsHeaders(request, env);
    try {
      const response = await route(request, env);
      const outgoing = new Response(response.body, response);
      Object.entries(headers).forEach(([key, value]) => outgoing.headers.set(key, String(value)));
      outgoing.headers.set("cache-control", "no-store");
      outgoing.headers.set("x-content-type-options", "nosniff");
      return outgoing;
    } catch (error) {
      console.error(error);
      const response = json({ error: "服务暂时不可用" }, 500, headers);
      return response;
    }
  },
} satisfies ExportedHandler<Env>;
