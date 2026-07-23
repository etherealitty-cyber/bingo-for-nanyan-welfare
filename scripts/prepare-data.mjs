import { createHash, randomInt } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const topicLabels = [
  "《哈利波特》", "无畏契约", "玄幻小说", "诺兰导演作品", "方大同",
  "宠物", "羽毛球", "周杰伦", "自然风光摄影", "油画",
  "舞蹈", "邓紫棋", "王者荣耀", "《十日终焉》", "西北川藏高原",
  "板绘", "《龙族》", "篮球", "孙燕姿", "言情小说",
  "林俊杰", "《紫罗兰永恒花园》", "异国景致", "乒乓球", "人文摄影",
];

const topicIds = [
  "r1c1", "r1c2", "r1c3", "r1c4", "r1c5",
  "r2c1", "r2c2", "r2c3", "r2c4", "r2c5",
  "r3c1", "r3c2", "r3c3", "r3c4", "r3c5",
  "r4c1", "r4c2", "r4c3", "r4c4", "r4c5",
  "r5c1", "r5c2", "r5c3", "r5c4", "r5c5",
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(value.trim());
      value = "";
    } else if (char === "\n") {
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  if (quoted) throw new Error("CSV中存在未闭合的引号");
  return rows;
}

function recordsFromCsv(text) {
  const [headers, ...rows] = parseCsv(text);
  if (!headers) return [];
  return rows.map((row, rowIndex) => {
    if (row.length !== headers.length) throw new Error(`CSV第${rowIndex + 2}行列数不一致`);
    return Object.fromEntries(headers.map((header, index) => [header, row[index]]));
  });
}

function sql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function createInviteCodes(count) {
  const codes = new Set();
  while (codes.size < count) codes.add(String(randomInt(100000, 1000000)));
  return [...codes];
}

const participantsPath = resolve(process.argv[2] ?? "data/participants-template.csv");
const answersPath = resolve(process.argv[3] ?? "data/answers-template.csv");
const outputDirectory = resolve(".private-data");

const participants = recordsFromCsv(await readFile(participantsPath, "utf8"));
const answers = recordsFromCsv(await readFile(answersPath, "utf8"));

if (participants.length === 0) throw new Error("参与者名单为空");
const nicknames = participants.map((participant) => participant.nickname);
if (new Set(nicknames).size !== nicknames.length) throw new Error("参与者昵称存在重复");

const validRoles = new Set(["camper", "counselor", "staff"]);
for (const participant of participants) {
  if (!participant.nickname) throw new Error("参与者昵称不能为空");
  if (!validRoles.has(participant.role)) throw new Error(`${participant.nickname}的身份无效`);
  if (!["0", "1"].includes(participant.eligible_for_prize)) throw new Error(`${participant.nickname}的获奖资格必须是0或1`);
}

const answerByNickname = new Map(answers.map((answer) => [answer.nickname, answer]));
for (const participant of participants) {
  const answer = answerByNickname.get(participant.nickname);
  if (!answer) throw new Error(`${participant.nickname}缺少问卷答案`);
  for (const topicLabel of topicLabels) {
    if (!["是", "否"].includes(answer[topicLabel])) throw new Error(`${participant.nickname}对“${topicLabel}”的答案无效`);
  }
}

const providedCodes = participants.map((participant) => participant.invite_code).filter(Boolean);
if (providedCodes.length > 0 && providedCodes.length !== participants.length) {
  throw new Error("如需指定邀请码，参与者名单中的每一行都必须填写invite_code");
}
if (providedCodes.some((code) => !/^\d{6}$/.test(code))) throw new Error("指定邀请码必须是6位数字");
if (new Set(providedCodes).size !== providedCodes.length) throw new Error("指定邀请码存在重复");
const inviteCodes = providedCodes.length > 0 ? providedCodes : createInviteCodes(participants.length);
const participantRows = participants.map((participant, index) => ({
  ...participant,
  id: `p${String(index + 1).padStart(3, "0")}`,
  inviteCode: inviteCodes[index],
}));

const participantSql = participantRows.map((participant) =>
  `(${sql(participant.id)}, ${sql(participant.nickname)}, ${sql(participant.role)}, ${sql(sha256(participant.inviteCode))}, ${participant.eligible_for_prize})`,
).join(",\n");

const answerSql = participantRows.flatMap((participant) => {
  const answer = answerByNickname.get(participant.nickname);
  return topicLabels.map((topicLabel, index) =>
    `(${sql(participant.id)}, ${sql(topicIds[index])}, ${answer[topicLabel] === "是" ? 1 : 0})`,
  );
}).join(",\n");

const importSql = `INSERT INTO participants (id, nickname, role, invite_code_hash, eligible_for_prize) VALUES
${participantSql};

INSERT INTO answers (participant_id, topic_id, interested) VALUES
${answerSql};
`;

const inviteCsv = ["nickname,role,invite_code", ...participantRows.map((participant) =>
  `${participant.nickname},${participant.role},${participant.inviteCode}`,
)].join("\n");

await mkdir(outputDirectory, { recursive: true });
await writeFile(resolve(outputDirectory, "import.sql"), importSql, { mode: 0o600 });
await writeFile(resolve(outputDirectory, "invite-codes.csv"), `${inviteCsv}\n`, { mode: 0o600 });

console.log(`已生成 ${participantRows.length} 名参与者的导入文件：`);
console.log(".private-data/import.sql");
console.log(".private-data/invite-codes.csv");
