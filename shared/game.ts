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
  ["《哈利波特》", "无畏契约", "玄幻小说", "诺兰导演作品", "方大同"],
  ["宠物", "羽毛球", "周杰伦", "自然风光", "油画"],
  ["舞蹈", "邓紫棋", "王者荣耀", "《十日终焉》", "西北川藏高原"],
  ["板绘", "《龙族》", "篮球", "孙燕姿", "言情小说"],
  ["林俊杰", "《紫罗兰永恒花园》", "江南水乡", "乒乓球", "摄影"],
] as const;

export const topics: Topic[] = labels.flatMap((row, rowIndex) =>
  row.map((label, colIndex) => ({
    id: `r${rowIndex + 1}c${colIndex + 1}`,
    label,
    row: rowIndex,
    col: colIndex,
    special: rowIndex === colIndex,
    free: false,
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

const secondaryDiagonal: Line = {
  id: "diagonal-secondary",
  label: "右上至左下对角线",
  cellIds: topics.filter((topic) => topic.row + topic.col === 4).map((topic) => topic.id),
};

export const validLines = [...rowLines, ...columnLines, secondaryDiagonal];

export const excludedLine: Line = {
  id: "diagonal-special",
  label: "蓝色特殊对角线",
  cellIds: topics.filter((topic) => topic.row === topic.col).map((topic) => topic.id),
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
