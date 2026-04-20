const { Pool } = require("pg");
const { getConfig } = require("./config");

let pool;

function buildActiveBatchEntryCondition(tableAlias) {
  return `
    (
      ${tableAlias}.import_batch_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM logbook_import_batches batch
        WHERE batch.id = ${tableAlias}.import_batch_id
          AND batch.status = 'completed'
          AND COALESCE(batch.is_active, TRUE) = TRUE
      )
    )
  `;
}

function getPostgresPool() {
  if (!pool) {
    const config = getConfig();
    pool = new Pool({
      connectionString: config.databaseUrl
    });
  }

  return pool;
}

async function fetchAllLogbookEntries() {
  const query = `
    SELECT
      'tower' AS source_type,
      id AS source_id,
      entry_no,
      entry_date,
      entry_time,
      operation_type,
      facility,
      call_sign,
      description,
      NULL::text AS equipment,
      NULL::text AS frequency_section,
      NULL::text AS incident
    FROM tower_logbook_entries
    WHERE ${buildActiveBatchEntryCondition("tower_logbook_entries")}

    UNION ALL

    SELECT
      'app' AS source_type,
      id AS source_id,
      entry_no,
      entry_date,
      entry_time,
      operation_type,
      facility,
      call_sign,
      description,
      NULL::text AS equipment,
      NULL::text AS frequency_section,
      NULL::text AS incident
    FROM app_logbook_entries
    WHERE ${buildActiveBatchEntryCondition("app_logbook_entries")}

    UNION ALL

    SELECT
      'teknik' AS source_type,
      id AS source_id,
      entry_no,
      entry_date,
      entry_time,
      NULL::text AS operation_type,
      NULL::text AS facility,
      NULL::text AS call_sign,
      NULL::text AS description,
      equipment,
      frequency_section,
      incident
    FROM teknik_logbook_entries
    WHERE ${buildActiveBatchEntryCondition("teknik_logbook_entries")}

    ORDER BY entry_date DESC, entry_time DESC
  `;

  const result = await getPostgresPool().query(query);
  return result.rows;
}

async function fetchEntriesByRefs(refs) {
  if (refs.length === 0) {
    return [];
  }

  const idsByType = refs.reduce(
    (accumulator, ref) => {
      accumulator[ref.sourceType].push(ref.sourceId);
      return accumulator;
    },
    { tower: [], app: [], teknik: [] }
  );

  const statements = [];
  const values = [];
  let parameterIndex = 1;

  const addStatement = (sourceType, tableName) => {
    const ids = idsByType[sourceType];

    if (ids.length === 0) {
      return;
    }

    values.push(ids);
    statements.push(`
      SELECT
        '${sourceType}' AS source_type,
        id AS source_id,
        entry_no,
        entry_date,
        entry_time,
        operation_type,
        facility,
        call_sign,
        description,
        NULL::text AS equipment,
        NULL::text AS frequency_section,
        NULL::text AS incident
      FROM ${tableName}
      WHERE ${buildActiveBatchEntryCondition(tableName)}
        AND id = ANY($${parameterIndex}::text[])
    `);
    parameterIndex += 1;
  };

  addStatement("tower", "tower_logbook_entries");
  addStatement("app", "app_logbook_entries");

  if (idsByType.teknik.length > 0) {
    values.push(idsByType.teknik);
    statements.push(`
      SELECT
        'teknik' AS source_type,
        id AS source_id,
        entry_no,
        entry_date,
        entry_time,
        NULL::text AS operation_type,
        NULL::text AS facility,
        NULL::text AS call_sign,
        NULL::text AS description,
        equipment,
        frequency_section,
        incident
      FROM teknik_logbook_entries
      WHERE ${buildActiveBatchEntryCondition("teknik_logbook_entries")}
        AND id = ANY($${parameterIndex}::text[])
    `);
  }

  const result = await getPostgresPool().query(statements.join("\nUNION ALL\n"), values);
  return result.rows;
}

