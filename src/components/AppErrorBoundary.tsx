import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("页面渲染失败", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="center-page fatal-error">
        <section>
          <span>兴趣 Bingo</span>
          <h1>页面显示遇到问题</h1>
          <p>请刷新页面重试。若仍然出现，请把下方信息发给管理员。</p>
          <code>{this.state.error.message}</code>
          <button type="button" className="primary-button" onClick={() => window.location.reload()}>
            刷新页面
          </button>
        </section>
      </main>
    );
  }
}
