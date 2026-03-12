<?php

namespace App\Http\Controllers\Api;

use App\Jobs\RunExternalDnpSync;
use App\Models\ExternalDnpAnswer;
use App\Models\ExternalDnpCap;
use App\Models\ExternalDnpCapExtension;
use App\Models\ExternalDnpCapFulfillment;
use App\Models\ExternalDnpCapFulfillmentFile;
use App\Models\ExternalDnpCapReview;
use App\Models\ExternalDnpReview;
use App\Models\ExternalDnpQuestion;
use App\Models\ExternalDnpSession;
use App\Models\ExternalDnpSessionArea;
use App\Models\ExternalDnpSyncJob;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Str;

class ExternalDnpCapController extends ApiController
{
    public function syncInit()
    {
        try {
            $wrapperUrl = $this->wrapperUrl();
            $response = $this->wrapperHttp(30)->post($wrapperUrl.'/automation-init');
        } catch (\RuntimeException $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
        if (!$response->ok()) {
            return response()->json(['error' => 'Gagal menginisiasi sesi captcha.'], 502);
        }

        $payload = $response->json();
        if (!empty($payload['error']) || empty($payload['session_id'])) {
            return response()->json(['error' => $payload['error'] ?? 'Session ID tidak tersedia.'], 502);
        }

        $sessionId = $payload['session_id'];
        return $this->respondData([
            'sessionId' => $sessionId,
            'captchaUrl' => URL::temporarySignedRoute(
                'external-dnp.sync.captcha',
                now()->addMinutes(10),
                ['sessionId' => $sessionId]
            ),
        ]);
    }

    public function syncCaptcha(Request $request)
    {
        $sessionId = $request->route('sessionId');
        if (!$sessionId) {
            return response()->json(['error' => 'Session ID tidak valid.'], 422);
        }

        try {
            $wrapperUrl = $this->wrapperUrl();
            $response = $this->wrapperHttp(30)
                ->get($wrapperUrl.'/automation-captcha', ['session_id' => $sessionId]);
        } catch (\RuntimeException $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }

        if (!$response->ok()) {
            return response()->json(['error' => 'Gagal memuat captcha.'], 502);
        }

        return response($response->body(), 200)->header('Content-Type', 'image/jpeg');
    }

    public function syncStart(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['nullable', 'in:audit,inspeksi,surveillance'],
            'sessionId' => ['required', 'string'],
            'captcha' => ['required', 'string'],
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $userId = (string) optional($request->user())->id;
        if ($userId === '') {
            return response()->json(['error' => 'User tidak valid.'], 401);
        }

        $runningJob = ExternalDnpSyncJob::query()
            ->where('user_id', $userId)
            ->where('scope', $validated['scope'] ?? null)
            ->whereIn('status', ['queued', 'running'])
            ->latest('created_at')
            ->first();

        if ($runningJob) {
            return $this->respondData([
                'jobId' => $runningJob->id,
                'status' => $runningJob->status,
                'message' => 'Sinkronisasi sebelumnya masih berjalan.',
            ], 202);
        }

        $syncJob = ExternalDnpSyncJob::query()->create([
            'user_id' => $userId,
            'scope' => $validated['scope'] ?? null,
            'status' => 'queued',
            'message' => 'Sinkronisasi dimasukkan ke antrean.',
        ]);

        RunExternalDnpSync::dispatch(
            syncJobId: (string) $syncJob->id,
            userId: $userId,
            payload: $validated
        );

        return $this->respondData([
            'jobId' => $syncJob->id,
            'status' => $syncJob->status,
            'message' => $syncJob->message,
        ], 202);
    }

    public function syncJobStatus(Request $request, ExternalDnpSyncJob $job)
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

    public function syncRun(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['nullable', 'in:audit,inspeksi,surveillance'],
            'sessionId' => ['required', 'string'],
            'captcha' => ['required', 'string'],
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
            'loginOnly' => ['nullable', 'boolean'],
            'instansiName' => ['nullable', 'string'],
        ]);

        try {
            $wrapperUrl = $this->wrapperUrl();
        } catch (\RuntimeException $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }

        $isLoginOnly = (bool) ($validated['loginOnly'] ?? false);
        if ($isLoginOnly) {
            $response = $this->wrapperHttp(60)
                ->post($wrapperUrl.'/automation-run', [
                    'action' => 'login_only',
                    'session_id' => $validated['sessionId'],
                    'captcha' => $validated['captcha'],
                    'username' => $validated['username'],
                    'password' => $validated['password'],
                ]);

            if ($response->status() === 401) {
                return response()->json([
                    'error' => 'Captcha salah atau login gagal.',
                    'needNewSession' => true,
                ], 401);
            }
            if (!$response->ok()) {
                return response()->json([
                    'error' => 'Gagal login ke wrapper.',
                    'detail' => $response->body(),
                ], 502);
            }

            $payload = $response->json();
            if (!is_array($payload)) {
                return response()->json(['error' => 'Respons wrapper tidak valid.'], 502);
            }
            if (!empty($payload['error'])) {
                return response()->json(['error' => $payload['error']], 502);
            }

            $instansiName = trim((string) ($validated['instansiName'] ?? ''));
            if ($instansiName === '') {
                $instansiName = trim((string) ($this->extractInstansiName($payload) ?? ''));
            }

            $userId = (string) optional($request->user())->id;
            if ($userId !== '') {
                Cache::put($this->sessionCacheKey($userId), $validated['sessionId'], now()->addHours(6));
                if ($instansiName !== '') {
                    Cache::put(
                        $this->sessionCacheKey($userId, $instansiName),
                        $validated['sessionId'],
                        now()->addHours(6)
                    );
                }
            }

            return $this->respondData([
                'loginOnly' => true,
                'instansiName' => $instansiName !== '' ? $instansiName : null,
                'authenticated' => true,
            ]);
        }

        $scopes = $validated['scope'] ? [$validated['scope']] : ['audit', 'inspeksi', 'surveillance'];
        $summary = [
            'sessions' => 0,
            'areas' => 0,
            'questions' => 0,
            'answers' => 0,
            'reviews' => 0,
            'caps' => 0,
            'instansiName' => null,
            'scopes' => [],
        ];

