const { retrieveDocuments } = require("./retrieval");

async function searchDocuments(query) {
  return retrieveDocuments(query, 5);
}

module.exports = { searchDocuments };
