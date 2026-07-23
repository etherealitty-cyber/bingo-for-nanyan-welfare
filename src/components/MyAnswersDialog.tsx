import { CheckCircle, X, XCircle } from "@phosphor-icons/react";
import { topics } from "../../shared/game";
import type { OwnAnswer, Participant } from "../types";

export function MyAnswersDialog({
  participant,
  answers,
  loading,
  error,
  onClose,
}: {
  participant: Participant;
  answers: OwnAnswer[];
  loading: boolean;
  error: string;
  onClose: () => void;
}) {
  const answerByTopic = new Map(answers.map((answer) => [answer.topic_id, answer.interested]));
  const yesCount = answers.filter((answer) => answer.interested).length;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className="my-answers-dialog" role="dialog" aria-modal="true" aria-labelledby="my-answers-title">
        <header>
          <div>
            <span>仅你登录后可见</span>
            <h2 id="my-answers-title">{participant.nickname}的兴趣名片</h2>
            <p>这是系统根据最终问卷记录给出的 25 项判定，可以直接拿它和大家交流。</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭兴趣名片">
            <X size={22} />
          </button>
        </header>

        {loading && (
          <div className="my-answers-loading" aria-busy="true">
            <div className="loading-mark" aria-label="正在读取">
              <span />
              <span />
              <span />
            </div>
            <p>正在读取你的问卷判定</p>
          </div>
        )}

        {!loading && error && (
          <div className="my-answers-error">
            <strong>暂时无法读取</strong>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && answers.length > 0 && (
          <>
            <div className="my-answers-summary">
              <span><strong>{yesCount}</strong> 项有兴趣</span>
              <span><strong>{answers.length - yesCount}</strong> 项没兴趣</span>
            </div>
            <div className="my-answers-grid">
              {topics.map((topic) => {
                const interested = answerByTopic.get(topic.id);
                return (
                  <article
                    key={topic.id}
                    className={`my-answer-cell ${topic.special ? "special" : ""} ${interested ? "yes" : "no"}`}
                  >
                    <strong>{topic.label}</strong>
                    <span>
                      {interested
                        ? <CheckCircle size={19} weight="fill" />
                        : <XCircle size={19} weight="fill" />}
                      系统判定：{interested ? "是" : "否"}
                    </span>
                  </article>
                );
              })}
            </div>
            <footer>
              <span><i className="special-swatch" />蓝色格仍只能填写辅导员或工作人员</span>
              <button type="button" className="primary-button" onClick={onClose}>知道了</button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
