<?php

namespace App\Http\Controllers\Api;

use App\Models\SelfAssessmentAnswer;
use App\Models\SelfAssessmentCap;
use App\Models\SelfAssessmentEvidence;
use App\Models\SelfAssessmentQuestion;
use App\Models\SelfAssessmentReview;
use App\Models\SelfAssessmentResult;
use App\Models\SelfAssessmentSession;
use App\Models\SelfAssessmentSessionArea;
use App\Models\SelfAssessmentSessionQuestionCategoryUser;
use App\Models\SelfAssessmentQuestionCategory;
use App\Models\SystemNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;

class SelfAssessmentReviewController extends ApiController
{
    public function adminIndex(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['nullable', 'in:audit,monitoring,inspeksi,surveillance'],
            'month' => ['nullable'],
            'year' => ['nullable', 'integer'],
        ]);

        $monthNumber = $this->resolveMonth($validated['month'] ?? null);

        $answers = SelfAssessmentAnswer::query()
            ->where('is_submitted', true)
            ->when($monthNumber, fn ($query) => $query->whereMonth('submitted_at', $monthNumber))
            ->when($validated['year'] ?? null, fn ($query, $year) => $query->whereYear('submitted_at', $year))
            ->when($validated['scope'] ?? null, function ($query, $scope) {
                $query->whereHas('sessionArea', function ($areaQuery) use ($scope) {
                    $areaQuery->whereHas('session', fn ($sessionQuery) => $sessionQuery->where('scope', $scope));
                });
            })
            ->with(['sessionArea.session', 'user'])
            ->get();

        $grouped = $answers->groupBy(fn ($answer) => $answer->session_area_id.'|'.$answer->user_id);

        $payload = $grouped->map(function (Collection $items) {
            $sample = $items->first();
            $session = $sample->sessionArea?->session;
            $schedule = $session && $session->start_date && $session->end_date
                ? $session->start_date->format('Y-m-d').' - '.$session->end_date->format('Y-m-d')
                : null;
            $latestSubmitted = $items->max('submitted_at');

            return [
                'sessionAreaId' => $sample->session_area_id,
                'user' => $sample->user?->only(['id', 'name', 'email']),
                'area' => $sample->sessionArea?->category ?? '-',
                'scope' => $session?->scope ?? '-',
                'schedule' => $schedule,
                'leader' => $session?->team_leader ?? '-',
                'dnp' => $session?->team_members ?? [],
                'kobo' => $session?->team_audity ?? [],
                'questionCount' => $items->count(),
                'submittedAt' => $latestSubmitted ? $latestSubmitted->toDateTimeString() : null,
            ];
        })->values();

        return $this->respondData($payload);
    }

    public function adminShow(Request $request, SelfAssessmentSessionArea $area)
    {
        $validated = $request->validate([
            'userId' => ['required', 'uuid'],
        ]);

        $session = SelfAssessmentSession::query()->find($area->session_id);

        $answers = SelfAssessmentAnswer::query()
            ->where('session_area_id', $area->id)
            ->where('user_id', $validated['userId'])
            ->where('is_submitted', true)
            ->with(['review.reviewer', 'user'])
            ->get();

        $questions = SelfAssessmentQuestion::query()
            ->when($session?->scope, fn ($query, $scope) => $query->where('scope', $scope))
            ->whereIn('code', $answers->pluck('question_code'))
            ->get()
            ->keyBy('code');
        $totalQuestions = $this->resolveTotalQuestions(
            $session,
            $area,
            $validated['userId']
        );

        $evidence = SelfAssessmentEvidence::query()
            ->where('session_area_id', $area->id)
            ->where('user_id', $validated['userId'])
            ->whereIn('question_code', $answers->pluck('question_code'))
            ->get()
            ->groupBy('question_code');

        $team = $session?->team_leader ? [
            'leader' => $session->team_leader,
            'dnp' => $session->team_members ?? [],
            'kobo' => $session->team_audity ?? [],
        ] : null;
        $result = SelfAssessmentResult::query()
            ->where('session_area_id', $area->id)
            ->where('user_id', $validated['userId'])
            ->with('files')
            ->first();

        $payload = [
            'sessionAreaId' => $area->id,
            'area' => $area->category,
            'scope' => $session?->scope ?? '',
            'schedule' => $session && $session->start_date && $session->end_date
                ? $session->start_date->format('Y-m-d').' - '.$session->end_date->format('Y-m-d')
                : null,
            'totalQuestions' => $totalQuestions,
            'team' => $team,
            'result' => $result ? [
                'id' => $result->id,
                'status' => $result->status,
                'finalizedAt' => optional($result->finalized_at)->toDateTimeString(),
                'files' => $result->files->map(fn ($file) => [
                    'id' => $file->id,
                    'name' => $file->name,
                    'url' => $file->url,
                ])->values(),
            ] : null,
            'answers' => $answers->map(function (SelfAssessmentAnswer $answer) use ($questions, $evidence) {
                $question = $questions[$answer->question_code] ?? null;
                $review = $answer->review;
                return [
                    'id' => $answer->id,
                    'questionCode' => $answer->question_code,
                    'questionText' => $question?->text ?? '',
                    'reference' => $question?->reference ?? '',
                    'status' => $answer->status,
                    'comment' => $answer->comment,
                    'evidenceNote' => $answer->evidence_note,
                    'submittedAt' => optional($answer->submitted_at)->toDateTimeString(),
                    'evidence' => ($evidence[$answer->question_code] ?? collect())->map(function ($item) {
                        return [
                            'id' => $item->id,
                            'name' => $item->name,
                            'url' => URL::temporarySignedRoute(
                                'self-assessment.evidence.signed',
                                now()->addMinutes(10),
                                ['evidence' => $item->id]
                            ),
                        ];
                    })->values(),
                    'review' => $review ? [
                        'id' => $review->id,
                        'status' => $review->status,
                        'comment' => $review->comment,
                        'severity' => $review->severity,
                        'probability' => $review->probability,
                        'resume' => $review->resume,
                        'description' => $review->description,
                        'finding' => $review->finding,
                        'recommendations' => $review->recommendations,
                        'remark' => $review->remark,
                        'allowReply' => $review->allow_reply,
                        'isFinal' => $review->is_final,
                        'sentAt' => optional($review->sent_at)->toDateTimeString(),
                        'reviewer' => $review->reviewer?->only(['id', 'name', 'email']),
                    ] : null,
                ];
            })->values(),
        ];

        return $this->respondData($payload);
    }

    private function resolveTotalQuestions(?SelfAssessmentSession $session, SelfAssessmentSessionArea $area, string $userId): int
    {
        if (!$session) {
            return 0;
        }

        $baseQuery = SelfAssessmentQuestion::query()
            ->where('scope', $session->scope)
            ->when($area->category, fn ($query, $category) => $query->where('category', $category))
            ->where('is_active', true);

        $sessionAssignments = SelfAssessmentSessionQuestionCategoryUser::query()
            ->where('session_id', $session->id)
            ->get(['question_category_id', 'user_id']);

        if ($sessionAssignments->isEmpty()) {
            return $baseQuery->count();
        }

        $userCategoryIds = $sessionAssignments
            ->where('user_id', $userId)
            ->pluck('question_category_id')
            ->unique();

        if ($userCategoryIds->isEmpty()) {
            return 0;
        }

        $categoryKeyById = SelfAssessmentQuestionCategory::query()
            ->where('scope', $session->scope)
            ->whereIn('id', $userCategoryIds)
            ->get(['id', 'prefix', 'name'])
            ->mapWithKeys(fn ($item) => [$item->id => $item->prefix.'|'.$item->name]);

        $allowedKeys = $categoryKeyById->values()->all();
        if (empty($allowedKeys)) {
            return 0;
        }

        $baseQuery->whereIn(
            \DB::raw("CONCAT(question_category_prefix, '|', question_category)"),
            $allowedKeys
        );

        return $baseQuery->count();
    }

    public function storeBulk(Request $request)
    {
        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.answerId' => ['required', 'uuid'],
            'items.*.status' => ['required', 'string'],
            'items.*.comment' => ['nullable', 'string'],
            'items.*.severity' => ['nullable', 'string'],
            'items.*.probability' => ['nullable', 'string'],
            'items.*.resume' => ['nullable', 'string'],
            'items.*.description' => ['nullable', 'string'],
            'items.*.finding' => ['nullable', 'string'],
            'items.*.recommendations' => ['nullable', 'string'],
            'items.*.remark' => ['nullable', 'string'],
            'action' => ['required', 'in:draft,send'],
            'allowReply' => ['nullable', 'boolean'],
        ]);

        $allowReply = $validated['allowReply'] ?? false;
        $action = $validated['action'];
        $sentAt = $action === 'send' ? now() : null;

        $reviews = [];
        $answerIds = [];
        foreach ($validated['items'] as $item) {
            $comment = $item['comment'] ?? null;
            $description = $item['description'] ?? null;
            if ($comment === null && $description !== null) {
                $comment = $description;
            }
            if ($description === null && $comment !== null) {
                $description = $comment;
            }

            $review = SelfAssessmentReview::query()->updateOrCreate(
                ['answer_id' => $item['answerId']],
                [
                    'reviewer_id' => $request->user()->id,
                    'status' => $item['status'],
                    'comment' => $comment,
                    'severity' => $item['severity'] ?? null,
                    'probability' => $item['probability'] ?? null,
                    'resume' => $item['resume'] ?? null,
                    'description' => $description,
                    'finding' => $item['finding'] ?? null,
                    'recommendations' => $item['recommendations'] ?? null,
                    'remark' => $item['remark'] ?? null,
                    'allow_reply' => $action === 'send' ? $allowReply : false,
                    'is_final' => $action === 'send' ? !$allowReply : false,
                    'sent_at' => $sentAt,
                ]
            );
            $reviews[] = $review->id;
            $answerIds[] = $item['answerId'];
        }

        if ($action === 'send' && !empty($answerIds)) {
            $answers = SelfAssessmentAnswer::query()
                ->whereIn('id', $answerIds)
                ->get(['id', 'user_id']);
            $now = now();
            $notifications = $answers->map(function ($answer) use ($allowReply, $now) {
                return [
                    'id' => (string) Str::uuid(),
                    'user_id' => $answer->user_id,
                    'type' => 'review-sent',
                    'title' => 'Review Unit Safety dikirim',
                    'message' => $allowReply
                        ? 'Review Unit Safety dikirim. Kamu bisa memperbaiki dan kirim ulang.'
                        : 'Review Unit Safety dikirim. Jawaban telah difinalisasi.',
                    'data' => json_encode([
                        'answerId' => $answer->id,
                        'allowReply' => $allowReply,
                    ]),
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            })->all();

            if (!empty($notifications)) {
                SystemNotification::query()->insert($notifications);
            }
        }

        return $this->respondData(['saved' => $reviews]);
    }

    public function index(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['nullable', 'in:audit,monitoring,inspeksi,surveillance'],
            'month' => ['nullable'],
            'year' => ['nullable', 'integer'],
        ]);

        $monthNumber = $this->resolveMonth($validated['month'] ?? null);
        $userId = $request->user()->id;
        $scope = $validated['scope'] ?? null;
        $monitoringReviewedAnswerIds = collect();

        if ($scope === 'monitoring') {
            $monitoringReviewedAnswerIds = SelfAssessmentCap::query()
                ->where('user_id', $userId)
                ->whereNotNull('answer_id')
                ->whereHas('fulfillments', fn ($query) => $query->whereIn('status', ['sent', 'submitted']))
                ->where(function ($query) use ($monthNumber, $validated) {
                    $query->whereHas('review', function ($reviewQuery) use ($monthNumber, $validated) {
                        $reviewQuery->whereNotNull('reviewed_at')
                            ->when($monthNumber, fn ($monthQuery) => $monthQuery->whereMonth('reviewed_at', $monthNumber))
                            ->when(
                                $validated['year'] ?? null,
                                fn ($yearQuery, $year) => $yearQuery->whereYear('reviewed_at', $year)
                            );
                    })->orWhereHas('answer.review', function ($reviewQuery) use ($monthNumber, $validated) {
                        $reviewQuery->whereNotNull('sent_at')
                            ->when($monthNumber, fn ($monthQuery) => $monthQuery->whereMonth('sent_at', $monthNumber))
                            ->when(
                                $validated['year'] ?? null,
                                fn ($yearQuery, $year) => $yearQuery->whereYear('sent_at', $year)
                            );
                    });
                })
                ->pluck('answer_id')
                ->filter()
                ->unique()
                ->values();
        }

        $answers = SelfAssessmentAnswer::query()
            ->where('user_id', $userId)
            ->when(
                $scope === 'monitoring',
                function ($query) use ($monitoringReviewedAnswerIds) {
                    if ($monitoringReviewedAnswerIds->isEmpty()) {
                        $query->whereRaw('1 = 0');
                        return;
                    }
                    $query->whereIn('id', $monitoringReviewedAnswerIds);
                },
                fn ($query) => $query->whereHas('review', fn ($reviewQuery) => $reviewQuery->whereNotNull('sent_at'))
            )
            ->when($scope !== 'monitoring' ? $monthNumber : null, function ($query, $month) {
                $query->whereMonth('submitted_at', $month);
            })
            ->when($scope !== 'monitoring' ? ($validated['year'] ?? null) : null, function ($query, $year) {
                $query->whereYear('submitted_at', $year);
            })
            ->when($scope, function ($query, $scope) {
                if ($scope === 'monitoring') {
                    return;
                }
                $query->whereHas('sessionArea', function ($areaQuery) use ($scope) {
                    $areaQuery->whereHas('session', fn ($sessionQuery) => $sessionQuery->where('scope', $scope));
                });
            })
            ->with(['sessionArea.session'])
            ->get();

        $grouped = $answers->groupBy('session_area_id');

        $payload = $grouped->map(function (Collection $items, string $areaId) {
            $sample = $items->first();
            $session = $sample->sessionArea?->session;
            $schedule = $session && $session->start_date && $session->end_date
                ? $session->start_date->format('Y-m-d').' - '.$session->end_date->format('Y-m-d')
                : null;
            $latestSubmitted = $items->max('submitted_at');

            return [
                'sessionAreaId' => $areaId,
                'area' => $sample->sessionArea?->category ?? '-',
                'scope' => $session?->scope ?? '-',
                'schedule' => $schedule,
                'leader' => $session?->team_leader ?? '-',
                'dnp' => $session?->team_members ?? [],
                'kobo' => $session?->team_audity ?? [],
                'questionCount' => $items->count(),
                'submittedAt' => $latestSubmitted ? $latestSubmitted->toDateTimeString() : null,
            ];
        })->values();

        return $this->respondData($payload);
    }

    public function show(Request $request, SelfAssessmentSessionArea $area)
    {
        $userId = $request->user()->id;

        $answers = SelfAssessmentAnswer::query()
            ->where('session_area_id', $area->id)
            ->where('user_id', $userId)
            ->with(['review.reviewer', 'user'])
            ->get();

        $session = SelfAssessmentSession::query()->find($area->session_id);

        $questions = SelfAssessmentQuestion::query()
            ->when($session?->scope, fn ($query, $scope) => $query->where('scope', $scope))
            ->whereIn('code', $answers->pluck('question_code'))
            ->get()
            ->keyBy('code');

        $evidence = SelfAssessmentEvidence::query()
            ->where('session_area_id', $area->id)
            ->where('user_id', $userId)
            ->whereIn('question_code', $answers->pluck('question_code'))
            ->get()
            ->groupBy('question_code');

        $payload = [
            'sessionAreaId' => $area->id,
            'area' => $area->category,
            'scope' => $session?->scope ?? '',
            'schedule' => $session && $session->start_date && $session->end_date
                ? $session->start_date->format('Y-m-d').' - '.$session->end_date->format('Y-m-d')
                : null,
            'answers' => $answers->map(function (SelfAssessmentAnswer $answer) use ($questions, $evidence) {
                $question = $questions[$answer->question_code] ?? null;
                return [
                    'id' => $answer->id,
                    'questionCode' => $answer->question_code,
                    'questionText' => $question?->text ?? '',
                    'reference' => $question?->reference ?? '',
                    'status' => $answer->status,
                    'comment' => $answer->comment,
                    'evidenceNote' => $answer->evidence_note,
                    'createdAt' => optional($answer->submitted_at ?? $answer->created_at)
                        ? optional($answer->submitted_at ?? $answer->created_at)->toDateTimeString()
                        : null,
                    'updatedAt' => optional($answer->updated_at)->toDateTimeString(),
                    'createdBy' => $answer->user?->only(['id', 'name', 'email']),
                    'isSubmitted' => $answer->is_submitted,
                    'submittedAt' => optional($answer->submitted_at)->toDateTimeString(),
                    'evidence' => ($evidence[$answer->question_code] ?? collect())->map(function ($item) {
                        return [
                            'id' => $item->id,
                            'name' => $item->name,
                            'url' => URL::temporarySignedRoute(
                                'self-assessment.evidence.signed',
                                now()->addMinutes(10),
                                ['evidence' => $item->id]
                            ),
                        ];
                    })->values(),
                    'review' => $answer->review ? [
                        'id' => $answer->review->id,
                        'status' => $answer->review->status,
                        'comment' => $answer->review->comment,
                        'severity' => $answer->review->severity,
                        'probability' => $answer->review->probability,
                        'resume' => $answer->review->resume,
                        'description' => $answer->review->description,
                        'finding' => $answer->review->finding,
                        'recommendations' => $answer->review->recommendations,
                        'remark' => $answer->review->remark,
                        'allowReply' => $answer->review->allow_reply,
                        'isFinal' => $answer->review->is_final,
                        'sentAt' => optional($answer->review->sent_at)->toDateTimeString(),
                        'reviewer' => $answer->review->reviewer?->only(['id', 'name', 'email']),
                    ] : null,
                ];
            })->values(),
        ];

        return $this->respondData($payload);
    }

    private function resolveMonth(?string $value): ?int
    {
        if (!$value) {
            return null;
        }

        if (is_numeric($value)) {
            $numeric = (int) $value;
            return $numeric >= 1 && $numeric <= 12 ? $numeric : null;
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

        $upper = strtoupper($value);
        return $map[$upper] ?? null;
    }
}
