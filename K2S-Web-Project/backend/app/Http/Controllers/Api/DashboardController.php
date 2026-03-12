<?php

namespace App\Http\Controllers\Api;

use App\Models\ExternalDnpCap;
use App\Models\SelfAssessmentAnswer;
use App\Models\SelfAssessmentCap;
use App\Models\SelfAssessmentQuestion;
use App\Models\SelfAssessmentQuestionCategory;
use App\Models\SelfAssessmentMonitoringResult;
use App\Models\SelfAssessmentResult;
use App\Models\SelfAssessmentReview;
use App\Models\SelfAssessmentSession;
use App\Models\SelfAssessmentSessionArea;
use App\Models\SelfAssessmentSessionQuestionCategoryUser;
use App\Models\SelfAssessmentSessionUser;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;

class DashboardController extends ApiController
{
    public function capSummary(Request $request)
    {
        $userId = $request->user()->id;
        $today = Carbon::today();
        $dueSoonLimit = Carbon::today()->addDays(7);

        $baseQuery = SelfAssessmentCap::query()
            ->where('user_id', $userId)
            ->where('status', 'sent');

        $totalCaps = (clone $baseQuery)->count();

        $closedCaps = (clone $baseQuery)
            ->whereHas('fulfillments', function ($query) {
                $query->where('status', 'sent');
            })
            ->count();

        $overdueCaps = (clone $baseQuery)
            ->whereDate('target_date', '<', $today)
            ->whereDoesntHave('fulfillments', function ($query) {
                $query->where('status', 'sent');
            })
            ->count();

        $dueSoonCaps = (clone $baseQuery)
            ->whereBetween('target_date', [$today, $dueSoonLimit])
            ->whereDoesntHave('fulfillments', function ($query) {
                $query->where('status', 'sent');
            })
            ->count();

        $openSessionsByScope = (clone $baseQuery)
            ->with(['answer.sessionArea.session'])
            ->get()
            ->filter(fn ($cap) => $cap->answer?->sessionArea?->session)
            ->groupBy(fn ($cap) => $cap->answer->sessionArea->session->scope ?? '-')
            ->map(function ($items) {
                return $items
                    ->map(fn ($cap) => $cap->answer?->session_area_id)
                    ->filter()
                    ->unique()
                    ->count();
            })
            ->toArray();

        $openSessions = array_sum($openSessionsByScope);

        return $this->respondData([
            'totalQuestions' => $totalCaps,
            'openSessions' => $openSessions,
            'openSessionsByScope' => $openSessionsByScope,
            'overdueCaps' => $overdueCaps,
            'dueSoonCaps' => $dueSoonCaps,
            'closedCaps' => $closedCaps,
        ]);
    }

