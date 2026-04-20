const { QdrantClient } = require("@qdrant/js-client-rest");
const { getConfig } = require("./config");

let client;

function getQdrantClient() {
  if (!client) {
    const config = getConfig();
    client = new QdrantClient({
      url: config.qdrantUrl,
      apiKey: config.qdrantApiKey
    });
  }

  return client;
}

async function ensureCollection(vectorSize) {
  const config = getConfig();
  const qdrant = getQdrantClient();

  try {
    await qdrant.getCollection(config.qdrantCollection);
  } catch (_error) {
    await qdrant.createCollection(config.qdrantCollection, {
      vectors: {
        size: vectorSize,
        distance: "Cosine"
      }
    });
  }
}

async function resetCollection() {
  const config = getConfig();
  const qdrant = getQdrantClient();

  try {
    await qdrant.deleteCollection(config.qdrantCollection);
  } catch (error) {
    const collectionMissing =
      error?.status === 404 ||
      error?.data?.status?.error?.toLowerCase?.().includes("not found");

    if (!collectionMissing) {
      throw error;
    }
  }
}

module.exports = { ensureCollection, getQdrantClient, resetCollection };
