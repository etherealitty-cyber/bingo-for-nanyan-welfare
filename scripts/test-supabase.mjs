import { readFile } from "node:fs/promises";

const supabaseUrl = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const adminPassword = process.env.BINGO_ADMIN_PASSWORD;
if (!supabaseUrl || !publishableKey || !adminPassword) {
  throw new Error("缺少 SUPABASE_URL、SUPABASE_PUBLISHABLE_KEY 或 BINGO_ADMIN_PASSWORD");
}

const answerRows = (await readFile("data/test-answers.csv", "utf8")).trim().split("\n").map((line) => line.split(","));
const [answerHeaders, ...answerData] = answerRows;
const answerByNickname = new Map(answerData.map((row) => [
  row[0], Object.fromEntries(answerHeaders.slice(1).map((header, index) => [header, row[index + 1]])),
]));
const topicLabels = {
  r1c1: "《哈利波特》", r1c2: "无畏契约", r1c3: "玄幻小说", r1c4: "诺兰导演作品", r1c5: "方大同",
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS  ${message}`);
}

async function rpc(name, parameters = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: publishableKey, "content-type": "application/json" },
    body: JSON.stringify(parameters),
  });
  const data = await response.json();
  return { response, data };
}

async function login(code) {
  const result = await rpc("bingo_login", { p_code: code });
  assert(result.response.ok, `邀请码 ${code} 登录成功`);
  return result.data.token;
}

function buildLine(people, mode = "correct") {
  const used = new Set();
  const entries = {};
  for (const [topicId, label] of Object.entries(topicLabels)) {
    const candidates = people.filter((person) => topicId !== "r1c1" || person.role !== "camper");
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
  return rpc("bingo_submit", { p_token: token, p_line_id: "row-1", p_entries: entries });
}

const baseToken = await login("200001");
const gameResult = await rpc("bingo_game", { p_token: baseToken });
assert(gameResult.response.ok, "读取棋盘和人员名单成功");
const people = gameResult.data.people;
assert(people.length === 50, "参与者名单恰好为50人");
assert(people.filter((person) => person.role === "camper").length === 30, "营员恰好为30人");
assert(people.filter((person) => person.role !== "camper").length === 20, "辅导员和工作人员恰好为20人");

const specialToken = await login("200003");
const specialEntries = buildLine(people);
const unusedCamper = people.find((person) => person.role === "camper" && !Object.values(specialEntries).some((entry) =>
  entry.yesParticipantId === person.id || entry.noParticipantId === person.id));
specialEntries.r1c1.yesParticipantId = unusedCamper.id;
const specialResult = await submit(specialToken, specialEntries);
assert(!specialResult.response.ok && specialResult.data.message.includes("蓝色特殊格"), "后端拒绝特殊格填写营员");

const duplicateToken = await login("200004");
const duplicateEntries = buildLine(people);
duplicateEntries.r1c2.yesParticipantId = duplicateEntries.r1c1.yesParticipantId;
const duplicateResult = await submit(duplicateToken, duplicateEntries);
assert(!duplicateResult.response.ok && duplicateResult.data.message.includes("重复"), "后端拒绝同一线路重复姓名");

const validToken = await login("200005");
const validResult = await submit(validToken, buildLine(people, "correct"));
assert(validResult.response.ok && validResult.data.submission.valid === true, "正确成绩有效");
assert(validResult.data.submission.accuracy === 1, "有效成绩准确率为100%");
const repeatedResult = await submit(validToken, buildLine(people, "correct"));
assert(!repeatedResult.response.ok && repeatedResult.data.message.includes("锁定"), "第二次提交被永久拒绝");

const invalidToken = await login("200006");
const invalidResult = await submit(invalidToken, buildLine(people, "wrong"));
assert(invalidResult.response.ok && invalidResult.data.submission.valid === false, "低于80%的成绩锁定且无效");
assert(invalidResult.data.submission.accuracy === 0, "无效成绩准确率为0%");

const counselorToken = await login("200031");
const counselorResult = await submit(counselorToken, buildLine(people, "correct"));
assert(counselorResult.response.ok && counselorResult.data.submission.valid === true, "辅导员可以提交有效成绩");

const leaderboard = await rpc("bingo_leaderboard");
assert(leaderboard.response.ok, "实时排名接口可用");
assert(leaderboard.data.rankings.length === 1 && leaderboard.data.rankings[0].nickname === "鹿鸣", "排名仅包含有效且有资格的营员");

const adminLogin = await rpc("bingo_admin_login", { p_password: adminPassword });
assert(adminLogin.response.ok, "管理员登录成功");
const overview = await rpc("bingo_admin_overview", { p_token: adminLogin.data.token });
assert(overview.response.ok, "后台统计接口可用");
assert(overview.data.stats.participant_count === 50, "后台参与人数统计为50");
assert(overview.data.stats.submission_count === 3, "后台正式提交统计为3");
assert(overview.data.stats.valid_count === 2, "后台有效成绩统计为2");

console.log("\nSupabase 全部端到端测试通过。");
