import { useState } from "react";
import { CheckCircle, X, XCircle } from "@phosphor-icons/react";
import { topics } from "../../shared/game";
import type { OwnAnswer, Participant } from "../types";

export function MyAnswersDialog({
  participant,
  answers,
  loading,
  error,
  updatingTopicId,
  updateError,
  onUpdate,
  onClose,
}: {
  participant: Participant;
  answers: OwnAnswer[];
  loading: boolean;
  error: string;
  updatingTopicId: string | null;
  updateError: string;
  onUpdate: (topicId: string, interested: boolean) => Promise<void>;
  onClose: () => void;
}) {
  const [confirmTopicId, setConfirmTopicId] = useState<string | null>(null);
  const answerByTopic = new Map(answers.map((answer) => [answer.topic_id, answer]));
  const yesCount = answers.filter((answer) => answer.interested).length;

  async function confirmUpdate(topicId: string, interested: boolean) {
    try {
      await onUpdate(topicId, interested);
      setConfirmTopicId(null);
    } catch {
      // The parent displays the server error and keeps this confirmation open for retry.
    }
  }

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
            <p>每个兴趣格可以自行修改一次。修改后会作为新的正式判定，并影响相关提交的正确率。</p>
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
                const answer = answerByTopic.get(topic.id);
                const interested = Boolean(answer?.interested);
                const editUsed = Boolean(answer?.self_edit_used);
                const confirming = confirmTopicId === topic.id;
                const updating = updatingTopicId === topic.id;
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
                    <div className="my-answer-edit">
                      {editUsed ? (
                        <small>本格修改机会已使用</small>
                      ) : confirming ? (
                        <>
                          <small>确认后本格不能再次修改</small>
                          <div>
                            <button
                              type="button"
                              disabled={updating}
                              onClick={() => setConfirmTopicId(null)}
                            >
                              取消
                            </button>
                            <button
                              type="button"
                              className="confirm"
                              disabled={updating}
                              onClick={() => void confirmUpdate(topic.id, !interested)}
                            >
                              {updating ? "保存中" : `确认改为${interested ? "否" : "是"}`}
                            </button>
                          </div>
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={updatingTopicId !== null}
                          onClick={() => setConfirmTopicId(topic.id)}
                        >
                          改为{interested ? "否" : "是"}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
            {updateError && <p className="my-answer-update-error" role="alert">{updateError}</p>}
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
