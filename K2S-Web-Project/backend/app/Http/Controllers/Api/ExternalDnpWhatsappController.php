<?php

namespace App\Http\Controllers\Api;

use App\Jobs\RunWhatsappBatchSend;
use App\Models\ExternalDnpAnswer;
use App\Models\ExternalDnpCapFulfillment;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Throwable;

class ExternalDnpWhatsappController extends ApiController
{
    public function temuan(Request $request)
    {
        try {
            $validated = $request->validate([
                'scope' => ['nullable', 'in:all,audit,inspeksi,surveillance'],
                'year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
                'view' => ['nullable', 'in:summary,list'],
                'instansi' => ['nullable', 'string', 'max:255'],
                'area' => ['nullable', 'string', 'max:255'],
            ]);

            $scope = $validated['scope'] ?? 'all';
            $year = $validated['year'] ?? null;
            $view = $validated['view'] ?? 'summary';
            $instansi = $this->normalizeFilterValue($validated['instansi'] ?? null);
            $area = $this->normalizeFilterValue($validated['area'] ?? null);
            return $this->respondData(
                $this->buildTemuanPayload($scope, $year, $view, $instansi, $area)
            );
        } catch (Throwable $exception) {
            report($exception);

            return response()->json([
                'error' => config('app.debug')
                    ? $exception->getMessage()
                    : 'Bot tidak dapat mengakses data temuan saat ini.',
            ], 503);
        }
    }

