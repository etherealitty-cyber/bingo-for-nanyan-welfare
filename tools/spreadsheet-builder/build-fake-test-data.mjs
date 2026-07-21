import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const projectRoot = "/Users/pluto/CODE/funrepo/bingo";
const outputDir = `${projectRoot}/outputs/fake-test-data`;

const campers = [
  "朝露", "橘子海", "山岚", "星野", "鹿鸣", "远帆", "夏木", "青柠", "稻穗", "云杉",
  "知更", "洛川", "轻舟", "初霁", "海盐", "月见", "小岛", "听澜", "长风", "野渡",
  "昼川", "栗子", "望舒", "碎冰", "白茶", "青空", "南枝", "北辰", "木槿", "森屿",
];
const counselors = ["麦冬", "山竹", "白榆", "知夏", "竹影", "雾松", "清和", "千帆", "芝麻", "木蓝"];
const staff = ["松墨", "岩茶", "拾光", "榛果", "河豚", "半夏", "秋池", "明溪", "铃兰", "乌桕"];

const topics = [
  "王者荣耀", "林俊杰", "西北旅行", "原神", "星空摄影",
  "厦门旅行", "阿瓦隆", "孙燕姿", "羽毛球", "血染钟楼",
  "第五人格", "自然风光", "周杰伦", "绘画",
  "邓紫棋", "剧本杀", "土耳其旅行", "无畏契约", "言情小说",
  "西藏旅行", "薇尔莉特", "猫和老鼠", "饥荒联机", "书法",
];

const people = [
  ...campers.map((nickname) => ({ nickname, role: "camper", roleZh: "营员", eligible: 1 })),
  ...counselors.map((nickname) => ({ nickname, role: "counselor", roleZh: "辅导员", eligible: 0 })),
  ...staff.map((nickname) => ({ nickname, role: "staff", roleZh: "工作人员", eligible: 0 })),
].map((person, index) => ({ ...person, inviteCode: String(200001 + index) }));

const answers = people.map((person, personIndex) => ({
  nickname: person.nickname,
  role: person.role,
  values: topics.map((_, topicIndex) => ((personIndex + topicIndex + Math.floor(topicIndex / 3)) % 2 === 0 ? "是" : "否")),
}));

