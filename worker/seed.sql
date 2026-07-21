-- Demo invite codes are 100001-100012. These rows are only for local development.
INSERT OR REPLACE INTO participants (id, nickname, role, invite_code_hash, eligible_for_prize) VALUES
('p01', '小满', 'camper', '97c489b6c1231ecd9fac99df40e60cec000a70a057d5971fb520c578da8e8841', 1),
('p02', '阿野', 'camper', '3fb836229505c02d85ef0286b0c93213db710766d841f00d91db5edaeade136b', 1),
('p03', '南星', 'camper', '24eb33c5f8f98314500b1c7f3fe403413c3b3fe0e4ae8ac5cc464dd2b686802c', 1),
('p04', '木棉', 'camper', '9d186a0f4729551607e18c9ba595d564321d5a0df721dc0bf85a88850c69b4d3', 1),
('p05', '青禾', 'camper', 'cf488acc4d95a725831a0162ff06023768b3dd2774ebecc78158fb3ccc87b64c', 1),
('p06', '一川', 'camper', '0a3e4e8d8e78dbb2dd0a0297243aedef9f8b01e52113945e8b2516ade2e3fca9', 1),
('p07', '迟雨', 'camper', 'a9b75b2f327ec0df12c834a62d22c54ea6e41d12437eb556126f8a786e2a53c7', 1),
('p08', '松塔', 'camper', 'c6197a851ecbf99d15dcd787999bdf3b0f3a5d6b0ac74742839305c74bdff8f4', 1),
('p09', '麦冬', 'counselor', '39f6d4d95349109bc7568494f6bdba6834222376db1b98034cb194c66a9369cd', 0),
('p10', '山竹', 'counselor', 'a9788e889e31fccc4651902adb05d2f8c4bcc1845694d91202e72716ebe9a4a0', 0),
('p11', '白榆', 'staff', '8162e509861bf0b9ccdb512d6abb780ed03beacb777c62b761562a9c2458de5d', 0),
('p12', '知夏', 'staff', '92eed7da0290ed8950c106c08c30b86b42975c23a95acfba509d3088818566d4', 0);

-- Generate deterministic demo answers. Real answers must be imported after the survey closes.
WITH topics(topic_id) AS (VALUES
  ('r1c1'), ('r1c2'), ('r1c3'), ('r1c4'), ('r1c5'),
  ('r2c1'), ('r2c2'), ('r2c3'), ('r2c4'), ('r2c5'),
  ('r3c1'), ('r3c2'), ('r3c4'), ('r3c5'),
  ('r4c1'), ('r4c2'), ('r4c3'), ('r4c4'), ('r4c5'),
  ('r5c1'), ('r5c2'), ('r5c3'), ('r5c4'), ('r5c5')
)
INSERT OR REPLACE INTO answers (participant_id, topic_id, interested)
SELECT p.id, t.topic_id,
  ((CAST(substr(p.id, 2) AS INTEGER) + CAST(substr(t.topic_id, 2, 1) AS INTEGER) + CAST(substr(t.topic_id, 4, 1) AS INTEGER)) % 2)
FROM participants p CROSS JOIN topics t;
