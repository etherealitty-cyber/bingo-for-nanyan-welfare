import { useState } from "react";
import { LockKey, X } from "@phosphor-icons/react";
import { minimumCorrect, totalSlots, type Line } from "../../shared/game";

export function SubmitDialog({
  lines,
  submitting,
  error,
  onClose,
  onSubmit,
}: {
  lines: Line[];
  submitting: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (lineId: string) => void;
}) {
  const [selectedLineId, setSelectedLineId] = useState(lines[0]?.id ?? "");
  const selectedLine = lines.find((line) => line.id === selectedLineId);

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="submit-dialog" role="dialog" aria-modal="true" aria-labelledby="submit-title">
        <header>
          <div className="lock-badge"><LockKey size={23} weight="fill" /></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭" disabled={submitting}>
            <X size={22} />
          </button>
        </header>
        <h2 id="submit-title">确认正式提交</h2>
        <p>提交后所有填写内容永久锁定。即使准确率不足80%，也不能修改或再次提交。</p>

        <fieldset>
          <legend>选择参赛线路</legend>
          {lines.map((line) => (
            <label key={line.id} className={selectedLineId === line.id ? "selected" : ""}>
              <input
                type="radio"
                name="line"
                value={line.id}
                checked={selectedLineId === line.id}
                onChange={() => setSelectedLineId(line.id)}
              />
              <span>
                <strong>{line.label}</strong>
                <small>{totalSlots(line)}项中至少答对{minimumCorrect(line)}项</small>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="submit-warning">请在提交前最后检查姓名和“有兴趣／没兴趣”是否填反。</div>
        {error && <p className="field-error">{error}</p>}
        <footer>
          <button type="button" className="secondary-button" onClick={onClose} disabled={submitting}>返回检查</button>
          <button
            type="button"
            className="danger-button"
            disabled={!selectedLine || submitting}
            onClick={() => onSubmit(selectedLineId)}
          >
            {submitting ? "正在锁定" : "确认并锁定"}
          </button>
        </footer>
      </section>
    </div>
  );
}
