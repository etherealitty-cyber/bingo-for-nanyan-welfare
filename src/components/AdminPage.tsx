import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, LockKey, SignOut } from "@phosphor-icons/react";
import { adminLogin, adminSession, getAdminOverview } from "../api";
import { parseServerDate } from "../date";

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

  useEffect(() => {
    if (!authenticated) return;
    void refresh();
    const timer = window.setInterval(refresh, 10_000);
    return () => window.clearInterval(timer);
  }, [authenticated, refresh]);

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
              <div><h2>全部提交</h2><p>数据每10秒自动更新，提交后不可修改。</p></div>
              <button type="button" className="secondary-button" onClick={refresh}>立即刷新</button>
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
                        <td>{submission.role === "camper" ? "营员" : submission.role === "counselor" ? "辅导员" : "工作人员"}</td>
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
    </main>
  );
}
