import { useState } from "react";
import { ArrowRight, CheckCircle } from "@phosphor-icons/react";
import { login, session } from "../api";

export function LoginPage({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(code);
      session.set(data.token);
      onLoggedIn();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-copy">
        <div className="brand-lockup" aria-label="兴趣 Bingo">
          <span className="brand-rays"><i /><i /><i /></span>
          <strong>兴趣</strong><b>Bingo</b>
        </div>
        <h1>找到你的<br />同频好友</h1>
        <p>完成一条有效线路，准确率达到80%，就能进入排名。</p>
        <div className="rule-note">
          <CheckCircle size={21} weight="fill" />
          <span>正式提交后锁定，不能修改或再次提交</span>
        </div>
      </section>

      <form className="login-form" onSubmit={handleSubmit}>
        <label htmlFor="invite-code">6位活动邀请码</label>
        <input
          id="invite-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
          placeholder="请输入邀请码"
          aria-describedby={error ? "login-error" : "login-help"}
          aria-invalid={Boolean(error)}
        />
        <p id="login-help" className="field-help">邀请码由工作人员在活动开始前发放。</p>
        {error && <p id="login-error" className="field-error">{error}</p>}
        <button className="primary-button" disabled={code.length !== 6 || loading}>
          {loading ? "正在进入" : "进入游戏"}
          {!loading && <ArrowRight size={19} weight="bold" />}
        </button>
      </form>
    </main>
  );
}
