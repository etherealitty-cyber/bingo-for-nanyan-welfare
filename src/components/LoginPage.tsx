import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle, ListChecks } from "@phosphor-icons/react";
import { getPublicPeople, login, session } from "../api";
import { shufflePeopleWithPinnedThird } from "../people";
import type { Person } from "../types";
import { RulesDialog } from "./RulesDialog";

export function LoginPage({ onLoggedIn, initialError = "" }: { onLoggedIn: () => void; initialError?: string }) {
  const [nickname, setNickname] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const visibleError = error || initialError;

  useEffect(() => {
    getPublicPeople()
      .then((result) => setPeople(shufflePeopleWithPinnedThird(result.people)))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "姓名名单加载失败"))
      .finally(() => setPeopleLoading(false));
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(nickname);
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

      <div className="login-actions">
        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="participant-name">选择你的姓名</label>
          <select
            id="participant-name"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            disabled={peopleLoading}
            aria-describedby={visibleError ? "login-error" : "login-help"}
            aria-invalid={Boolean(visibleError)}
          >
            <option value="">{peopleLoading ? "正在加载姓名…" : "点击选择姓名"}</option>
            {people.map((person) => (
              <option key={person.id} value={person.nickname}>
                {person.nickname} · {person.roleLabel}
              </option>
            ))}
          </select>
          <p id="login-help" className="field-help">请选择本人姓名，进入后会自动读取你的填写进度。</p>
          {visibleError && <p id="login-error" className="field-error">{visibleError}</p>}
          <button className="primary-button" disabled={!nickname || peopleLoading || loading}>
            {loading ? "正在进入" : "进入游戏"}
            {!loading && <ArrowRight size={19} weight="bold" />}
          </button>
        </form>
        <button type="button" className="login-rules-button" onClick={() => setShowRules(true)}>
          <ListChecks size={19} />
          活动前先看完整规则
        </button>
      </div>

      {showRules && <RulesDialog onClose={() => setShowRules(false)} />}
    </main>
  );
}