    public function adminOptions(Request $request)
    {
        try {
            $validated = $request->validate([
                'instansi' => ['nullable', 'string', 'max:255'],
                'scope' => ['nullable', 'in:all,audit,inspeksi,surveillance'],
                'year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            ]);

            $instansi = $this->normalizeFilterValue($validated['instansi'] ?? null);
            $scope = $validated['scope'] ?? 'all';
            $year = $validated['year'] ?? null;

            return $this->respondData([
                'filters' => [
                    'instansi' => $instansi,
                    'scope' => $scope,
                    'year' => $year,
                ],
                'options' => [
                    'instansi' => $this->buildInstansiOptions(),
                    'years' => $this->buildYearOptions($instansi),
                    'scopes' => $this->buildScopeOptions($instansi, $year),
                    'areas' => $this->buildAreaOptions($instansi, $scope, $year),
                ],
            ]);
        } catch (Throwable $exception) {
            report($exception);

            return response()->json([
                'error' => config('app.debug')
                    ? $exception->getMessage()
                    : 'Gagal memuat opsi WhatsApp API.',
            ], 503);
        }
    }

    public function adminSessionStatus()
    {
        return $this->proxyWhatsappSessionRequest('get', '/internal/session');
    }

    public function adminSessionLogout()
    {
        return $this->proxyWhatsappSessionRequest('post', '/internal/session/logout');
    }

    public function adminSessionNew()
    {
        return $this->proxyWhatsappSessionRequest('post', '/internal/session/new');
    }

    public function adminSend(Request $request)
    {
        try {
            $validated = $request->validate([
                'phoneNumber' => ['required', 'regex:/^628\\d{7,15}$/'],
                'instansi' => ['nullable', 'string', 'max:255'],
                'scope' => ['nullable', 'in:all,audit,inspeksi,surveillance'],
                'year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
                'area' => ['nullable', 'string', 'max:255'],
            ]);

            $payload = [
                'phoneNumber' => $validated['phoneNumber'],
                'instansi' => $this->normalizeFilterValue($validated['instansi'] ?? null),
                'scope' => $validated['scope'] ?? 'all',
                'year' => $validated['year'] ?? null,
                'area' => $this->normalizeFilterValue($validated['area'] ?? null),
            ];

            $text = $this->buildWhatsappMessage(
                $payload['scope'],
                $payload['year'],
                $payload['instansi'],
                $payload['area']
            );

            $response = $this->whatsappApiHttp(30)->post(
                $this->whatsappApiUrl().'/internal/send-text',
                [
                    'phoneNumber' => $payload['phoneNumber'],
                    'text' => $text,
                ]
            );

            if ($response->failed()) {
                $message = $response->json('error')
                    ?: $response->json('message')
                    ?: $response->body()
                    ?: 'Gagal mengirim pesan WhatsApp.';
                return response()->json(['error' => $message], $response->status() ?: 502);
            }

            return $this->respondData([
                'sent' => true,
                'phoneNumber' => $payload['phoneNumber'],
                'scope' => $payload['scope'],
                'instansi' => $payload['instansi'],
                'year' => $payload['year'],
                'area' => $payload['area'],
                'message' => $response->json('message') ?: 'Pesan WhatsApp berhasil dikirim.',
            ]);
        } catch (Throwable $exception) {
            report($exception);

            return response()->json([
                'error' => config('app.debug')
                    ? $exception->getMessage()
                    : 'Gagal mengirim pesan WhatsApp.',
            ], 503);
        }
    }

    public function adminSendBatch(Request $request)
    {
        try {
            $validated = $this->validateBatchTargets($request);

            $queuedTargets = [];

            foreach ($validated['targets'] as $target) {
                $phoneNumber = (string) $target['phoneNumber'];
                $items = is_array($target['items'] ?? null) ? $target['items'] : [];
                $normalizedItems = $this->normalizeBatchItems($items);
                $text = $this->buildBatchMessage($normalizedItems);

                $queuedTargets[] = [
                    'phoneNumber' => $phoneNumber,
                    'text' => $text,
                    'items' => $normalizedItems,
                ];
            }

            RunWhatsappBatchSend::dispatch($queuedTargets);

            return $this->respondData([
                'queued' => true,
                'summary' => [
                    'totalTargets' => count($queuedTargets),
                ],
                'message' => count($queuedTargets) > 1
                    ? 'Batch WhatsApp masuk antrean. Pengiriman akan diproses bertahap dengan delay acak 5-15 detik antar nomor.'
                    : 'Pengiriman WhatsApp masuk antrean dan akan diproses segera.',
            ]);
        } catch (Throwable $exception) {
            report($exception);

            return response()->json([
                'error' => config('app.debug')
                    ? $exception->getMessage()
                    : 'Gagal mengirim batch WhatsApp.',
            ], 503);
        }
    }

    public function adminPreviewBatch(Request $request)
    {
        try {
            $validated = $request->validate([
                'items' => ['required', 'array', 'min:1'],
                'items.*.instansi' => ['nullable', 'string', 'max:255'],
                'items.*.scope' => ['nullable', 'in:all,audit,inspeksi,surveillance'],
                'items.*.year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
                'items.*.area' => ['nullable', 'string', 'max:255'],
                'items.*.compactSummary' => ['nullable', 'boolean'],
            ]);

            $normalizedItems = $this->normalizeBatchItems($validated['items']);

            return $this->respondData([
                'text' => $this->buildBatchMessage($normalizedItems),
                'items' => $normalizedItems,
            ]);
        } catch (Throwable $exception) {
            report($exception);

            return response()->json([
                'error' => config('app.debug')
                    ? $exception->getMessage()
                    : 'Gagal membuat preview pesan WhatsApp.',
            ], 503);
        }
    }

    private function validateBatchTargets(Request $request): array
    {
        return $request->validate([
            'targets' => ['required', 'array', 'min:1'],
            'targets.*.phoneNumber' => ['required', 'regex:/^628\\d{7,15}$/'],
            'targets.*.items' => ['required', 'array', 'min:1'],
            'targets.*.items.*.instansi' => ['nullable', 'string', 'max:255'],
            'targets.*.items.*.scope' => ['nullable', 'in:all,audit,inspeksi,surveillance'],
            'targets.*.items.*.year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'targets.*.items.*.area' => ['nullable', 'string', 'max:255'],
            'targets.*.items.*.compactSummary' => ['nullable', 'boolean'],
        ]);
    }

    private function normalizeBatchItems(array $items): array
    {
        $normalizedItems = [];

        foreach ($items as $item) {
            $normalizedItems[] = [
                'instansi' => $this->normalizeFilterValue($item['instansi'] ?? null),
                'scope' => $item['scope'] ?? 'all',
                'year' => $item['year'] ?? null,
                'area' => $this->normalizeFilterValue($item['area'] ?? null),
                'compactSummary' => (bool) ($item['compactSummary'] ?? false),
            ];
        }

        return $normalizedItems;
    }

    private function proxyWhatsappSessionRequest(string $method, string $path)
    {
        try {
            $response = $this->whatsappApiHttp(30)->send(
                strtoupper($method),
                $this->whatsappApiUrl().$path
            );

            if ($response->failed()) {
                $message = $response->json('error')
                    ?: $response->json('message')
                    ?: $response->body()
                    ?: 'Gagal mengakses sesi WhatsApp.';
                return response()->json(['error' => $message], $response->status() ?: 502);
            }

            return $this->respondData($response->json('data') ?? []);
        } catch (Throwable $exception) {
            report($exception);

            return response()->json([
                'error' => config('app.debug')
                    ? $exception->getMessage()
                    : 'Gagal mengakses sesi WhatsApp.',
            ], 503);
        }
    }

    private function buildTemuanPayload(
        string $scope,
        ?int $year,
        string $view,
        ?string $instansi = null,
        ?string $area = null
    ): array {
        $baseQuery = $this->buildImportedTemuanQuery($scope, $year, $instansi, $area);
        $totalTemuan = (clone $baseQuery)->count('answers.id');
        $totalTerpenuhi = $this->countCompletedTemuan($baseQuery);

        $summary = [
            'scope' => $scope,
            'year' => $year,
            'instansi' => $instansi,
            'area' => $area,
            'totalTemuan' => $totalTemuan,
            'totalInstansi' => (clone $baseQuery)
                ->whereNotNull('sessions.instansi_name')
                ->where('sessions.instansi_name', '!=', '')
                ->distinct()
                ->count('sessions.instansi_name'),
            'totalArea' => (clone $baseQuery)
                ->distinct()
                ->count('areas.id'),
            'totalTerpenuhi' => $totalTerpenuhi,
            'totalBelumTerpenuhi' => $totalTemuan - $totalTerpenuhi,
            'byScope' => $this->buildScopeBreakdown($scope, $year, $instansi, $area),
            'byInstansi' => $this->buildInstansiBreakdown($scope, $year, $instansi, $area),
        ];

        $payload = [
            'query' => [
                'scope' => $scope,
                'year' => $year,
                'view' => $view,
                'instansi' => $instansi,
                'area' => $area,
            ],
            'summary' => $summary,
        ];

        if ($view === 'summary') {
            return $payload;
        }

        $payload['items'] = $this->buildTemuanItems($scope, $year, $instansi, $area);

        return $payload;
    }

    private function buildTemuanItems(
        string $scope,
        ?int $year,
        ?string $instansi = null,
        ?string $area = null
    ): array {
        $items = (clone $this->buildImportedTemuanQuery($scope, $year, $instansi, $area))
            ->select([
                'answers.id',
                'answers.question_code as answer_question_code',
                'caps.id as cap_id',
                'caps.external_cap_id',
                'caps.status as cap_status',
                'caps.action_plan',
                'questions.code as question_code',
                'questions.text as question_text',
                'reviews.status as review_status',
                'reviews.finding as review_finding',
                'reviews.description as review_description',
                'reviews.resume as review_resume',
                'areas.category as area_name',
                'sessions.scope',
                'sessions.instansi_name',
                'sessions.start_date',
                'sessions.end_date',
            ])
            ->leftJoin('external_dnp_questions as questions', function ($join) {
                $join->on('questions.scope', '=', 'sessions.scope')
                    ->on('questions.code', '=', 'answers.question_code');
            })
            ->orderByDesc('sessions.start_date')
            ->orderBy('sessions.instansi_name')
            ->orderBy('areas.category')
            ->orderBy('questions.code')
            ->get();

        $fulfillmentsByCapId = ExternalDnpCapFulfillment::query()
            ->whereIn('cap_id', $items->pluck('cap_id')->filter()->unique()->values())
            ->get()
            ->groupBy('cap_id');

        return $items
            ->map(function ($item) use ($fulfillmentsByCapId) {
                $fulfillments = $item->cap_id
                    ? ($fulfillmentsByCapId[$item->cap_id] ?? collect())
                    : collect();
                $highestProgress = (int) ($fulfillments->max(
                    fn ($fulfillment) => (int) ($fulfillment->progress ?? 0)
                ) ?? 0);
                $latestFulfillment = $fulfillments
                    ->filter(fn ($fulfillment) => $fulfillment->submitted_at || $fulfillment->created_at)
                    ->sortByDesc(function ($fulfillment) {
                        $submitted = $fulfillment->submitted_at?->timestamp ?? 0;
                        $created = $fulfillment->created_at?->timestamp ?? 0;
                        return max($submitted, $created);
                    })
                    ->first();
                $year = null;
                if ($item->start_date) {
                    try {
                        $year = (int) date('Y', strtotime((string) $item->start_date));
                    } catch (\Throwable) {
                        $year = null;
                    }
                }

                return [
                    'id' => $item->id,
                    'scope' => $item->scope,
                    'year' => $year,
                    'instansiName' => $item->instansi_name ?: '-',
                    'schedule' => $this->formatSchedule(
                        $item->start_date ? (string) $item->start_date : null,
                        $item->end_date ? (string) $item->end_date : null
                    ),
                    'area' => $item->area_name ?: '-',
                    'questionCode' => $item->question_code ?: ($item->answer_question_code ?: '-'),
                    'questionText' => $item->question_text ?: '',
                    'findingText' => $item->review_finding
                        ?: $item->review_description
                        ?: $item->review_resume
                        ?: '',
                    'reviewStatus' => $item->review_status ?: '-',
                    'capStatus' => $item->cap_status ?: '-',
                    'capId' => $item->cap_id,
                    'externalCapId' => $item->external_cap_id,
                    'step' => (int) ($latestFulfillment?->step ?? 0),
                    'progress' => $highestProgress,
                    'fulfillmentStatus' => $latestFulfillment?->status ?: '-',
                    'completeDate' => $latestFulfillment?->complete_date
                        ? (string) $latestFulfillment->complete_date
                        : null,
                    'submittedAt' => $latestFulfillment?->submitted_at
                        ? (string) $latestFulfillment->submitted_at
                        : null,
                    'createdAt' => $latestFulfillment?->created_at
                        ? (string) $latestFulfillment->created_at
                        : null,
                    'actionPlan' => $item->action_plan ?: '',
                    'proposeAction' => $latestFulfillment?->propose_action ?: '',
                    'actionOffice' => $latestFulfillment?->action_office ?: '',
                    'evidenceReference' => $latestFulfillment?->evidence_reference ?: null,
                ];
            })
            ->values()
            ->all();
    }

    private function buildWhatsappMessage(
        string $scope,
        ?int $year,
        ?string $instansi = null,
        ?string $area = null,
        bool $compactSummary = false
    ): string {
        if ($compactSummary) {
            $payload = $this->buildTemuanPayload($scope, $year, 'summary', $instansi, $area);
            return $this->formatSummaryMessage($payload['summary'] ?? []);
        }

        $payload = $this->buildTemuanPayload($scope, $year, 'list', $instansi, $area);
        return $this->formatListMessage(
            $payload['summary'] ?? [],
            $payload['items'] ?? [],
            $scope,
            $year
        );
    }

    private function buildBatchSectionMessage(array $item, int $index): string
    {
        $scope = (string) ($item['scope'] ?? 'all');
        $year = isset($item['year']) ? (is_numeric($item['year']) ? (int) $item['year'] : null) : null;
        $instansi = $item['instansi'] ?? null;
        $area = $item['area'] ?? null;
        $compactSummary = (bool) ($item['compactSummary'] ?? false);

        $header = [
            $index.'. '.($instansi ?: 'Semua Instansi'),
            'Scope : '.($scope === 'all' ? 'Semua scope' : ucfirst($scope)),
            'Tahun : '.($year !== null ? (string) $year : 'Semua tahun'),
            'Area  : '.($area ?: 'Semua area'),
            'Mode  : '.($compactSummary ? 'Ringkas temuan' : 'Detail per scope'),
        ];

        return implode("\n", array_merge(
            $header,
            [''],
            [trim($this->buildWhatsappMessage($scope, $year, $instansi, $area, $compactSummary))]
        ));
    }

    private function buildBatchMessage(array $normalizedItems): string
    {
        $sections = [];
        foreach ($normalizedItems as $index => $item) {
            $sections[] = $this->buildBatchSectionMessage($item, $index + 1);
        }

        return implode("\n\n", array_merge(
            ['LAPORAN TEMUAN DNP'],
            $sections
        ));
    }

    private function buildImportedTemuanQuery(
        string $scope,
        ?int $year,
        ?string $instansi = null,
        ?string $area = null
    ): Builder
    {
        return ExternalDnpAnswer::query()
            ->from('external_dnp_answers as answers')
            ->join('external_dnp_reviews as reviews', 'reviews.answer_id', '=', 'answers.id')
            ->join('external_dnp_session_areas as areas', 'areas.id', '=', 'answers.session_area_id')
            ->join('external_dnp_sessions as sessions', 'sessions.id', '=', 'areas.session_id')
            ->leftJoin('external_dnp_caps as caps', 'caps.answer_id', '=', 'answers.id')
            ->where('answers.is_submitted', true)
            ->where('reviews.status', 'Not Satisfactory')
            ->whereNotNull('reviews.sent_at')
            ->when($scope !== 'all', function (Builder $query) use ($scope) {
                $query->where('sessions.scope', $scope);
            })
            ->when($year !== null, function (Builder $query) use ($year) {
                $query->whereYear('sessions.start_date', $year);
            })
            ->when($instansi !== null, function (Builder $query) use ($instansi) {
                $query->whereRaw(
                    "COALESCE(NULLIF(TRIM(sessions.instansi_name), ''), '-') = ?",
                    [$instansi]
                );
            })
            ->when($area !== null, function (Builder $query) use ($area) {
                $query->whereRaw(
                    "COALESCE(NULLIF(TRIM(areas.category), ''), '-') = ?",
                    [$area]
                );
            });
    }

    private function countCompletedTemuan(Builder $baseQuery): int
    {
        return (clone $baseQuery)
            ->whereExists(function ($query) {
                $query->selectRaw('1')
                    ->from('external_dnp_caps as completed_caps')
                    ->join(
                        'external_dnp_cap_fulfillments as completed_fulfillments',
                        'completed_fulfillments.cap_id',
                        '=',
                        'completed_caps.id'
                    )
                    ->whereColumn('completed_caps.answer_id', 'answers.id')
                    ->where('completed_fulfillments.progress', '>=', 100);
            })
            ->count('answers.id');
    }

    private function buildScopeBreakdown(
        string $scope,
        ?int $year,
        ?string $instansi = null,
        ?string $area = null
    ): array
    {
        $scopes = $scope === 'all'
            ? ['audit', 'inspeksi', 'surveillance']
            : [$scope];

        $rows = [];
        foreach ($scopes as $scopeItem) {
            $rows[$scopeItem] = (clone $this->buildImportedTemuanQuery(
                $scopeItem,
                $year,
                $instansi,
                $area
            ))->count('answers.id');
        }

        return $rows;
    }

    private function buildInstansiBreakdown(
        string $scope,
        ?int $year,
        ?string $instansi = null,
        ?string $area = null
    ): array
    {
        return (clone $this->buildImportedTemuanQuery($scope, $year, $instansi, $area))
            ->selectRaw("
                COALESCE(NULLIF(TRIM(sessions.instansi_name), ''), '-') as instansi_name,
                COUNT(*) as total_temuan,
                SUM(
                    CASE WHEN EXISTS (
                        SELECT 1
                        FROM external_dnp_caps completed_caps
                        INNER JOIN external_dnp_cap_fulfillments completed_fulfillments
                            ON completed_fulfillments.cap_id = completed_caps.id
                        WHERE completed_caps.answer_id = answers.id
                            AND completed_fulfillments.progress >= 100
                    ) THEN 1 ELSE 0 END
                ) as total_terpenuhi,
                SUM(
                    CASE WHEN EXISTS (
                        SELECT 1
                        FROM external_dnp_caps completed_caps
                        INNER JOIN external_dnp_cap_fulfillments completed_fulfillments
                            ON completed_fulfillments.cap_id = completed_caps.id
                        WHERE completed_caps.answer_id = answers.id
                            AND completed_fulfillments.progress >= 100
                    ) THEN 0 ELSE 1 END
                ) as total_belum_terpenuhi
            ")
            ->groupByRaw("COALESCE(NULLIF(TRIM(sessions.instansi_name), ''), '-')")
            ->orderByDesc('total_temuan')
            ->orderBy('instansi_name')
            ->get()
            ->map(function ($row) {
                return [
                    'instansiName' => $row->instansi_name,
                    'totalTemuan' => (int) $row->total_temuan,
                    'totalTerpenuhi' => (int) $row->total_terpenuhi,
                    'totalBelumTerpenuhi' => (int) $row->total_belum_terpenuhi,
                ];
            })
            ->values()
            ->all();
    }

    private function buildInstansiOptions(): array
    {
        return (clone $this->buildImportedTemuanQuery('all', null))
            ->selectRaw("COALESCE(NULLIF(TRIM(sessions.instansi_name), ''), '-') as instansi_name")
            ->groupByRaw("COALESCE(NULLIF(TRIM(sessions.instansi_name), ''), '-')")
            ->orderBy('instansi_name')
            ->get()
            ->map(function ($row) {
                return [
                    'value' => $row->instansi_name,
                    'label' => $row->instansi_name,
                ];
            })
            ->values()
            ->all();
    }

    private function buildYearOptions(?string $instansi = null): array
    {
        return (clone $this->buildImportedTemuanQuery('all', null, $instansi))
            ->selectRaw('YEAR(sessions.start_date) as session_year')
            ->whereNotNull('sessions.start_date')
            ->groupByRaw('YEAR(sessions.start_date)')
            ->orderByDesc('session_year')
            ->get()
            ->map(function ($row) {
                return (int) $row->session_year;
            })
            ->values()
            ->all();
    }

    private function buildScopeOptions(?string $instansi = null, ?int $year = null): array
    {
        return (clone $this->buildImportedTemuanQuery('all', $year, $instansi))
            ->select('sessions.scope')
            ->groupBy('sessions.scope')
            ->orderBy('sessions.scope')
            ->get()
            ->map(function ($row) {
                $value = (string) $row->scope;
                return [
                    'value' => $value,
                    'label' => ucfirst($value),
                ];
            })
            ->values()
            ->all();
    }

    private function buildAreaOptions(?string $instansi = null, string $scope = 'all', ?int $year = null): array
    {
        return (clone $this->buildImportedTemuanQuery($scope, $year, $instansi))
            ->selectRaw("COALESCE(NULLIF(TRIM(areas.category), ''), '-') as area_name")
            ->groupByRaw("COALESCE(NULLIF(TRIM(areas.category), ''), '-')")
            ->orderBy('area_name')
            ->get()
            ->map(function ($row) {
                return [
                    'value' => $row->area_name,
                    'label' => $row->area_name,
                ];
            })
            ->values()
            ->all();
    }

    private function normalizeFilterValue(mixed $value): ?string
    {
        if (!is_string($value)) {
            return null;
        }

        $normalized = trim($value);
        if ($normalized === '' || strtolower($normalized) === 'all') {
            return null;
        }

        return $normalized;
    }

    private function trimText(?string $value, int $limit): string
    {
        $text = trim(preg_replace('/\s+/', ' ', (string) ($value ?? '')));
        if (mb_strlen($text) <= $limit) {
            return $text;
        }

        return rtrim(mb_substr($text, 0, max(0, $limit - 3))).'...';
    }

    private function formatSummaryMessage(array $summary): string
    {
        $byScope = is_array($summary['byScope'] ?? null) ? $summary['byScope'] : [];
        $byInstansi = is_array($summary['byInstansi'] ?? null) ? $summary['byInstansi'] : [];

        $lines = [
            'RINGKASAN TEMUAN DNP',
            '',
            'Total temuan        : '.(int) ($summary['totalTemuan'] ?? 0),
            'Total instansi      : '.(int) ($summary['totalInstansi'] ?? 0),
            'Total area          : '.(int) ($summary['totalArea'] ?? 0),
            'Terpenuhi (100%)    : '.(int) ($summary['totalTerpenuhi'] ?? 0),
            'Belum terpenuhi     : '.(int) ($summary['totalBelumTerpenuhi'] ?? 0),
            '',
            'Per Scope',
            '  Audit        : '.(int) ($byScope['audit'] ?? 0),
            '  Inspeksi     : '.(int) ($byScope['inspeksi'] ?? 0),
            '  Surveillance : '.(int) ($byScope['surveillance'] ?? 0),
        ];

        if ($byInstansi !== []) {
            $lines[] = '';
            $lines[] = 'Per Instansi';
            foreach ($byInstansi as $item) {
                if (!is_array($item)) {
                    continue;
                }

                $lines[] = '';
                $lines[] = (string) ($item['instansiName'] ?? '-');
                $lines[] = '  Total     : '.(int) ($item['totalTemuan'] ?? 0);
                $lines[] = '  Terpenuhi : '.(int) ($item['totalTerpenuhi'] ?? 0);
                $lines[] = '  Belum     : '.(int) ($item['totalBelumTerpenuhi'] ?? 0);
            }
        }

        return implode("\n", $lines);
    }

    private function formatListMessage(array $summary, array $items, string $scope, ?int $year): string
    {
        $periodLabel = $year !== null ? 'tahun '.$year : 'semua tahun';
        $scopeLabel = $scope === 'all' ? 'SEMUA SCOPE' : strtoupper($scope);

        if ($items === []) {
            return implode("\n", [
                'Tidak ada temuan DNP',
                'Scope   : '.($scope === 'all' ? 'semua scope' : $scope),
                'Periode : '.$periodLabel,
            ]);
        }

        $lines = [
            'TEMUAN DNP - '.$scopeLabel,
            'Periode : '.$periodLabel,
            '',
            'Total data     : '.(int) ($summary['totalTemuan'] ?? count($items)),
            'Total instansi : '.(int) ($summary['totalInstansi'] ?? 0),
            'Terpenuhi      : '.(int) ($summary['totalTerpenuhi'] ?? 0),
            'Belum terpenuhi: '.(int) ($summary['totalBelumTerpenuhi'] ?? 0),
        ];

        $groupStats = [];
        $groupProgress = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }

            $instansiName = (string) ($item['instansiName'] ?? '-');
            $areaName = (string) ($item['area'] ?? '-');
            $schedule = (string) ($item['schedule'] ?? '-');
            $scopeName = (string) ($item['scope'] ?? '-');
            $groupKey = $scopeName.'::'.$instansiName.'::'.$areaName.'::'.$schedule;

            if (!isset($groupStats[$groupKey])) {
                $groupStats[$groupKey] = [
                    'scope' => $scopeName,
                    'terpenuhi' => 0,
                    'belum' => 0,
                ];
            }

            if ((int) ($item['progress'] ?? 0) >= 100) {
                $groupStats[$groupKey]['terpenuhi']++;
            } else {
                $groupStats[$groupKey]['belum']++;
            }

            $progress = (int) ($item['progress'] ?? 0);
            $code = trim((string) ($item['questionCode'] ?? '-')) ?: '-';
            if (!isset($groupProgress[$groupKey])) {
                $groupProgress[$groupKey] = [];
            }
            if (!isset($groupProgress[$groupKey][$progress])) {
                $groupProgress[$groupKey][$progress] = [];
            }
            if (!in_array($code, $groupProgress[$groupKey][$progress], true)) {
                $groupProgress[$groupKey][$progress][] = $code;
            }
        }

        foreach ($groupStats as $groupKey => $stats) {
            [$scopeName, $instansiName, $areaName, $schedule] = explode('::', $groupKey, 4);

            $lines[] = '';
            $lines[] = $instansiName;
            if ($scope === 'all') {
                $lines[] = '  Scope    : '.ucfirst($scopeName);
            }
            $lines[] = '  Area     : '.$areaName;
            $lines[] = '  Schedule : '.$schedule;
            $lines[] = '  Terpenuhi      : '.(int) ($stats['terpenuhi'] ?? 0);
            $lines[] = '  Belum terpenuhi: '.(int) ($stats['belum'] ?? 0);

            $progressGroups = $groupProgress[$groupKey] ?? [];
            krsort($progressGroups);
            foreach ($progressGroups as $progress => $codes) {
                if (!is_array($codes) || $codes === []) {
                    continue;
                }

                $joinedCodes = implode(', ', array_map(
                    fn ($code) => '['.$code.']',
                    $codes
                ));
                $lines[] = '  Progress '.(int) $progress.'% : '.$joinedCodes;
            }
        }

        return implode("\n", $lines);
    }

    private function whatsappApiUrl(): string
    {
        $serviceUrl = rtrim((string) config('services.whatsapp_api.service_url', ''), '/');
        if ($serviceUrl === '') {
            throw new \RuntimeException('WhatsApp API service URL belum dikonfigurasi.');
        }

        return $serviceUrl;
    }

    private function whatsappApiHttp(int $timeout = 30): PendingRequest
    {
        $token = trim((string) config('services.whatsapp_api.internal_token', ''));
        if ($token === '') {
            throw new \RuntimeException('WhatsApp API internal token belum dikonfigurasi.');
        }

        return Http::timeout($timeout)
            ->acceptJson()
            ->withHeaders([
                'Content-Type' => 'application/json',
                'X-Internal-Token' => $token,
            ]);
    }

    private function formatSchedule(?string $startDate, ?string $endDate): ?string
    {
        if (!$startDate && !$endDate) {
            return null;
        }
        if ($startDate && $endDate && $startDate !== $endDate) {
            return $startDate.' - '.$endDate;
        }

        return $startDate ?: $endDate;
    }
}
