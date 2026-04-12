<?php

namespace App\Http\Controllers\Api;

use App\Jobs\RunSelfAssessmentExportDnpImport;
use App\Models\SelfAssessmentAnswer;
use App\Models\SelfAssessmentEvidence;
use App\Models\SelfAssessmentExportDnpImportJob;
use App\Models\SelfAssessmentExportDnpSnapshot;
use App\Models\SelfAssessmentExportDnpSnapshotItem;
use App\Models\SelfAssessmentSessionArea;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;

class SelfAssessmentExportDnpController extends ApiController
{
    public function init(Request $request)
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
                'admin.self-assessment.export-dnp.captcha',
                now()->addMinutes(10),
                ['sessionId' => $sessionId]
            ),
        ]);
    }

    public function captcha(Request $request)
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

    public function import(Request $request)
    {
        $validated = $request->validate([
            'sessionAreaId' => ['required', 'uuid', 'exists:self_assessment_session_areas,id'],
            'userId' => ['required', 'uuid', 'exists:users,id'],
            'sessionId' => ['required', 'string'],
            'captcha' => ['required', 'string'],
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
            'year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'fillCode1' => ['required', 'string'],
            'fillCode2' => ['required', 'string'],
            'fillArea' => ['nullable', 'string'],
        ]);

        $area = SelfAssessmentSessionArea::query()
            ->with('session')
            ->find($validated['sessionAreaId']);
        if (!$area) {
            return response()->json(['error' => 'Session area tidak ditemukan.'], 404);
        }

        $scope = (string) ($area->session?->scope ?? '');
        if (!in_array($scope, ['audit', 'inspeksi', 'surveillance'], true)) {
            return response()->json(['error' => 'Scope tidak didukung untuk compare DNP.'], 422);
        }

        $userId = (string) optional($request->user())->id;
        if ($userId === '') {
            return response()->json(['error' => 'User tidak valid.'], 401);
        }

        $runningJob = SelfAssessmentExportDnpImportJob::query()
            ->where('user_id', $userId)
            ->where('session_area_id', $validated['sessionAreaId'])
            ->where('target_user_id', $validated['userId'])
            ->whereIn('status', ['queued', 'running'])
            ->latest('created_at')
            ->first();

        if ($runningJob) {
            return $this->respondData([
                'jobId' => $runningJob->id,
                'status' => $runningJob->status,
                'message' => 'Pengambilan data DNP sebelumnya masih berjalan.',
            ], 202);
        }

        $year = (int) ($validated['year'] ?? optional($area->session?->start_date)->format('Y') ?? now()->format('Y'));

        $importJob = SelfAssessmentExportDnpImportJob::query()->create([
            'user_id' => $userId,
            'session_area_id' => $validated['sessionAreaId'],
            'target_user_id' => $validated['userId'],
            'scope' => $scope,
            'year' => $year,
            'fill_code1' => $validated['fillCode1'],
            'fill_code2' => $validated['fillCode2'],
            'fill_area' => (string) ($validated['fillArea'] ?? ''),
            'status' => 'queued',
            'message' => 'Pengambilan data export DNP dimasukkan ke antrean.',
        ]);

        $payload = $validated;
        $payload['year'] = $year;

        RunSelfAssessmentExportDnpImport::dispatch(
            importJobId: (string) $importJob->id,
            userId: $userId,
            payload: $payload
        );

        return $this->respondData([
            'jobId' => $importJob->id,
            'status' => $importJob->status,
            'message' => $importJob->message,
        ], 202);
    }

    public function importStatus(Request $request, SelfAssessmentExportDnpImportJob $job)
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
            'detail' => is_array($job->summary) ? ($job->summary['detail'] ?? null) : null,
            'debugLog' => is_array($job->summary) ? ($job->summary['debugLog'] ?? null) : null,
            'startedAt' => optional($job->started_at)->toDateTimeString(),
            'finishedAt' => optional($job->finished_at)->toDateTimeString(),
            'createdAt' => optional($job->created_at)->toDateTimeString(),
        ]);
    }

    public function saveMatches(Request $request)
    {
        $validated = $request->validate([
            'sessionAreaId' => ['required', 'uuid', 'exists:self_assessment_session_areas,id'],
            'userId' => ['required', 'uuid', 'exists:users,id'],
            'matches' => ['present', 'array'],
            'matches.*.answerId' => ['required', 'uuid'],
            'matches.*.localQuestionCode' => ['required', 'string'],
            'matches.*.localQuestionText' => ['required', 'string'],
            'matches.*.dnpSnapshotItemId' => ['required', 'uuid'],
            'matches.*.dnpQuestionCode' => ['nullable', 'string'],
            'matches.*.dnpQuestionText' => ['nullable', 'string'],
            'matches.*.dnpReference' => ['nullable', 'string'],
            'matches.*.similarity' => ['required', 'numeric', 'min:0', 'max:100'],
        ]);

        $snapshot = SelfAssessmentExportDnpSnapshot::query()
            ->where('session_area_id', $validated['sessionAreaId'])
            ->where('user_id', $validated['userId'])
            ->with('items:id,snapshot_id')
            ->first();

        if (!$snapshot) {
            return response()->json(['error' => 'Snapshot compare DNP belum tersedia.'], 404);
        }

        $validItemIds = $snapshot->items->pluck('id')->map(fn ($id) => (string) $id)->all();
        $validItemLookup = array_fill_keys($validItemIds, true);

        $selectedMatches = [];
        foreach ($validated['matches'] as $match) {
            $dnpSnapshotItemId = (string) $match['dnpSnapshotItemId'];
            if (!isset($validItemLookup[$dnpSnapshotItemId])) {
                return response()->json([
                    'error' => 'Ada target pertanyaan DNP yang tidak valid untuk snapshot ini.',
                ], 422);
            }

            $selectedMatches[] = [
                'answerId' => (string) $match['answerId'],
                'localQuestionCode' => (string) $match['localQuestionCode'],
                'localQuestionText' => (string) $match['localQuestionText'],
                'dnpSnapshotItemId' => $dnpSnapshotItemId,
                'dnpQuestionCode' => (string) ($match['dnpQuestionCode'] ?? ''),
                'dnpQuestionText' => (string) ($match['dnpQuestionText'] ?? ''),
                'dnpReference' => (string) ($match['dnpReference'] ?? ''),
                'similarity' => max(0, min(100, (int) round((float) $match['similarity']))),
            ];
        }

        $summary = is_array($snapshot->summary) ? $snapshot->summary : [];
        $summary['selectedMatches'] = array_values($selectedMatches);
        $summary['selectedMatchesUpdatedAt'] = now()->toDateTimeString();

        $snapshot->summary = $summary;
        $snapshot->save();

        return $this->respondData([
            'selectedMatches' => $summary['selectedMatches'],
            'updatedAt' => $summary['selectedMatchesUpdatedAt'],
        ]);
    }

    public function exportDraft(Request $request)
    {
        $validated = $request->validate([
            'sessionAreaId' => ['required', 'uuid', 'exists:self_assessment_session_areas,id'],
            'userId' => ['required', 'uuid', 'exists:users,id'],
            'sessionId' => ['required', 'string'],
            'answerIds' => ['nullable', 'array'],
            'answerIds.*' => ['required', 'uuid'],
        ]);

        $snapshot = SelfAssessmentExportDnpSnapshot::query()
            ->where('session_area_id', $validated['sessionAreaId'])
            ->where('user_id', $validated['userId'])
            ->with('items')
            ->first();

        if (!$snapshot) {
            return response()->json(['error' => 'Snapshot compare DNP belum tersedia.'], 404);
        }

        $selectedMatches = collect(data_get($snapshot->summary, 'selectedMatches', []))
            ->filter(fn ($item) => is_array($item))
            ->values();
        if ($selectedMatches->isEmpty()) {
            return response()->json(['error' => 'Belum ada pairing pertanyaan yang dipilih.'], 422);
        }

        $targetAnswerIds = collect($validated['answerIds'] ?? [])
            ->map(fn ($item) => (string) $item)
            ->filter()
            ->values();
        if ($targetAnswerIds->isNotEmpty()) {
            $selectedMatches = $selectedMatches
                ->filter(fn (array $item) => $targetAnswerIds->contains((string) ($item['answerId'] ?? '')))
                ->values();
        }

        if ($selectedMatches->isEmpty()) {
            return response()->json(['error' => 'Tidak ada pairing yang dipilih untuk diexport.'], 422);
        }

        $answers = SelfAssessmentAnswer::query()
            ->where('session_area_id', $validated['sessionAreaId'])
            ->where('user_id', $validated['userId'])
            ->whereIn('id', $selectedMatches->pluck('answerId')->all())
            ->get()
            ->keyBy('id');

        $snapshotItems = $snapshot->items->keyBy('id');
        $answerEvidence = SelfAssessmentEvidence::query()
            ->where('session_area_id', $validated['sessionAreaId'])
            ->where('user_id', $validated['userId'])
            ->whereIn('question_code', $answers->pluck('question_code')->all())
            ->orderBy('created_at')
            ->get()
            ->groupBy('question_code');

        $results = [];
        foreach ($selectedMatches as $match) {
            $answerId = (string) ($match['answerId'] ?? '');
            $snapshotItemId = (string) ($match['dnpSnapshotItemId'] ?? '');
            /** @var SelfAssessmentAnswer|null $answer */
            $answer = $answers->get($answerId);
            /** @var SelfAssessmentExportDnpSnapshotItem|null $snapshotItem */
            $snapshotItem = $snapshotItems->get($snapshotItemId);

            if (!$answer || !$snapshotItem) {
                $results[] = [
                    'answerId' => $answerId,
                    'localQuestionCode' => (string) ($match['localQuestionCode'] ?? ''),
                    'dnpQuestionCode' => (string) ($match['dnpQuestionCode'] ?? ''),
                    'status' => 'skipped',
                    'message' => 'Jawaban lokal atau target DNP tidak ditemukan.',
                ];
                continue;
            }

            $draftPayload = data_get($snapshotItem->raw_payload, 'draft_payload', []);
            if (!is_array($draftPayload) || empty($draftPayload['plan_id']) || empty($draftPayload['pq_id'])) {
                $results[] = [
                    'answerId' => $answerId,
                    'localQuestionCode' => $answer->question_code,
                    'dnpQuestionCode' => (string) ($match['dnpQuestionCode'] ?? ''),
                    'status' => 'failed',
                    'message' => 'Draft payload DNP tidak lengkap.',
                ];
                continue;
            }

            $payload = array_merge($draftPayload, [
                'action' => 'selfassessment_save_draft',
                'type' => $snapshot->scope,
                'session_id' => $validated['sessionId'],
                'plan_id' => (string) ($draftPayload['plan_id'] ?? $snapshotItem->plan_id ?? ''),
                'area_group_id' => (string) ($draftPayload['area_group_id'] ?? $snapshotItem->area_group_id ?? ''),
                'pq_id' => (string) ($draftPayload['pq_id'] ?? $snapshotItem->pq_id ?? ''),
                'data_id' => (string) ($snapshotItem->data_id ?? data_get($snapshotItem->raw_payload, 'data_id', '')),
                'is_file_exist' => (($answerEvidence->get($answer->question_code)?->count() ?? 0) > 0) ? '1' : (string) ($draftPayload['is_file_exist'] ?? '0'),
                'pq_desc' => (string) ($draftPayload['pq_desc'] ?? data_get($snapshotItem->raw_payload, 'pq_desc', $snapshotItem->question_text ?? '')),
                'konten_ref' => (string) ($draftPayload['konten_ref'] ?? $snapshotItem->reference ?? ''),
                'ass_status' => $this->mapLocalStatusToDnp((string) $answer->status),
                'comment' => (string) ($answer->comment ?? ''),
                'evidence' => (string) ($answer->evidence_note ?? ''),
                'status' => 'draft',
            ]);

            try {
                $response = $this->wrapperHttp(120)->post($this->wrapperUrl().'/automation-run', $payload);
            } catch (\RuntimeException $exception) {
                $results[] = [
                    'answerId' => $answerId,
                    'localQuestionCode' => $answer->question_code,
                    'dnpQuestionCode' => (string) ($match['dnpQuestionCode'] ?? ''),
                    'status' => 'failed',
                    'message' => $exception->getMessage(),
                ];
                continue;
            }

            $responsePayload = $response->json();
            if (!$response->ok()) {
                $results[] = [
                    'answerId' => $answerId,
                    'localQuestionCode' => $answer->question_code,
                    'dnpQuestionCode' => (string) ($match['dnpQuestionCode'] ?? ''),
                    'status' => 'failed',
                    'message' => (is_array($responsePayload) ? ($responsePayload['error'] ?? null) : null) ?? 'Gagal export draft ke DNP.',
                    'detail' => is_array($responsePayload) ? $responsePayload : $response->body(),
                ];
                continue;
            }

            $results[] = [
                'answerId' => $answerId,
                'localQuestionCode' => $answer->question_code,
                'dnpQuestionCode' => (string) ($match['dnpQuestionCode'] ?? ''),
                'status' => 'success',
                'message' => 'Draft berhasil dikirim ke DNP.',
                'response' => is_array($responsePayload) ? $responsePayload : null,
            ];

            $evidenceItems = $answerEvidence->get($answer->question_code, collect());
            $uploadResults = [];
            foreach ($evidenceItems as $evidence) {
                $relativePath = $this->resolveEvidenceStoragePath((string) ($evidence->url ?? ''));
                if (!$relativePath || !Storage::disk('public')->exists($relativePath)) {
                    $uploadResults[] = [
                        'evidenceId' => $evidence->id,
                        'fileName' => $evidence->name,
                        'status' => 'skipped',
                        'message' => 'File evidence lokal tidak ditemukan.',
                    ];
                    continue;
                }

                $absolutePath = Storage::disk('public')->path($relativePath);
                $mimeType = Storage::disk('public')->mimeType($relativePath) ?: 'application/octet-stream';

                try {
                    $uploadResponse = Http::acceptJson()
                        ->timeout(180)
                        ->withHeaders([
                            'X-Internal-Token' => (string) config('services.external_dnp.wrapper_internal_token', ''),
                        ])
                        ->attach('file', fopen($absolutePath, 'r'), $evidence->name ?? basename($absolutePath))
                        ->post($this->wrapperUrl().'/automation-run', [
                            'action' => 'selfassessment_upload_file',
                            'type' => $snapshot->scope,
                            'session_id' => $validated['sessionId'],
                            'plan_id' => (string) ($draftPayload['plan_id'] ?? $snapshotItem->plan_id ?? ''),
                            'area_group_id' => (string) ($draftPayload['area_group_id'] ?? $snapshotItem->area_group_id ?? ''),
                            'pq_id' => (string) ($draftPayload['pq_id'] ?? $snapshotItem->pq_id ?? ''),
                            'data_id' => (string) ($snapshotItem->data_id ?? data_get($snapshotItem->raw_payload, 'data_id', '')),
                            'mime_type' => $mimeType,
                        ]);
                } catch (\Throwable $exception) {
                    $uploadResults[] = [
                        'evidenceId' => $evidence->id,
                        'fileName' => $evidence->name,
                        'status' => 'failed',
                        'message' => $exception->getMessage(),
                    ];
                    continue;
                }

                $uploadPayload = $uploadResponse->json();
                $uploadResults[] = [
                    'evidenceId' => $evidence->id,
                    'fileName' => $evidence->name,
                    'status' => $uploadResponse->ok() ? 'success' : 'failed',
                    'message' => $uploadResponse->ok()
                        ? 'File evidence berhasil diupload ke DNP.'
                        : ((is_array($uploadPayload) ? ($uploadPayload['error'] ?? null) : null) ?? 'Gagal upload file evidence ke DNP.'),
                ];
            }

            $results[array_key_last($results)]['uploads'] = $uploadResults;
        }

        $successCount = collect($results)->where('status', 'success')->count();
        $failedCount = collect($results)->where('status', 'failed')->count();
        $skippedCount = collect($results)->where('status', 'skipped')->count();

        return $this->respondData([
            'summary' => [
                'total' => count($results),
                'success' => $successCount,
                'failed' => $failedCount,
                'skipped' => $skippedCount,
            ],
            'results' => $results,
        ]);
    }

    public function importRun(Request $request)
    {
        $validated = $request->validate([
            'sessionAreaId' => ['required', 'uuid', 'exists:self_assessment_session_areas,id'],
            'userId' => ['required', 'uuid', 'exists:users,id'],
            'sessionId' => ['required', 'string'],
            'captcha' => ['required', 'string'],
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
            'year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'fillCode1' => ['required', 'string'],
            'fillCode2' => ['required', 'string'],
            'fillArea' => ['nullable', 'string'],
        ]);

        $area = SelfAssessmentSessionArea::query()
            ->with('session')
            ->find($validated['sessionAreaId']);
        if (!$area) {
            return response()->json(['error' => 'Session area tidak ditemukan.'], 404);
        }

        $scope = (string) ($area->session?->scope ?? '');
        if (!in_array($scope, ['audit', 'inspeksi', 'surveillance'], true)) {
            return response()->json(['error' => 'Scope tidak didukung untuk compare DNP.'], 422);
        }

        $year = (int) ($validated['year'] ?? optional($area->session?->start_date)->format('Y') ?? now()->format('Y'));

        try {
            $wrapperUrl = $this->wrapperUrl();
            $compareResponse = $this->wrapperHttp(240)->post($wrapperUrl.'/automation-run', [
                'action' => 'selfassessment_compare',
                'type' => $scope,
                'stage' => 'selfassessment',
                'year' => (string) $year,
                'session_id' => $validated['sessionId'],
                'fill_code1' => (string) $validated['fillCode1'],
                'fill_code2' => (string) $validated['fillCode2'],
                'fill_area' => (string) ($validated['fillArea'] ?? ''),
                'captcha' => $validated['captcha'],
                'username' => $validated['username'],
                'password' => $validated['password'],
            ]);
        } catch (\RuntimeException $exception) {
            return response()->json(['error' => $exception->getMessage()], 500);
        }

        if ($compareResponse->status() === 401) {
            $payload = $compareResponse->json();
            return response()->json([
                'error' => (is_array($payload) ? ($payload['error'] ?? null) : null) ?? 'Login DNP gagal.',
                'needNewSession' => true,
                'detail' => is_array($payload) ? ($payload['detail'] ?? null) : null,
                'debugLog' => is_array($payload) ? ($payload['debug_log'] ?? null) : null,
            ], 401);
        }

        if (!$compareResponse->ok()) {
            $detailPayload = $compareResponse->json();
            return response()->json([
                'error' => 'Gagal mengambil data self assessment DNP.',
                'detail' => is_array($detailPayload) ? ($detailPayload['error'] ?? $detailPayload) : $compareResponse->body(),
                'debugLog' => is_array($detailPayload) ? ($detailPayload['debug_log'] ?? null) : null,
            ], 502);
        }

        $comparePayload = $compareResponse->json();
        $items = data_get($comparePayload, 'results.selfassessment.items', []);
        if (!is_array($items)) {
            $items = [];
        }

        $snapshot = SelfAssessmentExportDnpSnapshot::query()->updateOrCreate(
            [
                'session_area_id' => $validated['sessionAreaId'],
                'user_id' => $validated['userId'],
            ],
            [
                'imported_by' => optional($request->user())->id,
                'scope' => $scope,
                'year' => $year,
                'wrapper_session_id' => $validated['sessionId'],
                'fill_code1' => (string) $validated['fillCode1'],
                'fill_code2' => (string) $validated['fillCode2'],
                'fill_area' => (string) ($validated['fillArea'] ?? ''),
                'local_area' => (string) $area->category,
                'summary' => [
                    'itemCount' => count($items),
                    'assessment' => data_get($comparePayload, 'results.selfassessment.assessment'),
                    'selectedMatches' => [],
                ],
                'imported_at' => now(),
            ]
        );

        SelfAssessmentExportDnpSnapshotItem::query()
            ->where('snapshot_id', $snapshot->id)
            ->delete();

        foreach (array_values($items) as $index => $item) {
            if (!is_array($item)) {
                continue;
            }

            $editable = is_array($item['editable'] ?? null) ? $item['editable'] : [];
            SelfAssessmentExportDnpSnapshotItem::query()->create([
                'snapshot_id' => $snapshot->id,
                'sort_order' => $index + 1,
                'question_code' => (string) ($item['pq_no'] ?? ''),
                'question_text' => (string) ($item['pertanyaan'] ?? ''),
                'reference' => (string) ($item['konten_ref'] ?? ''),
                'status' => (string) ($editable['ass_status'] ?? ''),
                'comment' => (string) ($editable['comment'] ?? ''),
                'evidence_note' => (string) ($editable['evidence'] ?? ''),
                'plan_id' => (string) ($item['plan_id'] ?? ''),
                'area_group_id' => (string) ($item['area_group_id'] ?? ''),
                'pq_id' => (string) ($item['pq_id'] ?? ''),
                'data_id' => (string) ($item['data_id'] ?? ''),
                'files' => is_array($item['data_files'] ?? null) ? $item['data_files'] : [],
                'raw_payload' => $item,
            ]);
        }

        $snapshot->load(['items' => fn ($query) => $query->orderBy('sort_order')]);

        $userId = (string) optional($request->user())->id;
        if ($userId !== '') {
            $this->cacheWrapperSession(
                $userId,
                (string) $validated['sessionId'],
                $scope,
                (string) $validated['sessionAreaId'],
                (string) ($validated['fillArea'] ?? '')
            );
        }

        return $this->respondData([
            'snapshot' => $this->snapshotPayload($snapshot),
        ]);
    }

    public function areas(Request $request)
    {
        $validated = $request->validate([
            'sessionAreaId' => ['required', 'uuid', 'exists:self_assessment_session_areas,id'],
            'sessionId' => ['required', 'string'],
            'captcha' => ['required', 'string'],
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
            'year' => ['required', 'integer', 'min:2000', 'max:2100'],
        ]);

        $area = SelfAssessmentSessionArea::query()
            ->with('session')
            ->find($validated['sessionAreaId']);
        if (!$area) {
            return response()->json(['error' => 'Session area tidak ditemukan.'], 404);
        }

        $scope = (string) ($area->session?->scope ?? '');
        if (!in_array($scope, ['audit', 'inspeksi', 'surveillance'], true)) {
            return response()->json(['error' => 'Scope tidak didukung untuk compare DNP.'], 422);
        }

        try {
            $wrapperUrl = $this->wrapperUrl();
            $fillResponse = $this->wrapperHttp(120)->post($wrapperUrl.'/automation-run', [
                'action' => 'selfassessment_fill',
                'type' => $scope,
                'stage' => 'selfassessment',
                'year' => (string) $validated['year'],
                'session_id' => $validated['sessionId'],
                'captcha' => $validated['captcha'],
                'username' => $validated['username'],
                'password' => $validated['password'],
            ]);
        } catch (\RuntimeException $exception) {
            return response()->json(['error' => $exception->getMessage()], 500);
        }

        if ($fillResponse->status() === 401) {
            $payload = $fillResponse->json();
            return response()->json([
                'error' => (is_array($payload) ? ($payload['error'] ?? null) : null) ?? 'Login DNP gagal.',
                'needNewSession' => true,
            ], 401);
        }

        if (!$fillResponse->ok()) {
            return response()->json([
                'error' => 'Gagal mengambil daftar area self assessment dari DNP.',
                'detail' => $fillResponse->body(),
            ], 502);
        }

        $fillPayload = $fillResponse->json();
        $fillTargets = data_get($fillPayload, 'results.selfassessment.fill_targets', []);
        if (!is_array($fillTargets)) {
            $fillTargets = [];
        }

        $userId = (string) optional($request->user())->id;
        if ($userId !== '') {
            $this->cacheWrapperSession(
                $userId,
                (string) $validated['sessionId'],
                $scope,
                (string) $validated['sessionAreaId']
            );
        }

        return $this->respondData([
            'areas' => array_values(array_map(
                static fn ($target) => [
                    'fillCode1' => (string) ($target['code1'] ?? ''),
                    'fillCode2' => (string) ($target['code2'] ?? ''),
                    'area' => (string) ($target['area'] ?? ''),
                ],
                array_filter(
                    $fillTargets,
                    static fn ($target) => is_array($target) && !empty($target['code1']) && !empty($target['code2'])
                )
            )),
        ]);
    }

    public function snapshotPayload(?SelfAssessmentExportDnpSnapshot $snapshot): ?array
    {
        if (!$snapshot) {
            return null;
        }

        return [
            'id' => $snapshot->id,
            'scope' => $snapshot->scope,
            'year' => $snapshot->year,
            'fillCode1' => $snapshot->fill_code1,
            'fillCode2' => $snapshot->fill_code2,
            'fillArea' => $snapshot->fill_area,
            'localArea' => $snapshot->local_area,
            'importedAt' => optional($snapshot->imported_at)->toDateTimeString(),
            'summary' => $snapshot->summary,
            'items' => $snapshot->items
                ->sortBy('sort_order')
                ->values()
                ->map(fn (SelfAssessmentExportDnpSnapshotItem $item) => [
                    'id' => $item->id,
                    'questionCode' => $item->question_code,
                    'questionText' => $item->question_text,
                    'reference' => $item->reference,
                    'status' => $item->status,
                    'comment' => $item->comment,
                    'evidenceNote' => $item->evidence_note,
                    'files' => $item->files ?? [],
                    'sortOrder' => $item->sort_order,
                ])
                ->all(),
        ];
    }

    private function wrapperUrl(): string
    {
        $wrapperUrl = rtrim((string) config('services.external_dnp.wrapper_url', ''), '/');
        if ($wrapperUrl === '') {
            throw new \RuntimeException('EXTERNAL_DNP_WRAPPER_URL belum dikonfigurasi.');
        }

        return $wrapperUrl;
    }

    private function wrapperHttp(int $timeout = 120): PendingRequest
    {
        $token = (string) config('services.external_dnp.wrapper_internal_token', '');
        if ($token === '') {
            throw new \RuntimeException('EXTERNAL_DNP_WRAPPER_INTERNAL_TOKEN belum dikonfigurasi.');
        }

        return Http::acceptJson()
            ->timeout($timeout)
            ->withHeaders([
                'X-Internal-Token' => $token,
            ]);
    }

    private function cacheWrapperSession(
        string $userId,
        string $sessionId,
        string $scope,
        string $sessionAreaId,
        ?string $fillArea = null
    ): void {
        if ($userId === '' || $sessionId === '') {
            return;
        }

        $ttl = now()->addHours(6);

        Cache::put($this->sessionCacheKey($userId), $sessionId, $ttl);
        Cache::put($this->sessionCacheKey($userId, $scope), $sessionId, $ttl);
        Cache::put($this->sessionCacheKey($userId, $scope, $sessionAreaId), $sessionId, $ttl);

        $normalizedFillArea = $this->normalizeCacheSegment($fillArea);
        if ($normalizedFillArea !== '') {
            Cache::put(
                $this->sessionCacheKey($userId, $scope, $sessionAreaId, $normalizedFillArea),
                $sessionId,
                $ttl
            );
        }
    }

    private function sessionCacheKey(
        string $userId,
        ?string $scope = null,
        ?string $sessionAreaId = null,
        ?string $fillArea = null
    ): string {
        $segments = ['self_assessment_export_dnp_wrapper_session', $userId];

        $normalizedScope = $this->normalizeCacheSegment($scope);
        if ($normalizedScope !== '') {
            $segments[] = $normalizedScope;
        }

        $normalizedSessionAreaId = $this->normalizeCacheSegment($sessionAreaId);
        if ($normalizedSessionAreaId !== '') {
            $segments[] = $normalizedSessionAreaId;
        }

        $normalizedFillArea = $this->normalizeCacheSegment($fillArea);
        if ($normalizedFillArea !== '') {
            $segments[] = md5($normalizedFillArea);
        }

        return implode('_', $segments);
    }

    private function normalizeCacheSegment(?string $value): string
    {
        if ($value === null) {
            return '';
        }

        return trim(Str::of($value)->lower()->squish()->value());
    }

    private function mapLocalStatusToDnp(string $status): string
    {
        return match (Str::lower(trim($status))) {
            'satisfactory' => 'SA',
            'not satisfactory' => 'NS',
            'not aplicable', 'not applicable' => 'NA',
            default => 'SA',
        };
    }

    private function resolveEvidenceStoragePath(string $url): ?string
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
        if ($path === '' || str_contains($path, '..') || !str_starts_with($path, 'self-assessment-evidence/')) {
            return null;
        }

        return $path;
    }
}
