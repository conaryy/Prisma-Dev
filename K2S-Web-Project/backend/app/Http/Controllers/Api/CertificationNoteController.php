<?php

namespace App\Http\Controllers\Api;

use App\Models\CertificationNoteRow;
use App\Models\CertificationNoteTable;
use App\Models\Instansi;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use PhpOffice\PhpWord\IOFactory;
use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\Settings;
use PhpOffice\PhpWord\SimpleType\Jc;
use PhpOffice\PhpWord\SimpleType\JcTable;
use PhpOffice\PhpWord\SimpleType\VerticalJc;

class CertificationNoteController extends ApiController
{
    private const MAX_EVIDENCE_FILE_SIZE_KB = 20480;

    private const LOCATIONS = [
        'surabaya' => [
            'label' => 'Surabaya',
            'office_label' => 'Perum LPPNPI Cabang Surabaya',
        ],
        'sumenep' => [
            'label' => 'Sumenep',
            'office_label' => 'Perum LPPNPI Cabang Pembantu Sumenep',
        ],
        'banyuwangi' => [
            'label' => 'Banyuwangi',
            'office_label' => 'Perum LPPNPI Cabang Pembantu Banyuwangi',
        ],
        'malang' => [
            'label' => 'Malang',
            'office_label' => 'Perum LPPNPI Cabang Pembantu Malang',
        ],
        'kediri' => [
            'label' => 'Kediri',
            'office_label' => 'Perum LPPNPI Cabang Pembantu Kediri',
        ],
        'blora' => [
            'label' => 'Blora',
            'office_label' => 'Perum LPPNPI Cabang Pembantu Blora',
        ],
        'jember' => [
            'label' => 'Jember',
            'office_label' => 'Perum LPPNPI Cabang Pembantu Jember',
        ],
        'bawean' => [
            'label' => 'Bawean',
            'office_label' => 'Perum LPPNPI Cabang Pembantu Bawean',
        ],
    ];

    public function index(Request $request, string $locationSlug)
    {
        $location = $this->resolveLocationPayload($locationSlug);
        if (!$location) {
            return response()->json(['error' => 'Lokasi catatan sertifikasi tidak valid.'], 404);
        }

        $instansiId = $this->resolveInstansiId($request);
        if (!$instansiId) {
            return $this->respondData([
                'location' => $location,
                'tables' => [],
            ]);
        }

        $tables = CertificationNoteTable::query()
            ->where('instansi_id', $instansiId)
            ->where('location_slug', $locationSlug)
            ->with('rows')
            ->orderBy('sort_order')
            ->get()
            ->map(fn (CertificationNoteTable $table) => $this->serializeTable($table));

        return $this->respondData([
            'location' => $location,
            'tables' => $tables,
        ]);
    }

    public function storeTable(Request $request, string $locationSlug)
    {
        $location = $this->resolveLocationPayload($locationSlug);
        if (!$location) {
            return response()->json(['error' => 'Lokasi catatan sertifikasi tidak valid.'], 404);
        }

        $instansiId = $this->resolveInstansiId($request, true);
        $nextOrder = (int) CertificationNoteTable::query()
            ->where('instansi_id', $instansiId)
            ->where('location_slug', $locationSlug)
            ->max('sort_order');
        $nextOrder++;

        $table = CertificationNoteTable::create([
            'instansi_id' => $instansiId,
            'location_slug' => $locationSlug,
            'title' => 'Tabel ' . $nextOrder,
            'sort_order' => $nextOrder,
        ]);

        CertificationNoteRow::create([
            'certification_note_table_id' => $table->id,
            'sort_order' => 1,
            'progress' => 0,
        ]);

        return $this->respondData($this->serializeTable($table->fresh('rows')), 201);
    }

