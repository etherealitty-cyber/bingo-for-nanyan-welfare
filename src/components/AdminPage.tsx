import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle, LockKey, MinusCircle, SignOut, X, XCircle } from "@phosphor-icons/react";
import { adminLogin, adminSession, getAdminOverview, getAdminParticipantDetail } from "../api";
import { parseServerDate } from "../date";
import type { AdminAuditChoice, AdminParticipantDetail, AdminParticipantSummary } from "../types";

type Overview = Awaited<ReturnType<typeof getAdminOverview>>;

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(parseServerDate(value));
}

function roleLabel(role: string): string {
  return role === "camper" ? "营员" : role === "counselor" ? "辅导员" : "工作人员";
}

function statusLabel(status: AdminParticipantSummary["status"]): string {
  return status === "submitted" ? "已提交" : status === "draft" ? "填写中" : "未开始";
}

function AuditChoice({ label, choice }: { label: "是" | "否"; choice: AdminAuditChoice | null }) {
  const state = choice ? (choice.correct ? "correct" : "incorrect") : "missing";
  return (
    <span className={`audit-choice ${state}`}>
      <i>{label}</i>
      <b>{choice?.nickname ?? "未填写"}</b>
      {choice ? (choice.correct ? <CheckCircle weight="fill" /> : <XCircle weight="fill" />) : <MinusCircle />}
    </span>
  );
}

