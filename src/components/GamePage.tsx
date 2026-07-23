import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowSquareOut, Check, IdentificationCard, LockKey, SignOut, UsersThree } from "@phosphor-icons/react";
import {
  completedLines,
  progressForLine,
  topics,
  totalSlots,
  validLines,
  type Draft,
  type Topic,
} from "../../shared/game";
import { getMyAnswers, saveDraft, session, submitGame } from "../api";
import { shufflePeopleWithPinnedThird } from "../people";
import type { LockedSubmission, OwnAnswer, Participant, Person } from "../types";
import { CellEditor } from "./CellEditor";
import { Leaderboard } from "./Leaderboard";
import { MyAnswersDialog } from "./MyAnswersDialog";
import { NanyanBrand } from "./NanyanBrand";
import { RulesDialog } from "./RulesDialog";
import { SubmitDialog } from "./SubmitDialog";

const DRAFT_KEY = "interest-bingo-draft";

function loadDraft(participantId: string, cloudDraft: Draft = {}): Draft {
  try {
    const localDraft = JSON.parse(localStorage.getItem(`${DRAFT_KEY}:${participantId}`) ?? "{}");
    return { ...cloudDraft, ...localDraft };
  } catch {
    return cloudDraft;
  }
}

function normalizeSubmission(submission: LockedSubmission): LockedSubmission {
  return {
    ...submission,
    lineId: submission.lineId ?? submission.line_id,
    correctCount: submission.correctCount ?? submission.correct_count,
    totalCount: submission.totalCount ?? submission.total_count,
    submittedAt: submission.submittedAt ?? submission.submitted_at,
  };
}

function LockedResult({ submission }: { submission: LockedSubmission }) {
  const result = normalizeSubmission(submission);
  const valid = Boolean(result.valid);
  return (
    <section className={`locked-result ${valid ? "valid" : "invalid"}`}>
      <div className="result-icon">{valid ? <Check size={28} weight="bold" /> : <LockKey size={26} weight="fill" />}</div>
      <div>
        <span>成绩已锁定</span>
        <h2>{valid ? "成绩有效" : "未达到准确率门槛"}</h2>
        <p>
          答对 {result.correctCount}/{result.totalCount} 项，准确率 {Math.round(result.accuracy * 100)}%。
          {valid ? "营员有效成绩已进入排名。" : "本次不能修改或重新提交。"}
        </p>
      </div>
    </section>
  );
}

function BoardCell({
  topic,
  draft,
  people,
  locked,
  onOpen,
}: {
  topic: Topic;
  draft: Draft;
  people: Person[];
  locked: boolean;
  onOpen: () => void;
}) {
  const entry = draft[topic.id];
  const yes = people.find((person) => person.id === entry?.yesParticipantId)?.nickname;
  const no = people.find((person) => person.id === entry?.noParticipantId)?.nickname;
  const complete = Boolean(yes && no);

  if (topic.free) {
    return (
      <div className="board-cell free-cell" aria-label="免费格，开局已点亮">
        <span>FREE</span>
        <strong>免费格</strong>
        <small>已点亮</small>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`board-cell ${topic.special ? "special-cell" : ""} ${complete ? "complete" : ""}`}
      onClick={onOpen}
      disabled={locked}
      aria-label={`${topic.label}${complete ? "，已填写" : "，未填写"}`}
    >
      <strong>{topic.label}</strong>
      <span><i>是</i><b>{yes || "待填写"}</b></span>
      <span><i>否</i><b>{no || "待填写"}</b></span>
    </button>
  );
}