    public function userAlerts(Request $request)
    {
        $userId = $request->user()->id;
        $today = Carbon::today();
        $now = now();
        $alerts = [];

        $baseCapQuery = SelfAssessmentCap::query()
            ->where('user_id', $userId)
            ->where('status', 'sent');

        $dueImmediateCaps = (clone $baseCapQuery)
            ->whereBetween('target_date', [$today, $today->copy()->addDays(3)->endOfDay()])
            ->whereDoesntHave('fulfillments', function ($query) {
                $query->where('status', 'sent');
            })
            ->count();

        if ($dueImmediateCaps > 0) {
            $alerts[] = [
                'key' => 'cap-fulfillment-expiring',
                'label' => 'PQ Pemenuhan CAP Mau Habis',
                'count' => $dueImmediateCaps,
                'href' => '/cap?status=open',
                'description' => 'Ada PQ CAP dengan deadline 0-3 hari. Segera lakukan pemenuhan.',
                'priority' => 92,
            ];
        }

        $dueSoonCaps = (clone $baseCapQuery)
            ->whereDate('target_date', '>', $today->copy()->addDays(3)->toDateString())
            ->whereDate('target_date', '<=', $today->copy()->addDays(7)->toDateString())
            ->whereDoesntHave('fulfillments', function ($query) {
                $query->where('status', 'sent');
            })
            ->count();

        if ($dueSoonCaps > 0) {
            $alerts[] = [
                'key' => 'cap-due-soon',
                'label' => 'PQ CAP Mendekati Due Date',
                'count' => $dueSoonCaps,
                'href' => '/cap?status=open',
                'description' => 'Ada PQ CAP dengan deadline 4-7 hari.',
                'priority' => 84,
            ];
        }

        $activeSessions = SelfAssessmentSession::query()
            ->where('scope', '!=', 'monitoring')
            ->where('is_published', true)
            ->whereDate('start_date', '<=', $today)
            ->whereDate('end_date', '>=', $today)
            ->get(['id', 'scope']);

        $activeSessionIds = $activeSessions->pluck('id')->values();
        if ($activeSessionIds->isNotEmpty()) {
            $assignedSessionIds = SelfAssessmentSessionUser::query()
                ->whereIn('session_id', $activeSessionIds)
                ->pluck('session_id')
                ->unique();

            if ($assignedSessionIds->isNotEmpty()) {
                $userAssignedSessionIds = SelfAssessmentSessionUser::query()
                    ->whereIn('session_id', $assignedSessionIds)
                    ->where('user_id', $userId)
                    ->pluck('session_id')
                    ->flip();

                $activeSessions = $activeSessions
                    ->filter(function ($session) use ($assignedSessionIds, $userAssignedSessionIds) {
                        return !$assignedSessionIds->contains($session->id)
                            || $userAssignedSessionIds->has($session->id);
                    })
                    ->values();
            }
        }

        $pqUnopened = 0;
        $pqDraft = 0;
        $pqUnopenedByScope = [
            'audit' => 0,
            'inspeksi' => 0,
            'surveillance' => 0,
        ];
        $pqDraftByScope = [
            'audit' => 0,
            'inspeksi' => 0,
            'surveillance' => 0,
        ];

        if ($activeSessions->isNotEmpty()) {
            $activeSessionIds = $activeSessions->pluck('id')->values();
            $areas = SelfAssessmentSessionArea::query()
                ->whereIn('session_id', $activeSessionIds)
                ->where('is_active', true)
                ->get(['id', 'session_id', 'category']);

            if ($areas->isNotEmpty()) {
                $areasBySession = $areas->groupBy('session_id');
                $scopes = $activeSessions->pluck('scope')->filter()->unique()->values();
                $categories = $areas->pluck('category')->filter()->unique()->values();

                $questions = SelfAssessmentQuestion::query()
                    ->where('is_active', true)
                    ->when($scopes->isNotEmpty(), fn ($query) => $query->whereIn('scope', $scopes))
                    ->when($categories->isNotEmpty(), fn ($query) => $query->whereIn('category', $categories))
                    ->get([
                        'scope',
                        'category',
                        'code',
                        'question_category_prefix',
                        'question_category',
                    ]);

                $questionItemsByScopeCategory = [];
                foreach ($questions as $question) {
                    $scopeCategoryKey = $question->scope.'|'.$question->category;
                    if (!isset($questionItemsByScopeCategory[$scopeCategoryKey])) {
                        $questionItemsByScopeCategory[$scopeCategoryKey] = [];
                    }

                    $questionItemsByScopeCategory[$scopeCategoryKey][] = [
                        'code' => $question->code,
                        'categoryKey' => $question->question_category_prefix.'|'.$question->question_category,
                    ];
                }

                $sessionCategoryAssignments = SelfAssessmentSessionQuestionCategoryUser::query()
                    ->whereIn('session_id', $activeSessionIds)
                    ->get(['session_id', 'user_id', 'question_category_id']);

                $hasCategoryAssignmentsBySession = [];
                $categoryIdsBySessionUser = [];
                foreach ($sessionCategoryAssignments as $assignment) {
                    $hasCategoryAssignmentsBySession[$assignment->session_id] = true;
                    $sessionUserKey = $assignment->session_id.'|'.$assignment->user_id;
                    if (!isset($categoryIdsBySessionUser[$sessionUserKey])) {
                        $categoryIdsBySessionUser[$sessionUserKey] = [];
                    }
                    $categoryIdsBySessionUser[$sessionUserKey][$assignment->question_category_id] = true;
                }

                $categoryKeyById = SelfAssessmentQuestionCategory::query()
                    ->whereIn('id', $sessionCategoryAssignments->pluck('question_category_id')->unique()->values())
                    ->get(['id', 'prefix', 'name'])
                    ->mapWithKeys(fn ($item) => [$item->id => $item->prefix.'|'.$item->name])
                    ->toArray();

                $answers = SelfAssessmentAnswer::query()
                    ->where('user_id', $userId)
                    ->whereIn('session_area_id', $areas->pluck('id')->values())
                    ->get(['session_area_id', 'question_code', 'is_submitted']);

                $answerStateByKey = [];
                foreach ($answers as $answer) {
                    $answerKey = $answer->session_area_id.'|'.$answer->question_code;
                    $answerStateByKey[$answerKey] = $answer->is_submitted ? 'submitted' : 'draft';
                }

                foreach ($activeSessions as $session) {
                    $sessionScope = strtolower((string) $session->scope);
                    if (!isset($pqUnopenedByScope[$sessionScope])) {
                        $pqUnopenedByScope[$sessionScope] = 0;
                    }
                    if (!isset($pqDraftByScope[$sessionScope])) {
                        $pqDraftByScope[$sessionScope] = 0;
                    }

                    $areasInSession = $areasBySession[$session->id] ?? collect();
                    if ($areasInSession->isEmpty()) {
                        continue;
                    }

                    $hasCategoryAssignments = $hasCategoryAssignmentsBySession[$session->id] ?? false;
                    $sessionUserKey = $session->id.'|'.$userId;
                    $assignedCategoryIds = array_keys($categoryIdsBySessionUser[$sessionUserKey] ?? []);

                    foreach ($areasInSession as $area) {
                        $scopeCategoryKey = $sessionScope.'|'.$area->category;
                        $questionItems = $questionItemsByScopeCategory[$scopeCategoryKey] ?? [];
                        if (empty($questionItems)) {
                            continue;
                        }

                        $expectedQuestionCodes = [];
                        if ($hasCategoryAssignments) {
                            if (empty($assignedCategoryIds)) {
                                continue;
                            }

                            $allowedCategoryKeys = [];
                            foreach ($assignedCategoryIds as $categoryId) {
                                $categoryKey = $categoryKeyById[$categoryId] ?? null;
                                if ($categoryKey) {
                                    $allowedCategoryKeys[$categoryKey] = true;
                                }
                            }

                            if (empty($allowedCategoryKeys)) {
                                continue;
                            }

                            foreach ($questionItems as $questionItem) {
                                if (isset($allowedCategoryKeys[$questionItem['categoryKey']])) {
                                    $expectedQuestionCodes[] = $questionItem['code'];
                                }
                            }
                        } else {
                            $expectedQuestionCodes = array_column($questionItems, 'code');
                        }

                        $expectedQuestionCodes = array_values(array_unique($expectedQuestionCodes));
                        foreach ($expectedQuestionCodes as $questionCode) {
                            $answerKey = $area->id.'|'.$questionCode;
                            $state = $answerStateByKey[$answerKey] ?? 'unopened';

                            if ($state === 'unopened') {
                                $pqUnopened += 1;
                                $pqUnopenedByScope[$sessionScope] += 1;
                                continue;
                            }

                            if ($state === 'draft') {
                                $pqDraft += 1;
                                $pqDraftByScope[$sessionScope] += 1;
                            }
                        }
                    }
                }
            }
        }

        if ($pqUnopened > 0) {
            $dominantScope = $this->resolveDominantScope($pqUnopenedByScope);
            $alerts[] = [
                'key' => 'pq-unopened',
                'label' => 'PQ Belum Diisi',
                'count' => $pqUnopened,
                'href' => $this->resolveSelfAssessmentRoute($dominantScope),
                'description' => 'Ada pertanyaan protocol question yang belum diisi pada sesi aktif.'
                    .$this->formatScopeBreakdown($pqUnopenedByScope),
                'priority' => 95,
            ];
        }

        if ($pqDraft > 0) {
            $dominantScope = $this->resolveDominantScope($pqDraftByScope);
            $alerts[] = [
                'key' => 'pq-draft',
                'label' => 'PQ Draft Belum Dikirim',
                'count' => $pqDraft,
                'href' => $this->resolveSelfAssessmentRoute($dominantScope),
                'description' => 'Ada jawaban protocol question yang masih draft dan belum dikirim.'
                    .$this->formatScopeBreakdown($pqDraftByScope),
                'priority' => 85,
            ];
        }

        $newMonitoringResults = SelfAssessmentMonitoringResult::query()
            ->where('user_id', $userId)
            ->whereNotNull('finalized_at')
            ->where('finalized_at', '>=', $now->copy()->subDays(7))
            ->whereHas('sessionArea', function ($query) {
                $query->whereHas('session', function ($sessionQuery) {
                    $sessionQuery->where('scope', 'monitoring');
                });
            })
            ->count();

        if ($newMonitoringResults > 0) {
            $alerts[] = [
                'key' => 'monitoring-latest',
                'label' => 'Monitoring Baru dari Admin',
                'count' => $newMonitoringResults,
                'href' => '/monitoring/protocol-question/hasil-review-dgca',
                'description' => 'Hasil monitoring baru dikirim admin dalam 7 hari terakhir.',
                'priority' => 70,
            ];
        }

        usort($alerts, function (array $left, array $right) {
            $priorityLeft = (int) ($left['priority'] ?? 0);
            $priorityRight = (int) ($right['priority'] ?? 0);
            if ($priorityLeft !== $priorityRight) {
                return $priorityRight <=> $priorityLeft;
            }

            return (int) ($right['count'] ?? 0) <=> (int) ($left['count'] ?? 0);
        });

        $payload = array_map(function (array $item) {
            unset($item['priority']);
            return $item;
        }, $alerts);

        return $this->respondData($payload);
    }

