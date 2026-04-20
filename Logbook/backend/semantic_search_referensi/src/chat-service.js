const { generateChatCompletion } = require("./chat-model");
const { getConfig } = require("./config");
const { retrieveDocuments, retrieveStructuredDocuments } = require("./retrieval");
const { hasStructuredDateFilter, normalizeExplicitFilters } = require("./query-filters");

function chunkArray(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function buildContext(results) {
  return results
    .map(
      (item, index) =>
        [
          `Sumber ${index + 1}`,
          `source: ${item.sourceType}`,
          `entry_no: ${item.entryNo}`,
          `date: ${item.entryDate || "-"}`,
          `subtitle: ${item.subtitle || "-"}`,
          `content: ${item.content || "-"}`
        ].join("\n")
    )
    .join("\n\n");
}

function emitProgress(onProgress, event) {
  if (typeof onProgress === "function") {
    onProgress(event);
  }
}

async function summarizeSinglePass(question, results, useStructuredRetrieval) {
  const prompt = [
    "Gunakan hanya konteks berikut untuk menjawab pertanyaan pengguna.",
    "Jika konteks tidak cukup, katakan bahwa data tidak cukup.",
    "Perhatikan filter waktu atau source_type yang diberikan oleh aplikasi.",
    useStructuredRetrieval
      ? "Konteks berikut berasal dari hasil filter terstruktur PostgreSQL, bukan hanya top-k semantic retrieval."
      : "Konteks berikut berasal dari semantic retrieval yang diperkaya detail PostgreSQL.",
    "",
    "Pertanyaan:",
    question,
    "",
    "Konteks:",
    buildContext(results),
    "",
    "Jawaban ringkas dalam Bahasa Indonesia:"
  ].join("\n");

  return generateChatCompletion(prompt);
}

async function summarizeInChunks(question, results, chunkSize, onProgress) {
  const chunks = chunkArray(results, chunkSize);
  const partialSummaries = [];

  emitProgress(onProgress, {
    type: "status",
    stage: "chunking",
    message: `Membagi ${results.length} data menjadi ${chunks.length} chunk`
  });

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    emitProgress(onProgress, {
      type: "status",
      stage: "chunk",
      message: `Merangkum chunk ${index + 1}/${chunks.length}`,
      chunkIndex: index + 1,
      chunkCount: chunks.length,
      itemCount: chunk.length
    });

    const chunkPrompt = [
      "Ringkas konteks berikut menjadi poin-poin penting yang faktual.",
      "Gunakan Bahasa Indonesia.",
      "Sertakan tanggal ketika relevan.",
      "Jangan menambah informasi di luar konteks.",
      "",
      "Pertanyaan pengguna:",
      question,
      "",
      "Konteks chunk:",
      buildContext(chunk),
      "",
      "Ringkasan chunk:"
    ].join("\n");

    const chunkSummary = await generateChatCompletion(chunkPrompt);
    partialSummaries.push(`Chunk ${index + 1}\n${chunkSummary}`);

    emitProgress(onProgress, {
      type: "status",
      stage: "chunk_done",
      message: `Chunk ${index + 1}/${chunks.length} selesai diringkas`,
      chunkIndex: index + 1,
      chunkCount: chunks.length
    });
  }

  emitProgress(onProgress, {
    type: "status",
    stage: "final_summary",
    message: "Menggabungkan seluruh ringkasan chunk"
  });

  const finalPrompt = [
    "Berdasarkan ringkasan-ringkasan chunk berikut, buat jawaban final untuk pengguna.",
    "Gunakan Bahasa Indonesia.",
    "Gabungkan informasi yang berulang.",
    "Pertahankan informasi tanggal penting.",
    "Jangan menambah informasi di luar ringkasan yang diberikan.",
    "",
    "Pertanyaan pengguna:",
    question,
    "",
    "Ringkasan chunk:",
    partialSummaries.join("\n\n"),
    "",
    "Jawaban final:"
  ].join("\n");

  return generateChatCompletion(finalPrompt);
}

async function chatWithDocuments(question, explicitFilters = {}, onProgress) {
  const config = getConfig();
  const parsed = normalizeExplicitFilters(explicitFilters);
  const useStructuredRetrieval = hasStructuredDateFilter(parsed);
  emitProgress(onProgress, {
    type: "status",
    stage: "retrieval",
    message: useStructuredRetrieval
      ? "Mengambil data terstruktur dari PostgreSQL"
      : "Mengambil konteks semantic dari Qdrant"
  });
  const results = useStructuredRetrieval
    ? await retrieveStructuredDocuments(question, config.chatStructuredLimit, explicitFilters)
    : await retrieveDocuments(question, 6, explicitFilters);

  if (results.length === 0) {
    return {
      answer: "Saya tidak menemukan data yang relevan di logbook untuk menjawab pertanyaan ini.",
      sources: []
    };
  }

  emitProgress(onProgress, {
    type: "status",
    stage: "retrieval_done",
    message: `Mengumpulkan ${results.length} sumber konteks`,
    resultCount: results.length,
    retrievalMode: useStructuredRetrieval ? "structured" : "semantic"
  });

  let answer;

  if (useStructuredRetrieval && results.length >= config.chatChunkThreshold) {
    answer = await summarizeInChunks(question, results, config.chatChunkSize, onProgress);
  } else {
    emitProgress(onProgress, {
      type: "status",
      stage: "single_summary",
      message: "Menyusun jawaban langsung dari konteks"
    });
    answer = await summarizeSinglePass(question, results, useStructuredRetrieval);
  }

  return {
    answer,
    sources: results,
    appliedFilters: parsed,
    retrievalMode: useStructuredRetrieval ? "structured" : "semantic"
  };
}

module.exports = { chatWithDocuments };
