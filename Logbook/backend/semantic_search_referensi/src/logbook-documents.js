const crypto = require("crypto");

function formatDate(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildEmbeddingText(entry) {
  if (entry.source_type === "teknik") {
    return [
      "teknik logbook",
      `equipment: ${entry.equipment || ""}`,
      `frequency section: ${entry.frequency_section || ""}`,
      `incident: ${entry.incident || ""}`
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    `${entry.source_type} logbook`,
    `operation type: ${entry.operation_type || ""}`,
    `facility: ${entry.facility || ""}`,
    `call sign: ${entry.call_sign || ""}`,
    `description: ${entry.description || ""}`
  ]
    .filter(Boolean)
    .join("\n");
}

function buildPayload(entry) {
  const formattedDate = formatDate(entry.entry_date);
  const date = formattedDate ? new Date(`${formattedDate}T00:00:00.000Z`) : null;

  return {
    source_type: entry.source_type,
    source_id: entry.source_id,
    entry_no: entry.entry_no,
    entry_date: formattedDate,
    entry_year: date ? date.getUTCFullYear() : null,
    entry_month: date ? date.getUTCMonth() + 1 : null,
    entry_day: date ? date.getUTCDate() : null,
    entry_date_key: date
      ? Number(
          `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`
        )
      : null,
    entry_time: entry.entry_time
  };
}

function buildPointId(entry) {
  const raw = `${entry.source_type}:${entry.source_id}`;
  const hex = crypto.createHash("sha256").update(raw).digest("hex");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `a${hex.slice(17, 20)}`,
    hex.slice(20, 32)
  ].join("-");
}

function buildResult(entry) {
  if (entry.source_type === "teknik") {
    return {
      sourceType: entry.source_type,
      sourceId: entry.source_id,
      entryNo: entry.entry_no,
      entryDate: formatDate(entry.entry_date),
      entryTime: entry.entry_time,
      title: `Teknik #${entry.entry_no} - ${entry.equipment || "Tanpa equipment"}`,
      content: entry.incident || "",
      subtitle: [entry.frequency_section, entry.entry_time].filter(Boolean).join(" | ")
    };
  }

  return {
    sourceType: entry.source_type,
    sourceId: entry.source_id,
    entryNo: entry.entry_no,
    entryDate: formatDate(entry.entry_date),
    entryTime: entry.entry_time,
    title: `${entry.source_type.toUpperCase()} #${entry.entry_no} - ${entry.operation_type || "Tanpa operasi"}`,
    content: entry.description || "",
    subtitle: [entry.facility, entry.call_sign, entry.entry_time].filter(Boolean).join(" | ")
  };
}

module.exports = { buildEmbeddingText, buildPayload, buildPointId, buildResult };
