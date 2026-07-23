import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const participantPath = resolve(process.argv[2] ?? "data/test-participants.csv");
const answerPath = resolve(process.argv[3] ?? "data/test-answers.csv");
const adminPassword = process.env.BINGO_ADMIN_PASSWORD;
if (!adminPassword) throw new Error("请通过 BINGO_ADMIN_PASSWORD 提供后台密码");

function rows(csv) {
  const [headerLine, ...lines] = csv.trim().split(/\r?\n/);
  const headers = headerLine.replace(/^\uFEFF/, "").split(",");
  return lines.map((line) => Object.fromEntries(line.split(",").map((value, index) => [headers[index], value])));
}

function sql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const participants = rows(await readFile(participantPath, "utf8"));
const answers = rows(await readFile(answerPath, "utf8"));
const answerByNickname = new Map(answers.map((answer) => [answer.nickname, answer]));
const topicIds = [
  "r1c1", "r1c2", "r1c3", "r1c4", "r1c5",
  "r2c1", "r2c2", "r2c3", "r2c4", "r2c5",
  "r3c1", "r3c2", "r3c3", "r3c4", "r3c5",
  "r4c1", "r4c2", "r4c3", "r4c4", "r4c5",
  "r5c1", "r5c2", "r5c3", "r5c4", "r5c5",
];
const topicLabels = [
  "《哈利波特》", "无畏契约", "玄幻小说", "诺兰导演作品", "方大同",
  "宠物", "羽毛球", "周杰伦", "自然风光摄影", "油画",
  "舞蹈", "邓紫棋", "王者荣耀", "《十日终焉》", "西北川藏高原",
  "板绘", "《龙族》", "篮球", "孙燕姿", "言情小说",
  "林俊杰", "《紫罗兰永恒花园》", "异国景致", "乒乓球", "人文摄影",
];

const participantValues = participants.map((participant, index) => {
  if (!/^\d{6}$/.test(participant.invite_code)) throw new Error(`${participant.nickname}的邀请码无效`);
  if (!answerByNickname.has(participant.nickname)) throw new Error(`${participant.nickname}缺少问卷答案`);
  return `(${sql(`p${String(index + 1).padStart(3, "0")}`)}, ${sql(participant.nickname)}, ${sql(participant.role)}, ${sql(sha256(participant.invite_code))}, ${participant.eligible_for_prize === "1"})`;
});

const answerValues = participants.flatMap((participant, index) => {
  const answer = answerByNickname.get(participant.nickname);
  return topicIds.map((topicId, topicIndex) => {
    const interested = answer[topicLabels[topicIndex]];
    if (interested !== "是" && interested !== "否") throw new Error(`${participant.nickname}的“${topicLabels[topicIndex]}”答案无效`);
    return `(${sql(`p${String(index + 1).padStart(3, "0")}`)}, ${sql(topicId)}, ${interested === "是"})`;
  });
});

const migrations = await Promise.all([
  "supabase/migrations/0001_bingo.sql",
  "supabase/migrations/0002_live_drafts.sql",
  "supabase/migrations/0003_final_board.sql",
  "supabase/migrations/0004_fix_answer_scopes.sql",
  "supabase/migrations/0005_final_topic_updates.sql",
].map((path) => readFile(resolve(path), "utf8")));
const replaceData = process.argv.includes("--replace-data");
const resetSql = replaceData ? `
delete from bingo_private.admin_sessions;
delete from bingo_private.sessions;
delete from bingo_private.submissions;
delete from bingo_private.drafts;
delete from bingo_private.answers;
delete from bingo_private.participants;
` : "";
const setup = `begin;\n${migrations.join("\n")}\n
${resetSql}
insert into bingo_private.participants
  (id, nickname, role, invite_code_hash, eligible_for_prize)
values\n${participantValues.join(",\n")};

insert into bingo_private.answers (participant_id, topic_id, interested)
values\n${answerValues.join(",\n")};

insert into bingo_private.admin_config(singleton, password_hash)
values (true, ${sql(sha256(adminPassword))})
on conflict (singleton) do update set password_hash = excluded.password_hash;
commit;\n`;

const outputPath = resolve(replaceData
  ? ".private-data/supabase-replace-data.sql"
  : ".private-data/supabase-setup.sql");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, setup, { mode: 0o600 });
console.log(`已生成 Supabase 初始化文件：${outputPath}`);
console.log(`参与者 ${participants.length} 人，答案 ${answerValues.length} 条。`);