    public function capOpenTrend(Request $request)
    {
        $validated = $request->validate([
            'userId' => ['nullable', 'uuid'],
        ]);

        $authUser = $request->user();
        $isAdmin = strtolower((string) $authUser->role) === 'admin';

        $query = SelfAssessmentCap::query()
            ->where('status', 'sent')
            ->with([
                'answer.sessionArea.session',
                'fulfillments',
            ]);

        if ($isAdmin) {
            if (!empty($validated['userId'])) {
                $query->where('user_id', $validated['userId']);
            }
        } else {
            $query->where('user_id', $authUser->id);
        }

        $payload = $query->get()
            ->map(function (SelfAssessmentCap $cap) {
                $session = $cap->answer?->sessionArea?->session;
                if (!$session) {
                    return null;
                }

                $latestFulfillment = $cap->fulfillments
                    ->filter(fn ($fulfillment) => $fulfillment->submitted_at || $fulfillment->created_at)
                    ->sortByDesc(function ($fulfillment) {
                        $submitted = $fulfillment->submitted_at?->timestamp ?? 0;
                        $created = $fulfillment->created_at?->timestamp ?? 0;
                        return max($submitted, $created);
                    })
                    ->first();

                if (!$latestFulfillment) {
                    return null;
                }

                $activityAt = $latestFulfillment->submitted_at ?? $latestFulfillment->created_at;
                if (!$activityAt) {
                    return null;
                }

                return [
                    'capId' => $cap->id,
                    'fulfillmentId' => $latestFulfillment->id,
                    'step' => (int) $latestFulfillment->step,
                    'userId' => $cap->user_id,
                    'scope' => $session->scope ?? '-',
                    'progress' => (int) ($latestFulfillment->progress ?? 0),
                    'status' => $latestFulfillment->status,
                    'activityAt' => $activityAt->toDateTimeString(),
                ];
            })
            ->filter(fn ($item) => $item !== null)
            ->values();

        return $this->respondData($payload);
    }

    public function externalDnpCapTrend(Request $request)
    {
        $payload = ExternalDnpCap::query()
            ->whereHas('fulfillments')
            ->with([
                'answer.sessionArea.session',
                'fulfillments',
            ])
            ->get()
            ->map(function (ExternalDnpCap $cap) {
                $session = $cap->answer?->sessionArea?->session;
                if (!$session) {
                    return null;
                }

                $latestFulfillment = $cap->fulfillments
                    ->filter(fn ($fulfillment) => $fulfillment->submitted_at || $fulfillment->created_at)
                    ->sortByDesc(function ($fulfillment) {
                        $submitted = $fulfillment->submitted_at?->timestamp ?? 0;
                        $created = $fulfillment->created_at?->timestamp ?? 0;
                        return max($submitted, $created);
                    })
                    ->first();

                if (!$latestFulfillment) {
                    return null;
                }

                $activityAt = $latestFulfillment->submitted_at ?? $latestFulfillment->created_at;
                if (!$activityAt) {
                    return null;
                }

                return [
                    'capId' => $cap->id,
                    'fulfillmentId' => $latestFulfillment->id,
                    'step' => (int) $latestFulfillment->step,
                    'userId' => 'external-dnp',
                    'scope' => $session->scope ?? '-',
                    'progress' => (int) ($latestFulfillment->progress ?? 0),
                    'status' => $latestFulfillment->status,
                    'activityAt' => $activityAt->toDateTimeString(),
                ];
            })
            ->filter(fn ($item) => $item !== null)
            ->values();

        return $this->respondData($payload);
    }

    public function adminModuleTrend(Request $request)
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $to = !empty($validated['to'])
            ? Carbon::parse($validated['to'])->endOfDay()
            : Carbon::today()->endOfDay();
        if (!empty($validated['from'])) {
            $from = Carbon::parse($validated['from'])->startOfDay();
        } else {
            $minimumDates = collect([
                SelfAssessmentSession::query()->min('start_date'),
                SelfAssessmentCap::query()->min('created_at'),
            ])->filter();

            $from = $minimumDates->isNotEmpty()
                ? Carbon::parse($minimumDates->sort()->first())->startOfMonth()
                : $to->copy()->subMonths(5)->startOfMonth();
        }

