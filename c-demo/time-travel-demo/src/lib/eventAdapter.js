const VALID_TONES = new Set(["error", "success"]);

function normalizeText(value, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }

  const text = value.trim();
  return text || fallback;
}

export function normalizeEventOption(option, index) {
  const text = normalizeText(
    option?.text,
    `未命名选项 ${index + 1}`,
  );
  const result = normalizeText(option?.result, "系统尚未生成结果文本。");
  const tone = VALID_TONES.has(option?.tone) ? option.tone : null;

  return {
    text,
    result,
    ...(tone ? { tone } : {}),
  };
}

export function toSystemModalProps(event) {
  const title = normalizeText(event?.title, "系统提示");
  const content = normalizeText(
    event?.rpgContext ?? event?.content,
    "系统暂未收到该历史节点的情境数据。",
  );
  const options = Array.isArray(event?.options)
    ? event.options.map(normalizeEventOption)
    : [];

  return { title, content, options };
}

export function findEventById(dynasties, eventId) {
  if (!Array.isArray(dynasties)) {
    return null;
  }

  for (const dynasty of dynasties) {
    const event = dynasty?.events?.find(
      (candidate) => candidate?.id === eventId,
    );

    if (event) {
      return event;
    }
  }

  return null;
}
