<?php

namespace App\Http\Controllers\Api;

use App\Models\SelfAssessmentAnswer;
use App\Models\SelfAssessmentCap;
use App\Models\SelfAssessmentCapExtension;
use App\Models\SelfAssessmentCapFulfillment;
use App\Models\SelfAssessmentCapFulfillmentFile;
use App\Models\SelfAssessmentCapFulfillmentReview;
use App\Models\SelfAssessmentMonitoringResult;
use App\Models\SelfAssessmentMonitoringReview;
use App\Models\SelfAssessmentCapReview;
use App\Models\SelfAssessmentEvidence;
use App\Models\SelfAssessmentQuestion;
use App\Models\SelfAssessmentReview;
use App\Models\SelfAssessmentResult;
use App\Models\SelfAssessmentSession;
use App\Models\SelfAssessmentSessionArea;
use App\Models\SelfAssessmentSessionUser;
use App\Models\SystemNotification;
use App\Models\User;
use App\Services\Whatsapp\SelfAssessmentWhatsappNotificationService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;

class SelfAssessmentCapController extends ApiController
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['required', 'in:audit,monitoring,inspeksi,surveillance'],
            'sessionAreaId' => ['required', 'uuid'],
            'includeReviewed' => ['nullable', 'boolean'],
        ]);

        $userId = $request->user()->id;

        $area = SelfAssessmentSessionArea::query()
            ->with('session')
            ->findOrFail($validated['sessionAreaId']);

        if ($area->session?->scope !== $validated['scope']) {
            return response()->json(['error' => 'Invalid scope'], 422);
        }

        $result = SelfAssessmentResult::query()
            ->where('session_area_id', $area->id)
            ->where('user_id', $userId)
            ->first();

        if (!$result) {
            return $this->respondData([]);
        }

        $includeReviewed = (bool) ($validated['includeReviewed'] ?? false);
        $useMonitoringReviewedCaps = $includeReviewed;
        $reviewedCapAnswerIds = collect();
        if ($useMonitoringReviewedCaps) {
            $reviewedCapAnswerIds = SelfAssessmentCap::query()
                ->where('user_id', $userId)
                ->whereNotNull('answer_id')
                ->whereHas('answer', fn ($query) => $query->where('session_area_id', $area->id))
                ->whereHas('fulfillments', fn ($query) => $query->whereIn('status', ['sent', 'submitted']))
                ->where(function ($query) {
                    $query->whereHas('review', fn ($reviewQuery) => $reviewQuery->whereNotNull('reviewed_at'))
                        ->orWhereHas('answer.review', fn ($reviewQuery) => $reviewQuery->whereNotNull('sent_at'));
                })
                ->pluck('answer_id')
                ->filter()
                ->unique()
                ->values();
        }

        $answers = SelfAssessmentAnswer::query()
            ->where('user_id', $userId)
            ->where('session_area_id', $area->id)
            ->when(
                $useMonitoringReviewedCaps,
                fn ($query) => $query->whereIn('id', $reviewedCapAnswerIds),
                function ($query) {
                    $query->whereHas('review', function ($reviewQuery) {
                        $reviewQuery->where('status', 'Not Satisfactory')
                            ->whereNotNull('sent_at');
                    });
                }
            )
            ->where('is_submitted', true)
            ->with(['review.reviewer', 'sessionArea.session'])
            ->get();

        $questions = SelfAssessmentQuestion::query()
            ->where('scope', $validated['scope'])
            ->whereIn('code', $answers->pluck('question_code'))
            ->get()
            ->keyBy('code');

        $caps = SelfAssessmentCap::query()
            ->where('user_id', $userId)
            ->whereIn('answer_id', $answers->pluck('id'))
            ->with(['review.reviewer', 'fulfillmentReview.reviewer', 'monitoringReview.reviewer', 'fulfillments.files', 'extensions'])
            ->get()
            ->keyBy('answer_id');

        $payload = $answers->map(function (SelfAssessmentAnswer $answer) use ($questions, $caps) {
            $question = $questions[$answer->question_code] ?? null;
            $cap = $caps[$answer->id] ?? null;
            return [
                'answerId' => $answer->id,
                'questionCode' => $answer->question_code,
                'questionText' => $question?->text ?? '',
                'reference' => $question?->reference ?? '',
                'status' => $answer->status,
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
                    'fulfillmentReview' => $cap->fulfillmentReview ? [
                        'result' => $cap->fulfillmentReview->result,
                        'comment' => $cap->fulfillmentReview->comment,
                        'status' => $cap->fulfillmentReview->status,
                        'reviewedBy' => $cap->fulfillmentReview->reviewer?->only(['id', 'name', 'email']),
                        'reviewedAt' => optional($cap->fulfillmentReview->reviewed_at)->toDateTimeString(),
                    ] : null,
                    'monitoringReview' => $cap->monitoringReview ? [
                        'result' => $cap->monitoringReview->result,
                        'comment' => $cap->monitoringReview->comment,
                        'status' => $cap->monitoringReview->status,
                        'reviewedBy' => $cap->monitoringReview->reviewer?->only(['id', 'name', 'email']),
                        'reviewedAt' => optional($cap->monitoringReview->reviewed_at)->toDateTimeString(),
                    ] : null,
                    'fulfillments' => $cap->fulfillments
                        ->sortBy('created_at')
                        ->map(function ($fulfillment) {
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
                            'files' => $fulfillment->files->map(function ($file) {
                                return [
                                    'id' => $file->id,
                                    'name' => $file->name,
                                    'url' => URL::temporarySignedRoute(
                                        'self-assessment.cap.fulfillment-file.signed',
                                        now()->addMinutes(10),
                                        ['file' => $file->id]
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
                                'self-assessment.cap.extension-file.signed',
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

    public function userList(Request $request)
    {
        $userId = $request->user()->id;

        $caps = SelfAssessmentCap::query()
            ->where('user_id', $userId)
            ->where('status', 'sent')
            ->with([
                'answer.sessionArea.session',
                'answer',
                'fulfillments' => fn ($query) => $query->where('status', 'sent'),
            ])
            ->orderByDesc('sent_at')
            ->get();

        if ($caps->isEmpty()) {
            return $this->respondData([]);
        }

        $areaIds = $caps->map(fn ($cap) => $cap->answer?->session_area_id)
            ->filter()
            ->unique()
            ->values();
        $questionCodes = $caps->map(fn ($cap) => $cap->answer?->question_code)
            ->filter()
            ->unique()
            ->values();

        $questions = SelfAssessmentQuestion::query()
            ->whereIn('code', $questionCodes)
            ->get()
            ->keyBy('code');

        $payload = $caps->map(function (SelfAssessmentCap $cap) use ($questions) {
            $answer = $cap->answer;
            $sessionArea = $answer?->sessionArea;
            $session = $sessionArea?->session;
            $question = $answer?->question_code ? $questions[$answer->question_code] ?? null : null;

            return [
                'id' => $cap->id,
                'answerId' => $cap->answer_id,
                'sessionAreaId' => $sessionArea?->id,
                'scope' => $session?->scope ?? '-',
                'area' => $sessionArea?->category ?? '-',
                'questionCode' => $answer?->question_code,
                'questionText' => $question?->text ?? '',
                'questionCategory' => $question?->question_category,
                'questionCategoryPrefix' => $question?->question_category_prefix,
                'leader' => $session?->team_leader ?? '-',
                'targetDate' => optional($cap->target_date)->format('Y-m-d'),
                'isClosed' => $cap->fulfillments->isNotEmpty(),
            ];
        });

        return $this->respondData($payload->values());
    }

    public function userSessions(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['required', 'in:audit,monitoring,inspeksi,surveillance'],
            'month' => ['nullable'],
            'year' => ['nullable', 'integer'],
        ]);

        $userId = $request->user()->id;
        $monthNumber = $this->resolveMonth($validated['month'] ?? null);

        $results = SelfAssessmentResult::query()
            ->where('user_id', $userId)
            ->when($validated['year'] ?? null, fn ($query, $year) => $query->whereYear('finalized_at', $year))
            ->when($monthNumber, fn ($query) => $query->whereMonth('finalized_at', $monthNumber))
            ->whereHas('sessionArea.session', fn ($query) => $query->where('scope', $validated['scope']))
            ->with(['sessionArea.session'])
            ->orderByDesc('finalized_at')
            ->get();

        $areaIds = $results->pluck('session_area_id')->unique()->values();

        if ($areaIds->isEmpty()) {
            return $this->respondData([]);
        }

        $notSatisfactoryCounts = SelfAssessmentAnswer::query()
            ->where('user_id', $userId)
            ->where('is_submitted', true)
            ->whereIn('session_area_id', $areaIds)
            ->whereHas('review', function ($query) {
                $query->where('status', 'Not Satisfactory')
                    ->whereNotNull('sent_at');
            })
            ->selectRaw('session_area_id, count(*) as total')
            ->groupBy('session_area_id')
            ->pluck('total', 'session_area_id');

        $payload = $results->filter(function (SelfAssessmentResult $result) use ($notSatisfactoryCounts) {
            return ($notSatisfactoryCounts[$result->session_area_id] ?? 0) > 0;
        })->map(function (SelfAssessmentResult $result) use ($notSatisfactoryCounts) {
            $session = $result->sessionArea?->session;
            $schedule = $session && $session->start_date && $session->end_date
                ? $session->start_date->format('Y-m-d').' - '.$session->end_date->format('Y-m-d')
                : null;

            return [
                'sessionAreaId' => $result->session_area_id,
                'area' => $result->sessionArea?->category ?? '-',
                'scope' => $session?->scope ?? '-',
                'schedule' => $schedule,
                'leader' => $session?->team_leader ?? '-',
                'dnp' => $session?->team_members ?? [],
                'kobo' => $session?->team_audity ?? [],
                'notSatisfactoryCount' => (int) ($notSatisfactoryCounts[$result->session_area_id] ?? 0),
                'finalizedAt' => optional($result->finalized_at)->toDateTimeString(),
            ];
        })->values();

        return $this->respondData($payload);
    }

    public function userFulfillmentSessions(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['nullable', 'in:audit,monitoring,inspeksi,surveillance'],
            'month' => ['nullable'],
            'year' => ['nullable', 'integer'],
        ]);

        $userId = $request->user()->id;
        $monthNumber = $this->resolveMonth($validated['month'] ?? null);

        $fulfillments = SelfAssessmentCapFulfillment::query()
            ->where('status', 'sent')
            ->whereHas('cap', fn ($query) => $query->where('user_id', $userId))
            ->when($monthNumber, fn ($query) => $query->whereMonth('submitted_at', $monthNumber))
            ->when($validated['year'] ?? null, fn ($query, $year) => $query->whereYear('submitted_at', $year))
            ->when($validated['scope'] ?? null, function ($query, $scope) {
                $query->whereHas(
                    'cap.answer.sessionArea.session',
                    fn ($sessionQuery) => $sessionQuery->where('scope', $scope)
                );
            })
            ->with(['cap.answer.sessionArea.session'])
            ->get();

        $grouped = $fulfillments->groupBy(function ($item) {
            $cap = $item->cap;
            return $cap?->answer?->session_area_id;
        });

        $payload = $grouped->map(function ($items) {
            $sample = $items->first();
            $cap = $sample?->cap;
            $sessionArea = $cap?->answer?->sessionArea;
            $session = $sessionArea?->session;
            $schedule = $session && $session->start_date && $session->end_date
                ? $session->start_date->format('Y-m-d').' - '.$session->end_date->format('Y-m-d')
                : null;
            $latestSent = $items->max('submitted_at');

            return [
                'sessionAreaId' => $sessionArea?->id,
                'title' => $session?->title,
                'area' => $sessionArea?->category ?? '-',
                'scope' => $session?->scope ?? '-',
                'schedule' => $schedule,
                'leader' => $session?->team_leader ?? '-',
                'dnp' => $session?->team_members ?? [],
                'kobo' => $session?->team_audity ?? [],
                'fulfillmentCount' => $items->count(),
                'sentAt' => $latestSent ? $latestSent->toDateTimeString() : null,
            ];
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

        $userId = $request->user()->id;

        $answer = SelfAssessmentAnswer::query()
            ->where('id', $validated['answerId'])
            ->where('user_id', $userId)
            ->firstOrFail();

        $resultExists = SelfAssessmentResult::query()
            ->where('session_area_id', $answer->session_area_id)
            ->where('user_id', $userId)
            ->exists();

        if (!$resultExists) {
            return response()->json(['error' => 'CAP hanya tersedia setelah hasil disahkan.'], 422);
        }

        $cap = SelfAssessmentCap::query()->firstOrNew([
            'answer_id' => $answer->id,
            'user_id' => $userId,
        ]);

        $cap->action_plan = $validated['actionPlan'];
        $cap->target_date = $validated['targetDate'];
        $cap->status = $validated['action'] === 'send' ? 'sent' : 'draft';
        $cap->sent_at = $validated['action'] === 'send' ? now() : null;
        $cap->save();

        if ($validated['action'] === 'send') {
            $admins = User::query()->where('role', 'admin')->get(['id']);
            $now = now();
            $notifications = $admins->map(function ($admin) use ($cap, $now) {
                return [
                    'id' => (string) Str::uuid(),
                    'user_id' => $admin->id,
                    'type' => 'cap-submitted',
                    'title' => 'CAP dikirim',
                    'message' => 'User mengirim penyusunan CAP.',
                    'data' => json_encode(['capId' => $cap->id]),
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            })->all();
            if (!empty($notifications)) {
                SystemNotification::query()->insert($notifications);
            }

            $cap->loadMissing(['answer.sessionArea.session', 'answer.user']);
            app(SelfAssessmentWhatsappNotificationService::class)
                ->notifyCapDraftSubmitted($cap);
        }

        return $this->respondData([
            'id' => $cap->id,
            'status' => $cap->status,
            'sentAt' => optional($cap->sent_at)->toDateTimeString(),
        ]);
    }

    public function storeFulfillment(Request $request, SelfAssessmentCap $cap)
    {
        $validated = $request->validate([
            'step' => ['required', 'integer', 'min:1'],
            'proposeAction' => ['required', 'string'],
            'actionOffice' => ['required', 'string'],
            'evidenceReference' => ['nullable', 'string'],
            'completeDate' => ['required', 'date'],
            'progress' => ['required', 'integer', 'min:0', 'max:100'],
            'action' => ['required', 'in:draft,send'],
            'file' => ['nullable', 'file', 'max:20480'],
            'files' => ['nullable', 'array'],
            'files.*' => ['file', 'max:20480'],
        ]);

        if ($cap->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        if (!$cap->review || !$cap->review->reviewed_at) {
            return response()->json([
                'error' => 'Review CAP belum tersedia.',
            ], 422);
        }

        $existingDraft = SelfAssessmentCapFulfillment::query()
            ->where('cap_id', $cap->id)
            ->where('step', $validated['step'])
            ->where('status', 'draft')
            ->orderByDesc('created_at')
            ->first();

        $isSend = $validated['action'] === 'send';

        if ($existingDraft) {
            $existingDraft->fill([
                'propose_action' => $validated['proposeAction'],
                'action_office' => $validated['actionOffice'],
                'evidence_reference' => $validated['evidenceReference'] ?? null,
                'complete_date' => $validated['completeDate'],
                'progress' => $validated['progress'],
                'status' => $isSend ? 'sent' : 'draft',
                'submitted_at' => $isSend ? now() : null,
            ]);
            $existingDraft->save();
            $fulfillment = $existingDraft;
        } else {
            $fulfillment = SelfAssessmentCapFulfillment::create([
                'cap_id' => $cap->id,
                'step' => $validated['step'],
                'propose_action' => $validated['proposeAction'],
                'action_office' => $validated['actionOffice'],
                'evidence_reference' => $validated['evidenceReference'] ?? null,
                'complete_date' => $validated['completeDate'],
                'progress' => $validated['progress'],
                'status' => $isSend ? 'sent' : 'draft',
                'submitted_at' => $isSend ? now() : null,
            ]);
        }

        $uploadedFiles = [];
        if (!empty($validated['file'])) {
            $uploadedFiles[] = $validated['file'];
        }
        if (!empty($validated['files']) && is_array($validated['files'])) {
            $uploadedFiles = array_merge($uploadedFiles, $validated['files']);
        }

        foreach ($uploadedFiles as $uploadedFile) {
            $path = $uploadedFile->store('self-assessment-cap-fulfillments', 'public');
            SelfAssessmentCapFulfillmentFile::create([
                'id' => (string) Str::uuid(),
                'fulfillment_id' => $fulfillment->id,
                'name' => $uploadedFile->getClientOriginalName(),
                'url' => Storage::disk('public')->url($path),
                'created_at' => now(),
            ]);
        }

        $scope = $cap->answer?->sessionArea?->session?->scope ?? null;

        if ($isSend && $scope === 'monitoring') {
            // Kiriman pemenuhan baru harus masuk siklus review admin lagi.
            if ($cap->fulfillmentReview) {
                $cap->fulfillmentReview->reviewed_at = null;
                $cap->fulfillmentReview->comment = null;
                $cap->fulfillmentReview->status = null;
                $cap->fulfillmentReview->result = null;
                $cap->fulfillmentReview->save();
            }
            if ($cap->monitoringReview) {
                $cap->monitoringReview->reviewed_at = null;
                $cap->monitoringReview->comment = null;
                $cap->monitoringReview->status = null;
                $cap->monitoringReview->result = null;
                $cap->monitoringReview->save();
            }

            $admins = User::query()
                ->where('role', 'admin')
                ->pluck('id');
            if ($admins->isNotEmpty()) {
                $now = now();
                $notifications = $admins->map(function ($adminId) use ($cap, $scope, $fulfillment, $now) {
                    return [
                        'id' => (string) Str::uuid(),
                        'user_id' => $adminId,
                        'type' => 'cap-fulfillment-submitted',
                        'title' => 'Pemenuhan CAP dikirim',
                        'message' => 'Ada pemenuhan CAP baru dari user yang perlu direview.',
                        'data' => json_encode([
                            'capId' => $cap->id,
                            'fulfillmentId' => $fulfillment->id,
                            'scope' => $scope,
                            'sessionAreaId' => $cap->answer?->session_area_id,
                            'userId' => $cap->user_id,
                        ]),
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                })->all();
                SystemNotification::query()->insert($notifications);
            }
        }

        if ($isSend) {
            $cap->loadMissing(['answer.sessionArea.session', 'answer.user']);
            app(SelfAssessmentWhatsappNotificationService::class)
                ->notifyCapFulfillmentSubmitted($cap, $fulfillment);
        }

        return $this->respondData([
            'id' => $fulfillment->id,
            'status' => $fulfillment->status,
            'submittedAt' => optional($fulfillment->submitted_at)->toDateTimeString(),
        ]);
    }

    public function storeExtension(Request $request, SelfAssessmentCap $cap)
    {
        $validated = $request->validate([
            'dueDate' => ['required', 'date'],
            'file' => ['required', 'file', 'max:20480'],
        ]);

        if ($cap->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        if (!$cap->review || !$cap->review->reviewed_at) {
            return response()->json([
                'error' => 'Review CAP belum tersedia.',
            ], 422);
        }

        $path = $validated['file']->store('self-assessment-cap-extensions', 'public');
        $extension = SelfAssessmentCapExtension::create([
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

    public function destroyFulfillmentFile(Request $request, SelfAssessmentCapFulfillmentFile $file)
    {
        $capUserId = $file->fulfillment?->cap?->user_id;
        if ($capUserId && $capUserId !== $request->user()->id) {
            return response()->json(['error' => 'Tidak diizinkan menghapus file ini.'], 403);
        }

        $relative = $this->resolveStoragePath((string) $file->url, ['self-assessment-cap-fulfillments/']);
        if ($relative !== '' && Storage::disk('public')->exists($relative)) {
            Storage::disk('public')->delete($relative);
        }
        $file->delete();

        return $this->respondData(['deleted' => true]);
    }

    public function downloadFulfillmentFileSigned(Request $request, SelfAssessmentCapFulfillmentFile $file)
    {
        $relative = $this->resolveStoragePath((string) $file->url, ['self-assessment-cap-fulfillments/']);
        if (!$relative || !Storage::disk('public')->exists($relative)) {
            return response()->json(['error' => 'File tidak ditemukan.'], 404);
        }
        $absolute = Storage::disk('public')->path($relative);
        return response()->download($absolute, $file->name ?: basename($relative));
    }

    public function downloadExtensionFileSigned(Request $request, SelfAssessmentCapExtension $extension)
    {
        $relative = $this->resolveStoragePath((string) $extension->file_url, ['self-assessment-cap-extensions/']);
        if (!$relative || !Storage::disk('public')->exists($relative)) {
            return response()->json(['error' => 'File tidak ditemukan.'], 404);
        }
        $absolute = Storage::disk('public')->path($relative);
        return response()->download($absolute, $extension->file_name ?: basename($relative));
    }

    public function adminIndex(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['nullable', 'in:audit,monitoring,inspeksi,surveillance'],
        ]);

        $caps = SelfAssessmentCap::query()
            ->where('status', 'sent')
            ->when($validated['scope'] ?? null, function ($query, $scope) {
                $query->whereHas('answer.sessionArea.session', fn ($sessionQuery) => $sessionQuery->where('scope', $scope));
            })
            ->with([
                'answer.sessionArea',
                'answer.sessionArea.session',
                'answer.review.reviewer',
                'review.reviewer',
                'user',
            ])
            ->orderByDesc('sent_at')
            ->get();

        $questionCodes = $caps
            ->map(fn (SelfAssessmentCap $cap) => $cap->answer?->question_code)
            ->filter()
            ->unique()
            ->values();

        $questions = SelfAssessmentQuestion::query()
            ->whereIn('code', $questionCodes)
            ->get()
            ->keyBy('code');

        $payload = $caps->map(function (SelfAssessmentCap $cap) use ($questions) {
            $answer = $cap->answer;
            $session = $answer?->sessionArea?->session;
            $question = $answer?->question_code ? $questions[$answer->question_code] ?? null : null;
            return [
                'id' => $cap->id,
                'answerId' => $cap->answer_id,
                'user' => $cap->user?->only(['id', 'name', 'email']),
                'area' => $answer?->sessionArea?->category ?? '-',
                'scope' => $session?->scope ?? '-',
                'questionCode' => $answer?->question_code,
                'questionText' => $question?->text ?? '',
                'actionPlan' => $cap->action_plan,
                'targetDate' => optional($cap->target_date)->format('Y-m-d'),
                'sentAt' => optional($cap->sent_at)->toDateTimeString(),
                'review' => $cap->review ? [
                    'result' => $cap->review->result,
                    'comment' => $cap->review->comment,
                    'status' => $cap->review->status,
                    'reviewedBy' => $cap->review->reviewer?->only(['id', 'name', 'email']),
                    'reviewedAt' => optional($cap->review->reviewed_at)->toDateTimeString(),
                ] : null,
                'selfAssessmentReview' => $answer?->review ? [
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
            ];
        });

        return $this->respondData($payload->values());
    }

    public function adminSessions(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['nullable', 'in:audit,monitoring,inspeksi,surveillance'],
            'month' => ['nullable'],
            'year' => ['nullable', 'integer'],
        ]);

        $monthNumber = $this->resolveMonth($validated['month'] ?? null);

        $caps = SelfAssessmentCap::query()
            ->where('status', 'sent')
            ->when($monthNumber, fn ($query) => $query->whereMonth('sent_at', $monthNumber))
            ->when($validated['year'] ?? null, fn ($query, $year) => $query->whereYear('sent_at', $year))
            ->when($validated['scope'] ?? null, function ($query, $scope) {
                $query->whereHas('answer.sessionArea.session', fn ($sessionQuery) => $sessionQuery->where('scope', $scope));
            })
            ->with(['answer.sessionArea.session', 'user', 'fulfillments:id,cap_id,progress'])
            ->get();

        $grouped = $caps->groupBy(fn ($cap) => $cap->answer?->session_area_id.'|'.$cap->user_id);

        $areaIds = $caps->map(fn ($cap) => $cap->answer?->session_area_id)
            ->filter()
            ->unique()
            ->values();
        $userIds = $caps->pluck('user_id')->unique()->values();

        $payload = $grouped->map(function ($items) {
            $sample = $items->first();
            $sessionArea = $sample?->answer?->sessionArea;
            $session = $sessionArea?->session;
            $schedule = $session && $session->start_date && $session->end_date
                ? $session->start_date->format('Y-m-d').' - '.$session->end_date->format('Y-m-d')
                : null;
            $latestSent = $items->max('sent_at');

            return [
                'sessionAreaId' => $sessionArea?->id,
                'user' => $sample->user?->only(['id', 'name', 'email']),
                'title' => $session?->title,
                'area' => $sessionArea?->category ?? '-',
                'scope' => $session?->scope ?? '-',
                'schedule' => $schedule,
                'leader' => $session?->team_leader ?? '-',
                'dnp' => $session?->team_members ?? [],
                'kobo' => $session?->team_audity ?? [],
                'capCount' => $items->count(),
                'openCapCount' => $items->filter(function ($cap) {
                    $highestProgress = (int) $cap->fulfillments
                        ->max(fn ($fulfillment) => (int) ($fulfillment->progress ?? 0));
                    return $highestProgress < 100;
                })->count(),
                'completedCapCount' => $items->filter(function ($cap) {
                    $highestProgress = (int) $cap->fulfillments
                        ->max(fn ($fulfillment) => (int) ($fulfillment->progress ?? 0));
                    return $highestProgress >= 100;
                })->count(),
                'sentAt' => $latestSent ? $latestSent->toDateTimeString() : null,
            ];
        })->values();

        return $this->respondData($payload);
    }

    public function adminShow(Request $request, SelfAssessmentSessionArea $area)
    {
        $validated = $request->validate([
            'userId' => ['required', 'uuid'],
        ]);

        $caps = SelfAssessmentCap::query()
            ->where('status', 'sent')
            ->where('user_id', $validated['userId'])
            ->whereHas('answer', function ($query) use ($area) {
                $query->where('session_area_id', $area->id);
            })
            ->with(['answer.review.reviewer', 'review.reviewer', 'answer.sessionArea.session'])
            ->get();

        if ($caps->isEmpty()) {
            return $this->respondData([
                'sessionAreaId' => $area->id,
                'area' => $area->category ?? '-',
                'scope' => $area->session?->scope ?? '-',
                'schedule' => null,
                'team' => null,
                'caps' => [],
            ]);
        }

        $session = $area->session;
        $schedule = $session && $session->start_date && $session->end_date
            ? $session->start_date->format('Y-m-d').' - '.$session->end_date->format('Y-m-d')
            : null;

        $team = $session?->team_leader ? [
            'leader' => $session->team_leader,
            'dnp' => $session->team_members ?? [],
            'kobo' => $session->team_audity ?? [],
        ] : null;

        $questionCodes = $caps->map(fn ($cap) => $cap->answer?->question_code)
            ->filter()
            ->unique()
            ->values();

        $questions = SelfAssessmentQuestion::query()
            ->whereIn('code', $questionCodes)
            ->get()
            ->keyBy('code');

        $payload = [
            'sessionAreaId' => $area->id,
            'area' => $area->category ?? '-',
            'scope' => $session?->scope ?? '-',
            'schedule' => $schedule,
            'team' => $team,
            'caps' => $caps->map(function (SelfAssessmentCap $cap) use ($questions) {
                $answer = $cap->answer;
                $question = $answer?->question_code ? $questions[$answer->question_code] ?? null : null;
                return [
                    'id' => $cap->id,
                    'answerId' => $cap->answer_id,
                    'questionCode' => $answer?->question_code,
                    'questionText' => $question?->text ?? '',
                    'actionPlan' => $cap->action_plan,
                    'targetDate' => optional($cap->target_date)->format('Y-m-d'),
                    'sentAt' => optional($cap->sent_at)->toDateTimeString(),
                    'review' => $cap->review ? [
                        'result' => $cap->review->result,
                        'comment' => $cap->review->comment,
                        'status' => $cap->review->status,
                        'reviewedBy' => $cap->review->reviewer?->only(['id', 'name', 'email']),
                        'reviewedAt' => optional($cap->review->reviewed_at)->toDateTimeString(),
                    ] : null,
                    'selfAssessmentReview' => $answer?->review ? [
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
                ];
            })->values(),
        ];

        return $this->respondData($payload);
    }

    public function adminFulfillmentSessions(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['nullable', 'in:audit,monitoring,inspeksi,surveillance'],
            'month' => ['nullable'],
            'year' => ['nullable', 'integer'],
            'openedOnly' => ['nullable', 'boolean'],
        ]);

        $monthNumber = $this->resolveMonth($validated['month'] ?? null);

        $fulfillments = SelfAssessmentCapFulfillment::query()
            ->where('status', 'sent')
            ->when($monthNumber, fn ($query) => $query->whereMonth('submitted_at', $monthNumber))
            ->when($validated['year'] ?? null, fn ($query, $year) => $query->whereYear('submitted_at', $year))
            ->when($validated['scope'] ?? null, function ($query, $scope) {
                $query->whereHas('cap.answer.sessionArea.session', fn ($sessionQuery) => $sessionQuery->where('scope', $scope));
            })
            ->with(['cap.answer.sessionArea.session', 'cap.user'])
            ->get();

        $grouped = $fulfillments->groupBy(function ($item) {
            $cap = $item->cap;
            $areaId = $cap?->answer?->session_area_id;
            return $areaId.'|'.$cap?->user_id;
        });

        $areaIds = $fulfillments
            ->map(fn ($item) => $item->cap?->answer?->session_area_id)
            ->filter()
            ->unique()
            ->values();
        $userIds = $fulfillments->map(fn ($item) => $item->cap?->user_id)
            ->filter()
            ->unique()
            ->values();

        $payload = $grouped->map(function ($items) {
            $sample = $items->first();
            $cap = $sample?->cap;
            $sessionArea = $cap?->answer?->sessionArea;
            $session = $sessionArea?->session;
            $schedule = $session && $session->start_date && $session->end_date
                ? $session->start_date->format('Y-m-d').' - '.$session->end_date->format('Y-m-d')
                : null;
            $latestSent = $items->max('submitted_at');

            return [
                'sessionAreaId' => $sessionArea?->id,
                'user' => $cap?->user?->only(['id', 'name', 'email']),
                'title' => $session?->title,
                'area' => $sessionArea?->category ?? '-',
                'scope' => $session?->scope ?? '-',
                'schedule' => $schedule,
                'leader' => $session?->team_leader ?? '-',
                'dnp' => $session?->team_members ?? [],
                'kobo' => $session?->team_audity ?? [],
                'fulfillmentCount' => $items->count(),
                'sentAt' => $latestSent ? $latestSent->toDateTimeString() : null,
            ];
        })->values();

        $openedOnly = (bool) ($validated['openedOnly'] ?? false);
        if ($openedOnly) {
            $today = Carbon::today();
            $monitoringSessions = SelfAssessmentSession::query()
                ->where('scope', 'monitoring')
                ->where('is_published', true)
                ->whereDate('start_date', '<=', $today)
                ->whereDate('end_date', '>=', $today)
                ->get(['id', 'target_session_area_ids']);

            $sessionIds = $monitoringSessions->pluck('id')->values();
            $sessionUserIds = $sessionIds->isNotEmpty()
                ? SelfAssessmentSessionUser::query()
                    ->whereIn('session_id', $sessionIds)
                    ->get(['session_id', 'user_id'])
                    ->groupBy('session_id')
                    ->map(fn ($rows) => $rows->pluck('user_id')->unique()->values()->all())
                : collect();

            $payload = $payload->filter(function (array $item) use ($monitoringSessions, $sessionUserIds) {
                $sessionAreaId = $item['sessionAreaId'] ?? null;
                $userId = $item['user']['id'] ?? null;
                if (!$sessionAreaId || !$userId) {
                    return false;
                }

                return $monitoringSessions->contains(function (SelfAssessmentSession $session) use ($sessionAreaId, $userId, $sessionUserIds) {
                    $targetAreaIds = collect($session->target_session_area_ids ?? []);
                    if (!$targetAreaIds->contains($sessionAreaId)) {
                        return false;
                    }

                    $allowedUserIds = collect($sessionUserIds->get($session->id, []));
                    if ($allowedUserIds->isEmpty()) {
                        return true;
                    }

                    return $allowedUserIds->contains($userId);
                });
            })->values();
        }

        return $this->respondData($payload);
    }

    public function adminFulfillmentShow(Request $request, SelfAssessmentSessionArea $area)
    {
        $validated = $request->validate([
            'userId' => ['required', 'uuid'],
        ]);

        $caps = SelfAssessmentCap::query()
            ->where('user_id', $validated['userId'])
            ->whereHas('answer', function ($query) use ($area) {
                $query->where('session_area_id', $area->id);
            })
            ->whereHas('fulfillments', function ($query) {
                $query->where('status', 'sent');
            })
            ->with([
                'answer.review.reviewer',
                'review.reviewer',
                'fulfillmentReview.reviewer',
                'monitoringReview.reviewer',
                'user',
                'answer.sessionArea.session',
                'fulfillments' => fn ($query) => $query->where('status', 'sent')->with('files'),
                'extensions',
            ])
            ->get();

        $totalCaps = SelfAssessmentCap::query()
            ->where('user_id', $validated['userId'])
            ->whereHas('answer', function ($query) use ($area) {
                $query->where('session_area_id', $area->id);
            })
            ->count();

        $result = SelfAssessmentMonitoringResult::query()
            ->where('session_area_id', $area->id)
            ->where('user_id', $validated['userId'])
            ->with('files')
            ->first();

        $resultPayload = $result ? [
            'id' => $result->id,
            'status' => $result->status,
            'finalizedAt' => optional($result->finalized_at)->toDateTimeString(),
            'files' => $result->files->map(function ($file) {
                return [
                    'id' => $file->id,
                    'name' => $file->name,
                    'url' => URL::temporarySignedRoute(
                        'self-assessment.monitoring-results.file.signed',
                        now()->addMinutes(10),
                        ['file' => $file->id]
                    ),
                ];
            })->values(),
        ] : null;

        if ($caps->isEmpty()) {
            return $this->respondData([
                'sessionAreaId' => $area->id,
                'area' => $area->category ?? '-',
                'scope' => $area->session?->scope ?? '-',
                'schedule' => null,
                'team' => null,
                'sentCaps' => 0,
                'totalCaps' => $totalCaps,
                'result' => $resultPayload,
                'user' => null,
                'caps' => [],
            ]);
        }

        $session = $area->session;
        $schedule = $session && $session->start_date && $session->end_date
            ? $session->start_date->format('Y-m-d').' - '.$session->end_date->format('Y-m-d')
            : null;

        $team = $session?->team_leader ? [
            'leader' => $session->team_leader,
            'dnp' => $session->team_members ?? [],
            'kobo' => $session->team_audity ?? [],
        ] : null;

        $questionCodes = $caps->map(fn ($cap) => $cap->answer?->question_code)
            ->filter()
            ->unique()
            ->values();

        $questions = SelfAssessmentQuestion::query()
            ->whereIn('code', $questionCodes)
            ->get()
            ->keyBy('code');
        $answerEvidence = SelfAssessmentEvidence::query()
            ->where('session_area_id', $area->id)
            ->where('user_id', $validated['userId'])
            ->orderBy('created_at')
            ->get();
        $evidenceByQuestionCode = $answerEvidence->groupBy(function (SelfAssessmentEvidence $evidence) {
            return strtoupper(trim((string) $evidence->question_code));
        });
        $evidenceByNormalizedQuestionCode = $answerEvidence->groupBy(function (SelfAssessmentEvidence $evidence) {
            return $this->normalizeQuestionCode($evidence->question_code);
        });

        $payload = [
            'sessionAreaId' => $area->id,
            'area' => $area->category ?? '-',
            'scope' => $session?->scope ?? '-',
            'schedule' => $schedule,
            'team' => $team,
            'sentCaps' => $caps->count(),
            'totalCaps' => $totalCaps,
            'result' => $resultPayload,
            'user' => $caps->first()?->user?->only(['id', 'name', 'email']),
            'caps' => $caps->map(function (SelfAssessmentCap $cap) use ($questions, $evidenceByQuestionCode, $evidenceByNormalizedQuestionCode) {
                $answer = $cap->answer;
                $question = $answer?->question_code ? $questions[$answer->question_code] ?? null : null;
                $questionCode = (string) ($answer?->question_code ?? '');
                $questionCodeKey = strtoupper(trim($questionCode));
                $normalizedQuestionCode = $this->normalizeQuestionCode($questionCode);

                $selfAssessmentEvidenceFiles = collect();
                if ($questionCodeKey !== '') {
                    $selfAssessmentEvidenceFiles = $evidenceByQuestionCode->get($questionCodeKey, collect());
                }
                if ($selfAssessmentEvidenceFiles->isEmpty() && $normalizedQuestionCode !== '') {
                    $selfAssessmentEvidenceFiles = $evidenceByNormalizedQuestionCode->get($normalizedQuestionCode, collect());
                }
                return [
                    'id' => $cap->id,
                    'answerId' => $cap->answer_id,
                    'questionCode' => $answer?->question_code,
                    'questionText' => $question?->text ?? '',
                    'questionReference' => $question?->reference,
                    'actionPlan' => $cap->action_plan,
                    'targetDate' => optional($cap->target_date)->format('Y-m-d'),
                    'selfAssessmentComment' => $answer?->comment,
                    'selfAssessmentEvidenceNote' => $answer?->evidence_note,
                    'selfAssessmentCreatedAt' => optional($answer?->created_at)->toDateTimeString(),
                    'selfAssessmentUpdatedAt' => optional($answer?->updated_at)->toDateTimeString(),
                    'selfAssessmentEvidenceFiles' => $selfAssessmentEvidenceFiles
                        ->map(function ($evidence) {
                            return [
                                'id' => $evidence->id,
                                'name' => $evidence->name,
                                'url' => URL::temporarySignedRoute(
                                    'self-assessment.evidence.signed',
                                    now()->addMinutes(10),
                                    ['evidence' => $evidence->id]
                                ),
                            ];
                        })
                        ->values(),
                    'review' => $cap->review ? [
                        'result' => $cap->review->result,
                        'comment' => $cap->review->comment,
                        'status' => $cap->review->status,
                        'reviewedBy' => $cap->review->reviewer?->only(['id', 'name', 'email']),
                        'reviewedAt' => optional($cap->review->reviewed_at)->toDateTimeString(),
                    ] : null,
                    'fulfillmentReview' => $cap->fulfillmentReview ? [
                        'result' => $cap->fulfillmentReview->result,
                        'comment' => $cap->fulfillmentReview->comment,
                        'status' => $cap->fulfillmentReview->status,
                        'reviewedBy' => $cap->fulfillmentReview->reviewer?->only(['id', 'name', 'email']),
                        'reviewedAt' => optional($cap->fulfillmentReview->reviewed_at)->toDateTimeString(),
                    ] : null,
                    'monitoringReview' => $cap->monitoringReview ? [
                        'result' => $cap->monitoringReview->result,
                        'comment' => $cap->monitoringReview->comment,
                        'status' => $cap->monitoringReview->status,
                        'reviewedBy' => $cap->monitoringReview->reviewer?->only(['id', 'name', 'email']),
                        'reviewedAt' => optional($cap->monitoringReview->reviewed_at)->toDateTimeString(),
                    ] : null,
                    'selfAssessmentReview' => $answer?->review ? [
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
                    'fulfillments' => $cap->fulfillments->map(function ($fulfillment) {
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
                            'updatedAt' => optional($fulfillment->updated_at)->toDateTimeString(),
                            'files' => $fulfillment->files->map(function ($file) {
                                return [
                                    'id' => $file->id,
                                    'name' => $file->name,
                                    'url' => URL::temporarySignedRoute(
                                        'self-assessment.cap.fulfillment-file.signed',
                                        now()->addMinutes(10),
                                        ['file' => $file->id]
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
                                'self-assessment.cap.extension-file.signed',
                                now()->addMinutes(10),
                                ['extension' => $extension->id]
                            ),
                            'status' => $extension->status,
                        ];
                    })->values(),
                ];
            })->values(),
        ];

        return $this->respondData($payload);
    }

    private function normalizeQuestionCode(?string $value): string
    {
        $raw = strtoupper(trim((string) $value));
        return preg_replace('/[^A-Z0-9]+/', '', $raw) ?? '';
    }

    public function adminReview(Request $request)
    {
        $validated = $request->validate([
            'capId' => ['required', 'uuid'],
            'result' => ['nullable', 'string'],
            'comment' => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
            'action' => ['nullable', 'in:draft,send'],
            'enforceProgress100' => ['nullable', 'boolean'],
        ]);

        $cap = SelfAssessmentCap::query()
            ->with(['answer.review'])
            ->findOrFail($validated['capId']);
        $action = $validated['action'] ?? 'send';
        $enforceProgress100 = (bool) ($validated['enforceProgress100'] ?? false);
        if ($enforceProgress100) {
            $highestProgress = (int) $cap->fulfillments()
                ->where('status', 'sent')
                ->max('progress');
            if ($highestProgress < 100) {
                return response()->json([
                    'error' => 'Review pemenuhan CAP hanya dapat dikirim jika progress sudah 100%.',
                ], 422);
            }
        }
        $reviewedAt = $action === 'send' ? now() : null;
        $resolvedStatus = $validated['status']
            ?? $validated['result']
            ?? $cap->answer?->review?->status
            ?? 'Not Satisfactory';
        $resolvedComment = $validated['comment'] ?? null;

        $review = SelfAssessmentCapReview::query()->updateOrCreate(
            ['cap_id' => $cap->id],
            [
                'reviewer_id' => $request->user()->id,
                'result' => $validated['result'] ?? $resolvedStatus,
                'comment' => $resolvedComment,
                'status' => $resolvedStatus,
                'reviewed_at' => $reviewedAt,
            ]
        );

        if ($action === 'send') {
            $notification = [
                'id' => (string) Str::uuid(),
                'user_id' => $cap->user_id,
                'type' => 'cap-reviewed',
                'title' => 'Review CAP dikirim',
                'message' => 'Review CAP dari admin telah tersedia.',
                'data' => json_encode(['capId' => $cap->id]),
                'created_at' => now(),
                'updated_at' => now(),
            ];
            SystemNotification::query()->insert([$notification]);

            $cap->loadMissing(['answer.sessionArea.session', 'answer.user']);
            app(SelfAssessmentWhatsappNotificationService::class)
                ->notifyUserCapReviewed(
                    $cap,
                    $validated['result'] ?? $resolvedStatus,
                    $resolvedComment,
                    $resolvedStatus
                );
        }

        return $this->respondData([
            'id' => $review->id,
            'reviewedAt' => optional($review->reviewed_at)->toDateTimeString(),
        ]);
    }

    public function adminFulfillmentReview(Request $request)
    {
        $validated = $request->validate([
            'capId' => ['required', 'uuid'],
            'result' => ['nullable', 'string'],
            'comment' => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
            'action' => ['nullable', 'in:draft,send'],
            'enforceProgress100' => ['nullable', 'boolean'],
        ]);

        $cap = SelfAssessmentCap::query()->findOrFail($validated['capId']);
        $action = $validated['action'] ?? 'send';
        $enforceProgress100 = (bool) ($validated['enforceProgress100'] ?? false);
        if ($enforceProgress100) {
            $highestProgress = (int) $cap->fulfillments()
                ->where('status', 'sent')
                ->max('progress');
            if ($highestProgress < 100) {
                return response()->json([
                    'error' => 'Review pemenuhan CAP hanya dapat dikirim jika progress sudah 100%.',
                ], 422);
            }
        }

        $reviewedAt = $action === 'send' ? now() : null;
        $resolvedStatus = $validated['status']
            ?? $validated['result']
            ?? 'Not Satisfactory';
        $resolvedComment = $validated['comment'] ?? null;

        $review = SelfAssessmentCapFulfillmentReview::query()->updateOrCreate(
            ['cap_id' => $cap->id],
            [
                'reviewer_id' => $request->user()->id,
                'result' => $validated['result'] ?? $resolvedStatus,
                'comment' => $resolvedComment,
                'status' => $resolvedStatus,
                'reviewed_at' => $reviewedAt,
            ]
        );

        if ($action === 'send') {
            $notification = [
                'id' => (string) Str::uuid(),
                'user_id' => $cap->user_id,
                'type' => 'cap-fulfillment-reviewed',
                'title' => 'Review pemenuhan CAP dikirim',
                'message' => 'Review pemenuhan CAP dari admin telah tersedia.',
                'data' => json_encode(['capId' => $cap->id]),
                'created_at' => now(),
                'updated_at' => now(),
            ];
            SystemNotification::query()->insert([$notification]);

            $cap->loadMissing(['answer.sessionArea.session', 'answer.user']);
            app(SelfAssessmentWhatsappNotificationService::class)
                ->notifyUserCapFulfillmentReviewed(
                    $cap,
                    $resolvedComment,
                    $resolvedStatus
                );
        }

        return $this->respondData([
            'id' => $review->id,
            'reviewedAt' => optional($review->reviewed_at)->toDateTimeString(),
        ]);
    }

    public function adminMonitoringReview(Request $request)
    {
        $validated = $request->validate([
            'capId' => ['required', 'uuid'],
            'result' => ['nullable', 'string'],
            'comment' => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
            'action' => ['nullable', 'in:draft,send'],
        ]);

        $cap = SelfAssessmentCap::query()->findOrFail($validated['capId']);
        $action = $validated['action'] ?? 'send';
        $reviewedAt = $action === 'send' ? now() : null;
        $resolvedStatus = $validated['status']
            ?? $validated['result']
            ?? 'Not Satisfactory';
        $resolvedComment = $validated['comment'] ?? null;

        $review = SelfAssessmentMonitoringReview::query()->updateOrCreate(
            ['cap_id' => $cap->id],
            [
                'reviewer_id' => $request->user()->id,
                'result' => $validated['result'] ?? $resolvedStatus,
                'comment' => $resolvedComment,
                'status' => $resolvedStatus,
                'reviewed_at' => $reviewedAt,
            ]
        );

        if ($action === 'send' && $cap->answer_id) {
            $isClosed = $this->isMonitoringClosedStatus($resolvedStatus);
            $existingSelfAssessmentReview = SelfAssessmentReview::query()
                ->where('answer_id', $cap->answer_id)
                ->first();

            SelfAssessmentReview::query()->updateOrCreate(
                ['answer_id' => $cap->answer_id],
                [
                    'reviewer_id' => $request->user()->id,
                    'status' => $existingSelfAssessmentReview?->status ?? $resolvedStatus,
                    'comment' => $existingSelfAssessmentReview?->comment,
                    'allow_reply' => !$isClosed,
                    'is_final' => $isClosed,
                    'sent_at' => $existingSelfAssessmentReview?->sent_at ?? now(),
                ]
            );
        }

        if ($action === 'send') {
            $notification = [
                'id' => (string) Str::uuid(),
                'user_id' => $cap->user_id,
                'type' => 'monitoring-reviewed',
                'title' => 'Review monitoring dikirim',
                'message' => 'Review monitoring dari admin telah tersedia.',
                'data' => json_encode(['capId' => $cap->id]),
                'created_at' => now(),
                'updated_at' => now(),
            ];
            SystemNotification::query()->insert([$notification]);
        }

        return $this->respondData([
            'id' => $review->id,
            'reviewedAt' => optional($review->reviewed_at)->toDateTimeString(),
        ]);
    }

    private function isMonitoringClosedStatus(?string $status): bool
    {
        $normalized = strtolower(trim((string) $status));
        return in_array($normalized, ['satisfactory', 'closed'], true);
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

    private function resolveMonth(?string $month): ?int
    {
        if (!$month || strtoupper($month) === 'ALL') {
            return null;
        }

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

        return $map[strtoupper($month)] ?? null;
    }
}