        $monthCursor = $from->copy()->startOfMonth();
        $lastMonth = $to->copy()->startOfMonth();
        $buckets = [];

        while ($monthCursor <= $lastMonth) {
            $key = $monthCursor->format('Y-m');
            $buckets[$key] = [
                'month' => $key,
                'selfAssessment' => [
                    'unopened' => 0,
                    'draft' => 0,
                    'submitted' => 0,
                ],
                'cap' => [
                    'open' => 0,
                    'progress' => 0,
                    'completed' => 0,
                ],
                'monitoring' => [
                    'notOpened' => 0,
                    'active' => 0,
                    'completed' => 0,
                ],
            ];
            $monthCursor->addMonth();
        }

        $nonMonitoringSessions = SelfAssessmentSession::query()
            ->where('scope', '!=', 'monitoring')
            ->whereDate('start_date', '>=', $from->toDateString())
            ->whereDate('start_date', '<=', $to->toDateString())
            ->get(['id', 'scope', 'start_date']);

        if ($nonMonitoringSessions->isNotEmpty()) {
            $sessionIds = $nonMonitoringSessions->pluck('id')->values();
            $areas = SelfAssessmentSessionArea::query()
                ->whereIn('session_id', $sessionIds)
                ->where('is_active', true)
                ->get(['id', 'session_id', 'category']);
            $areasBySession = $areas->groupBy('session_id');
            $areaIds = $areas->pluck('id')->values();

            if ($areas->isNotEmpty()) {
                $questions = SelfAssessmentQuestion::query()
                    ->where('is_active', true)
                    ->whereIn('scope', $nonMonitoringSessions->pluck('scope')->unique()->values())
                    ->whereIn('category', $areas->pluck('category')->unique()->values())
                    ->get([
                        'scope',
                        'category',
                        'code',
                        'question_category_prefix',
                        'question_category',
                    ]);

                $questionItemsByScopeCategory = [];
                foreach ($questions as $question) {
                    $scopeCategoryKey = $question->scope.'|'.$question->category;
                    if (!isset($questionItemsByScopeCategory[$scopeCategoryKey])) {
                        $questionItemsByScopeCategory[$scopeCategoryKey] = [];
                    }

                    $questionItemsByScopeCategory[$scopeCategoryKey][] = [
                        'code' => $question->code,
                        'categoryKey' => $question->question_category_prefix.'|'.$question->question_category,
                    ];
                }

                $sessionUsers = SelfAssessmentSessionUser::query()
                    ->whereIn('session_id', $sessionIds)
                    ->get(['session_id', 'user_id']);

                $userIdsBySession = [];
                foreach ($sessionUsers as $sessionUser) {
                    if (!isset($userIdsBySession[$sessionUser->session_id])) {
                        $userIdsBySession[$sessionUser->session_id] = [];
                    }
                    $userIdsBySession[$sessionUser->session_id][$sessionUser->user_id] = true;
                }

                $sessionCategoryAssignments = SelfAssessmentSessionQuestionCategoryUser::query()
                    ->whereIn('session_id', $sessionIds)
                    ->get(['session_id', 'user_id', 'question_category_id']);

                $hasCategoryAssignmentsBySession = [];
                $categoryIdsBySessionUser = [];
                foreach ($sessionCategoryAssignments as $assignment) {
                    $hasCategoryAssignmentsBySession[$assignment->session_id] = true;
                    $sessionUserKey = $assignment->session_id.'|'.$assignment->user_id;
                    if (!isset($categoryIdsBySessionUser[$sessionUserKey])) {
                        $categoryIdsBySessionUser[$sessionUserKey] = [];
                    }
                    $categoryIdsBySessionUser[$sessionUserKey][$assignment->question_category_id] = true;
                }

                $categoryKeyById = SelfAssessmentQuestionCategory::query()
                    ->whereIn('id', $sessionCategoryAssignments->pluck('question_category_id')->unique()->values())
                    ->get(['id', 'prefix', 'name'])
                    ->mapWithKeys(fn ($item) => [$item->id => $item->prefix.'|'.$item->name])
                    ->toArray();

                $answerStates = SelfAssessmentAnswer::query()
                    ->whereIn('session_area_id', $areaIds)
                    ->get(['session_area_id', 'user_id', 'question_code', 'is_submitted']);

                $answerStateByKey = [];
                foreach ($answerStates as $answerState) {
                    $answerKey = $answerState->session_area_id.'|'.$answerState->user_id.'|'.$answerState->question_code;
                    $answerStateByKey[$answerKey] = $answerState->is_submitted ? 'submitted' : 'draft';
                }

                $allNonAdminUserIds = User::query()
                    ->whereRaw('LOWER(role) <> ?', ['admin'])
                    ->pluck('id')
                    ->values()
                    ->all();

                foreach ($nonMonitoringSessions as $session) {
                    if (!$session->start_date) {
                        continue;
                    }

                    $bucketKey = $session->start_date->copy()->startOfMonth()->format('Y-m');
                    if (!isset($buckets[$bucketKey])) {
                        continue;
                    }

                    $sessionUserIds = array_keys($userIdsBySession[$session->id] ?? []);
                    if (empty($sessionUserIds)) {
                        $sessionUserIds = $allNonAdminUserIds;
                    }
                    if (empty($sessionUserIds)) {
                        continue;
                    }

                    $areasInSession = $areasBySession[$session->id] ?? collect();
                    if ($areasInSession->isEmpty()) {
                        continue;
                    }

                    $hasCategoryAssignments = $hasCategoryAssignmentsBySession[$session->id] ?? false;

                    foreach ($areasInSession as $area) {
                        $scopeCategoryKey = $session->scope.'|'.$area->category;
                        $questionItems = $questionItemsByScopeCategory[$scopeCategoryKey] ?? [];
                        if (empty($questionItems)) {
                            continue;
                        }

                        foreach ($sessionUserIds as $userId) {
                            $expectedQuestionCodes = [];

                            if ($hasCategoryAssignments) {
                                $sessionUserKey = $session->id.'|'.$userId;
                                $assignedCategoryIds = array_keys($categoryIdsBySessionUser[$sessionUserKey] ?? []);
                                if (empty($assignedCategoryIds)) {
                                    continue;
                                }

                                $allowedCategoryKeys = [];
                                foreach ($assignedCategoryIds as $categoryId) {
                                    $categoryKey = $categoryKeyById[$categoryId] ?? null;
                                    if ($categoryKey) {
                                        $allowedCategoryKeys[$categoryKey] = true;
                                    }
                                }

                                if (empty($allowedCategoryKeys)) {
                                    continue;
                                }

                                foreach ($questionItems as $questionItem) {
                                    if (isset($allowedCategoryKeys[$questionItem['categoryKey']])) {
                                        $expectedQuestionCodes[] = $questionItem['code'];
                                    }
                                }
                            } else {
                                $expectedQuestionCodes = array_values(array_unique(array_column($questionItems, 'code')));
                            }

                            foreach ($expectedQuestionCodes as $questionCode) {
                                $answerKey = $area->id.'|'.$userId.'|'.$questionCode;
                                $state = $answerStateByKey[$answerKey] ?? 'unopened';

                                if ($state === 'submitted') {
                                    $buckets[$bucketKey]['selfAssessment']['submitted'] += 1;
                                } elseif ($state === 'draft') {
                                    $buckets[$bucketKey]['selfAssessment']['draft'] += 1;
                                } else {
                                    $buckets[$bucketKey]['selfAssessment']['unopened'] += 1;
                                }
                            }
                        }
                    }
                }
            }
        }