        foreach ($scopes as $scope) {
            $response = $this->wrapperHttp(120)
                ->post($wrapperUrl.'/automation-run', [
                    'type' => $scope,
                    'stage' => 'penyusunan',
                    'session_id' => $validated['sessionId'],
                    'captcha' => $validated['captcha'],
                    'username' => $validated['username'],
                    'password' => $validated['password'],
                ]);

            if ($response->status() === 401) {
                return response()->json([
                    'error' => 'Captcha salah atau login gagal.',
                    'needNewSession' => true,
                ], 401);
            }

            if (!$response->ok()) {
                return response()->json([
                    'error' => 'Gagal mengambil data dari wrapper.',
                    'detail' => $response->body(),
                ], 502);
            }

            $payload = $response->json();
            if (!empty($payload['error'])) {
                return response()->json(['error' => $payload['error']], 502);
            }
            if ($summary['instansiName'] === null) {
                $summary['instansiName'] = $this->extractInstansiName($payload);
            }

            $results = $payload['results'] ?? [];
            $scopeInstansiName = $this->extractInstansiName($payload);
            $scopeSummary = $this->ingestWrapperResults($scope, $results, $scopeInstansiName);
            foreach (['sessions', 'areas', 'questions', 'answers', 'reviews', 'caps'] as $key) {
                $summary[$key] += $scopeSummary[$key] ?? 0;
            }
            $summary['scopes'][$scope] = array_merge($scopeSummary, [
                'instansiName' => $scopeInstansiName,
            ]);

            $pemenuhan = $this->wrapperHttp(120)
                ->post($wrapperUrl.'/automation-run', [
                    'type' => $scope,
                    'stage' => 'pemenuhan',
                    'session_id' => $validated['sessionId'],
                    'captcha' => $validated['captcha'],
                    'username' => $validated['username'],
                    'password' => $validated['password'],
                ]);

            if ($pemenuhan->status() === 401) {
                return response()->json([
                    'error' => 'Captcha salah atau login gagal.',
                    'needNewSession' => true,
                ], 401);
            }
            if (!$pemenuhan->ok()) {
                return response()->json([
                    'error' => 'Gagal mengambil data pemenuhan dari wrapper.',
                    'detail' => $pemenuhan->body(),
                ], 502);
            }

            $pemPayload = $pemenuhan->json();
            if (!empty($pemPayload['error'])) {
                return response()->json(['error' => $pemPayload['error']], 502);
            }
            if ($summary['instansiName'] === null) {
                $summary['instansiName'] = $this->extractInstansiName($pemPayload);
            }
            if (empty($summary['scopes'][$scope]['instansiName'])) {
                $summary['scopes'][$scope]['instansiName'] = $this->extractInstansiName($pemPayload);
            }

            $pemResults = $pemPayload['results'] ?? [];
            $pemSummary = $this->ingestWrapperPemenuhan($scope, $pemResults);
            foreach (['fulfillments', 'files', 'extensions', 'cap_reviews'] as $key) {
                if (!isset($summary[$key])) {
                    $summary[$key] = 0;
                }
                $summary[$key] += $pemSummary[$key] ?? 0;
            }
            $summary['scopes'][$scope]['pemenuhan'] = $pemSummary;
        }

        $userId = (string) optional($request->user())->id;
        if ($userId !== '') {
            Cache::put($this->sessionCacheKey($userId), $validated['sessionId'], now()->addHours(6));

            $knownInstansi = collect([$summary['instansiName'] ?? null])
                ->merge(collect($summary['scopes'])->map(fn ($item) => $item['instansiName'] ?? null))
                ->filter(fn ($value) => is_string($value) && trim($value) !== '')
                ->map(fn ($value) => trim((string) $value))
                ->unique()
                ->values();

            foreach ($knownInstansi as $instansiName) {
                Cache::put(
                    $this->sessionCacheKey($userId, (string) $instansiName),
                    $validated['sessionId'],
                    now()->addHours(6)
                );
            }
        }