    public function updateTable(Request $request, CertificationNoteTable $table)
    {
        if ($response = $this->authorizeTable($request, $table)) {
            return $response;
        }

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
        ]);

        $table->fill([
            'title' => trim($validated['title']) !== '' ? trim($validated['title']) : 'Tabel',
        ])->save();

        return $this->respondData($this->serializeTable($table->fresh('rows')));
    }

    public function destroyTable(Request $request, CertificationNoteTable $table)
    {
        if ($response = $this->authorizeTable($request, $table)) {
            return $response;
        }

        $table->loadMissing('rows');
        foreach ($table->rows as $row) {
            $this->deleteEvidenceFiles($this->normalizeEvidenceFiles($row));
        }

        $table->delete();

        return $this->respondData(['success' => true]);
    }

    public function storeRow(Request $request, CertificationNoteTable $table)
    {
        if ($response = $this->authorizeTable($request, $table)) {
            return $response;
        }

        $validated = $request->validate([
            'note' => ['nullable', 'string'],
            'actionOffice' => ['nullable', 'string'],
            'progress' => ['nullable', 'integer', 'in:0,25,50,75,100'],
            'files' => ['nullable', 'array', 'max:20'],
            'files.*' => ['file', 'max:' . self::MAX_EVIDENCE_FILE_SIZE_KB, 'mimes:pdf,png,jpg,jpeg,doc,docx,xls,xlsx'],
        ], $this->evidenceValidationMessages());

        $nextOrder = (int) CertificationNoteRow::query()
            ->where('certification_note_table_id', $table->id)
            ->max('sort_order');
        $nextOrder++;

        $row = CertificationNoteRow::create([
            'certification_note_table_id' => $table->id,
            'sort_order' => $nextOrder,
            'note' => $this->normalizeNullableText($validated['note'] ?? null),
            'action_office' => $this->normalizeNullableText($validated['actionOffice'] ?? null),
            'progress' => $validated['progress'] ?? 0,
            'evidence_files' => $this->storeEvidenceFiles($validated['files'] ?? []),
        ]);

        return $this->respondData($this->serializeRow($row), 201);
    }

    public function updateRow(Request $request, CertificationNoteTable $table, CertificationNoteRow $row)
    {
        if ($response = $this->authorizeRow($request, $table, $row)) {
            return $response;
        }

        $validated = $request->validate([
            'note' => ['sometimes', 'nullable', 'string'],
            'actionOffice' => ['sometimes', 'nullable', 'string'],
            'progress' => ['sometimes', 'integer', 'in:0,25,50,75,100'],
            'files' => ['nullable', 'array', 'max:20'],
            'files.*' => ['file', 'max:' . self::MAX_EVIDENCE_FILE_SIZE_KB, 'mimes:pdf,png,jpg,jpeg,doc,docx,xls,xlsx'],
        ], $this->evidenceValidationMessages());

        $payload = [];
        if (array_key_exists('note', $validated)) {
            $payload['note'] = $this->normalizeNullableText($validated['note']);
        }
        if (array_key_exists('actionOffice', $validated)) {
            $payload['action_office'] = $this->normalizeNullableText($validated['actionOffice']);
        }
        if (array_key_exists('progress', $validated)) {
            $payload['progress'] = $validated['progress'];
        }

        $newFiles = $this->storeEvidenceFiles($validated['files'] ?? []);
        if ($newFiles !== []) {
            $payload['evidence_files'] = array_merge($this->normalizeEvidenceFiles($row), $newFiles);
        }

        $row->fill($payload)->save();

        return $this->respondData($this->serializeRow($row->fresh()));
    }

    public function destroyRow(Request $request, CertificationNoteTable $table, CertificationNoteRow $row)
    {
        if ($response = $this->authorizeRow($request, $table, $row)) {
            return $response;
        }

        $this->deleteEvidenceFiles($this->normalizeEvidenceFiles($row));
        $row->delete();

        return $this->respondData(['success' => true]);
    }

    public function destroyEvidenceFile(
        Request $request,
        CertificationNoteTable $table,
        CertificationNoteRow $row,
        string $fileIndex
    ) {
        if ($response = $this->authorizeRow($request, $table, $row)) {
            return $response;
        }

        $files = $this->normalizeEvidenceFiles($row);
        $index = filter_var($fileIndex, FILTER_VALIDATE_INT);
        if ($index === false || !array_key_exists($index, $files)) {
            return response()->json(['error' => 'File evidence tidak ditemukan.'], 404);
        }

        $file = $files[$index];
        unset($files[$index]);
        $files = array_values($files);

        $this->deleteEvidenceFiles([$file]);

        $row->fill([
            'evidence_files' => $files,
        ])->save();

        return $this->respondData($this->serializeRow($row->fresh()));
    }

    public function generateDocument(Request $request, CertificationNoteTable $table)
    {
        if ($response = $this->authorizeTable($request, $table)) {
            return $response;
        }

        $userId = (string) optional($request->user())->id;
        if ($userId === '') {
            return response()->json(['error' => 'User tidak valid.'], 401);
        }

        $table->loadMissing(['instansi', 'rows']);
        $location = $this->resolveLocationPayload($table->location_slug) ?? [
            'slug' => $table->location_slug,
            'label' => Str::title(str_replace('-', ' ', $table->location_slug)),
            'office_label' => (string) ($table->instansi?->name ?: 'Catatan Sertifikasi'),
        ];

        $path = $this->exportPath($userId, $table);
        $this->storeDocument($path, $table, $location);

        return $this->respondData([
            'generated' => true,
            'tableId' => (string) $table->id,
            'filename' => $this->downloadFilename($table, $location),
            'totalItems' => $table->rows->count(),
            'generatedAt' => now()->toDateTimeString(),
            'downloadUrl' => '/api/certification-note-tables/'.$table->id.'/export-document/download',
        ]);
    }

    public function downloadDocument(Request $request, CertificationNoteTable $table)
    {
        if ($response = $this->authorizeTable($request, $table)) {
            return $response;
        }

        $userId = (string) optional($request->user())->id;
        if ($userId === '') {
            return response()->json(['error' => 'User tidak valid.'], 401);
        }

        $table->loadMissing('instansi');
        $location = $this->resolveLocationPayload($table->location_slug) ?? [
            'slug' => $table->location_slug,
            'label' => Str::title(str_replace('-', ' ', $table->location_slug)),
            'office_label' => (string) ($table->instansi?->name ?: 'Catatan Sertifikasi'),
        ];

        $path = $this->exportPath($userId, $table);
        if (!Storage::disk('local')->exists($path)) {
            return response()->json([
                'error' => 'Dokumen belum digenerate untuk tabel ini.',
            ], 404);
        }

        return response()->download(
            Storage::disk('local')->path($path),
            $this->downloadFilename($table, $location),
            ['Content-Type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
        );
    }

    public function downloadSigned(Request $request, CertificationNoteRow $row)
    {
        $evidenceFile = $this->resolveEvidenceFile($row, $request->query('file'));
        $relativePath = $this->resolveStoragePath((string) ($evidenceFile['url'] ?? ''), [
            'certification-note-evidence/',
        ]);

        if (!$relativePath || !Storage::disk('public')->exists($relativePath)) {
            return response()->json(['error' => 'File tidak ditemukan.'], 404);
        }

        return response()->file(Storage::disk('public')->path($relativePath));
    }

    private function resolveLocationPayload(string $locationSlug): ?array
    {
        if (!array_key_exists($locationSlug, self::LOCATIONS)) {
            return null;
        }

        return [
            'slug' => $locationSlug,
            'label' => self::LOCATIONS[$locationSlug]['label'],
            'office_label' => self::LOCATIONS[$locationSlug]['office_label'],
        ];
    }

    private function resolveInstansiId(Request $request, bool $createIfMissing = false): ?string
    {
        $userId = $request->user()->id;

        $instansi = Instansi::query()
            ->where('user_id', $userId)
            ->first();

        if ($instansi) {
            return $instansi->id;
        }

        $orphan = Instansi::query()
            ->whereNull('user_id')
            ->first();

        if ($orphan) {
            $orphan->user_id = $userId;
            $orphan->save();

            return $orphan->id;
        }

        if (!$createIfMissing) {
            return null;
        }

        return Instansi::create([
            'user_id' => $userId,
            'facility_group' => 'Pelayanan Navigasi Penerbangan',
            'kobu' => 'KANTOR OTORITAS BANDAR UDARA WILAYAH III',
            'bandara' => 'JUANDA',
            'cabang_airnav' => 'PERUM LPPNPI CABANG SURABAYA',
            'name' => 'Perum LPPNPI Cabang Surabaya',
            'alias' => 'Surabaya',
            'address' => '',
            'contact_name' => '',
            'contact_email' => '',
            'contact_phone' => '',
            'fax' => '',
            'postal_code' => '',
            'longitude' => '',
            'latitude' => '',
            'service_area' => '',
            'operating_hours' => '',
            'traffic_type' => '',
            'runway_capacity' => '',
            'runway_condition' => '',
            'location' => '',
        ])->id;
    }

    private function authorizeTable(Request $request, CertificationNoteTable $table): ?JsonResponse
    {
        $instansiId = $this->resolveInstansiId($request);
        if (!$instansiId || $table->instansi_id !== $instansiId) {
            return response()->json(['error' => 'Forbidden.'], 403);
        }

        return null;
    }

    private function authorizeRow(
        Request $request,
        CertificationNoteTable $table,
        CertificationNoteRow $row
    ): ?JsonResponse {
        if ($response = $this->authorizeTable($request, $table)) {
            return $response;
        }

        if ($row->certification_note_table_id !== $table->id) {
            return response()->json(['error' => 'Baris catatan sertifikasi tidak ditemukan.'], 404);
        }

        return null;
    }

    private function serializeTable(CertificationNoteTable $table): array
    {
        return [
            'id' => $table->id,
            'location_slug' => $table->location_slug,
            'title' => $table->title,
            'sort_order' => $table->sort_order,
            'rows' => $table->rows
                ->sortBy('sort_order')
                ->values()
                ->map(fn (CertificationNoteRow $row) => $this->serializeRow($row))
                ->all(),
            'created_at' => $table->created_at,
            'updated_at' => $table->updated_at,
        ];
    }

    private function serializeRow(CertificationNoteRow $row): array
    {
        return [
            'id' => $row->id,
            'certification_note_table_id' => $row->certification_note_table_id,
            'sort_order' => $row->sort_order,
            'note' => $row->note,
            'action_office' => $row->action_office,
            'progress' => $row->progress,
            'evidence_files' => $this->withSignedEvidenceFiles($row),
            'created_at' => $row->created_at,
            'updated_at' => $row->updated_at,
        ];
    }

    private function storeEvidenceFiles(array $files): array
    {
        return array_map(function ($file): array {
            $path = $file->store('certification-note-evidence', 'public');

            return [
                'name' => $file->getClientOriginalName(),
                'url' => Storage::disk('public')->url($path),
                'size' => $file->getSize(),
                'mime_type' => $file->getClientMimeType(),
            ];
        }, $files);
    }

    private function normalizeEvidenceFiles(CertificationNoteRow $row): array
    {
        $files = [];

        foreach (($row->evidence_files ?? []) as $file) {
            if (!is_array($file)) {
                continue;
            }

            $url = (string) ($file['url'] ?? $file['file_url'] ?? '');
            if ($url === '') {
                continue;
            }

            $files[] = [
                'name' => (string) ($file['name'] ?? $file['file_name'] ?? basename($url)),
                'url' => $url,
                'size' => $file['size'] ?? null,
                'mime_type' => $file['mime_type'] ?? null,
            ];
        }

        return $files;
    }

    private function withSignedEvidenceFiles(CertificationNoteRow $row): array
    {
        $files = [];

        foreach ($this->normalizeEvidenceFiles($row) as $index => $file) {
            $files[] = [
                'name' => $file['name'],
                'url' => $file['url'],
                'size' => $file['size'],
                'mime_type' => $file['mime_type'],
                'signed_url' => URL::temporarySignedRoute(
                    'certification-notes.rows.evidence.signed',
                    now()->addMinutes(10),
                    [
                        'row' => $row->id,
                        'file' => $index,
                    ]
                ),
            ];
        }

        return $files;
    }

    private function resolveEvidenceFile(CertificationNoteRow $row, mixed $fileIndex): ?array
    {
        $files = $this->normalizeEvidenceFiles($row);
        if ($files === []) {
            return null;
        }

        if ($fileIndex === null || $fileIndex === '') {
            return $files[0];
        }

        $index = filter_var($fileIndex, FILTER_VALIDATE_INT);
        if ($index === false || !array_key_exists($index, $files)) {
            return null;
        }

        return $files[$index];
    }

    private function deleteEvidenceFiles(array $files): void
    {
        foreach ($files as $file) {
            $relativePath = $this->resolveStoragePath((string) ($file['url'] ?? ''), [
                'certification-note-evidence/',
            ]);

            if ($relativePath && Storage::disk('public')->exists($relativePath)) {
                Storage::disk('public')->delete($relativePath);
            }
        }
    }

    private function resolveStoragePath(string $url, array $allowedPrefixes = []): ?string
    {
        if ($url === '') {
            return null;
        }

        $path = parse_url($url, PHP_URL_PATH) ?? $url;
        $path = ltrim($path, '/');

        $storagePos = strpos($path, 'storage/');
        if ($storagePos !== false) {
            $path = substr($path, $storagePos + strlen('storage/'));
        }

        $path = ltrim($path, '/');
        if ($path === '' || str_contains($path, '..')) {
            return null;
        }

        foreach ($allowedPrefixes as $prefix) {
            if ($prefix !== '' && str_starts_with($path, $prefix)) {
                return $path;
            }
        }

        return empty($allowedPrefixes) ? $path : null;
    }

    private function storeDocument(string $path, CertificationNoteTable $table, array $location): void
    {
        $disk = Storage::disk('local');
        $disk->makeDirectory(dirname($path));

        $absolutePath = $disk->path($path);
        if (is_file($absolutePath)) {
            @unlink($absolutePath);
        }

        $phpWord = new PhpWord();
        $phpWord->setDefaultFontName('Times New Roman');
        $phpWord->setDefaultFontSize(11);
        $phpWord->setDefaultParagraphStyle([
            'spaceAfter' => 0,
            'lineHeight' => 1.0,
        ]);

        $section = $phpWord->addSection([
            'orientation' => 'landscape',
            'marginTop' => 720,
            'marginBottom' => 720,
            'marginLeft' => 720,
            'marginRight' => 720,
        ]);

        $sectionTitleStyle = [
            'bold' => true,
            'size' => 16,
        ];
        $sectionTitleParagraph = [
            'alignment' => Jc::CENTER,
            'spaceAfter' => 120,
            'lineHeight' => 1.0,
        ];
        $sectionScopeStyle = [
            'bold' => true,
            'size' => 14,
        ];
        $sectionScopeParagraph = [
            'alignment' => Jc::CENTER,
            'spaceAfter' => 220,
            'lineHeight' => 1.0,
        ];
        $areaParagraph = [
            'spaceAfter' => 140,
            'lineHeight' => 1.0,
        ];

        $tableStyle = [
            'alignment' => JcTable::CENTER,
            'borderSize' => 6,
            'borderColor' => 'B7C0CC',
            'cellMarginTop' => 30,
            'cellMarginBottom' => 30,
            'cellMarginLeft' => 40,
            'cellMarginRight' => 40,
        ];
        $headerCellStyle = [
            'bgColor' => 'E5E7EB',
            'valign' => VerticalJc::CENTER,
        ];
        $headerTextStyle = [
            'bold' => true,
            'size' => 11,
        ];
        $headerParagraphStyle = [
            'alignment' => Jc::START,
            'spaceAfter' => 0,
            'lineHeight' => 1.0,
        ];
        $bodyTextStyle = [
            'size' => 11,
        ];
        $bodyParagraphStyle = [
            'spaceAfter' => 0,
            'lineHeight' => 1.0,
        ];
        $centerParagraphStyle = [
            'alignment' => Jc::CENTER,
            'spaceAfter' => 0,
            'lineHeight' => 1.0,
        ];

        $section->addText(
            $this->normalizeExportText((string) ($location['office_label'] ?? $table->instansi?->name ?? 'Catatan Sertifikasi')),
            $sectionTitleStyle,
            $sectionTitleParagraph
        );
        $section->addText('Catatan Sertifikasi', $sectionScopeStyle, $sectionScopeParagraph);
        $section->addText(
            'Area : '.$this->normalizeExportText((string) ($table->title ?? 'Tabel')),
            ['bold' => true, 'size' => 12],
            $areaParagraph
        );

        $documentTable = $section->addTable($tableStyle);
        $documentTable->addRow(500);
        $this->addCellText($documentTable, 900, 'No', $headerCellStyle, $headerTextStyle, $headerParagraphStyle);
        $this->addCellText($documentTable, 5600, 'Catatan', $headerCellStyle, $headerTextStyle, $headerParagraphStyle);
        $this->addCellText($documentTable, 4500, 'Action Office', $headerCellStyle, $headerTextStyle, $headerParagraphStyle);
        $this->addCellText($documentTable, 2600, 'File Evidence', $headerCellStyle, $headerTextStyle, $headerParagraphStyle);
        $this->addCellText($documentTable, 1200, 'Progress', $headerCellStyle, $headerTextStyle, $centerParagraphStyle);

        $rows = $table->rows->sortBy('sort_order')->values();
        if ($rows->isEmpty()) {
            $documentTable->addRow();
            $documentTable
                ->addCell(14800, [
                    'gridSpan' => 5,
                    'valign' => VerticalJc::CENTER,
                ])
                ->addText('Belum ada baris catatan.', $bodyTextStyle, $centerParagraphStyle);
        }

        foreach ($rows as $index => $row) {
            $documentTable->addRow();
            $this->addCellText($documentTable, 900, (string) ($index + 1), ['valign' => VerticalJc::CENTER], $bodyTextStyle, $centerParagraphStyle);
            $this->addCellMultilineText($documentTable, 5600, (string) ($row->note ?? '-'), ['valign' => VerticalJc::TOP], $bodyTextStyle, $bodyParagraphStyle);
            $this->addCellMultilineText($documentTable, 4500, (string) ($row->action_office ?? '-'), ['valign' => VerticalJc::TOP], $bodyTextStyle, $bodyParagraphStyle);
            $this->addCellMultilineText($documentTable, 2600, $this->implodeEvidenceNames($row), ['valign' => VerticalJc::TOP], $bodyTextStyle, $bodyParagraphStyle);
            $this->addCellText($documentTable, 1200, ((string) ($row->progress ?? 0)).'%', ['valign' => VerticalJc::CENTER], $bodyTextStyle, $centerParagraphStyle);
        }

        $previousOutputEscaping = Settings::isOutputEscapingEnabled();
        Settings::setOutputEscapingEnabled(true);

        try {
            IOFactory::createWriter($phpWord, 'Word2007')->save($absolutePath);
        } finally {
            Settings::setOutputEscapingEnabled($previousOutputEscaping);
        }
    }

    private function addCellText($table, int $width, string $text, array $cellStyle, array $fontStyle, array $paragraphStyle): void
    {
        $table->addCell($width, $cellStyle)->addText($this->normalizeExportText($text), $fontStyle, $paragraphStyle);
    }

    private function addCellMultilineText($table, int $width, string $text, array $cellStyle, array $fontStyle, array $paragraphStyle): void
    {
        $cell = $table->addCell($width, $cellStyle);
        $lines = preg_split("/\r\n|\n|\r/", $this->normalizeExportText($text)) ?: ['-'];

        foreach ($lines as $line) {
            $cell->addText($line !== '' ? $line : ' ', $fontStyle, $paragraphStyle);
        }
    }

    private function normalizeExportText(string $text): string
    {
        $normalized = $this->removeInvalidXmlCharacters($text);
        $normalized = preg_replace("/\r\n|\r/u", "\n", trim($normalized)) ?? '';
        $normalized = preg_replace("/[ \t]+/u", ' ', $normalized) ?? '';

        return $normalized !== '' ? $normalized : '-';
    }

    private function removeInvalidXmlCharacters(string $text): string
    {
        $withoutControlCharacters = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $text) ?? '';

        return preg_replace('/[^\x09\x0A\x0D\x20-\x{D7FF}\x{E000}-\x{FFFD}]/u', '', $withoutControlCharacters) ?? '';
    }

    private function implodeEvidenceNames(CertificationNoteRow $row): string
    {
        $names = array_map(
            static fn (array $file) => trim((string) ($file['name'] ?? '')),
            $this->normalizeEvidenceFiles($row)
        );
        $names = array_values(array_filter($names, static fn (string $name) => $name !== ''));

        return $names === [] ? '-' : implode("\n", $names);
    }

    private function normalizeNullableText(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim($value);

        return $trimmed === '' ? null : $trimmed;
    }

    private function evidenceValidationMessages(): array
    {
        return [
            'files.max' => 'Maksimal 20 file evidence per baris.',
            'files.*.uploaded' => 'Upload file evidence gagal di server. Coba unggah ulang file dan pastikan ukuran file tidak melebihi 20 MB.',
            'files.*.max' => 'Ukuran file evidence maksimal 20 MB per file.',
            'files.*.mimes' => 'Format file evidence harus PDF, PNG, JPG, JPEG, DOC, DOCX, XLS, atau XLSX.',
        ];
    }

    private function exportPath(string $userId, CertificationNoteTable $table): string
    {
        return 'certification-note-exports/'.$userId.'/'.$table->id.'.docx';
    }

    private function downloadFilename(CertificationNoteTable $table, array $location): string
    {
        $locationPart = Str::slug((string) ($location['label'] ?? $table->location_slug));
        $titlePart = Str::slug((string) ($table->title ?: 'tabel'));

        return 'catatan-sertifikasi-'.$locationPart.'-'.$titlePart.'.docx';
    }
}