        $monitoringSessions = SelfAssessmentSession::query()
            ->where('scope', 'monitoring')
            ->whereDate('start_date', '>=', $from->toDateString())
            ->whereDate('start_date', '<=', $to->toDateString())
            ->get(['start_date', 'end_date', 'is_published']);
        $today = Carbon::today();

        foreach ($monitoringSessions as $session) {
            if (!$session->start_date) {
                continue;
            }

            $bucketKey = $session->start_date->copy()->startOfMonth()->format('Y-m');
            if (!isset($buckets[$bucketKey])) {
                continue;
            }

            if (!$session->is_published || $session->start_date->copy()->startOfDay()->gt($today)) {
                $buckets[$bucketKey]['monitoring']['notOpened'] += 1;
                continue;
            }

            if ($session->end_date && $session->end_date->copy()->endOfDay()->lt($today)) {
                $buckets[$bucketKey]['monitoring']['completed'] += 1;
                continue;
            }

            $buckets[$bucketKey]['monitoring']['active'] += 1;
        }

        $caps = SelfAssessmentCap::query()
            ->whereBetween('created_at', [$from, $to])
            ->with(['fulfillments:id,cap_id,progress'])
            ->get(['id', 'created_at']);

        foreach ($caps as $cap) {
            if (!$cap->created_at) {
                continue;
            }

            $bucketKey = $cap->created_at->copy()->startOfMonth()->format('Y-m');
            if (!isset($buckets[$bucketKey])) {
                continue;
            }

            $highestProgress = (int) $cap->fulfillments
                ->max(fn ($fulfillment) => (int) ($fulfillment->progress ?? 0));

            if ($highestProgress >= 100) {
                $buckets[$bucketKey]['cap']['completed'] += 1;
                continue;
            }

            if ($highestProgress > 0) {
                $buckets[$bucketKey]['cap']['progress'] += 1;
                continue;
            }

            $buckets[$bucketKey]['cap']['open'] += 1;
        }

