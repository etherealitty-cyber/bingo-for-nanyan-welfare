PRAGMA foreign_keys = ON;

CREATE TABLE participants (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('camper', 'counselor', 'staff')),
  invite_code_hash TEXT NOT NULL UNIQUE,
  eligible_for_prize INTEGER NOT NULL DEFAULT 0 CHECK (eligible_for_prize IN (0, 1)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE answers (
  participant_id TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  interested INTEGER NOT NULL CHECK (interested IN (0, 1)),
  PRIMARY KEY (participant_id, topic_id),
  FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
);

CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL UNIQUE,
  line_id TEXT NOT NULL,
  correct_count INTEGER NOT NULL,
  total_count INTEGER NOT NULL,
  accuracy REAL NOT NULL,
  valid INTEGER NOT NULL CHECK (valid IN (0, 1)),
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE RESTRICT
);

CREATE TABLE submission_entries (
  submission_id TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  yes_participant_id TEXT NOT NULL,
  no_participant_id TEXT NOT NULL,
  yes_correct INTEGER NOT NULL CHECK (yes_correct IN (0, 1)),
  no_correct INTEGER NOT NULL CHECK (no_correct IN (0, 1)),
  PRIMARY KEY (submission_id, topic_id),
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (yes_participant_id) REFERENCES participants(id) ON DELETE RESTRICT,
  FOREIGN KEY (no_participant_id) REFERENCES participants(id) ON DELETE RESTRICT
);

CREATE INDEX idx_answers_topic ON answers(topic_id, participant_id);
CREATE INDEX idx_submissions_ranking ON submissions(valid, submitted_at);
CREATE INDEX idx_sessions_participant ON sessions(participant_id);
