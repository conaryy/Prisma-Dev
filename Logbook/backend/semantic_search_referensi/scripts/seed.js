require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { createEmbedding } = require("../src/embedding");
const { getConfig } = require("../src/config");
const { buildEmbeddingText, buildPayload, buildPointId } = require("../src/logbook-documents");
const { fetchAllLogbookEntries } = require("../src/postgres");
const { ensureCollection, getQdrantClient, resetCollection } = require("../src/qdrant");

const BATCH_SIZE = Number(process.env.SEED_BATCH_SIZE || 10);
const LOG_EVERY = Number(process.env.SEED_LOG_EVERY || 5);
const FLUSH_RETRIES = Number(process.env.SEED_FLUSH_RETRIES || 5);
const STATE_FILE = process.env.SEED_STATE_FILE || path.join(__dirname, "..", ".seed-state.json");
const STATE_VERSION = "4";
const FULL_REINDEX =
  process.argv.includes("--full-reindex") ||
  process.env.SEED_FULL_REINDEX === "1" ||
  (process.env.SEED_FULL_REINDEX || "").toLowerCase() === "true";

function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function getEmbeddingModelLabel(config) {
  if (config.embeddingProvider === "ollama") {
    return `${config.embeddingProvider}:${config.ollamaEmbeddingModel}`;
  }

  return `${config.embeddingProvider}:${config.geminiEmbeddingModel}`;
}

function getStateFingerprint(config) {
  return `${STATE_VERSION}|${config.qdrantCollection}|${getEmbeddingModelLabel(config)}`;
}

function loadState(config) {
  if (!fs.existsSync(STATE_FILE)) {
    return {
      fingerprint: getStateFingerprint(config),
      completedIds: []
    };
  }

  const raw = fs.readFileSync(STATE_FILE, "utf8");
  const parsed = JSON.parse(raw);

  if (parsed.fingerprint !== getStateFingerprint(config)) {
    return {
      fingerprint: getStateFingerprint(config),
      completedIds: []
    };
  }

  return {
    fingerprint: parsed.fingerprint,
    completedIds: Array.isArray(parsed.completedIds) ? parsed.completedIds : []
  };
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function clearStateFile() {
  if (fs.existsSync(STATE_FILE)) {
    fs.unlinkSync(STATE_FILE);
  }
}

function isRetryableQdrantError(error) {
  return (
    error?.cause?.code === "UND_ERR_SOCKET" ||
    error?.message === "fetch failed" ||
    error?.cause?.message === "fetch failed"
  );
}

async function flushPoints(qdrant, collectionName, points, counters, state) {
  if (points.length === 0) {
    return;
  }

  let lastError;

  for (let attempt = 1; attempt <= FLUSH_RETRIES; attempt += 1) {
    try {
      await qdrant.upsert(collectionName, {
        wait: true,
        points
      });
      lastError = null;
      break;
    } catch (error) {
      lastError = error;

      if (!isRetryableQdrantError(error) || attempt === FLUSH_RETRIES) {
        throw error;
      }

      const backoffMs = attempt * 2000;
      console.log(
        `[seed] flush failed on attempt ${attempt}/${FLUSH_RETRIES}, retrying in ${formatDuration(backoffMs)}`
      );
      await sleep(backoffMs);
    }
  }

  if (lastError) {
    throw lastError;
  }

  counters.flushed += points.length;
  state.completedIds.push(...points.map((point) => point.id));
  saveState(state);
  console.log(
    `[seed] flushed ${points.length} points to Qdrant (${counters.flushed} total written)`
  );
  points.length = 0;
}

async function main() {
  const config = getConfig();
  const qdrant = getQdrantClient();

  if (FULL_REINDEX) {
    console.log(`[seed] full reindex enabled, clearing collection "${config.qdrantCollection}"`);
    await resetCollection();
    clearStateFile();
  }

  const state = loadState(config);
  const completedIdSet = new Set(state.completedIds);
  const allDocuments = await fetchAllLogbookEntries();
  const indexedDocuments = allDocuments.map((document) => ({
    ...document,
    pointId: buildPointId(document)
  }));
  const documents = indexedDocuments.filter((document) => !completedIdSet.has(document.pointId));

  if (allDocuments.length === 0) {
    throw new Error("No logbook entries found in PostgreSQL.");
  }

  const startedAt = Date.now();
  const points = [];
  const counters = {
    processed: 0,
    flushed: 0
  };

  console.log(`[seed] fetched ${allDocuments.length} logbook entries from PostgreSQL`);
  console.log(`[seed] resume state contains ${completedIdSet.size} completed entries`);
  console.log(`[seed] mode: ${FULL_REINDEX ? "full-reindex" : "resume-aware-upsert"}`);

  if (documents.length === 0) {
    console.log("[seed] nothing to do, all entries are already indexed according to local checkpoint");
    return;
  }

  console.log(`[seed] processing ${documents.length} remaining entries`);

  for (const document of documents) {
    const textToEmbed = buildEmbeddingText(document);
    const vector = await createEmbedding(textToEmbed);

    if (counters.processed === 0) {
      await ensureCollection(vector.length);
      console.log(
        `[seed] collection "${config.qdrantCollection}" is ready with vector size ${vector.length}`
      );
    }

    points.push({
      id: document.pointId,
      vector,
      payload: buildPayload(document)
    });

    counters.processed += 1;

    if (counters.processed % LOG_EVERY === 0 || counters.processed === documents.length) {
      const elapsed = Date.now() - startedAt;
      const averageMs = elapsed / counters.processed;
      const remaining = documents.length - counters.processed;
      const eta = averageMs * remaining;

      console.log(
        `[seed] processed ${counters.processed}/${documents.length} entries | avg ${averageMs.toFixed(0)}ms/entry | ETA ${formatDuration(eta)}`
      );
    }

    if (points.length >= BATCH_SIZE) {
      await flushPoints(qdrant, config.qdrantCollection, points, counters, state);
    }
  }

  await flushPoints(qdrant, config.qdrantCollection, points, counters, state);

  console.log(
    `[seed] completed. Indexed ${counters.processed} logbook entries from PostgreSQL in ${formatDuration(Date.now() - startedAt)}`
  );
}

main().catch((error) => {
  if (error?.data?.status?.error) {
    console.error("Seed failed:", error.data.status.error);
    process.exit(1);
  }

  console.error("Seed failed:", error);
  process.exit(1);
});