        return $this->respondData($summary);
    }

    public function syncStatus(Request $request)
    {
        $validated = $request->validate([
            'instansiName' => ['required', 'string'],
        ]);

        $userId = (string) optional($request->user())->id;
        if ($userId === '') {
            return $this->respondData([
                'active' => false,
                'instansiName' => $validated['instansiName'],
            ]);
        }

        $instansiName = trim((string) $validated['instansiName']);
        $sessionId = (string) Cache::get($this->sessionCacheKey($userId, $instansiName), '');

        return $this->respondData([
            'active' => $sessionId !== '',
            'instansiName' => $instansiName,
        ]);
    }

    public function sync(Request $request)
    {
        return response()->json([
            'error' => 'Endpoint lama dinonaktifkan. Gunakan /external-dnp/sync/init + /external-dnp/sync/start.',
        ], 410);
    }

    public function index(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['required', 'in:audit,inspeksi,surveillance'],
            'sessionAreaId' => ['required', 'uuid'],
        ]);

        $area = ExternalDnpSessionArea::query()
            ->with('session')
            ->findOrFail($validated['sessionAreaId']);

        if ($area->session?->scope !== $validated['scope']) {
            return response()->json(['error' => 'Invalid scope'], 422);
        }

        $answers = ExternalDnpAnswer::query()
            ->where('session_area_id', $area->id)
            ->whereHas('review', function ($query) {
                $query->where('status', 'Not Satisfactory')
                    ->whereNotNull('sent_at');
            })
            ->where('is_submitted', true)
            ->with(['review.reviewer', 'sessionArea.session'])
            ->get();

        $questions = ExternalDnpQuestion::query()
            ->where('scope', $validated['scope'])
            ->whereIn('code', $answers->pluck('question_code'))
            ->get()
            ->keyBy('code');

        $caps = ExternalDnpCap::query()
            ->whereIn('answer_id', $answers->pluck('id'))
            ->with(['review.reviewer', 'fulfillments.files', 'extensions'])
            ->get()
            ->keyBy('answer_id');
        $userId = (string) optional($request->user())->id;
        $instansiName = (string) ($area->session?->instansi_name ?? '');
        $wrapperSessionId = $userId !== ''
            ? (string) Cache::get($this->sessionCacheKey($userId, $instansiName), '')
            : '';
        if ($wrapperSessionId === '' && $userId !== '') {
            $wrapperSessionId = (string) Cache::get($this->sessionCacheKey($userId), '');
        }

        $payload = $answers->map(function (ExternalDnpAnswer $answer) use ($questions, $caps, $area, $validated, $wrapperSessionId) {
            $question = $questions[$answer->question_code] ?? null;
            $cap = $caps[$answer->id] ?? null;
            return [
                'answerId' => $answer->id,
                'questionCode' => $answer->question_code,
                'questionText' => $question?->text ?? '',
                'reference' => $question?->reference ?? '',
                'status' => $answer->status,
                'instansiName' => $area->session?->instansi_name,
                'review' => $answer->review ? [
                    'status' => $answer->review->status,
                    'severity' => $answer->review->severity,
                    'probability' => $answer->review->probability,
                    'resume' => $answer->review->resume,
                    'finding' => $answer->review->finding,
                    'recommendations' => $answer->review->recommendations,
                    'description' => $answer->review->description,
                    'reviewedBy' => $answer->review->reviewer?->only(['id', 'name', 'email']),
                    'reviewedAt' => optional($answer->review->sent_at)->toDateTimeString(),
                ] : null,
                'cap' => $cap ? [
                    'id' => $cap->id,
                    'actionPlan' => $cap->action_plan,
                    'targetDate' => optional($cap->target_date)->format('Y-m-d'),
                    'status' => $cap->status,
                    'sentAt' => optional($cap->sent_at)->toDateTimeString(),
                    'review' => $cap->review ? [
                        'result' => $cap->review->result,
                        'comment' => $cap->review->comment,
                        'status' => $cap->review->status,
                        'reviewedBy' => $cap->review->reviewer?->only(['id', 'name', 'email']),
                        'reviewedAt' => optional($cap->review->reviewed_at)->toDateTimeString(),
                    ] : null,
                    'fulfillments' => $cap->fulfillments
                        ->sortBy('created_at')
                        ->map(function ($fulfillment) use ($wrapperSessionId, $validated) {
                            return [
                                'id' => $fulfillment->id,
                                'step' => $fulfillment->step,
                                'proposeAction' => $fulfillment->propose_action,
                                'actionOffice' => $fulfillment->action_office,
                                'evidenceReference' => $fulfillment->evidence_reference,
                                'completeDate' => optional($fulfillment->complete_date)->format('Y-m-d'),
                                'progress' => $fulfillment->progress,
                                'status' => $fulfillment->status,
                                'submittedAt' => optional($fulfillment->submitted_at)->toDateTimeString(),
                                'createdAt' => optional($fulfillment->created_at)->toDateTimeString(),
                                'files' => $fulfillment->files->map(function ($file) use ($wrapperSessionId, $validated) {
                                    $routeParams = ['file' => $file->id];
                                    if (!empty($file->external_file_id) && $wrapperSessionId !== '') {
                                        $routeParams['ws'] = $wrapperSessionId;
                                        $routeParams['scope'] = $validated['scope'];
                                    }
                                    return [
                                        'id' => $file->id,
                                        'name' => $file->name,
                                        'source' => !empty($file->external_file_id) ? 'dnp' : 'local',
                                        'externalFileId' => $file->external_file_id,
                                        'url' => URL::temporarySignedRoute(
                                            'external-dnp.cap.fulfillment-file.signed',
                                            now()->addMinutes(10),
                                            $routeParams
                                        ),
                                    ];
                                })->values(),
                            ];
                        })->values(),
                    'extensions' => $cap->extensions->map(function ($extension) {
                        return [
                            'id' => $extension->id,
                            'dueDate' => optional($extension->due_date)->format('Y-m-d'),
                            'fileName' => $extension->file_name,
                            'fileUrl' => URL::temporarySignedRoute(
                                'external-dnp.cap.extension-file.signed',
                                now()->addMinutes(10),
                                ['extension' => $extension->id]
                            ),
                            'status' => $extension->status,
                        ];
                    })->values(),
                ] : null,
            ];
        });

        return $this->respondData($payload->values());
    }

    public function sessions(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['required', 'in:audit,inspeksi,surveillance'],
            'month' => ['nullable'],
            'year' => ['nullable', 'integer'],
        ]);

        $monthNumber = $this->resolveMonth($validated['month'] ?? null);

        $sessions = ExternalDnpSession::query()
            ->where('scope', $validated['scope'])
            ->when($validated['year'] ?? null, fn ($query, $year) => $query->whereYear('start_date', $year))
            ->when($monthNumber, fn ($query) => $query->whereMonth('start_date', $monthNumber))
            ->orderByDesc('start_date')
            ->get();

        if ($sessions->isEmpty()) {
            return $this->respondData([]);
        }

        $areas = ExternalDnpSessionArea::query()
            ->whereIn('session_id', $sessions->pluck('id'))
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get()
            ->groupBy('session_id');

        $areaIds = $areas->flatten()->pluck('id')->unique()->values();

        if ($areaIds->isEmpty()) {
            return $this->respondData([]);
        }

        $notSatisfactoryCounts = ExternalDnpAnswer::query()
            ->where('is_submitted', true)
            ->whereIn('session_area_id', $areaIds)
            ->whereHas('review', function ($query) {
                $query->where('status', 'Not Satisfactory')
                    ->whereNotNull('sent_at');
            })
            ->selectRaw('session_area_id, count(*) as total')
            ->groupBy('session_area_id')
            ->pluck('total', 'session_area_id');

        $payload = $sessions->flatMap(function (ExternalDnpSession $session) use ($areas, $notSatisfactoryCounts) {
            $schedule = $session->start_date && $session->end_date
                ? $session->start_date->format('Y-m-d').' - '.$session->end_date->format('Y-m-d')
                : null;

            return ($areas[$session->id] ?? collect())
                ->filter(fn ($area) => ($notSatisfactoryCounts[$area->id] ?? 0) > 0)
                ->map(function ($area) use ($session, $schedule, $notSatisfactoryCounts) {
                    return [
                        'sessionAreaId' => $area->id,
                        'area' => $area->category ?? '-',
                        'scope' => $session->scope ?? '-',
                        'instansiName' => $session->instansi_name,
                        'schedule' => $schedule,
                        'leader' => $session->team_leader ?? '-',
                        'dnp' => $session->team_members ?? [],
                        'kobo' => $session->team_audity ?? [],
                        'notSatisfactoryCount' => (int) ($notSatisfactoryCounts[$area->id] ?? 0),
                        'finalizedAt' => null,
                    ];
                });
        })->values();

        return $this->respondData($payload);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'answerId' => ['required', 'uuid'],
            'actionPlan' => ['required', 'string'],
            'targetDate' => ['required', 'date'],
            'action' => ['required', 'in:draft,send'],
        ]);

        $answer = ExternalDnpAnswer::query()
            ->where('id', $validated['answerId'])
            ->firstOrFail();

        $cap = ExternalDnpCap::query()->firstOrNew([
            'answer_id' => $answer->id,
        ]);

        $cap->action_plan = $validated['actionPlan'];
        $cap->target_date = $validated['targetDate'];
        $cap->status = $validated['action'] === 'send' ? 'sent' : 'draft';
        $cap->sent_at = $validated['action'] === 'send' ? now() : null;
        $cap->save();

        return $this->respondData([
            'id' => $cap->id,
            'status' => $cap->status,
            'sentAt' => optional($cap->sent_at)->toDateTimeString(),
        ]);
    }

    public function storeFulfillment(Request $request, ExternalDnpCap $cap)
    {
        $validated = $request->validate([
            'step' => ['required', 'integer', 'min:1'],
            'proposeAction' => ['required', 'string'],
            'actionOffice' => ['required', 'string'],
            'evidenceReference' => ['nullable', 'string'],
            'completeDate' => ['required', 'date'],
            'progress' => ['required', 'integer', 'min:0', 'max:100'],
            'action' => ['required', 'in:draft'],
            'exportToExternal' => ['nullable', 'boolean'],
            'file' => ['nullable', 'file', 'max:20480'],
        ]);
        $exportToExternal = $request->boolean('exportToExternal');
        if ($exportToExternal && empty($validated['file'])) {
            return response()->json(['error' => 'File wajib diunggah sebelum Export DNP.'], 422);
        }

        $existingDraft = ExternalDnpCapFulfillment::query()
            ->where('cap_id', $cap->id)
            ->where('step', $validated['step'])
            ->where('status', 'draft')
            ->orderByDesc('created_at')
            ->first();

        if ($existingDraft) {
            $existingDraft->fill([
                'propose_action' => $validated['proposeAction'],
                'action_office' => $validated['actionOffice'],
                'evidence_reference' => $validated['evidenceReference'] ?? null,
                'complete_date' => $validated['completeDate'],
                'progress' => $validated['progress'],
                'status' => 'draft',
                'submitted_at' => null,
            ]);
            $existingDraft->save();
            $fulfillment = $existingDraft;
        } else {
            $fulfillment = ExternalDnpCapFulfillment::create([
                'cap_id' => $cap->id,
                'step' => $validated['step'],
                'propose_action' => $validated['proposeAction'],
                'action_office' => $validated['actionOffice'],
                'evidence_reference' => $validated['evidenceReference'] ?? null,
                'complete_date' => $validated['completeDate'],
                'progress' => $validated['progress'],
                'status' => 'draft',
                'submitted_at' => null,
            ]);
        }

        if (!empty($validated['file'])) {
            $path = $validated['file']->store('external-dnp-cap-fulfillments', 'public');
            ExternalDnpCapFulfillmentFile::create([
                'id' => (string) Str::uuid(),
                'fulfillment_id' => $fulfillment->id,
                'name' => $validated['file']->getClientOriginalName(),
                'url' => Storage::disk('public')->url($path),
                'created_at' => now(),
            ]);
        }

        if ($exportToExternal) {
            $wrapperSync = $this->syncDraftToWrapper($request, $cap, $validated, $fulfillment);
            if (!empty($wrapperSync['error'])) {
                return response()->json([
                    'error' => $wrapperSync['error'],
                    'needSyncUpdateData' => $wrapperSync['needSyncUpdateData'] ?? false,
                ], 502);
            }
        }

        return $this->respondData([
            'id' => $fulfillment->id,
            'status' => $fulfillment->status,
            'submittedAt' => optional($fulfillment->submitted_at)->toDateTimeString(),
        ]);
    }

    public function storeExtension(Request $request, ExternalDnpCap $cap)
    {
        $validated = $request->validate([
            'dueDate' => ['required', 'date'],
            'file' => ['required', 'file', 'max:20480'],
        ]);

        $path = $validated['file']->store('external-dnp-cap-extensions', 'public');
        $extension = ExternalDnpCapExtension::create([
            'id' => (string) Str::uuid(),
            'cap_id' => $cap->id,
            'due_date' => $validated['dueDate'],
            'file_name' => $validated['file']->getClientOriginalName(),
            'file_url' => Storage::disk('public')->url($path),
            'status' => 'submitted',
        ]);

        return $this->respondData([
            'id' => $extension->id,
            'dueDate' => $extension->due_date->format('Y-m-d'),
        ]);
    }

    public function destroyFulfillmentFile(Request $request, ExternalDnpCapFulfillmentFile $file)
    {
        $capUserId = $file->fulfillment?->cap?->user_id;
        if ($capUserId && $capUserId !== $request->user()->id) {
            return response()->json(['error' => 'Tidak diizinkan menghapus file ini.'], 403);
        }

        $relative = $this->resolveStoragePath((string) $file->url, ['external-dnp-cap-fulfillments/']);
        if ($relative !== '' && Storage::disk('public')->exists($relative)) {
            Storage::disk('public')->delete($relative);
        }
        $file->delete();

        return $this->respondData(['deleted' => true]);
    }

    public function downloadFulfillmentFileSigned(Request $request, ExternalDnpCapFulfillmentFile $file)
    {
        $relative = $this->resolveStoragePath((string) $file->url, ['external-dnp-cap-fulfillments/']);
        if ($relative && Storage::disk('public')->exists($relative)) {
            $absolute = Storage::disk('public')->path($relative);
            return response()->file($absolute);
        }

        if (empty($file->external_file_id)) {
            return response()->json(['error' => 'File tidak ditemukan.'], 404);
        }

        $wrapperSessionId = trim((string) $request->query('ws', ''));
        $scope = trim((string) $request->query('scope', ''));
        if ($wrapperSessionId === '' || !in_array($scope, ['audit', 'inspeksi', 'surveillance'], true)) {
            return response()->json([
                'error' => 'Sesi instansi belum aktif untuk mengunduh file DNP. Silakan login instansi dulu.',
            ], 401);
        }

        try {
            $wrapperUrl = $this->wrapperUrl();
            $response = $this->wrapperHttp(120)->get($wrapperUrl.'/automation-download-file', [
                'session_id' => $wrapperSessionId,
                'scope' => $scope,
                'file_id' => (string) $file->external_file_id,
            ]);
        } catch (\RuntimeException $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }

        if ($response->status() === 401) {
            return response()->json([
                'error' => 'Sesi DNP kedaluwarsa. Silakan login instansi lagi sebelum download.',
            ], 401);
        }
        if (!$response->ok()) {
            return response()->json(['error' => 'Gagal mengunduh file dari DNP.'], 502);
        }

        $contentType = $response->header('Content-Type', 'application/octet-stream');
        $downloadName = $file->name !== '' ? $file->name : ('dnp-file-'.(string) $file->external_file_id);
        return response($response->body(), 200, [
            'Content-Type' => $contentType,
            'Content-Disposition' => 'attachment; filename="'.addslashes($downloadName).'"',
        ]);
    }

    public function downloadExtensionFileSigned(Request $request, ExternalDnpCapExtension $extension)
    {
        $relative = $this->resolveStoragePath((string) $extension->file_url, ['external-dnp-cap-extensions/']);
        if (!$relative || !Storage::disk('public')->exists($relative)) {
            return response()->json(['error' => 'File tidak ditemukan.'], 404);
        }
        $absolute = Storage::disk('public')->path($relative);
        return response()->file($absolute);
    }

    private function resolveMonth(?string $value): ?int
    {
        if (!$value) {
            return null;
        }

        $normalized = strtoupper($value);
        $map = [
            'JANUARI' => 1,
            'FEBRUARI' => 2,
            'MARET' => 3,
            'APRIL' => 4,
            'MEI' => 5,
            'JUNI' => 6,
            'JULI' => 7,
            'AGUSTUS' => 8,
            'SEPTEMBER' => 9,
            'OKTOBER' => 10,
            'NOVEMBER' => 11,
            'DESEMBER' => 12,
        ];

        return $map[$normalized] ?? null;
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

        if (!empty($allowedPrefixes)) {
            $allowed = false;
            foreach ($allowedPrefixes as $prefix) {
                if ($prefix !== '' && str_starts_with($path, $prefix)) {
                    $allowed = true;
                    break;
                }
            }
            if (!$allowed) {
                return null;
            }
        }

        return $path;
    }

    private function ingestWrapperResults(string $scope, array $results, ?string $defaultInstansiName = null): array
    {
        $count = [
            'sessions' => 0,
            'areas' => 0,
            'questions' => 0,
            'answers' => 0,
            'reviews' => 0,
            'caps' => 0,
        ];

        foreach ($results as $groupKey => $entry) {
            if (!is_array($entry)) {
                continue;
            }

            $leader = (string) ($entry['ketua_tim'] ?? $groupKey);
            $scheduleRaw = $entry['tanggal_pelaksanaan'] ?? '';
            [$startDate, $endDate, $scheduleLabel] = $this->parseSchedule($scheduleRaw);

            $instansiName = trim((string) ($this->extractInstansiName($entry) ?? $defaultInstansiName ?? ''));
            $session = $this->findSessionByScopeInstansiAndDate($scope, $instansiName, $startDate, $endDate);

            if (!$session) {
                $session = new ExternalDnpSession();
                $session->id = (string) Str::uuid();
                $session->scope = $scope;
                $session->start_date = $startDate;
                $session->end_date = $endDate;
                $session->is_published = true;
                $count['sessions']++;
            }

            $session->title = $scheduleLabel ?: $session->title;
            if (!$session->instansi_name && $instansiName !== '') {
                $session->instansi_name = $instansiName;
            }
            if (!$session->team_leader) {
                $session->team_leader = $leader;
            }
            if (empty($session->team_members)) {
                $session->team_members = $this->parsePeopleList((string) ($entry['anggota_dnp'] ?? ''));
            }
            if (empty($session->team_audity)) {
                $session->team_audity = $this->parsePeopleList((string) ($entry['anggota_kobu'] ?? ''));
            }
            $session->save();

            $audits = $entry['audits'] ?? [];
            foreach ($audits as $audit) {
                if (!is_array($audit)) {
                    continue;
                }

                $datatable = $audit['data_datatable'] ?? [];
                $datatableRow = is_array($datatable) && !empty($datatable) ? $datatable[0] : [];
                $areaGroup = $datatableRow['area_group'] ?? $audit['area'] ?? '-';

                $area = ExternalDnpSessionArea::query()
                    ->where('session_id', $session->id)
                    ->where('category', $areaGroup)
                    ->first();

                if (!$area) {
                    $area = new ExternalDnpSessionArea();
                    $area->id = (string) Str::uuid();
                    $area->session_id = $session->id;
                    $area->category = $areaGroup;
                    $area->is_active = true;
                    $area->sort_order = 0;
                    $area->save();
                    $count['areas']++;
                }

                $rsPq = is_array($datatableRow) ? ($datatableRow['rs_pq'] ?? []) : [];
                $headerMap = [];
                foreach ($rsPq as $item) {
                    if (!is_array($item)) {
                        continue;
                    }
                    if (($item['pq_posisi'] ?? '') === 'header' && !empty($item['pq_id'])) {
                        $headerMap[(string) $item['pq_id']] = (string) ($item['pq_no'] ?? '');
                    }
                }
                $realisasi = $audit['data_realisasi'] ?? [];
                $realisasiByDataId = [];
                foreach ($realisasi as $item) {
                    if (is_array($item) && !empty($item['data_id'])) {
                        $realisasiByDataId[(string) $item['data_id']] = $item;
                    }
                }

                foreach ($rsPq as $item) {
                    if (!is_array($item)) {
                        continue;
                    }
                    if (($item['pq_posisi'] ?? '') !== 'content') {
                        continue;
                    }
                    $pqNoRaw = (string) ($item['pq_no'] ?? '');
                    $pqNo = $this->resolveQuestionCode($pqNoRaw, (string) ($item['pq_induk'] ?? ''), $headerMap);
                    if ($pqNo === '') {
                        continue;
                    }

                        $question = $this->upsertQuestion(
                            $scope,
                            $pqNo,
                            (string) ($item['pq_desc'] ?? ''),
                            (string) ($item['pq_desc_en'] ?? '')
                        );
                    if ($question) {
                        $count['questions']++;
                    }

                    $dataId = (string) ($item['data_id'] ?? '');
                    if ($dataId === '') {
                        continue;
                    }

                    $answer = ExternalDnpAnswer::query()
                        ->where('session_area_id', $area->id)
                        ->where('question_code', $pqNo)
                        ->first();

                    if (!$answer) {
                        $answerByExternalId = ExternalDnpAnswer::query()->find($dataId);

                        if ($answerByExternalId) {
                            $sameContext = $answerByExternalId->session_area_id === $area->id
                                && $answerByExternalId->question_code === $pqNo;

                            if ($sameContext) {
                                $answer = $answerByExternalId;
                            } else {
                                // `data_id` dari DNP bisa bentrok antar-instansi.
                                // Gunakan ID lokal baru agar tidak menabrak primary key.
                                $answer = new ExternalDnpAnswer();
                                $answer->id = (string) Str::uuid();
                                $count['answers']++;
                            }
                        } else {
                            $answer = new ExternalDnpAnswer();
                            $answer->id = $dataId;
                            $count['answers']++;
                        }
                    }

                    $answer->session_area_id = $area->id;
                    $answer->external_answer_id = $dataId;
                    $answer->question_code = $pqNo;
                    $answer->status = (string) ($item['review_st'] ?? $item['ass_status'] ?? '');
                    $answer->is_submitted = true;
                    $answer->submitted_at = now();
                    $answer->save();

                    $realisasiItem = $realisasiByDataId[$dataId] ?? null;
                    $reviewId = (string) ($realisasiItem['review_id'] ?? $item['review_id'] ?? '');
                    if ($reviewId !== '') {
                        $review = ExternalDnpReview::query()
                            ->where('answer_id', $answer->id)
                            ->first();

                        if (!$review) {
                            $reviewByExternalId = ExternalDnpReview::query()->find($reviewId);
                            if ($reviewByExternalId) {
                                $sameContext = $reviewByExternalId->answer_id === $answer->id;
                                if ($sameContext) {
                                    $review = $reviewByExternalId;
                                } else {
                                    // `review_id` dari DNP bisa bentrok antar-instansi.
                                    // Gunakan ID lokal baru agar tidak menabrak unique(answer_id).
                                    $review = new ExternalDnpReview();
                                    $review->id = (string) Str::uuid();
                                    $count['reviews']++;
                                }
                            } else {
                                $review = new ExternalDnpReview();
                                $review->id = $reviewId;
                                $count['reviews']++;
                            }
                        }
                        $review->answer_id = $answer->id;
                        $review->status = (string) ($realisasiItem['review_st'] ?? $item['review_st'] ?? '');
                        $review->comment = $this->nullifyDash($realisasiItem['review_desc'] ?? null);
                        $review->severity = $this->nullifyDash($realisasiItem['risk_matrix'] ?? null);
                        $review->probability = $this->nullifyDash($realisasiItem['probability'] ?? null);
                        $review->description = $this->nullifyDash($realisasiItem['review_desc'] ?? null);
                        $review->finding = $this->nullifyDash($realisasiItem['review_finding'] ?? null);
                        $review->recommendations = $this->nullifyDash($realisasiItem['review_recommend'] ?? null);
                        $review->remark = $this->nullifyDash($realisasiItem['review_ket'] ?? null);
                        $review->sent_at = $this->parseDateTime($realisasiItem['review_date'] ?? null);
                        $review->save();
                    }

                    $capId = (string) ($realisasiItem['cap_id'] ?? $item['cap_id'] ?? '');
                    if ($capId !== '') {
                        $cap = ExternalDnpCap::query()
                            ->where('answer_id', $answer->id)
                            ->first();
                        if (!$cap) {
                            $capByExternalId = ExternalDnpCap::query()->find($capId);
                            if ($capByExternalId) {
                                $sameContext = $capByExternalId->answer_id === $answer->id;
                                if ($sameContext) {
                                    $cap = $capByExternalId;
                                } else {
                                    // `cap_id` dari DNP bisa bentrok antar-instansi.
                                    // Gunakan ID lokal baru, tapi simpan external_cap_id untuk mapping ke wrapper.
                                    $cap = new ExternalDnpCap();
                                    $cap->id = (string) Str::uuid();
                                    $count['caps']++;
                                }
                            } else {
                                $cap = new ExternalDnpCap();
                                $cap->id = $capId;
                                $count['caps']++;
                            }
                        }
                        $cap->external_cap_id = $capId;
                        $cap->answer_id = $answer->id;
                        $cap->action_plan = (string) ($realisasiItem['cap_desc'] ?? '');
                        $cap->target_date = $this->parseDate($realisasiItem['cap_target_date'] ?? null) ?? $startDate;
                        $cap->status = (string) ($realisasiItem['cap_status'] ?? $item['cap_status'] ?? 'draft');
                        $cap->sent_at = $this->parseDateTime(
                            $realisasiItem['created_at_cap_rev'] ?? $realisasiItem['created_at'] ?? null
                        );
                        $cap->save();
                    }
                }
            }
        }

        return $count;
    }

    private function ingestWrapperPemenuhan(string $scope, array $results): array
    {
        $count = [
            'fulfillments' => 0,
            'files' => 0,
            'extensions' => 0,
            'cap_reviews' => 0,
        ];

        foreach ($results as $groupKey => $entry) {
            if (!is_array($entry)) {
                continue;
            }

            $leader = (string) ($entry['ketua_tim'] ?? $groupKey);
            $scheduleRaw = (string) ($entry['tanggal_pelaksanaan'] ?? '');
            [$startDate, $endDate] = $this->parseSchedule($scheduleRaw);
            $entryInstansiName = trim((string) ($this->extractInstansiName($entry) ?? ''));
            $session = $this->findSessionByScopeInstansiAndDate($scope, $entryInstansiName, $startDate, $endDate);
            $audits = $entry['audits'] ?? [];
            foreach ($audits as $audit) {
                if (!is_array($audit)) {
                    continue;
                }

                $datatableRows = $audit['datatable_content'] ?? [];
                $datatableRow = is_array($datatableRows) && !empty($datatableRows) ? $datatableRows[0] : [];
                $defaultPlanId = (string) ($datatableRow['plan_id'] ?? '');
                $defaultAreaGroupId = (string) ($datatableRow['area_group_id'] ?? '');
                $areaGroup = (string) ($datatableRow['area_group'] ?? $audit['area'] ?? '-');
                $sessionArea = $session
                    ? ExternalDnpSessionArea::query()
                        ->where('session_id', $session->id)
                        ->where('category', $areaGroup)
                        ->first()
                    : null;

                $capDetails = $audit['cap_details'] ?? [];
                foreach ($capDetails as $detail) {
                    if (!is_array($detail)) {
                        continue;
                    }

                    $source = $detail['source_item'] ?? [];
                    $capId = (string) ($source['cap_id'] ?? '');
                    if ($capId === '') {
                        continue;
                    }

                    $cap = null;
                    if ($sessionArea) {
                        $cap = ExternalDnpCap::query()
                            ->where('external_cap_id', $capId)
                            ->whereHas('answer', function ($query) use ($sessionArea) {
                                $query->where('session_area_id', $sessionArea->id);
                            })
                            ->first();
                    }

                    if (!$cap && $session) {
                        $cap = ExternalDnpCap::query()
                            ->where('external_cap_id', $capId)
                            ->whereHas('answer.sessionArea', function ($query) use ($session) {
                                $query->where('session_id', $session->id);
                            })
                            ->first();
                    }

                    if (!$cap) {
                        $cap = ExternalDnpCap::query()->find($capId);
                    }

                    if (!$cap) {
                        continue;
                    }

                    $firstListCap = null;
                    $listCapContent = $detail['list_cap_content'] ?? null;
                    if (is_array($listCapContent) && !empty($listCapContent) && is_array($listCapContent[0])) {
                        $firstListCap = $listCapContent[0];
                    }
                    $cap->external_plan_id = (string) (($firstListCap['plan_id'] ?? null) ?: $defaultPlanId ?: $cap->external_plan_id);
                    $cap->external_area_group_id = $defaultAreaGroupId !== ''
                        ? $defaultAreaGroupId
                        : (string) ($cap->external_area_group_id ?? '');
                    $cap->save();

                    $realisasi = $detail['realisasi_cap_content']['data'] ?? [];
                    $capReview = $realisasi['realisasi_cap_review'] ?? null;
                    if (is_array($capReview) && !empty($capReview['cap_review_id'])) {
                        $review = ExternalDnpCapReview::query()->find((string) $capReview['cap_review_id']);
                        if (!$review) {
                            $review = new ExternalDnpCapReview();
                            $review->id = (string) $capReview['cap_review_id'];
                            $count['cap_reviews']++;
                        }
                        $review->cap_id = $cap->id;
                        $review->result = $this->nullifyDash($capReview['cap_result'] ?? null);
                        $review->comment = $this->nullifyDash($capReview['review_comment'] ?? null);
                        $review->status = $this->nullifyDash($capReview['cap_st'] ?? null);
                        $review->reviewed_at = $this->parseDateTime($capReview['review_date'] ?? null);
                        $review->save();
                    }

                    $step = $realisasi['realisasi_cap_step'] ?? null;
                    if (is_array($step)) {
                        $fulfillment = ExternalDnpCapFulfillment::query()
                            ->where('cap_id', $cap->id)
                            ->where('external_step_id', (string) ($step['step_id'] ?? ''))
                            ->first();

                        if (!$fulfillment) {
                            $fulfillment = new ExternalDnpCapFulfillment();
                            $fulfillment->id = (string) Str::uuid();
                            $fulfillment->cap_id = $cap->id;
                            $fulfillment->external_step_id = (string) ($step['step_id'] ?? null);
                            $count['fulfillments']++;
                        }

                        $fulfillment->step = (int) ($step['step_index'] ?? 1);
                        $fulfillment->propose_action = (string) ($step['step_propose'] ?? '');
                        $fulfillment->action_office = (string) ($step['step_location'] ?? '');
                        $fulfillment->evidence_reference = $this->nullifyDash($step['step_evidence_ref'] ?? null);
                        $fulfillment->complete_date = $this->parseDate($step['step_complete_date'] ?? null) ?? $cap->target_date;
                        $fulfillment->progress = (int) ($step['step_progress'] ?? 0);
                        $fulfillment->status = (string) ($step['data_st'] ?? 'draft');
                        $fulfillment->submitted_at = $this->parseDateTime($step['created_at'] ?? null);
                        $fulfillment->save();

                        $files = $step['data_files'] ?? [];
                        foreach ($files as $file) {
                            if (!is_array($file) || empty($file['file_id'])) {
                                continue;
                            }
                            $existingFile = ExternalDnpCapFulfillmentFile::query()
                                ->where('fulfillment_id', $fulfillment->id)
                                ->where('external_file_id', (string) $file['file_id'])
                                ->first();

                            if (!$existingFile) {
                                $existingFile = new ExternalDnpCapFulfillmentFile();
                                $existingFile->id = (string) Str::uuid();
                                $existingFile->fulfillment_id = $fulfillment->id;
                                $existingFile->external_file_id = (string) $file['file_id'];
                                $count['files']++;
                            }

                            $filePath = trim((string) ($file['file_path'] ?? ''), '/');
                            $fileName = (string) ($file['file_name'] ?? '');
                            $url = $filePath !== '' && $fileName !== ''
                                ? rtrim(config('services.external_dnp.web2_url', ''), '/').'/'.$filePath.'/'.$fileName
                                : '';

                            $existingFile->name = (string) ($file['file_judul'] ?? $fileName);
                            $existingFile->url = $url;
                            $existingFile->created_at = $this->parseDateTime($file['created_at'] ?? null) ?? now();
                            $existingFile->save();
                        }
                    }
                }
            }
        }

        return $count;
    }

    private function parsePeopleList(string $raw): array
    {
        $clean = trim($raw);
        if ($clean === '') {
            return [];
        }
        $parts = preg_split('/\\d+\\./', $clean);
        if (!$parts) {
            return [$clean];
        }
        return collect($parts)
            ->map(fn ($part) => trim($part))
            ->filter()
            ->values()
            ->all();
    }

    private function syncDraftToWrapper(
        Request $request,
        ExternalDnpCap $cap,
        array $validated,
        ExternalDnpCapFulfillment $fulfillment
    ): array {
        try {
            $wrapperUrl = $this->wrapperUrl();
            $http = $this->wrapperHttp(180);
        } catch (\RuntimeException $e) {
            return ['error' => $e->getMessage()];
        }

        $cap->loadMissing('answer.sessionArea.session');
        $scope = (string) optional(optional(optional($cap->answer)->sessionArea)->session)->scope;
        if (!in_array($scope, ['audit', 'inspeksi', 'surveillance'], true)) {
            return ['error' => 'Scope CAP external tidak valid.'];
        }

        $planId = (string) ($cap->external_plan_id ?? '');
        $areaGroupId = (string) ($cap->external_area_group_id ?? '');
        $externalCapId = (string) ($cap->external_cap_id ?? $cap->id);
        $dataId = (string) (optional($cap->answer)->external_answer_id ?? $cap->answer_id ?? '');
        if ($planId === '' || $areaGroupId === '' || $dataId === '') {
            return [
                'error' => 'Metadata external belum lengkap. Jalankan Update Data terlebih dahulu.',
                'needSyncUpdateData' => true,
            ];
        }

        $userId = (string) optional($request->user())->id;
        $instansiName = trim((string) optional(optional(optional($cap->answer)->sessionArea)->session)->instansi_name);
        $sessionId = $userId !== ''
            ? (string) Cache::get($this->sessionCacheKey($userId, $instansiName), '')
            : '';
        if ($sessionId === '' && $userId !== '') {
            $sessionId = (string) Cache::get($this->sessionCacheKey($userId), '');
        }
        if ($sessionId === '') {
            return [
                'error' => 'Session wrapper tidak tersedia. Jalankan Update Data terlebih dahulu.',
                'needSyncUpdateData' => true,
            ];
        }

        $requestBody = [
            'action' => 'post_draft',
            'session_id' => $sessionId,
            'type' => $scope,
            'plan_id' => $planId,
            'area_group_id' => $areaGroupId,
            'cap_id' => $externalCapId,
            'step_id' => (string) ($fulfillment->external_step_id ?? ''),
            'data_id' => $dataId,
            'step_index' => (string) $validated['step'],
            'step_propose' => (string) $validated['proposeAction'],
            'step_location' => (string) $validated['actionOffice'],
            'step_progress' => (string) $validated['progress'],
            'step_evidence_ref' => (string) ($validated['evidenceReference'] ?? ''),
            'step_complete_date' => (string) $validated['completeDate'],
        ];

        if (!empty($validated['file'])) {
            $http = $http->attach(
                'file',
                fopen($validated['file']->getRealPath(), 'r'),
                $validated['file']->getClientOriginalName()
            );
        }
        $response = $http->post($wrapperUrl.'/automation-run', $requestBody);
        if ($response->status() === 401) {
            return [
                'error' => 'Session wrapper kedaluwarsa. Jalankan Update Data dan captcha ulang.',
                'needSyncUpdateData' => true,
            ];
        }
        if (!$response->ok()) {
            return ['error' => 'Gagal sinkron draft ke DNP.', 'detail' => $response->body()];
        }

        $payload = $response->json();
        if (!is_array($payload)) {
            return ['error' => 'Respons wrapper tidak valid.'];
        }
        if (!empty($payload['error'])) {
            return ['error' => (string) $payload['error']];
        }
        return ['ok' => true];
    }

    private function wrapperUrl(): string
    {
        $wrapperUrl = rtrim((string) config('services.external_dnp.wrapper_url', ''), '/');
        if ($wrapperUrl === '') {
            throw new \RuntimeException('Wrapper URL belum dikonfigurasi.');
        }

        return $wrapperUrl;
    }

    private function wrapperHttp(int $timeout = 120): PendingRequest
    {
        $token = (string) config('services.external_dnp.wrapper_internal_token', '');
        if (trim($token) === '') {
            throw new \RuntimeException('Wrapper internal token belum dikonfigurasi.');
        }

        return Http::timeout($timeout)
            ->acceptJson()
            ->withHeaders([
                'X-Internal-Token' => $token,
            ]);
    }

    private function parseSchedule(string $raw): array
    {
        $clean = trim(preg_replace('/\\s+/', ' ', $raw));

        $indoDates = $this->extractIndonesianDates($clean);
        if (count($indoDates) >= 2) {
            return [$indoDates[0], $indoDates[1], $clean];
        }
        if (count($indoDates) === 1) {
            return [$indoDates[0], $indoDates[0], $clean];
        }

        $matches = [];
        preg_match_all('/\\d{4}-\\d{2}-\\d{2}/', $clean, $matches);
        $dates = $matches[0] ?? [];
        if (count($dates) >= 2) {
            return [Carbon::parse($dates[0]), Carbon::parse($dates[1]), $raw];
        }
        if (count($dates) === 1) {
            $date = Carbon::parse($dates[0]);
            return [$date, $date, $raw];
        }
        $today = Carbon::today();
        return [$today, $today, $clean];
    }

    private function extractIndonesianDates(string $raw): array
    {
        $monthMap = [
            'januari' => 1,
            'februari' => 2,
            'maret' => 3,
            'april' => 4,
            'mei' => 5,
            'juni' => 6,
            'juli' => 7,
            'agustus' => 8,
            'september' => 9,
            'oktober' => 10,
            'november' => 11,
            'desember' => 12,
        ];

        $pattern = '/(\\d{1,2})\\s+([A-Za-z]+)\\s+(\\d{4})/u';
        preg_match_all($pattern, $raw, $matches, PREG_SET_ORDER);
        $dates = [];
        foreach ($matches as $match) {
            $day = (int) $match[1];
            $monthName = strtolower($match[2]);
            $year = (int) $match[3];
            $month = $monthMap[$monthName] ?? null;
            if (!$month) {
                continue;
            }
            try {
                $dates[] = Carbon::createFromDate($year, $month, $day);
            } catch (\Throwable) {
                continue;
            }
        }
        return $dates;
    }

    private function extractInstansiName($value): ?string
    {
        if (is_array($value)) {
            if (!empty($value['instansi_name']) && is_string($value['instansi_name'])) {
                return trim((string) $value['instansi_name']) !== ''
                    ? trim((string) $value['instansi_name'])
                    : null;
            }
            if (!empty($value['instansiName']) && is_string($value['instansiName'])) {
                return trim((string) $value['instansiName']) !== ''
                    ? trim((string) $value['instansiName'])
                    : null;
            }
            foreach ($value as $item) {
                $found = $this->extractInstansiName($item);
                if ($found) {
                    return $found;
                }
            }
        }

        return null;
    }

    private function sessionCacheKey(string $userId, ?string $instansiName = null): string
    {
        $key = 'external_dnp_wrapper_session_'.$userId;
        $normalizedInstansi = $this->normalizeInstansiName($instansiName);
        if ($normalizedInstansi === '') {
            return $key;
        }

        return $key.'_'.md5($normalizedInstansi);
    }

    private function normalizeInstansiName(?string $instansiName): string
    {
        if ($instansiName === null) {
            return '';
        }
        $normalized = Str::of($instansiName)->lower()->squish()->value();

        return trim($normalized);
    }

    private function parseDate(?string $value): ?Carbon
    {
        if (!$value) {
            return null;
        }
        try {
            return Carbon::parse($value);
        } catch (\Throwable) {
            return null;
        }
    }

    private function parseDateTime(?string $value): ?Carbon
    {
        if (!$value) {
            return null;
        }
        try {
            return Carbon::parse($value);
        } catch (\Throwable) {
            return null;
        }
    }

    private function nullifyDash(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $trimmed = trim($value);
        return $trimmed === '-' ? null : $trimmed;
    }

    private function findSessionByScopeInstansiAndDate(
        string $scope,
        string $instansiName,
        Carbon $startDate,
        Carbon $endDate
    ): ?ExternalDnpSession {
        $baseQuery = ExternalDnpSession::query()
            ->where('scope', $scope)
            ->whereDate('start_date', $startDate)
            ->whereDate('end_date', $endDate);

        if ($instansiName !== '') {
            $normalizedInstansi = $this->normalizeInstansiName($instansiName);
            $session = (clone $baseQuery)
                ->whereNotNull('instansi_name')
                ->whereRaw('LOWER(TRIM(instansi_name)) = ?', [$normalizedInstansi])
                ->first();
            if ($session) {
                return $session;
            }
        }

        return (clone $baseQuery)
            ->where(function ($query) {
                $query->whereNull('instansi_name')
                    ->orWhere('instansi_name', '');
            })
            ->first();
    }

    private function upsertQuestion(string $scope, string $code, string $text, string $reference): ?ExternalDnpQuestion
    {
        if ($code === '') {
            return null;
        }
        $question = ExternalDnpQuestion::query()
            ->where('scope', $scope)
            ->where('code', $code)
            ->first();
        if (!$question) {
            $question = new ExternalDnpQuestion();
            $question->id = (string) Str::uuid();
            $question->scope = $scope;
            $question->code = $code;
        }
        $question->text = $text;
        $cleanRef = trim($reference);
        if ($cleanRef !== '' && strlen($cleanRef) > 250) {
            $cleanRef = null;
        } elseif ($cleanRef === '') {
            $cleanRef = null;
        }
        $question->reference = $cleanRef;
        $question->is_active = true;
        $question->sort_order = 0;
        $question->save();

        return $question;
    }

    private function resolveQuestionCode(string $pqNo, string $pqInduk, array $headerMap): string
    {
        $pqNo = trim($pqNo);
        if ($pqNo === '') {
            return '';
        }
        if (preg_match('/^[A-Z]\\.[0-9]+/i', $pqNo)) {
            return strtoupper($pqNo);
        }
        if (preg_match('/^[0-9]+$/', $pqNo)) {
            $header = $headerMap[$pqInduk] ?? '';
            $header = trim((string) $header);
            if ($header !== '' && preg_match('/^[A-Z]+$/i', $header)) {
                return strtoupper($header).'.'.$pqNo;
            }
        }
        return '';
    }
}