function ParticipantAuditDialog({
  detail,
  loading,
  error,
  onClose,
}: {
  detail: AdminParticipantDetail | null;
  loading: boolean;
  error: string;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="admin-audit-dialog" role="dialog" aria-modal="true" aria-labelledby="audit-title">
        <header>
          <div>
            <span>逐格核验</span>
            <h2 id="audit-title">{detail?.participant.nickname ?? "正在读取棋盘"}</h2>
            {detail && <p>{roleLabel(detail.participant.role)}，{statusLabel(detail.participant.status)}</p>}
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭详情"><X size={22} /></button>
        </header>

        {loading && <div className="admin-loading" aria-busy="true"><span /><span /><span /></div>}
        {error && <p className="inline-error audit-error">{error}</p>}
        {!loading && detail && (
          <>
            <div className="audit-meta">
              <span>状态<strong>{statusLabel(detail.participant.status)}</strong></span>
              <span>最后更新<strong>{detail.participant.updated_at ? formatDate(detail.participant.updated_at) : "暂无"}</strong></span>
              {detail.participant.accuracy !== null && (
                <span>正式准确率<strong>{Math.round(detail.participant.accuracy * 100)}%</strong></span>
              )}
            </div>
            <div className="admin-board-scroll">
              <div className="admin-audit-board">
                {detail.entries.map((entry) => entry.free ? (
                  <div key={entry.topic_id} className="audit-cell audit-free">
                    <small>FREE</small><strong>免费格</strong><span>已点亮</span>
                  </div>
                ) : (
                  <div key={entry.topic_id} className={`audit-cell ${entry.special ? "special" : ""}`}>
                    <strong>{entry.label}</strong>
                    <AuditChoice label="是" choice={entry.yes} />
                    <AuditChoice label="否" choice={entry.no} />
                  </div>
                ))}
              </div>
            </div>
            <footer className="audit-legend">
              <span className="correct"><CheckCircle weight="fill" />正确</span>
              <span className="incorrect"><XCircle weight="fill" />错误</span>
              <span className="missing"><MinusCircle />未填写</span>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}

function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { token } = await adminLogin(password);
      adminSession.set(token);
      onSuccess();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-login center-page">
      <form onSubmit={handleSubmit}>
        <div className="admin-lock"><LockKey size={28} weight="fill" /></div>
        <h1>活动管理后台</h1>
        <p>查看实时提交、有效成绩和排名。</p>
        <label htmlFor="admin-password">管理密码</label>
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={Boolean(error)}
        />
        {error && <p className="field-error">{error}</p>}
        <button className="primary-button" disabled={!password || loading}>{loading ? "正在登录" : "进入后台"}</button>
        <a href="/"><ArrowLeft size={17} /> 返回游戏</a>
      </form>
    </main>
  );
}

export function AdminPage() {
  const [authenticated, setAuthenticated] = useState(Boolean(adminSession.get()));
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [participantDetail, setParticipantDetail] = useState<AdminParticipantDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const refresh = useCallback(async () => {
    const token = adminSession.get();
    if (!token) return;
    try {
      setOverview(await getAdminOverview(token));
      setError("");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "后台数据读取失败";
      if (message.includes("失效")) {
        adminSession.clear();
        setAuthenticated(false);
      } else {
        setError(message);
      }
    }
  }, []);

  const refreshDetail = useCallback(async (participantId: string) => {
    const token = adminSession.get();
    if (!token) return;
    setDetailLoading(true);
    try {
      setParticipantDetail(await getAdminParticipantDetail(token, participantId));
      setDetailError("");
    } catch (caught) {
      setDetailError(caught instanceof Error ? caught.message : "棋盘详情读取失败");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    void refresh();
    const timer = window.setInterval(refresh, 10_000);
    return () => window.clearInterval(timer);
  }, [authenticated, refresh]);

  useEffect(() => {
    if (!selectedParticipantId) return;
    void refreshDetail(selectedParticipantId);
    const timer = window.setInterval(() => void refreshDetail(selectedParticipantId), 10_000);
    return () => window.clearInterval(timer);
  }, [selectedParticipantId, refreshDetail]);

  if (!authenticated) return <AdminLogin onSuccess={() => setAuthenticated(true)} />;

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <span>兴趣 Bingo</span>
          <h1>活动管理</h1>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            adminSession.clear();
            setAuthenticated(false);
          }}
        >
          <SignOut size={18} />退出
        </button>
      </header>

      {error && <p className="inline-error">{error}</p>}
      {!overview ? (
        <div className="admin-loading" aria-busy="true"><span /><span /><span /></div>
      ) : (
        <>
          <section className="stat-grid">
            <article><span>参与名单</span><strong>{overview.stats.participant_count}</strong><small>人</small></article>
            <article><span>正式提交</span><strong>{overview.stats.submission_count}</strong><small>份</small></article>
            <article><span>有效成绩</span><strong>{overview.stats.valid_count}</strong><small>份</small></article>
          </section>

          <section className="submission-panel">
            <header>
              <div><h2>参与进度</h2><p>查看每个人当前保存的棋盘，点击即可逐格核验。</p></div>
              <button type="button" className="secondary-button" onClick={refresh}>立即刷新</button>
            </header>
            <div className="table-scroll">
              <table className="participant-table">
                <thead><tr><th>昵称</th><th>身份</th><th>状态</th><th>已填写</th><th>最后更新</th><th>棋盘</th></tr></thead>
                <tbody>
                  {overview.participants.map((participant) => (
                    <tr key={participant.id}>
                      <td><strong>{participant.nickname}</strong></td>
                      <td>{roleLabel(participant.role)}</td>
                      <td><span className={`progress-status ${participant.status}`}>{statusLabel(participant.status)}</span></td>
                      <td>{participant.filled_count}/48</td>
                      <td><time>{participant.updated_at ? formatDate(participant.updated_at) : "暂无"}</time></td>
                      <td><button type="button" className="table-action" onClick={() => setSelectedParticipantId(participant.id)}>查看棋盘</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="submission-panel">
            <header>
              <div><h2>全部提交</h2><p>数据每10秒自动更新，提交后不可修改。</p></div>
            </header>
            {overview.submissions.length === 0 ? (
              <div className="empty-submissions">活动尚未收到正式提交。</div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead><tr><th>顺序</th><th>昵称</th><th>身份</th><th>线路</th><th>准确率</th><th>状态</th><th>提交时间</th></tr></thead>
                  <tbody>
                    {overview.submissions.map((submission, index) => (
                      <tr key={submission.id}>
                        <td>{index + 1}</td>
                        <td><strong>{submission.nickname}</strong></td>
                        <td>{roleLabel(submission.role)}</td>
                        <td>{submission.line_id}</td>
                        <td>{submission.correct_count}/{submission.total_count} ({Math.round(submission.accuracy * 100)}%)</td>
                        <td><span className={`status-text ${submission.valid ? "valid" : "invalid"}`}>{submission.valid ? "有效" : "未达标"}</span></td>
                        <td><time>{formatDate(submission.submitted_at)}</time></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
      {selectedParticipantId && (
        <ParticipantAuditDialog
          detail={participantDetail}
          loading={detailLoading}
          error={detailError}
          onClose={() => {
            setSelectedParticipantId(null);
            setParticipantDetail(null);
            setDetailError("");
          }}
        />
      )}
    </main>
  );
}
