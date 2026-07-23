import { CheckCircle, X, XCircle } from "@phosphor-icons/react";
import { useState } from "react";
import { topics } from "../../shared/game";
import type { AnswerDirectoryEntry, AnswerDirectoryPerson } from "../types";

function PersonChip({ person }: { person: AnswerDirectoryPerson }) {
  const roleMark = person.role === "counselor" ? "辅" : person.role === "staff" ? "工" : "";
  return (
    <span className={person.role === "camper" ? "" : "support-person"}>
      {person.nickname}
      {roleMark && <small>{roleMark}</small>}
    </span>
  );
}

export function AnswerDirectoryDialog({
  entries,
  initialTopicId,
  loading,
  error,
  onClose,
}: {
  entries: AnswerDirectoryEntry[];
  initialTopicId: string;
  loading: boolean;
  error: string;
  onClose: () => void;
}) {
  const [activeTopicId, setActiveTopicId] = useState(initialTopicId);
  const activeTopic = topics.find((topic) => topic.id === activeTopicId) ?? topics[0];
  const entry = entries.find((item) => item.topic_id === activeTopic.id);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="answer-directory-dialog" role="dialog" aria-modal="true" aria-labelledby="answer-directory-title">
        <header>
          <div>
            <span>正式提交后解锁</span>
            <h2 id="answer-directory-title">完整答案册</h2>
            <p>选择任意格子，查看所有人的最终“是 / 否”判定。</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭完整答案册"><X size={22} /></button>
        </header>

        {loading && <div className="admin-loading" aria-busy="true"><span /><span /><span /></div>}
        {!loading && error && <div className="my-answers-error"><strong>暂时无法读取</strong><p>{error}</p></div>}
        {!loading && !error && entries.length > 0 && (
          <>
            <nav className="answer-directory-topics" aria-label="选择兴趣格子">
              {topics.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  className={`${topic.special ? "special" : ""} ${topic.id === activeTopic.id ? "active" : ""}`}
                  aria-pressed={topic.id === activeTopic.id}
                  onClick={() => setActiveTopicId(topic.id)}
                >
                  {topic.label}
                </button>
              ))}
            </nav>

            <div className="answer-directory-detail">
              <div className="answer-directory-heading">
                <div>
                  <span>{activeTopic.special ? "蓝色特殊格" : "普通格"}</span>
                  <h3>{activeTopic.label}</h3>
                </div>
                <p>共 {entry?.yes.length ?? 0} 人回答“是”，{entry?.no.length ?? 0} 人回答“否”</p>
              </div>
              {activeTopic.special && <p className="directory-note">蓝色格实际填写时，仍只能选择辅导员或工作人员。</p>}
              <div className="answer-directory-columns">
                <section className="directory-yes">
                  <h4><CheckCircle size={18} weight="fill" />是</h4>
                  <div>{entry?.yes.map((person) => <PersonChip key={person.id} person={person} />)}</div>
                </section>
                <section className="directory-no">
                  <h4><XCircle size={18} weight="fill" />否</h4>
                  <div>{entry?.no.map((person) => <PersonChip key={person.id} person={person} />)}</div>
                </section>
              </div>
            </div>
            <footer>
              <span>“辅”和“工”分别表示辅导员与工作人员</span>
              <button type="button" className="primary-button" onClick={onClose}>关闭答案册</button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