function csvCell(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows) {
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(
  `${projectRoot}/data/test-participants.csv`,
  toCsv([
    ["nickname", "role", "eligible_for_prize", "invite_code"],
    ...people.map((person) => [person.nickname, person.role, person.eligible, person.inviteCode]),
  ]),
);
await fs.writeFile(
  `${projectRoot}/data/test-answers.csv`,
  toCsv([
    ["nickname", ...topics],
    ...answers.map((answer) => [answer.nickname, ...answer.values]),
  ]),
);

const workbook = Workbook.create();
const guide = workbook.worksheets.add("测试说明");
const participantSheet = workbook.worksheets.add("测试名单");
const answerSheet = workbook.worksheets.add("兴趣答案");
const casesSheet = workbook.worksheets.add("功能用例");

for (const sheet of [guide, participantSheet, answerSheet, casesSheet]) sheet.showGridLines = false;

guide.mergeCells("A1:F2");
guide.getRange("A1").values = [["兴趣 Bingo 50人虚构测试数据"]];
guide.getRange("A1:F2").format = {
  fill: "#DDF2F4",
  font: { bold: true, color: "#17201D", size: 20 },
  verticalAlignment: "center",
  horizontalAlignment: "left",
};
guide.getRange("A4:B7").values = [
  ["数据指标", "数量"],
  ["总人数", null],
  ["营员", null],
  ["辅导员及工作人员", null],
];
guide.getRange("B5").formulas = [["=COUNTA('测试名单'!A2:A51)"]];
guide.getRange("B6").formulas = [["=COUNTIF('测试名单'!C2:C51,\"营员\")"]];
guide.getRange("B7").formulas = [["=COUNTIF('测试名单'!C2:C51,\"辅导员\")+COUNTIF('测试名单'!C2:C51,\"工作人员\")"]];
guide.getRange("A4:B4").format = { fill: "#17201D", font: { bold: true, color: "#FFFFFF" } };
guide.getRange("A5:A7").format = { fill: "#F1F5F2", font: { bold: true, color: "#34413B" } };
guide.getRange("B5:B7").format = { fill: "#FFFFFF", font: { bold: true, color: "#287786", size: 15 }, numberFormat: "0" };
guide.getRange("A4:B7").format.borders = { preset: "outside", style: "thin", color: "#CAD0CB" };
guide.getRange("A9:F13").values = [
  ["使用说明", null, null, null, null, null],
  ["1", "所有姓名、邀请码和兴趣答案均为虚构，仅用于功能测试。", null, null, null, null],
  ["2", "营员邀请码为200001-200030，辅导员为200031-200040，工作人员为200041-200050。", null, null, null, null],
  ["3", "每题约25人回答“是”、25人回答“否”，特殊身份内部也保持正反答案充足。", null, null, null, null],
  ["4", "正式问卷到齐后整体替换此测试集，不要混用。", null, null, null, null],
];
guide.mergeCells("A9:F9");
for (let row = 10; row <= 13; row += 1) guide.mergeCells(`B${row}:F${row}`);
guide.getRange("A9:F9").format = { fill: "#17201D", font: { bold: true, color: "#FFFFFF" } };
guide.getRange("A10:A13").format = { fill: "#A9DFE6", font: { bold: true, color: "#17201D" }, horizontalAlignment: "center" };
guide.getRange("B10:F13").format = { fill: "#FFFFFF", font: { color: "#34413B" }, wrapText: true };
guide.getRange("A1:F13").format.rowHeight = 24;
guide.getRange("A1:F13").format.autofitColumns();
guide.getRange("A1:A13").format.columnWidth = 24;
guide.getRange("B1:F13").format.columnWidth = 18;
guide.freezePanes.freezeRows(2);

const participantRows = [
  ["序号", "昵称", "身份", "可参与前三名", "测试邀请码"],
  ...people.map((person, index) => [index + 1, person.nickname, person.roleZh, person.eligible ? "是" : "否", person.inviteCode]),
];
participantSheet.getRange(`A1:E${participantRows.length}`).values = participantRows;
participantSheet.getRange("A1:E1").format = { fill: "#17201D", font: { bold: true, color: "#FFFFFF" }, horizontalAlignment: "center" };
participantSheet.getRange("A2:A51").format = { numberFormat: "0", horizontalAlignment: "center" };
participantSheet.getRange("C2:E51").format.horizontalAlignment = "center";
participantSheet.getRange("A2:E51").format.borders = { insideHorizontal: { style: "thin", color: "#E0E5E1" } };
participantSheet.getRange("C2:C51").conditionalFormats.add("containsText", { text: "营员", format: { fill: "#E0F2E9", font: { color: "#33765F" } } });
participantSheet.getRange("C2:C51").conditionalFormats.add("containsText", { text: "辅导员", format: { fill: "#DDF2F4", font: { color: "#287786" } } });
participantSheet.getRange("C2:C51").conditionalFormats.add("containsText", { text: "工作人员", format: { fill: "#F5EDD2", font: { color: "#765E23" } } });
participantSheet.getRange("A1:E51").format.autofitColumns();
participantSheet.getRange("B2:B51").format.columnWidth = 16;
participantSheet.getRange("C2:C51").format.columnWidth = 15;
participantSheet.getRange("D2:E51").format.columnWidth = 18;
participantSheet.freezePanes.freezeRows(1);

const answerRows = [
  ["昵称", "身份", ...topics],
  ...answers.map((answer, index) => [answer.nickname, people[index].roleZh, ...answer.values]),
];
answerSheet.getRange(`A1:Z${answerRows.length}`).values = answerRows;
answerSheet.getRange("A1:Z1").format = { fill: "#17201D", font: { bold: true, color: "#FFFFFF" }, horizontalAlignment: "center", wrapText: true };
answerSheet.getRange("A2:B51").format = { fill: "#F1F5F2", font: { bold: true, color: "#34413B" } };
answerSheet.getRange("C2:Z51").format.horizontalAlignment = "center";
answerSheet.getRange("C2:Z51").conditionalFormats.add("containsText", { text: "是", format: { fill: "#E0F2E9", font: { color: "#33765F", bold: true } } });
answerSheet.getRange("C2:Z51").conditionalFormats.add("containsText", { text: "否", format: { fill: "#F8E4E1", font: { color: "#A3453B" } } });
answerSheet.getRange("A1:Z51").format.borders = { insideHorizontal: { style: "thin", color: "#E5E9E6" } };
answerSheet.getRange("A1:Z51").format.autofitColumns();
answerSheet.getRange("A2:A51").format.columnWidth = 14;
answerSheet.getRange("B2:B51").format.columnWidth = 14;
answerSheet.getRange("C2:Z51").format.columnWidth = 13;
answerSheet.freezePanes.freezeRows(1);
answerSheet.freezePanes.freezeColumns(2);

const cases = [
  ["功能", "测试账号", "操作", "期望结果"],
  ["邀请码登录", "200001", "输入正确邀请码", "进入朝露的棋盘"],
  ["普通格填写", "200002", "普通格选择任意身份的两人", "草稿成功保存"],
  ["特殊格限制", "200003", "打开星空摄影等蓝色格", "只显示辅导员和工作人员"],
  ["线路重复姓名", "200004", "同一线路重复使用同一个人", "正式提交按钮不可用于该线路"],
  ["有效成绩", "200005", "提交至少80%正确的线路", "成绩有效并进入排名"],
  ["无效成绩", "200006", "提交低于80%正确的线路", "成绩锁定但不进入排名"],
  ["重复提交", "200005", "有效提交后再次请求提交", "后端返回409并拒绝"],
  ["实时排名", "任意账号", "查看实时排名", "仅显示有效且有资格的营员"],
  ["身份排除", "200031", "辅导员提交有效线路", "可参与但不进入前三名"],
  ["后台统计", "管理员", "打开管理后台", "人数、提交数、有效数和明细一致"],
];
casesSheet.getRange(`A1:D${cases.length}`).values = cases;
casesSheet.getRange("A1:D1").format = { fill: "#17201D", font: { bold: true, color: "#FFFFFF" } };
casesSheet.getRange(`A2:A${cases.length}`).format = { fill: "#DDF2F4", font: { bold: true, color: "#287786" } };
casesSheet.getRange(`A2:D${cases.length}`).format = { ...casesSheet.getRange(`A2:D${cases.length}`).format, wrapText: true };
casesSheet.getRange(`A1:D${cases.length}`).format.borders = { insideHorizontal: { style: "thin", color: "#DDE3DF" }, outside: { style: "thin", color: "#CAD0CB" } };
casesSheet.getRange("A1:D11").format.autofitColumns();
casesSheet.getRange("A2:A11").format.columnWidth = 18;
casesSheet.getRange("B2:B11").format.columnWidth = 15;
casesSheet.getRange("C2:D11").format.columnWidth = 34;
casesSheet.getRange("A2:D11").format.rowHeight = 34;
casesSheet.freezePanes.freezeRows(1);

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(`${outputDir}/兴趣Bingo-50人虚构测试数据.xlsx`);

const summary = await workbook.inspect({
  kind: "table",
  sheetId: "测试说明",
  range: "A1:F13",
  include: "values,formulas",
  tableMaxRows: 13,
  tableMaxCols: 6,
});
console.log(summary.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "formula error scan",
});
console.log(errors.ndjson);

for (const [sheetName, range, fileName] of [
  ["测试说明", "A1:F13", "测试说明.png"],
  ["测试名单", "A1:E18", "测试名单.png"],
  ["兴趣答案", "A1:J16", "兴趣答案.png"],
  ["功能用例", "A1:D11", "功能用例.png"],
]) {
  const preview = await workbook.render({ sheetName, range, scale: 1.3, format: "png" });
  await fs.writeFile(`${outputDir}/${fileName}`, new Uint8Array(await preview.arrayBuffer()));
}

console.log(JSON.stringify({ people: people.length, campers: campers.length, counselors: counselors.length, staff: staff.length }));
