import { useEffect, useState } from "react";
import { getLeaderboard } from "../api";
import { parseServerDate } from "../date";
import type { Ranking } from "../types";

function timeLabel(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(parseServerDate(value));
}

export function Leaderboard({ compact = false }: { compact?: boolean }) {
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const data = await getLeaderboard();
        if (active) {
          setRankings(data.rankings);
          setError("");
        }
      } catch {
        if (active) setError("排名暂时无法更新");
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, 10_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <section className={`leaderboard ${compact ? "compact" : ""}`}>
      <header>
        <h2>实时排名</h2>
        <span>每10秒更新</span>
      </header>
      {error && <p className="inline-error">{error}</p>}
      {!error && rankings.length === 0 && <p className="empty-ranking">还没有有效成绩，第一名等你来。</p>}
      <ol>
        {rankings.map((item) => (
          <li key={`${item.nickname}-${item.submitted_at}`} className={item.rank <= 3 ? "winner" : ""}>
            <b>{item.rank}</b>
            <strong>{item.nickname}</strong>
            <span>{Math.round(item.accuracy * 100)}%</span>
            <time>{timeLabel(item.submitted_at)}</time>
          </li>
        ))}
      </ol>
    </section>
  );
}
