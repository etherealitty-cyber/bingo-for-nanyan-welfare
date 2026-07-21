import { useEffect, useState } from "react";
import { AdminPage } from "./components/AdminPage";
import { GamePage } from "./components/GamePage";
import { LoginPage } from "./components/LoginPage";
import { getGame, session } from "./api";
import type { LockedSubmission, Participant, Person } from "./types";

type GameData = {
  participant: Participant;
  people: Person[];
  submission: LockedSubmission | null;
};

export function App() {
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(Boolean(session.get()));

  useEffect(() => {
    const token = session.get();
    if (!token) return;
    getGame(token)
      .then(setGameData)
      .catch(() => session.clear())
      .finally(() => setLoading(false));
  }, []);

  const isAdmin = window.location.pathname.startsWith("/admin")
    || new URLSearchParams(window.location.search).has("admin");
  if (isAdmin) return <AdminPage />;

  if (loading) {
    return (
      <main className="center-page" aria-busy="true">
        <div className="loading-mark" aria-label="正在载入">
          <span />
          <span />
          <span />
        </div>
      </main>
    );
  }

  if (!gameData) {
    return <LoginPage onLoggedIn={() => {
      const token = session.get();
      if (!token) return;
      setLoading(true);
      getGame(token)
        .then(setGameData)
        .catch(() => session.clear())
        .finally(() => setLoading(false));
    }} />;
  }

  return (
    <GamePage
      initialData={gameData}
      onLogout={() => {
        session.clear();
        setGameData(null);
      }}
    />
  );
}