function buildStructuredWhere(filters, values) {
  const clauses = [];

  if (filters.startDate) {
    values.push(filters.startDate);
    clauses.push(`entry_date::date >= $${values.length}::date`);
  }

  if (filters.endDate) {
    values.push(filters.endDate);
    clauses.push(`entry_date::date <= $${values.length}::date`);
  }

  if (!filters.startDate && !filters.endDate && filters.year) {
    values.push(filters.year);
    clauses.push(`EXTRACT(YEAR FROM entry_date) = $${values.length}`);
  }

  if (!filters.startDate && !filters.endDate && filters.month) {
    values.push(filters.month);
    clauses.push(`EXTRACT(MONTH FROM entry_date) = $${values.length}`);
  }

  if (!filters.startDate && !filters.endDate && filters.day) {
    values.push(filters.day);
    clauses.push(`EXTRACT(DAY FROM entry_date) = $${values.length}`);
  }

  return clauses.join(" AND ");
}

async function fetchEntriesByStructuredFilters(filters, limit = 100) {
  const values = [];
  const statements = [];
  const requestedSourceTypes = filters.sourceType
    ? [filters.sourceType]
    : ["tower", "app", "teknik"];

  const addStatement = (sourceType, statementFactory) => {
    if (!requestedSourceTypes.includes(sourceType)) {
      return;
    }

    const localValues = [];
    const structuredClause = buildStructuredWhere(filters, localValues);
    const offset = values.length;
    const rewrittenStructuredClause = structuredClause.replace(
      /\$(\d+)/g,
      (_match, index) => `$${offset + Number(index)}`
    );
    const combinedClauses = [buildActiveBatchEntryCondition(sourceType === "tower" ? "tower_logbook_entries" : sourceType === "app" ? "app_logbook_entries" : "teknik_logbook_entries")];

    if (rewrittenStructuredClause) {
      combinedClauses.push(rewrittenStructuredClause);
    }

    const whereClause = `WHERE ${combinedClauses.join(" AND ")}`;

    values.push(...localValues);
    statements.push(statementFactory(whereClause));
  };

  addStatement(
    "tower",
    (whereClause) => `
      SELECT
        'tower' AS source_type,
        id AS source_id,
        entry_no,
        entry_date,
        entry_time,
        operation_type,
        facility,
        call_sign,
        description,
        NULL::text AS equipment,
        NULL::text AS frequency_section,
        NULL::text AS incident
      FROM tower_logbook_entries
      ${whereClause}
    `
  );

  addStatement(
    "app",
    (whereClause) => `
      SELECT
        'app' AS source_type,
        id AS source_id,
        entry_no,
        entry_date,
        entry_time,
        operation_type,
        facility,
        call_sign,
        description,
        NULL::text AS equipment,
        NULL::text AS frequency_section,
        NULL::text AS incident
      FROM app_logbook_entries
      ${whereClause}
    `
  );

  addStatement(
    "teknik",
    (whereClause) => `
      SELECT
        'teknik' AS source_type,
        id AS source_id,
        entry_no,
        entry_date,
        entry_time,
        NULL::text AS operation_type,
        NULL::text AS facility,
        NULL::text AS call_sign,
        NULL::text AS description,
        equipment,
        frequency_section,
        incident
      FROM teknik_logbook_entries
      ${whereClause}
    `
  );

  if (statements.length === 0) {
    return [];
  }

  values.push(limit);
  const result = await getPostgresPool().query(
    `
      ${statements.join("\nUNION ALL\n")}
      ORDER BY entry_date ASC, entry_time ASC
      LIMIT $${values.length}
    `,
    values
  );

  return result.rows;
}

module.exports = {
  fetchAllLogbookEntries,
  fetchEntriesByRefs,
  fetchEntriesByStructuredFilters,
  getPostgresPool
};