        return $this->respondData(array_values($buckets));
    }

    public function adminInsightTables(Request $request)
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $to = !empty($validated['to'])
            ? Carbon::parse($validated['to'])->endOfDay()
            : Carbon::today()->endOfDay();
        if (!empty($validated['from'])) {
            $from = Carbon::parse($validated['from'])->startOfDay();
        } else {
            $minimumDates = collect([
                SelfAssessmentSession::query()->min('start_date'),
                SelfAssessmentCap::query()->min('created_at'),
            ])->filter();

            $from = $minimumDates->isNotEmpty()
                ? Carbon::parse($minimumDates->sort()->first())->startOfMonth()
                : $to->copy()->subMonths(5)->startOfMonth();
        }

        $today = Carbon::today();
        $deadlineLimit = $today->copy()->addDays(7)->endOfDay();

        $users = User::query()
            ->whereRaw('LOWER(role) <> ?', ['admin'])
            ->orderBy('name')
            ->get(['id', 'name']);
        $allNonAdminUserIds = $users->pluck('id')->values()->all();

        $userRows = [];
        foreach ($users as $user) {
            $userRows[$user->id] = [
                'userId' => $user->id,
                'userName' => $user->name ?? '-',
                'saUnopened' => 0,
                'saDraft' => 0,
                'saSubmitted' => 0,
                'saWaitingReview' => 0,
                'saStagnant' => 0,
                'totalQuestions' => 0,
                'capOpen' => 0,
                'capCompleted' => 0,
                'capOverdue' => 0,
                'totalCaps' => 0,
                'monitoringNotOpened' => 0,
                'monitoringActive' => 0,
                'monitoringCompleted' => 0,
                'lastActivity' => null,
            ];
        }

        $touchLastActivity = static function (array &$rows, string $userId, mixed $candidate): void {
            if (!isset($rows[$userId]) || !$candidate) {
                return;
            }

            if ($candidate instanceof Carbon) {
                $activityAt = $candidate->copy();
            } else {
                try {
                    $activityAt = Carbon::parse((string) $candidate);
                } catch (\Throwable $e) {
                    return;
                }
            }

            if (!$rows[$userId]['lastActivity'] || $activityAt->gt($rows[$userId]['lastActivity'])) {
                $rows[$userId]['lastActivity'] = $activityAt;
            }
        };
        $stagnantThreshold = Carbon::now()->subDays(3);
        $isOlderThanThreshold = static function (mixed $candidate, Carbon $threshold): bool {
            if (!$candidate) {
                return false;
            }

            if ($candidate instanceof Carbon) {
                return $candidate->copy()->lt($threshold);
            }

            try {
                return Carbon::parse((string) $candidate)->lt($threshold);
            } catch (\Throwable $e) {
                return false;
            }
        };

        $nonMonitoringSessions = SelfAssessmentSession::query()
            ->where('scope', '!=', 'monitoring')
            ->whereDate('start_date', '>=', $from->toDateString())
            ->whereDate('start_date', '<=', $to->toDateString())
            ->get(['id', 'scope', 'start_date']);

        if ($nonMonitoringSessions->isNotEmpty()) {
            $sessionIds = $nonMonitoringSessions->pluck('id')->values();
            $areas = SelfAssessmentSessionArea::query()
                ->whereIn('session_id', $sessionIds)
                ->where('is_active', true)
                ->get(['id', 'session_id', 'category']);
            $areasBySession = $areas->groupBy('session_id');
            $areaIds = $areas->pluck('id')->values();

            if ($areas->isNotEmpty()) {
                $questions = SelfAssessmentQuestion::query()
                    ->where('is_active', true)
                    ->whereIn('scope', $nonMonitoringSessions->pluck('scope')->unique()->values())
                    ->whereIn('category', $areas->pluck('category')->unique()->values())
                    ->get([
                        'scope',
                        'category',
                        'code',
                        'question_category_prefix',
                        'question_category',
                    ]);

                $questionItemsByScopeCategory = [];
                foreach ($questions as $question) {
                    $scopeCategoryKey = $question->scope.'|'.$question->category;
                    if (!isset($questionItemsByScopeCategory[$scopeCategoryKey])) {
                        $questionItemsByScopeCategory[$scopeCategoryKey] = [];
                    }

                    $questionItemsByScopeCategory[$scopeCategoryKey][] = [
                        'code' => $question->code,
                        'categoryKey' => $question->question_category_prefix.'|'.$question->question_category,
                    ];
                }

                $sessionUsers = SelfAssessmentSessionUser::query()
                    ->whereIn('session_id', $sessionIds)
                    ->get(['session_id', 'user_id']);

                $userIdsBySession = [];
                foreach ($sessionUsers as $sessionUser) {
                    if (!isset($userIdsBySession[$sessionUser->session_id])) {
                        $userIdsBySession[$sessionUser->session_id] = [];
                    }
                    $userIdsBySession[$sessionUser->session_id][$sessionUser->user_id] = true;
                }

                $sessionCategoryAssignments = SelfAssessmentSessionQuestionCategoryUser::query()
                    ->whereIn('session_id', $sessionIds)
                    ->get(['session_id', 'user_id', 'question_category_id']);

                $hasCategoryAssignmentsBySession = [];
                $categoryIdsBySessionUser = [];
                foreach ($sessionCategoryAssignments as $assignment) {
                    $hasCategoryAssignmentsBySession[$assignment->session_id] = true;
                    $sessionUserKey = $assignment->session_id.'|'.$assignment->user_id;
                    if (!isset($categoryIdsBySessionUser[$sessionUserKey])) {
                        $categoryIdsBySessionUser[$sessionUserKey] = [];
                    }
                    $categoryIdsBySessionUser[$sessionUserKey][$assignment->question_category_id] = true;
                }

                $categoryKeyById = SelfAssessmentQuestionCategory::query()
                    ->whereIn('id', $sessionCategoryAssignments->pluck('question_category_id')->unique()->values())
                    ->get(['id', 'prefix', 'name'])
                    ->mapWithKeys(fn ($item) => [$item->id => $item->prefix.'|'.$item->name])
                    ->toArray();

                $answers = SelfAssessmentAnswer::query()
                    ->whereIn('session_area_id', $areaIds)
                    ->get([
                        'id',
                        'session_area_id',
                        'user_id',
                        'question_code',
                        'is_submitted',
                        'created_at',
                        'updated_at',
                        'submitted_at',
                    ]);

                $answerStateByKey = [];
                $answerIdByKey = [];
                $answerActivityByKey = [];
                foreach ($answers as $answer) {
                    $answerKey = $answer->session_area_id.'|'.$answer->user_id.'|'.$answer->question_code;
                    $answerStateByKey[$answerKey] = $answer->is_submitted ? 'submitted' : 'draft';
                    $answerIdByKey[$answerKey] = $answer->id;
                    $answerActivityByKey[$answerKey] =
                        $answer->submitted_at ?? $answer->updated_at ?? $answer->created_at;
                }

                $reviewedAnswerIds = $answers->isNotEmpty()
                    ? SelfAssessmentReview::query()
                        ->whereIn('answer_id', $answers->pluck('id')->values())
                        ->whereNotNull('sent_at')
                        ->pluck('answer_id')
                        ->flip()
                    : collect();

                foreach ($nonMonitoringSessions as $session) {
                    $sessionUserIds = array_keys($userIdsBySession[$session->id] ?? []);
                    if (empty($sessionUserIds)) {
                        $sessionUserIds = $allNonAdminUserIds;
                    }
                    if (empty($sessionUserIds)) {
                        continue;
                    }

                    $areasInSession = $areasBySession[$session->id] ?? collect();
                    if ($areasInSession->isEmpty()) {
                        continue;
                    }

                    $hasCategoryAssignments = $hasCategoryAssignmentsBySession[$session->id] ?? false;

                    foreach ($areasInSession as $area) {
                        $scopeCategoryKey = $session->scope.'|'.$area->category;
                        $questionItems = $questionItemsByScopeCategory[$scopeCategoryKey] ?? [];
                        if (empty($questionItems)) {
                            continue;
                        }

                        foreach ($sessionUserIds as $userId) {
                            if (!isset($userRows[$userId])) {
                                continue;
                            }

                            $expectedQuestionCodes = [];

                            if ($hasCategoryAssignments) {
                                $sessionUserKey = $session->id.'|'.$userId;
                                $assignedCategoryIds = array_keys($categoryIdsBySessionUser[$sessionUserKey] ?? []);
                                if (empty($assignedCategoryIds)) {
                                    continue;
                                }

                                $allowedCategoryKeys = [];
                                foreach ($assignedCategoryIds as $categoryId) {
                                    $categoryKey = $categoryKeyById[$categoryId] ?? null;
                                    if ($categoryKey) {
                                        $allowedCategoryKeys[$categoryKey] = true;
                                    }
                                }

                                if (empty($allowedCategoryKeys)) {
                                    continue;
                                }

                                foreach ($questionItems as $questionItem) {
                                    if (isset($allowedCategoryKeys[$questionItem['categoryKey']])) {
                                        $expectedQuestionCodes[] = $questionItem['code'];
                                    }
                                }
                            } else {
                                $expectedQuestionCodes = array_column($questionItems, 'code');
                            }

                            $expectedQuestionCodes = array_values(array_unique($expectedQuestionCodes));
                            if (empty($expectedQuestionCodes)) {
                                continue;
                            }

                            foreach ($expectedQuestionCodes as $questionCode) {
                                $userRows[$userId]['totalQuestions'] += 1;
                                $answerKey = $area->id.'|'.$userId.'|'.$questionCode;
                                $state = $answerStateByKey[$answerKey] ?? 'unopened';
                                $isPendingReviewItem = false;

                                if ($state === 'submitted') {
                                    $userRows[$userId]['saSubmitted'] += 1;
                                    $answerId = $answerIdByKey[$answerKey] ?? null;
                                    if (!$answerId || !$reviewedAnswerIds->has($answerId)) {
                                        $userRows[$userId]['saWaitingReview'] += 1;
                                        $isPendingReviewItem = true;
                                    }
                                } elseif ($state === 'draft') {
                                    $userRows[$userId]['saDraft'] += 1;
                                    $isPendingReviewItem = true;
                                } else {
                                    $userRows[$userId]['saUnopened'] += 1;
                                    $isPendingReviewItem = true;
                                }

                                $touchLastActivity($userRows, $userId, $answerActivityByKey[$answerKey] ?? null);
                                if ($isPendingReviewItem) {
                                    $pendingActivity = $answerActivityByKey[$answerKey] ?? $session->start_date;
                                    if ($isOlderThanThreshold($pendingActivity, $stagnantThreshold)) {
                                        $userRows[$userId]['saStagnant'] += 1;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        $monitoringSessions = SelfAssessmentSession::query()
            ->where('scope', 'monitoring')
            ->whereDate('start_date', '>=', $from->toDateString())
            ->whereDate('start_date', '<=', $to->toDateString())
            ->get(['id', 'start_date', 'end_date', 'is_published']);

        if ($monitoringSessions->isNotEmpty()) {
            $monitoringSessionUsers = SelfAssessmentSessionUser::query()
                ->whereIn('session_id', $monitoringSessions->pluck('id')->values())
                ->get(['session_id', 'user_id']);

            $monitoringUserIdsBySession = [];
            foreach ($monitoringSessionUsers as $sessionUser) {
                if (!isset($monitoringUserIdsBySession[$sessionUser->session_id])) {
                    $monitoringUserIdsBySession[$sessionUser->session_id] = [];
                }
                $monitoringUserIdsBySession[$sessionUser->session_id][$sessionUser->user_id] = true;
            }

            foreach ($monitoringSessions as $session) {
                $sessionUserIds = array_keys($monitoringUserIdsBySession[$session->id] ?? []);
                if (empty($sessionUserIds)) {
                    $sessionUserIds = $allNonAdminUserIds;
                }
                if (empty($sessionUserIds)) {
                    continue;
                }

                $isNotOpened = !$session->is_published || ($session->start_date && $session->start_date->copy()->startOfDay()->gt($today));
                $isCompleted = !$isNotOpened
                    && $session->end_date
                    && $session->end_date->copy()->endOfDay()->lt($today);

                foreach ($sessionUserIds as $userId) {
                    if (!isset($userRows[$userId])) {
                        continue;
                    }

                    if ($isNotOpened) {
                        $userRows[$userId]['monitoringNotOpened'] += 1;
                    } elseif ($isCompleted) {
                        $userRows[$userId]['monitoringCompleted'] += 1;
                    } else {
                        $userRows[$userId]['monitoringActive'] += 1;
                    }

                    $touchLastActivity($userRows, $userId, $session->start_date);
                }
            }
        }

        $caps = SelfAssessmentCap::query()
            ->whereBetween('created_at', [$from, $to])
            ->with([
                'fulfillments:id,cap_id,progress,created_at,updated_at,submitted_at',
                'answer.sessionArea.session',
            ])
            ->get(['id', 'answer_id', 'user_id', 'target_date', 'created_at', 'updated_at']);

        $deadlineRows = [];
        foreach ($caps as $cap) {
            if (!isset($userRows[$cap->user_id])) {
                continue;
            }

            $highestProgress = (int) $cap->fulfillments
                ->max(fn ($fulfillment) => (int) ($fulfillment->progress ?? 0));

            $userRows[$cap->user_id]['totalCaps'] += 1;
            if ($highestProgress >= 100) {
                $userRows[$cap->user_id]['capCompleted'] += 1;
            } else {
                $userRows[$cap->user_id]['capOpen'] += 1;
            }

            if ($cap->target_date && $cap->target_date->copy()->endOfDay()->lt($today) && $highestProgress < 100) {
                $userRows[$cap->user_id]['capOverdue'] += 1;
            }

            $touchLastActivity($userRows, $cap->user_id, $cap->updated_at ?? $cap->created_at);
            foreach ($cap->fulfillments as $fulfillment) {
                $touchLastActivity(
                    $userRows,
                    $cap->user_id,
                    $fulfillment->submitted_at ?? $fulfillment->updated_at ?? $fulfillment->created_at
                );
            }

            if (!$cap->target_date || $highestProgress >= 100 || $cap->target_date->copy()->endOfDay()->gt($deadlineLimit)) {
                continue;
            }

            $daysLeft = $today->diffInDays($cap->target_date, false);
            $statusLabel = $daysLeft < 0
                ? 'Overdue'
                : ($daysLeft === 0 ? 'Hari Ini' : 'H-'.$daysLeft);

            $scope = $cap->answer?->sessionArea?->session?->scope ?? '-';
            $area = $cap->answer?->sessionArea?->category ?? '-';

            $deadlineRows[] = [
                'capId' => $cap->id,
                'userId' => $cap->user_id,
                'userName' => $userRows[$cap->user_id]['userName'],
                'scope' => ucfirst((string) $scope),
                'area' => $area,
                'targetDate' => $cap->target_date->format('Y-m-d'),
                'daysLeft' => $daysLeft,
                'progress' => $highestProgress,
                'status' => $statusLabel,
            ];
        }

        $priorities = collect($userRows)
            ->map(function ($row) {
                $priorityScore = ($row['capOverdue'] * 5)
                    + ($row['saStagnant'] * 4)
                    + ($row['saWaitingReview'] * 3)
                    + ($row['saUnopened'] * 2)
                    + ($row['capOpen'] * 2)
                    + ($row['saDraft'])
                    + ($row['monitoringActive']);

                if ($row['capOverdue'] > 0 || $row['saStagnant'] >= 5 || $row['saUnopened'] >= 10) {
                    $sla = 'Merah';
                } elseif (
                    $row['saStagnant'] > 0
                    || $row['saUnopened'] > 0
                    || $row['saDraft'] > 0
                    || $row['saWaitingReview'] > 0
                    || $row['capOpen'] > 0
                    || $row['monitoringActive'] > 0
                ) {
                    $sla = 'Kuning';
                } else {
                    $sla = 'Hijau';
                }

                return [
                    'userId' => $row['userId'],
                    'userName' => $row['userName'],
                    'unopened' => $row['saUnopened'],
                    'draft' => $row['saDraft'],
                    'stagnantReview' => $row['saStagnant'],
                    'waitingReview' => $row['saWaitingReview'],
                    'capOpen' => $row['capOpen'],
                    'capOverdue' => $row['capOverdue'],
                    'monitoringActive' => $row['monitoringActive'],
                    'lastActivity' => $row['lastActivity']
                        ? $row['lastActivity']->toDateTimeString()
                        : null,
                    'sla' => $sla,
                    'priorityScore' => $priorityScore,
                ];
            })
            ->sortByDesc('priorityScore')
            ->values()
            ->map(function ($item) {
                unset($item['priorityScore']);
                return $item;
            })
            ->all();

        $userSummaries = collect($userRows)
            ->map(function ($row) {
                $submittedRate = $row['totalQuestions'] > 0
                    ? round(($row['saSubmitted'] / $row['totalQuestions']) * 100, 1)
                    : 0.0;
                $capCompletionRate = $row['totalCaps'] > 0
                    ? round(($row['capCompleted'] / $row['totalCaps']) * 100, 1)
                    : 0.0;

                $overduePenalty = min(20, $row['capOverdue'] * 5);
                $score = round(
                    min(
                        100,
                        max(
                            0,
                            ($submittedRate * 0.5)
                            + ($capCompletionRate * 0.3)
                            + (20 - $overduePenalty)
                        )
                    ),
                    1
                );

                return [
                    'userId' => $row['userId'],
                    'userName' => $row['userName'],
                    'totalTasks' => $row['totalQuestions'] + $row['totalCaps'],
                    'submittedRate' => $submittedRate,
                    'capCompletionRate' => $capCompletionRate,
                    'overdueCount' => $row['capOverdue'],
                    'monitoringActive' => $row['monitoringActive'],
                    'complianceScore' => $score,
                ];
            })
            ->sortByDesc('complianceScore')
            ->values()
            ->all();

        usort($deadlineRows, function (array $left, array $right) {
            if ($left['daysLeft'] === $right['daysLeft']) {
                return strcmp((string) $left['userName'], (string) $right['userName']);
            }

            return $left['daysLeft'] <=> $right['daysLeft'];
        });
        $deadline7Days = array_values($deadlineRows);

        return $this->respondData([
            'meta' => [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                'generatedAt' => now()->toDateTimeString(),
            ],
            'priorities' => $priorities,
            'userSummaries' => $userSummaries,
            'deadline7Days' => $deadline7Days,
        ]);
    }

    private function resolveDominantScope(array $counts): string
    {
        $scopeOrder = ['audit', 'inspeksi', 'surveillance'];
        $dominantScope = 'audit';
        $dominantCount = -1;

        foreach ($scopeOrder as $scope) {
            $count = (int) ($counts[$scope] ?? 0);
            if ($count > $dominantCount) {
                $dominantCount = $count;
                $dominantScope = $scope;
            }
        }

        return $dominantScope;
    }

    private function resolveSelfAssessmentRoute(string $scope): string
    {
        return match (strtolower($scope)) {
            'inspeksi' => '/inspeksi/protocol-question/self-assessment',
            'surveillance' => '/surveillance/protocol-question/self-assessment',
            default => '/audit/protocol-question/self-assessment',
        };
    }

    private function formatScopeBreakdown(array $counts): string
    {
        $scopeLabels = [
            'audit' => 'Audit',
            'inspeksi' => 'Inspeksi',
            'surveillance' => 'Surveillance',
        ];

        $parts = [];
        foreach ($scopeLabels as $scope => $label) {
            $count = (int) ($counts[$scope] ?? 0);
            if ($count <= 0) {
                continue;
            }
            $parts[] = $label.': '.$count;
        }

        if (empty($parts)) {
            return '';
        }

        return ' Detail '.implode(', ', $parts).'.';
    }
}
