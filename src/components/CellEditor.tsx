import { useMemo, useState } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import type { CellEntry, Topic } from "../../shared/game";
import type { Person } from "../types";

type Props = {
  topic: Topic;
  people: Person[];
  entry?: CellEntry;
  onSave: (entry: CellEntry) => void;
  onClose: () => void;
};

function PersonPicker({
  label,
  tone,
  value,
  people,
  excludedId,
  onChange,
}: {
  label: string;
  tone: "yes" | "no";
  value: string;
  people: Person[];
  excludedId: string;
  onChange: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => people.filter((person) =>
    person.id !== excludedId && person.nickname.toLowerCase().includes(query.trim().toLowerCase())), [people, query, excludedId]);
  const selected = people.find((person) => person.id === value);

  return (
    <div className={`person-picker ${tone}`}>
      <div className="picker-heading">
        <span>{label}</span>
        {selected && <button type="button" className="clear-choice" onClick={() => onChange("")}>清除</button>}
      </div>
      {selected ? (
        <button type="button" className="selected-person" onClick={() => onChange("")}>
          <strong>{selected.nickname}</strong>
          <small>{selected.roleLabel}</small>
        </button>
      ) : (
        <>
          <div className="search-field">
            <MagnifyingGlass size={17} />
            <input
              aria-label={`搜索${label}人员`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索昵称"
            />
          </div>
          <div className="person-options">
            {filtered.length > 0 ? filtered.map((person) => (
              <button type="button" key={person.id} onClick={() => onChange(person.id)}>
                <strong>{person.nickname}</strong>
                <small>{person.roleLabel}</small>
              </button>
            )) : <p>没有匹配的人</p>}
          </div>
        </>
      )}
    </div>
  );
}

export function CellEditor({ topic, people, entry, onSave, onClose }: Props) {
  const [yesParticipantId, setYesParticipantId] = useState(entry?.yesParticipantId ?? "");
  const [noParticipantId, setNoParticipantId] = useState(entry?.noParticipantId ?? "");
  const eligiblePeople = topic.special ? people.filter((person) => person.role !== "camper") : people;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="cell-editor" role="dialog" aria-modal="true" aria-labelledby="editor-title">
        <header>
          <div>
            <h2 id="editor-title">{topic.label}</h2>
            <p>{topic.special ? "特殊格仅可选择辅导员或工作人员" : "分别选择一位有兴趣和没兴趣的人"}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭">
            <X size={22} />
          </button>
        </header>

        <div className="picker-stack">
          <PersonPicker
            label="有兴趣"
            tone="yes"
            value={yesParticipantId}
            excludedId={noParticipantId}
            people={eligiblePeople}
            onChange={setYesParticipantId}
          />
          <PersonPicker
            label="没兴趣"
            tone="no"
            value={noParticipantId}
            excludedId={yesParticipantId}
            people={eligiblePeople}
            onChange={setNoParticipantId}
          />
        </div>

        <footer>
          <button type="button" className="secondary-button" onClick={onClose}>取消</button>
          <button
            type="button"
            className="primary-button"
            disabled={!yesParticipantId || !noParticipantId}
            onClick={() => onSave({ yesParticipantId, noParticipantId })}
          >
            保存此格
          </button>
        </footer>
      </section>
    </div>
  );
}
