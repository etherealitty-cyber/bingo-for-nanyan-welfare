import { readFile } from "node:fs/promises";

const apiBase = process.env.API_BASE_URL ?? "http://127.0.0.1:8787";
const answerRows = (await readFile("data/test-answers.csv", "utf8")).trim().split("\n").map((line) => line.split(","));
const [answerHeaders, ...answerData] = answerRows;
const answerByNickname = new Map(answerData.map((row) => [
  row[0],
  Object.fromEntries(answerHeaders.slice(1).map((header, index) => [header, row[index + 1]])),
]));
const topicLabels = {
  r1c1: "《哈利波特》",
  r1c2: "无畏契约",
  r1c3: "玄幻小说",
  r1c4: "诺兰导演作品",
  r1c5: "方大同",
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS  ${message}`);
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...options.headers },
  });
  const data = await response.json();
  return { response, data };
}

async function login(nickname) {
  const result = await request("/api/login", { method: "POST", body: JSON.stringify({ nickname }) });
  assert(result.response.status === 200, `姓名 ${nickname} 登录成功`);
  return result.data.token;
}

async function game(token) {
  const result = await request("/api/game", { headers: { authorization: `Bearer ${token}` } });
  assert(result.response.status === 200, "读取棋盘和人员名单成功");
  return result.data;
}

function buildLine(people, mode = "correct") {
  const used = new Set();
  const entries = {};
  for (const [topicId, label] of Object.entries(topicLabels)) {
    const special = topicId === "r1c1";
    const candidates = people.filter((person) => !special || person.role !== "camper");
    const yesAnswer = mode === "correct" ? "是" : "否";
    const noAnswer = mode === "correct" ? "否" : "是";
    const yes = candidates.find((person) => !used.has(person.id) && answerByNickname.get(person.nickname)?.[label] === yesAnswer);
    if (!yes) throw new Error(`找不到 ${label} 的测试“是”人选`);
    used.add(yes.id);
    const no = candidates.find((person) => !used.has(person.id) && answerByNickname.get(person.nickname)?.[label] === noAnswer);
    if (!no) throw new Error(`找不到 ${label} 的测试“否”人选`);
    used.add(no.id);
    entries[topicId] = { yesParticipantId: yes.id, noParticipantId: no.id };
  }
  return entries;
}

async function submit(token, entries) {
  return request("/api/submit", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify({ lineId: "row-1", entries }),
  });
}

const health = await request("/api/health");
assert(health.response.status === 200 && health.data.ok, "Worker健康检查通过");

const baseToken = await login("朝露");
const baseGame = await game(baseToken);
assert(baseGame.people.length === 50, "参与者名单恰好为50人");
assert(baseGame.people.filter((person) => person.role === "camper").length === 30, "营员恰好为30人");
assert(baseGame.people.filter((person) => person.role !== "camper").length === 20, "辅导员和工作人员恰好为20人");

const specialToken = await login("山岚");
const specialEntries = buildLine(baseGame.people, "correct");
const camperForSpecial = baseGame.people.find((person) =>
  person.role === "camper" &&
  !Object.values(specialEntries).some((entry) =>
    entry.yesParticipantId === person.id || entry.noParticipantId === person.id,
  ),
);
if (!camperForSpecial) throw new Error("找不到用于特殊格负向测试的营员");
specialEntries.r1c1.yesParticipantId = camperForSpecial.id;
const specialResult = await submit(specialToken, specialEntries);
assert(specialResult.response.status === 400 && specialResult.data.error.includes("蓝色特殊格"), "后端拒绝特殊格填写营员");

const duplicateToken = await login("星野");
const duplicateEntries = buildLine(baseGame.people);
duplicateEntries.r1c2.yesParticipantId = duplicateEntries.r1c1.yesParticipantId;
const duplicateResult = await submit(duplicateToken, duplicateEntries);
assert(duplicateResult.response.status === 400 && duplicateResult.data.error.includes("重复"), "后端拒绝同一线路重复姓名");

const validToken = await login("鹿鸣");
const validResult = await submit(validToken, buildLine(baseGame.people, "correct"));
assert(validResult.response.status === 201 && validResult.data.submission.valid === true, "80%以上正确成绩有效");
assert(validResult.data.submission.accuracy === 1, "构造的有效成绩准确率为100%");

const repeatedResult = await submit(validToken, buildLine(baseGame.people, "correct"));
assert(repeatedResult.response.status === 409, "同一参与者第二次提交被永久拒绝");

const invalidToken = await login("远帆");
const invalidResult = await submit(invalidToken, buildLine(baseGame.people, "wrong"));
assert(invalidResult.response.status === 201 && invalidResult.data.submission.valid === false, "低于80%的成绩锁定且判定无效");
assert(invalidResult.data.submission.accuracy === 0, "构造的无效成绩准确率为0% ");

const counselorToken = await login("麦冬");
const counselorResult = await submit(counselorToken, buildLine(baseGame.people, "correct"));
assert(counselorResult.response.status === 201 && counselorResult.data.submission.valid === true, "辅导员可以提交有效成绩");

const leaderboard = await request("/api/leaderboard");
assert(leaderboard.response.status === 200, "实时排名接口可用");
assert(leaderboard.data.rankings.length === 1 && leaderboard.data.rankings[0].nickname === "鹿鸣", "排名仅包含有效且有资格的营员");

const adminLogin = await request("/api/admin/login", { method: "POST", body: JSON.stringify({ password: "local-admin-only" }) });
assert(adminLogin.response.status === 200, "管理员登录成功");
const overview = await request("/api/admin/overview", { headers: { authorization: `Bearer ${adminLogin.data.token}` } });
assert(overview.data.stats.participant_count === 50, "后台参与人数统计为50");
assert(overview.data.stats.submission_count === 3, "后台正式提交统计为3");
assert(overview.data.stats.valid_count === 2, "后台有效成绩统计为2");

let lastRateLimitResult;
for (let attempt = 0; attempt < 13; attempt += 1) {
  lastRateLimitResult = await request("/api/login", {
    method: "POST",
    headers: { "x-real-ip": "198.51.100.50" },
    body: JSON.stringify({ nickname: "不存在的人" }),
  });
}
assert(lastRateLimitResult.response.status === 429, "姓名暴力尝试触发10分钟限流");

console.log("\n全部端到端测试通过。");