export function GamePage({
  initialData,
  onLogout,
}: {
  initialData: { participant: Participant; people: Person[]; submission: LockedSubmission | null; draft?: Draft };
  onLogout: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => loadDraft(initialData.participant.id, initialData.draft));
  const [displayPeople] = useState(() => shufflePeopleWithPinnedThird(initialData.people));
  const [activeTopic, setActiveTopic] = useState<Topic | null>(null);
  const [showSubmit, setShowSubmit] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showMyAnswers, setShowMyAnswers] = useState(false);
  const [myAnswers, setMyAnswers] = useState<OwnAnswer[]>([]);
  const [myAnswersLoading, setMyAnswersLoading] = useState(false);
  const [myAnswersError, setMyAnswersError] = useState("");
  const [submission, setSubmission] = useState<LockedSubmission | null>(initialData.submission);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [draftSaveState, setDraftSaveState] = useState<"idle" | "saving" | "saved" | "offline">("idle");
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const completeLines = useMemo(() => completedLines(draft), [draft]);
  const bestLine = useMemo(() => validLines
    .map((line) => ({ line, progress: progressForLine(line, draft), total: totalSlots(line) }))
    .sort((a, b) => (b.progress / b.total) - (a.progress / a.total))[0], [draft]);

  useEffect(() => {
    if (submission || Object.keys(draft).length === 0) return;
    const token = session.get();
    if (!token) return;
    const snapshot = draft;
    const timer = window.setTimeout(() => {
      setDraftSaveState("saving");
      const task = saveQueue.current
        .catch(() => undefined)
        .then(() => saveDraft(token, snapshot));
      saveQueue.current = task;
      void task.then(
        () => setDraftSaveState("saved"),
        () => setDraftSaveState("offline"),
      );
    }, 600);
    return () => window.clearTimeout(timer);
  }, [draft, submission]);

  function saveCell(topicId: string, entry: Draft[string]) {
    const next = { ...draft, [topicId]: entry };
    setDraft(next);
    localStorage.setItem(`${DRAFT_KEY}:${initialData.participant.id}`, JSON.stringify(next));
    setDraftSaveState("saving");
    setActiveTopic(null);
  }

  async function openMyAnswers() {
    setShowMyAnswers(true);
    if (myAnswers.length === 25 || myAnswersLoading) return;
    const token = session.get();
    if (!token) {
      setMyAnswersError("登录状态已失效，请重新登录");
      return;
    }
    setMyAnswersLoading(true);
    setMyAnswersError("");
    try {
      const result = await getMyAnswers(token);
      if (result.answers.length !== topics.length) {
        throw new Error("你的问卷答案尚未配置完整，请联系工作人员");
      }
      setMyAnswers(result.answers);
    } catch (caught) {
      setMyAnswersError(caught instanceof Error ? caught.message : "读取失败，请稍后重试");
    } finally {
      setMyAnswersLoading(false);
    }
  }

  async function handleSubmit(lineId: string) {
    const token = session.get();
    if (!token) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      await saveQueue.current.catch(() => undefined);
      await saveDraft(token, draft);
      const result = await submitGame(token, lineId, draft);
      setSubmission(result.submission);
      localStorage.removeItem(`${DRAFT_KEY}:${initialData.participant.id}`);
      setShowSubmit(false);
    } catch (caught) {
      setSubmitError(caught instanceof Error ? caught.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="game-shell">
      <header className="game-header">
        <div className="header-brands">
          <div className="mini-brand"><strong>兴趣</strong><b>Bingo</b></div>
          <span className="brand-divider" aria-hidden="true" />
          <NanyanBrand compact />
        </div>
        <div className="participant-chip">
          <span>{initialData.participant.nickname}</span>
          <small>{initialData.participant.roleLabel}</small>
        </div>
        <button type="button" className="icon-button" onClick={onLogout} aria-label="退出登录">
          <SignOut size={21} />
        </button>
      </header>

      <div className="game-layout">
        <section className="board-section">
          <div className="board-intro">
            <div>
              <h1>{submission ? "你的 Bingo" : "完成一条有效线路"}</h1>
              <p>{submission ? "正式成绩已提交，棋盘不可再修改。" : "点击格子填写姓名，每格都需要填写“是”和“否”。"}</p>
              {!submission && draftSaveState !== "idle" && (
                <small className={`draft-save-state ${draftSaveState}`}>
                  {draftSaveState === "saving" && "正在保存到云端"}
                  {draftSaveState === "saved" && "已自动保存到云端"}
                  {draftSaveState === "offline" && "本机已保存，联网后将再次同步"}
                </small>
              )}
            </div>
            {!submission && bestLine && (
              <div className="progress-copy">
                <strong>{bestLine.progress}/{bestLine.total}</strong>
                <span>最近线路</span>
              </div>
            )}
          </div>

          {submission && <LockedResult submission={submission} />}

          <section className="my-answer-banner">
            <div className="my-answer-banner-icon"><IdentificationCard size={26} weight="duotone" /></div>
            <div>
              <strong>看看系统如何判定你</strong>
              <span>打开自己的 25 项“是 / 否”，交流时更方便。</span>
            </div>
            <button type="button" className="secondary-button" onClick={openMyAnswers}>
              查看我的兴趣名片
            </button>
          </section>

          <div className={`bingo-board ${submission ? "locked" : ""}`}>
            {topics.map((topic) => (
              <BoardCell
                key={topic.id}
                topic={topic}
                draft={draft}
                people={displayPeople}
                locked={Boolean(submission)}
                onOpen={() => setActiveTopic(topic)}
              />
            ))}
          </div>

          <div className="board-legend">
            <span><i className="ordinary-swatch" />普通格</span>
            <span><i className="special-swatch" />特殊格，仅限辅导员或工作人员</span>
          </div>

          {!submission && (
            <div className="submit-bar">
              <div>
                {completeLines.length > 0 ? (
                  <><strong>已完成 {completeLines.length} 条有效线路</strong><span>提交后将永久锁定</span></>
                ) : (
                  <><strong>继续寻找同频好友</strong><span>完整且不重复的线路才能提交</span></>
                )}
              </div>
              <button
                type="button"
                className="primary-button"
                disabled={completeLines.length === 0}
                onClick={() => setShowSubmit(true)}
              >
                <LockKey size={18} weight="fill" />
                正式提交
              </button>
            </div>
          )}
        </section>

        <aside className="game-sidebar">
          <section className="quick-rules">
            <header><UsersThree size={23} /><h2>规则提醒</h2></header>
            <ul>
              <li>每格分别填写一位“有兴趣”和“没兴趣”的人。</li>
              <li>同一条参赛线路中，同一个人最多出现一次。</li>
              <li>左上至右下的蓝色对角线不计成绩，其他线路均可参与。</li>
              <li>提交后不能修改，准确率达到80%才有效。</li>
            </ul>
            <button type="button" className="text-button" onClick={() => setShowRules(true)}>查看完整规则 <ArrowSquareOut size={16} /></button>
          </section>
          <Leaderboard compact />
        </aside>
      </div>

      {activeTopic && (
        <CellEditor
          topic={activeTopic}
          people={displayPeople}
          entry={draft[activeTopic.id]}
          onSave={(entry) => saveCell(activeTopic.id, entry)}
          onClose={() => setActiveTopic(null)}
        />
      )}
      {showSubmit && (
        <SubmitDialog
          lines={completeLines}
          submitting={submitting}
          error={submitError}
          onClose={() => !submitting && setShowSubmit(false)}
          onSubmit={handleSubmit}
        />
      )}
      {showRules && <RulesDialog onClose={() => setShowRules(false)} />}
      {showMyAnswers && (
        <MyAnswersDialog
          participant={initialData.participant}
          answers={myAnswers}
          loading={myAnswersLoading}
          error={myAnswersError}
          onClose={() => setShowMyAnswers(false)}
        />
      )}
    </main>
  );
}
