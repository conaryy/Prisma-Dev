<?php

namespace App\Http\Controllers\Api;

use App\Jobs\RunSelfAssessmentQuestionImport;
use App\Models\SelfAssessmentQuestion;
use App\Models\SelfAssessmentQuestionCategory;
use App\Models\SelfAssessmentQuestionImportJob;
use App\Models\SelfAssessmentSessionArea;
use App\Models\SelfAssessmentSessionQuestionCategoryUser;
use Illuminate\Http\Request;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;

class SelfAssessmentQuestionController extends ApiController
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['required', 'in:audit,monitoring,inspeksi,surveillance'],
            'category' => ['nullable'],
            'sessionId' => ['nullable', 'uuid', 'exists:self_assessment_sessions,id'],
            'sessionAreaId' => ['nullable', 'uuid', 'exists:self_assessment_session_areas,id'],
        ]);

        $items = SelfAssessmentQuestion::query()
            ->when($validated['scope'] ?? null, function ($query, $scope) {
                $query->where('scope', $scope);
            })
            ->when($validated['category'] ?? null, function ($query, $category) {
                $query->where('category', $category);
            })
            ->where('is_active', true)
            ->orderBy('question_category_prefix')
            ->orderBy('sort_order')
            ->get();

        $questionCategories = SelfAssessmentQuestionCategory::query()
            ->where('scope', $validated['scope'])
            ->get(['id', 'name', 'prefix']);

        $sessionId = $validated['sessionId'] ?? null;
        if (!$sessionId && !empty($validated['sessionAreaId'])) {
            $sessionId = SelfAssessmentSessionArea::query()
                ->where('id', $validated['sessionAreaId'])
                ->value('session_id');
        }

        if ($sessionId && $questionCategories->isNotEmpty()) {
            $assignments = SelfAssessmentSessionQuestionCategoryUser::query()
                ->where('session_id', $sessionId)
                ->get(['question_category_id', 'user_id']);

            if ($assignments->isNotEmpty()) {
                $categoryKeyById = $questionCategories->mapWithKeys(function ($category) {
                    return [$category->id => $category->prefix.'|'.$category->name];
                });

                $userId = $request->user()->id;
                $allowedKeys = [];
                $assignedCategoryIds = $assignments
                    ->where('user_id', $userId)
                    ->pluck('question_category_id')
                    ->unique();

                foreach ($assignedCategoryIds as $categoryId) {
                    $key = $categoryKeyById[$categoryId] ?? null;
                    if ($key) {
                        $allowedKeys[$key] = true;
                    }
                }

                $items = $items->filter(function ($item) use ($allowedKeys) {
                    if (empty($allowedKeys)) {
                        return false;
                    }
                    $prefix = $item->question_category_prefix;
                    $name = $item->question_category;
                    if (!$prefix || !$name) {
                        return false;
                    }
                    $key = $prefix.'|'.$name;
                    return isset($allowedKeys[$key]);
                })->values();
            }
        }

        return $this->respondData($items);
    }

    public function adminIndex(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['nullable', 'in:audit,monitoring,inspeksi,surveillance'],
            'category' => ['nullable'],
        ]);

        $items = SelfAssessmentQuestion::query()
            ->when($validated['scope'] ?? null, function ($query, $scope) {
                $query->where('scope', $scope);
            })
            ->when($validated['category'] ?? null, function ($query, $category) {
                $query->where('category', $category);
            })
            ->orderBy('scope')
            ->orderBy('category')
            ->orderBy('question_category_prefix')
            ->orderBy('sort_order')
            ->get();

        return $this->respondData($items);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['required', 'in:audit,monitoring,inspeksi,surveillance'],
            'category' => ['nullable'],
            'questionCategoryId' => ['required'],
            'text' => ['required'],
            'reference' => ['nullable'],
            'isActive' => ['nullable', 'boolean'],
        ]);

        $questionCategory = SelfAssessmentQuestionCategory::query()->find($validated['questionCategoryId']);
        if (!$questionCategory) {
            return response()->json(['error' => 'Question category not found.'], 404);
        }

        $prefix = $questionCategory->prefix;
        $lastNumber = SelfAssessmentQuestion::query()
            ->where('scope', $validated['scope'])
            ->when($validated['category'] ?? null, function ($query, $category) {
                $query->where('category', $category);
            })
            ->where('question_category_prefix', $prefix)
            ->max('sort_order');
        $nextNumber = (int) $lastNumber + 1;

        $payload = $this->normalize($validated, [
            'isActive' => 'is_active',
        ]);
        $payload['question_category'] = $questionCategory->name;
        $payload['question_category_prefix'] = $prefix;
        $payload['sort_order'] = $nextNumber;
        $payload['code'] = $prefix . '.' . $nextNumber;

        $item = SelfAssessmentQuestion::create($payload);

        return $this->respondData($item, 201);
    }

    public function update(Request $request, SelfAssessmentQuestion $question)
    {
        $validated = $request->validate([
            'scope' => ['sometimes', 'in:audit,monitoring,inspeksi,surveillance'],
            'category' => ['nullable'],
            'questionCategoryId' => ['nullable'],
            'text' => ['sometimes'],
            'reference' => ['nullable'],
            'isActive' => ['nullable', 'boolean'],
        ]);

        $payload = $this->normalize($validated, [
            'isActive' => 'is_active',
        ]);

        if (!empty($validated['questionCategoryId'])) {
            $questionCategory = SelfAssessmentQuestionCategory::query()->find($validated['questionCategoryId']);
            if ($questionCategory) {
                $nextScope = $validated['scope'] ?? $question->scope;
                $nextCategory = $validated['category'] ?? $question->category;
                $prefix = $questionCategory->prefix;
                $lastNumber = SelfAssessmentQuestion::query()
                    ->where('scope', $question->scope)
                    ->when($question->category, function ($query, $category) {
                        $query->where('category', $category);
                    })
                    ->where('question_category_prefix', $prefix)
                    ->max('sort_order');
                $nextNumber = (int) $lastNumber + 1;
                $payload['question_category'] = $questionCategory->name;
                $payload['question_category_prefix'] = $prefix;
                $payload['sort_order'] = $nextNumber;
                $payload['code'] = $prefix . '.' . $nextNumber;
            }
        }

        $question->fill($payload)->save();

        return $this->respondData($question);
    }

    public function destroy(SelfAssessmentQuestion $question)
    {
        $question->delete();
        return $this->respondData(['success' => true]);
    }

    public function adminDestroyAll(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['required', 'in:audit,monitoring,inspeksi,surveillance'],
            'category' => ['required'],
        ]);

        $deleted = SelfAssessmentQuestion::query()
            ->where('scope', $validated['scope'])
            ->where('category', $validated['category'])
            ->delete();

        return $this->respondData(['deleted' => $deleted]);
    }

    public function exportUrl(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['required', 'in:audit,monitoring,inspeksi,surveillance'],
            'category' => ['required'],
        ]);

        $items = SelfAssessmentQuestion::query()
            ->where('scope', $validated['scope'])
            ->where('category', $validated['category'])
            ->orderBy('question_category_prefix')
            ->orderBy('sort_order')
            ->get(['question_category', 'question_category_prefix', 'text', 'reference']);

        $rows = [];
        foreach ($items as $item) {
            $description = trim((string) ($item->reference ?? ''));
            $rows[] = [
                (string) ($item->question_category ?? ''),
                (string) ($item->question_category_prefix ?? ''),
                (string) ($item->text ?? ''),
                $description !== '' ? $description : '-',
            ];
        }

        $handle = fopen('php://temp', 'w+');
        if ($handle === false) {
            return response()->json(['error' => 'Gagal membuat file export.'], 500);
        }

        fputcsv($handle, ['kategori', 'prefix', 'pertanyaan', 'referensi']);
        foreach ($rows as $row) {
            fputcsv($handle, $row);
        }

        rewind($handle);
        $csv = stream_get_contents($handle);
        fclose($handle);
        if ($csv === false) {
            return response()->json(['error' => 'Gagal membaca file export.'], 500);
        }

        Storage::disk('public')->put($this->exportedQuestionFilePath(), $csv);

        return $this->respondData([
            'url' => URL::temporarySignedRoute(
                'admin.self-assessment.questions.export.signed',
                now()->addMinutes(10),
                absolute: false
            ),
        ]);
    }

    public function exportDownloadSigned(Request $request)
    {
        $relativePath = $this->exportedQuestionFilePath();
        if (!Storage::disk('public')->exists($relativePath)) {
            return response()->json(['error' => 'File export tidak ditemukan.'], 404);
        }

        return Storage::disk('public')->download(
            $relativePath,
            'pertanyaan-self-assessment.csv',
            ['Content-Type' => 'text/csv; charset=UTF-8']
        );
    }

    public function import(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['required', 'in:audit,monitoring,inspeksi,surveillance'],
            'category' => ['required'],
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:10240'],
        ]);

        $file = $request->file('file');
        $handle = fopen($file->getRealPath(), 'r');
        if (!$handle) {
            return response()->json(['error' => 'File tidak bisa dibaca.'], 422);
        }

        $firstLine = fgets($handle);
        if ($firstLine === false) {
            fclose($handle);
            return response()->json(['error' => 'File kosong.'], 422);
        }
        $commaCount = substr_count($firstLine, ',');
        $semiCount = substr_count($firstLine, ';');
        $delimiter = $semiCount > $commaCount ? ';' : ',';
        rewind($handle);

        $header = fgetcsv($handle, 0, $delimiter);
        if (!$header) {
            fclose($handle);
            return response()->json(['error' => 'Header CSV tidak ditemukan.'], 422);
        }

        $normalizedHeader = array_map(function ($value) {
            return strtolower(trim($value));
        }, $header);

        $requiredColumns = ['kategori', 'prefix', 'pertanyaan'];
        foreach ($requiredColumns as $column) {
            if (!in_array($column, $normalizedHeader, true)) {
                fclose($handle);
                return response()->json(['error' => "Kolom CSV wajib: {$column}."], 422);
            }
        }

        $indexMap = array_flip($normalizedHeader);
        $referenceColumnIndex = $indexMap['referensi'] ?? $indexMap['deskripsi'] ?? null;
        $maxRows = 2000;
        $rowNumber = 1;
        $rows = [];

        while (($row = fgetcsv($handle, 0, $delimiter)) !== false) {
            $rowNumber++;
            if ($rowNumber > $maxRows + 1) {
                break;
            }

            $rows[] = [
                'rowNumber' => $rowNumber,
                'kategori' => (string) ($row[$indexMap['kategori']] ?? ''),
                'prefix' => (string) ($row[$indexMap['prefix']] ?? ''),
                'pertanyaan' => (string) ($row[$indexMap['pertanyaan']] ?? ''),
                'deskripsi' => $referenceColumnIndex !== null
                    ? (string) ($row[$referenceColumnIndex] ?? '')
                    : '',
            ];
        }

        fclose($handle);
        $result = $this->importQuestionRows($validated['scope'], $validated['category'], $rows);
        if ($rowNumber > $maxRows + 1) {
            $result['errors'][] = [
                'row' => $rowNumber,
                'message' => 'Batas maksimum baris terlampaui.',
            ];
        }

        return $this->respondData([
            'created' => $result['created'],
            'errors' => $result['errors'],
        ]);
    }

    public function importDnpInit(Request $request)
    {
        try {
            $wrapperUrl = $this->wrapperUrl();
            $response = $this->wrapperHttp(30)->post($wrapperUrl.'/automation-init');
        } catch (\RuntimeException $exception) {
            return response()->json(['error' => $exception->getMessage()], 500);
        }

        if (!$response->ok()) {
            return response()->json(['error' => 'Gagal menginisiasi sesi captcha DNP.'], 502);
        }

        $payload = $response->json();
        if (!is_array($payload) || !empty($payload['error']) || empty($payload['session_id'])) {
            return response()->json([
                'error' => (is_array($payload) ? ($payload['error'] ?? null) : null) ?? 'Session DNP tidak tersedia.',
            ], 502);
        }

        $sessionId = (string) $payload['session_id'];
        return $this->respondData([
            'sessionId' => $sessionId,
            'captchaUrl' => URL::temporarySignedRoute(
                'admin.self-assessment.questions.import-dnp.captcha',
                now()->addMinutes(10),
                ['sessionId' => $sessionId]
            ),
        ]);
    }

    public function importDnpCaptcha(Request $request)
    {
        $sessionId = (string) $request->route('sessionId');
        if ($sessionId === '') {
            return response()->json(['error' => 'Session ID tidak valid.'], 422);
        }

        try {
            $wrapperUrl = $this->wrapperUrl();
            $response = $this->wrapperHttp(30)->get($wrapperUrl.'/automation-captcha', [
                'session_id' => $sessionId,
            ]);
        } catch (\RuntimeException $exception) {
            return response()->json(['error' => $exception->getMessage()], 500);
        }

        if (!$response->ok()) {
            return response()->json(['error' => 'Gagal memuat captcha DNP.'], 502);
        }

        return response($response->body(), 200)->header('Content-Type', 'image/jpeg');
    }

    public function importDnpFillOptions(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['required', 'in:audit,inspeksi,surveillance'],
            'year' => ['required', 'integer', 'min:2000', 'max:2100'],
            'sessionId' => ['required', 'string'],
            'captcha' => ['nullable', 'string'],
            'username' => ['nullable', 'string'],
            'password' => ['nullable', 'string'],
        ]);

        try {
            $wrapperUrl = $this->wrapperUrl();
            $response = $this->wrapperHttp(120)->post($wrapperUrl.'/automation-run', [
                'action' => 'selfassessment_fill',
                'type' => $validated['scope'],
                'stage' => 'selfassessment',
                'year' => (string) $validated['year'],
                'session_id' => $validated['sessionId'],
                'captcha' => (string) ($validated['captcha'] ?? ''),
                'username' => (string) ($validated['username'] ?? ''),
                'password' => (string) ($validated['password'] ?? ''),
            ]);
        } catch (\RuntimeException $exception) {
            return response()->json(['error' => $exception->getMessage()], 500);
        }

        if ($response->status() === 401) {
            $payload = $response->json();
            return response()->json([
                'error' => (is_array($payload) ? ($payload['error'] ?? null) : null) ?? 'Login DNP gagal.',
                'needNewSession' => true,
            ], 401);
        }

        if (!$response->ok()) {
            return response()->json([
                'error' => 'Gagal mengambil daftar area fill dari DNP.',
                'detail' => $response->body(),
            ], 502);
        }

        $payload = $response->json();
        if (!is_array($payload) || !empty($payload['error'])) {
            return response()->json([
                'error' => is_array($payload) ? ($payload['error'] ?? 'Respons wrapper tidak valid.') : 'Respons wrapper tidak valid.',
            ], 502);
        }

        $fillTargets = data_get($payload, 'results.selfassessment.fill_targets', []);
        if (!is_array($fillTargets)) {
            $fillTargets = [];
        }

        return $this->respondData([
            'fillTargets' => array_values($fillTargets),
            'scope' => $validated['scope'],
            'year' => (int) $validated['year'],
        ]);
    }

    public function importDnpScrape(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['required', 'in:audit,inspeksi,surveillance'],
            'category' => ['required', 'string'],
            'year' => ['required', 'integer', 'min:2000', 'max:2100'],
            'sessionId' => ['required', 'string'],
            'fillCode1' => ['required', 'string'],
            'fillCode2' => ['required', 'string'],
            'fillArea' => ['nullable', 'string'],
            'captcha' => ['nullable', 'string'],
            'username' => ['nullable', 'string'],
            'password' => ['nullable', 'string'],
        ]);

        $userId = (string) optional($request->user())->id;
        if ($userId === '') {
            return response()->json(['error' => 'User tidak valid.'], 401);
        }

        $runningJob = SelfAssessmentQuestionImportJob::query()
            ->where('user_id', $userId)
            ->whereIn('status', ['queued', 'running'])
            ->latest('created_at')
            ->first();

        if ($runningJob) {
            return $this->respondData([
                'jobId' => $runningJob->id,
                'status' => $runningJob->status,
                'message' => 'Import DNP sebelumnya masih berjalan.',
            ], 202);
        }

        $importJob = SelfAssessmentQuestionImportJob::query()->create([
            'user_id' => $userId,
            'scope' => $validated['scope'],
            'category' => $validated['category'],
            'year' => (int) $validated['year'],
            'fill_code1' => $validated['fillCode1'],
            'fill_code2' => $validated['fillCode2'],
            'fill_area' => (string) ($validated['fillArea'] ?? ''),
            'status' => 'queued',
            'message' => 'Import pertanyaan DNP dimasukkan ke antrean.',
        ]);

        RunSelfAssessmentQuestionImport::dispatch(
            importJobId: (string) $importJob->id,
            userId: $userId,
            payload: $validated
        );

        return $this->respondData([
            'jobId' => $importJob->id,
            'status' => $importJob->status,
            'message' => $importJob->message,
        ], 202);
    }

    public function importDnpScrapeStatus(Request $request, SelfAssessmentQuestionImportJob $job)
    {
        $userId = (string) optional($request->user())->id;
        if ($userId === '' || (string) $job->user_id !== $userId) {
            return response()->json(['error' => 'Job tidak ditemukan.'], 404);
        }

        return $this->respondData([
            'jobId' => $job->id,
            'status' => $job->status,
            'message' => $job->message,
            'error' => $job->error_message,
            'summary' => $job->summary,
            'startedAt' => optional($job->started_at)->toDateTimeString(),
            'finishedAt' => optional($job->finished_at)->toDateTimeString(),
            'createdAt' => optional($job->created_at)->toDateTimeString(),
        ]);
    }

    public function importDnpScrapeRun(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['required', 'in:audit,inspeksi,surveillance'],
            'category' => ['required', 'string'],
            'year' => ['required', 'integer', 'min:2000', 'max:2100'],
            'sessionId' => ['required', 'string'],
            'fillCode1' => ['required', 'string'],
            'fillCode2' => ['required', 'string'],
            'fillArea' => ['nullable', 'string'],
            'captcha' => ['nullable', 'string'],
            'username' => ['nullable', 'string'],
            'password' => ['nullable', 'string'],
        ]);

        try {
            $wrapperUrl = $this->wrapperUrl();
            $response = $this->wrapperHttp(240)->post($wrapperUrl.'/automation-run', [
                'action' => 'selfassessment_scrape',
                'type' => $validated['scope'],
                'stage' => 'selfassessment',
                'year' => (string) $validated['year'],
                'session_id' => $validated['sessionId'],
                'fill_code1' => $validated['fillCode1'],
                'fill_code2' => $validated['fillCode2'],
                'fill_area' => (string) ($validated['fillArea'] ?? ''),
                'captcha' => (string) ($validated['captcha'] ?? ''),
                'username' => (string) ($validated['username'] ?? ''),
                'password' => (string) ($validated['password'] ?? ''),
            ]);
        } catch (\RuntimeException $exception) {
            return response()->json(['error' => $exception->getMessage()], 500);
        }

        if ($response->status() === 401) {
            $payload = $response->json();
            return response()->json([
                'error' => (is_array($payload) ? ($payload['error'] ?? null) : null) ?? 'Login DNP gagal.',
                'needNewSession' => true,
            ], 401);
        }

        if (!$response->ok()) {
            return response()->json([
                'error' => 'Gagal scraping selfassessment dari DNP.',
                'detail' => $response->body(),
            ], 502);
        }

        $payload = $response->json();
        if (!is_array($payload) || !empty($payload['error'])) {
            return response()->json([
                'error' => is_array($payload) ? ($payload['error'] ?? 'Respons wrapper tidak valid.') : 'Respons wrapper tidak valid.',
            ], 502);
        }

        $rows = data_get($payload, 'results.selfassessment.rows', []);
        if (!is_array($rows)) {
            $rows = [];
        }

        $result = $this->importQuestionRows(
            $validated['scope'],
            $validated['category'],
            $rows
        );

        return $this->respondData([
            'created' => $result['created'],
            'errors' => $result['errors'],
            'fill' => [
                'code1' => $validated['fillCode1'],
                'code2' => $validated['fillCode2'],
                'area' => $validated['fillArea'] ?? null,
            ],
        ]);
    }

    private function importQuestionRows(string $scope, string $category, array $rows): array
    {
        $created = 0;
        $errors = [];
        $categoryCache = [];
        $lastNumberCache = [];
        $normalizedRows = $this->normalizeImportRows($rows);

        foreach ($normalizedRows as $row) {
            $rowNumber = (int) ($row['rowNumber'] ?? 0);
            $kategori = (string) ($row['kategori'] ?? '');
            $prefix = (string) ($row['prefix'] ?? '');
            $pertanyaan = (string) ($row['pertanyaan'] ?? '');
            $deskripsi = (string) ($row['deskripsi'] ?? '');

            if ($kategori === '' || $prefix === '' || $pertanyaan === '') {
                $errors[] = [
                    'row' => $rowNumber,
                    'message' => 'Kolom kategori, prefix, dan pertanyaan wajib diisi.',
                ];
                continue;
            }

            try {
                $categoryKey = $scope.'|'.$kategori.'|'.$prefix;
                if (!isset($categoryCache[$categoryKey])) {
                    $questionCategory = SelfAssessmentQuestionCategory::query()
                        ->where('scope', $scope)
                        ->where('name', $kategori)
                        ->where('prefix', $prefix)
                        ->first();

                    if (!$questionCategory) {
                        $questionCategory = SelfAssessmentQuestionCategory::create([
                            'id' => (string) Str::uuid(),
                            'scope' => $scope,
                            'name' => $kategori,
                            'prefix' => $prefix,
                            'is_active' => true,
                            'sort_order' => 0,
                        ]);
                    }

                    $categoryCache[$categoryKey] = $questionCategory;
                }

                $numberKey = $scope.'|'.$category.'|'.$prefix;
                if (!isset($lastNumberCache[$numberKey])) {
                    $lastNumberCache[$numberKey] = (int) SelfAssessmentQuestion::query()
                        ->where('scope', $scope)
                        ->where('category', $category)
                        ->where('question_category_prefix', $prefix)
                        ->max('sort_order');
                }

                $lastNumberCache[$numberKey]++;
                $nextNumber = $lastNumberCache[$numberKey];

                SelfAssessmentQuestion::create([
                    'id' => (string) Str::uuid(),
                    'scope' => $scope,
                    'category' => $category,
                    'question_category' => $kategori,
                    'question_category_prefix' => $prefix,
                    'code' => $prefix.'.'.$nextNumber,
                    'text' => $pertanyaan,
                    'reference' => $deskripsi !== '' ? $deskripsi : null,
                    'is_active' => true,
                    'sort_order' => $nextNumber,
                ]);

                $created++;
            } catch (\Throwable $exception) {
                $errors[] = [
                    'row' => $rowNumber,
                    'message' => $exception->getMessage(),
                ];
            }
        }

        return ['created' => $created, 'errors' => $errors];
    }

    private function normalizeImportRows(array $rows): array
    {
        $normalizedRows = [];

        foreach ($rows as $index => $row) {
            if (!is_array($row)) {
                continue;
            }
            $normalizedRows[] = $this->normalizeImportRow($row, $index + 2);
        }

        return $normalizedRows;
    }

    private function normalizeImportRow(array $row, int $fallbackRowNumber): array
    {
        $rowNumber = (int) ($row['rowNumber'] ?? 0);

        return [
            'rowNumber' => $rowNumber > 0 ? $rowNumber : $fallbackRowNumber,
            'kategori' => $this->sanitizeCsvValue((string) ($row['kategori'] ?? '')),
            'prefix' => strtoupper($this->sanitizeCsvValue((string) ($row['prefix'] ?? ''))),
            'pertanyaan' => $this->sanitizeCsvValue((string) ($row['pertanyaan'] ?? '')),
            'deskripsi' => $this->sanitizeCsvValue((string) ($row['deskripsi'] ?? '')),
        ];
    }

    private function wrapperUrl(): string
    {
        $url = trim((string) env('EXTERNAL_DNP_WRAPPER_URL', ''));
        if ($url === '') {
            throw new \RuntimeException('EXTERNAL_DNP_WRAPPER_URL belum dikonfigurasi.');
        }

        return rtrim($url, '/');
    }

    private function wrapperHttp(int $timeout = 120): PendingRequest
    {
        $token = trim((string) env('EXTERNAL_DNP_WRAPPER_INTERNAL_TOKEN', ''));
        if ($token === '') {
            throw new \RuntimeException('EXTERNAL_DNP_WRAPPER_INTERNAL_TOKEN belum dikonfigurasi.');
        }

        return Http::timeout($timeout)
            ->acceptJson()
            ->withHeaders([
                'X-Internal-Token' => $token,
            ]);
    }

    private function sanitizeCsvValue(string $value): string
    {
        $value = trim($value);
        $value = strip_tags($value);
        $value = preg_replace('/\s+/', ' ', $value);
        return $value ?? '';
    }

    private function exportedQuestionFilePath(): string
    {
        return 'exports/self_assessment_questions_export.csv';
    }
}
