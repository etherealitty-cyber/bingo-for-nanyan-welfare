export type Role = "camper" | "counselor" | "staff";

export type Topic = {
  id: string;
  label: string;
  row: number;
  col: number;
  special: boolean;
  free: boolean;
};

export type Line = {
  id: string;
  label: string;
  cellIds: string[];
};

export type CellEntry = {
  yesParticipantId: string;
  noParticipantId: string;
};

export type Draft = Record<string, CellEntry>;

const labels = [
  ["王者荣耀", "林俊杰", "西北旅行", "原神", "星空摄影"],
  ["厦门旅行", "阿瓦隆", "孙燕姿", "羽毛球", "血染钟楼"],
  ["第五人格", "自然风光", "免费格", "周杰伦", "绘画"],
  ["邓紫棋", "剧本杀", "土耳其旅行", "无畏契约", "言情小说"],
  ["西藏旅行", "薇尔莉特", "猫和老鼠", "饥荒联机", "书法"],
] as const;

export const topics: Topic[] = labels.flatMap((row, rowIndex) =>
  row.map((label, colIndex) => ({
    id: `r${rowIndex + 1}c${colIndex + 1}`,
    label,
    row: rowIndex,
    col: colIndex,
    special: rowIndex + colIndex === 4 && !(rowIndex === 2 && colIndex === 2),
    free: rowIndex === 2 && colIndex === 2,
  })),
);

const rowLines: Line[] = Array.from({ length: 5 }, (_, row) => ({
  id: `row-${row + 1}`,
  label: `第 ${row + 1} 横行`,
  cellIds: topics.filter((topic) => topic.row === row).map((topic) => topic.id),
}));

const columnLines: Line[] = Array.from({ length: 5 }, (_, col) => ({
  id: `column-${col + 1}`,
  label: `第 ${col + 1} 竖列`,
  cellIds: topics.filter((topic) => topic.col === col).map((topic) => topic.id),
}));

const mainDiagonal: Line = {
  id: "diagonal-main",
  label: "左上至右下对角线",
  cellIds: topics.filter((topic) => topic.row === topic.col).map((topic) => topic.id),
};

export const validLines = [...rowLines, ...columnLines, mainDiagonal];

export const excludedLine: Line = {
  id: "diagonal-special",
  label: "蓝色特殊对角线",
  cellIds: topics.filter((topic) => topic.row + topic.col === 4).map((topic) => topic.id),
};

export function requiredCellIds(line: Line): string[] {
  return line.cellIds.filter((cellId) => !topics.find((topic) => topic.id === cellId)?.free);
}

export function completedLines(draft: Draft): Line[] {
  return validLines.filter((line) => {
    const cellIds = requiredCellIds(line);
    const entries = cellIds.map((cellId) => draft[cellId]);
    if (entries.some((entry) => !entry?.yesParticipantId || !entry?.noParticipantId)) return false;
    const participantIds = entries.flatMap((entry) => [entry.yesParticipantId, entry.noParticipantId]);
    return new Set(participantIds).size === participantIds.length;
  });
}

export function progressForLine(line: Line, draft: Draft): number {
  return requiredCellIds(line).reduce((count, cellId) => {
    const entry = draft[cellId];
    return count + Number(Boolean(entry?.yesParticipantId)) + Number(Boolean(entry?.noParticipantId));
  }, 0);
}

export function totalSlots(line: Line): number {
  return requiredCellIds(line).length * 2;
}

export function minimumCorrect(line: Line): number {
  return Math.ceil(totalSlots(line) * 0.8);
}
