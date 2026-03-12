<?php

namespace App\Http\Controllers\Api;

use App\Models\SelfAssessmentQuestionCategory;
use App\Models\SelfAssessmentSession;
use App\Models\SelfAssessmentSessionArea;
use App\Models\SelfAssessmentSessionQuestionCategoryUser;
use App\Models\SelfAssessmentSessionUser;
use App\Models\SelfAssessmentQuestion;
use App\Models\SelfAssessmentAnswer;
use App\Models\SelfAssessmentCap;
use App\Models\SelfAssessmentEvidence;
use App\Models\SelfAssessmentReview;
use App\Models\SystemNotification;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SelfAssessmentSessionController extends ApiController
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['required', 'in:audit,monitoring,inspeksi,surveillance'],
        ]);

        $today = Carbon::today();
        $sessions = SelfAssessmentSession::query()
            ->where('scope', $validated['scope'])
            ->where('is_published', true)
            ->whereDate('start_date', '<=', $today)
            ->whereDate('end_date', '>=', $today)
            ->orderByDesc('start_date')
            ->get();

        $sessionIds = $sessions->pluck('id');
        if ($sessionIds->isNotEmpty()) {
            $assignedSessionIds = SelfAssessmentSessionUser::query()
                ->whereIn('session_id', $sessionIds)
                ->pluck('session_id')
                ->unique();

            if ($assignedSessionIds->isNotEmpty()) {
                $userSessionIds = SelfAssessmentSessionUser::query()
                    ->whereIn('session_id', $assignedSessionIds)
                    ->where('user_id', $request->user()->id)
                    ->pluck('session_id')
                    ->unique();

                $sessions = $sessions
                    ->filter(function ($session) use ($assignedSessionIds, $userSessionIds) {
                        return !$assignedSessionIds->contains($session->id)
                            || $userSessionIds->contains($session->id);
                    })
                    ->values();
            }
        }

        $areas = SelfAssessmentSessionArea::query()
            ->whereIn('session_id', $sessions->pluck('id'))
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get()
            ->groupBy('session_id');

        // Monitoring sessions opened from CAP fulfillment may only contain target area ids.
        // Resolve those area ids so the user still gets clickable areas in self-assessment.
        $targetAreaIds = $sessions
            ->flatMap(fn ($session) => $session->target_session_area_ids ?? [])
            ->filter()
            ->unique()
            ->values();

        $targetAreasById = $targetAreaIds->isNotEmpty()
            ? SelfAssessmentSessionArea::query()
                ->whereIn('id', $targetAreaIds)
                ->with([
                    'session:id,team_leader,team_members,team_audity',
                ])
                ->get()
                ->keyBy('id')
            : collect();

        $supportsTargetAgendaIds = $this->supportsTargetAgendaIds();
        $payload = $sessions->map(function ($session) use ($areas, $supportsTargetAgendaIds, $targetAreasById) {
            $team = $session->team_leader ? [
                'leader' => $session->team_leader,
                'dnp' => $session->team_members ?? [],
                'kobo' => $session->team_audity ?? [],
            ] : null;

            $directAreaItems = ($areas[$session->id] ?? collect())->map(function ($area) use ($team) {
                return [
                    'id' => $area->id,
                    'category' => $area->category,
                    'team' => $team,
                ];
            })->values();

            if ($directAreaItems->isNotEmpty()) {
                $areaItems = $directAreaItems;
            } elseif ($session->scope === 'monitoring') {
                $areaItems = collect($session->target_session_area_ids ?? [])
                    ->map(fn ($areaId) => $targetAreasById->get($areaId))
                    ->filter()
                    ->unique('id')
                    ->map(function ($area) use ($team) {
                        $sourceSession = $area->session;
                        $sourceTeam = $sourceSession && $sourceSession->team_leader
                            ? [
                                'leader' => $sourceSession->team_leader,
                                'dnp' => $sourceSession->team_members ?? [],
                                'kobo' => $sourceSession->team_audity ?? [],
                            ]
                            : null;

                        return [
                            'id' => $area->id,
                            'category' => $area->category,
                            'team' => $team ?? $sourceTeam,
                        ];
                    })
                    ->values();
            } else {
                $areaItems = collect();
            }

            return [
                'id' => $session->id,
                'title' => $session->title,
                'startDate' => optional($session->start_date)->format('Y-m-d'),
                'endDate' => optional($session->end_date)->format('Y-m-d'),
                'targetSessionAreaIds' => $session->target_session_area_ids ?? [],
                'targetAgendaIds' => $supportsTargetAgendaIds
                    ? ($session->target_agenda_ids ?? [])
                    : [],
                'team' => $team,
                'areas' => $areaItems,
            ];
        });

        return $this->respondData($payload);
    }

    public function adminIndex(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['nullable', 'in:audit,monitoring,inspeksi,surveillance'],
        ]);

        $sessions = SelfAssessmentSession::query()
            ->when($validated['scope'] ?? null, function ($query, $scope) {
                $query->where('scope', $scope);
            })
            ->orderByDesc('start_date')
            ->get();

        $sessionIds = $sessions->pluck('id');
        if ($sessionIds->isNotEmpty()) {
            $assignments = SelfAssessmentSessionUser::query()
                ->whereIn('session_id', $sessionIds)
                ->get(['session_id', 'user_id']);

            $userIds = $assignments->pluck('user_id')->unique()->values();
            $usersById = $userIds->isNotEmpty()
                ? User::query()->whereIn('id', $userIds)->get(['id', 'name', 'email'])->keyBy('id')
                : collect();

            $usersBySession = $assignments
                ->groupBy('session_id')
                ->map(function ($items) use ($usersById) {
                    return $items
                        ->map(function ($item) use ($usersById) {
                            $user = $usersById[$item->user_id] ?? null;
                            return $user ? $user->only(['id', 'name', 'email']) : null;
                        })
                        ->filter()
                        ->values();
                });

            $sessions->each(function ($session) use ($usersBySession) {
                $session->setAttribute(
                    'users',
                    ($usersBySession->get($session->id) ?? collect())->values()->all()
                );
            });
        }

        if ($sessionIds->isNotEmpty()) {
            $categoryCounts = SelfAssessmentSessionQuestionCategoryUser::query()
                ->whereIn('session_id', $sessionIds)
                ->selectRaw('session_id, user_id, count(*) as total')
                ->groupBy('session_id', 'user_id')
                ->get()
                ->groupBy('session_id');

            $sessions->each(function ($session) use ($categoryCounts) {
                $counts = ($categoryCounts->get($session->id) ?? collect())
                    ->mapWithKeys(function ($item) {
                        return [$item->user_id => (int) $item->total];
                    })
                    ->all();
                $session->setAttribute('question_category_counts', $counts);
            });
        }

        if ($sessionIds->isNotEmpty()) {
            $areasBySession = SelfAssessmentSessionArea::query()
                ->whereIn('session_id', $sessionIds)
                ->orderBy('sort_order')
                ->orderBy('category')
                ->get(['session_id', 'category'])
                ->groupBy('session_id')
                ->map(function ($items) {
                    return $items
                        ->pluck('category')
                        ->filter()
                        ->values()
                        ->all();
                });

            $sessions->each(function ($session) use ($areasBySession) {
                $session->setAttribute(
                    'areas',
                    $areasBySession->get($session->id, [])
                );
            });
        }

        return $this->respondData($sessions);
    }

    public function adminShow(SelfAssessmentSession $session)
    {
        $supportsTargetAgendaIds = $this->supportsTargetAgendaIds();
        $userIds = SelfAssessmentSessionUser::query()
            ->where('session_id', $session->id)
            ->pluck('user_id')
            ->values();

        $assignments = SelfAssessmentSessionQuestionCategoryUser::query()
            ->where('session_id', $session->id)
            ->get(['user_id', 'question_category_id'])
            ->groupBy('user_id')
            ->map(function ($items) {
                return $items->pluck('question_category_id')->values()->all();
            });

        $categoryAssignments = $assignments->map(function ($categoryIds, $userId) {
            return [
                'userId' => $userId,
                'categoryIds' => $categoryIds,
            ];
        })->values();

        return $this->respondData([
            'id' => $session->id,
            'scope' => $session->scope,
            'title' => $session->title,
            'startDate' => optional($session->start_date)->format('Y-m-d'),
            'endDate' => optional($session->end_date)->format('Y-m-d'),
            'isPublished' => $session->is_published,
            'targetSessionAreaIds' => $session->target_session_area_ids ?? [],
            'targetAgendaIds' => $supportsTargetAgendaIds
                ? ($session->target_agenda_ids ?? [])
                : [],
            'team' => $session->team_leader ? [
                'leader' => $session->team_leader,
                'dnp' => $session->team_members ?? [],
                'kobo' => $session->team_audity ?? [],
            ] : null,
            'file' => $session->file_url ? [
                'name' => $session->file_name,
                'url' => $session->file_url,
            ] : null,
            'userIds' => $userIds,
            'categoryAssignments' => $categoryAssignments,
        ]);
    }

    public function adminStore(Request $request)
    {
        $supportsTargetAgendaIds = $this->supportsTargetAgendaIds();
        $rules = [
            'scope' => ['required', 'in:audit,monitoring,inspeksi,surveillance'],
            'title' => ['nullable'],
            'teamLeader' => ['required_unless:scope,monitoring', 'string', 'min:2'],
            'teamMembers' => ['required_unless:scope,monitoring', 'array', 'min:1'],
            'teamMembers.*' => ['string'],
            'teamAudity' => ['required_unless:scope,monitoring', 'array', 'min:1'],
            'teamAudity.*' => ['string'],
            'startDate' => ['required', 'date'],
            'endDate' => ['required', 'date', 'after_or_equal:startDate'],
            'isPublished' => ['nullable', 'boolean'],
            'targetSessionAreaIds' => ['nullable', 'array'],
            'targetSessionAreaIds.*' => ['uuid', 'exists:self_assessment_session_areas,id'],
            'targetAgendaIds' => ['nullable', 'array'],
            'userIds' => ['nullable', 'array'],
            'userIds.*' => ['uuid', 'exists:users,id'],
            'categoryAssignments' => ['nullable', 'array'],
            'categoryAssignments.*.userId' => ['required', 'uuid', 'exists:users,id'],
            'categoryAssignments.*.categoryIds' => ['nullable', 'array'],
            'categoryAssignments.*.categoryIds.*' => [
                'uuid',
                'exists:self_assessment_question_categories,id',
            ],
        ];
        if ($supportsTargetAgendaIds) {
            $rules['targetAgendaIds.*'] = [
                'uuid',
                Rule::exists('self_assessment_sessions', 'id')
                    ->where(fn ($query) => $query->where('scope', 'monitoring')),
            ];
        }
        $validated = $request->validate($rules);

        $userIds = collect($validated['userIds'] ?? [])
            ->filter()
            ->unique()
            ->values();
        unset($validated['userIds']);
        $targetSessionAreaIds = collect($validated['targetSessionAreaIds'] ?? [])
            ->filter()
            ->unique()
            ->values();
        unset($validated['targetSessionAreaIds']);
        $targetAgendaIds = $supportsTargetAgendaIds
            ? collect($validated['targetAgendaIds'] ?? [])
                ->filter()
                ->unique()
                ->values()
            : collect();
        unset($validated['targetAgendaIds']);
        $categoryAssignments = collect($validated['categoryAssignments'] ?? []);
        unset($validated['categoryAssignments']);

        if (($validated['scope'] ?? null) === 'monitoring' && $targetSessionAreaIds->isEmpty()) {
            throw ValidationException::withMessages([
                'targetSessionAreaIds' => ['Pilih minimal 1 target CAP untuk monitoring.'],
            ]);
        }

        $payload = $this->normalize($validated, [
            'startDate' => 'start_date',
            'endDate' => 'end_date',
            'isPublished' => 'is_published',
            'teamLeader' => 'team_leader',
            'teamMembers' => 'team_members',
            'teamAudity' => 'team_audity',
        ]);
        $payload['target_session_area_ids'] = $targetSessionAreaIds->isNotEmpty()
            ? $targetSessionAreaIds->all()
            : null;
        if ($supportsTargetAgendaIds) {
            $payload['target_agenda_ids'] = $targetAgendaIds->isNotEmpty()
                ? $targetAgendaIds->all()
                : null;
        }

        $session = SelfAssessmentSession::create($payload);

        if ($userIds->isNotEmpty()) {
            $now = now();
            $sessionUsers = $userIds->map(function ($userId) use ($session, $now) {
                return [
                    'id' => (string) Str::uuid(),
                    'session_id' => $session->id,
                    'user_id' => $userId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            })->all();
            SelfAssessmentSessionUser::query()->insert($sessionUsers);
        }

        if ($userIds->isNotEmpty() && $categoryAssignments->isNotEmpty()) {
            $validCategoryIds = SelfAssessmentQuestionCategory::query()
                ->where('scope', $session->scope)
                ->pluck('id')
                ->flip();
            $userIdLookup = $userIds->flip();
            $now = now();
            $sessionCategoryRows = [];

            foreach ($categoryAssignments as $assignment) {
                $userId = $assignment['userId'] ?? null;
                if (!$userId || !$userIdLookup->has($userId)) {
                    continue;
                }
                $categoryIds = collect($assignment['categoryIds'] ?? [])
                    ->filter(fn ($categoryId) => $validCategoryIds->has($categoryId))
                    ->unique()
                    ->values();

                foreach ($categoryIds as $categoryId) {
                    $sessionCategoryRows[] = [
                        'id' => (string) Str::uuid(),
                        'session_id' => $session->id,
                        'question_category_id' => $categoryId,
                        'user_id' => $userId,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
            }

            if (!empty($sessionCategoryRows)) {
                SelfAssessmentSessionQuestionCategoryUser::query()
                    ->insert($sessionCategoryRows);
            }
        }

        if (
            $session->scope === 'monitoring'
            && (bool) ($session->is_published ?? false)
            && $userIds->isNotEmpty()
            && $targetSessionAreaIds->isNotEmpty()
        ) {
            $this->allowReplyForMonitoringTargets(
                $userIds->all(),
                $targetSessionAreaIds->all()
            );
        }

        if ($session->is_published) {
            $users = $userIds->isNotEmpty()
                ? User::query()->whereIn('id', $userIds)->get(['id'])
                : User::query()->where('role', '!=', 'admin')->get(['id']);
            $now = now();
            $notifications = $users->map(function ($user) use ($session, $now) {
                return [
                    'id' => (string) Str::uuid(),
                    'user_id' => $user->id,
                    'type' => 'session-opened',
                    'title' => 'Sesi self assessment dibuka',
                    'message' => sprintf('Sesi %s baru tersedia.', ucfirst($session->scope)),
                    'data' => json_encode([
                        'scope' => $session->scope,
                        'sessionId' => $session->id,
                    ]),
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            })->all();

            if (!empty($notifications)) {
                SystemNotification::query()->insert($notifications);
            }
        }

        $admins = User::query()
            ->where('role', 'admin')
            ->get(['id']);
        $adminNotifications = $admins->map(function ($user) use ($session) {
            return [
                'id' => (string) Str::uuid(),
                'user_id' => $user->id,
                'type' => 'admin-session-opened',
                'title' => 'Sesi self assessment dibuat',
                'message' => sprintf('Sesi %s berhasil dibuat.', ucfirst($session->scope)),
                'data' => json_encode([
                    'scope' => $session->scope,
                    'sessionId' => $session->id,
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ];
        })->all();

        if (!empty($adminNotifications)) {
            SystemNotification::query()->insert($adminNotifications);
        }

        return $this->respondData($session, 201);
    }

    public function adminUpdate(Request $request, SelfAssessmentSession $session)
    {
        $supportsTargetAgendaIds = $this->supportsTargetAgendaIds();
        $request->merge(['scope' => $session->scope]);
        $rules = [
            'title' => ['nullable'],
            'teamLeader' => ['required_unless:scope,monitoring', 'string', 'min:2'],
            'teamMembers' => ['required_unless:scope,monitoring', 'array', 'min:1'],
            'teamMembers.*' => ['string'],
            'teamAudity' => ['required_unless:scope,monitoring', 'array', 'min:1'],
            'teamAudity.*' => ['string'],
            'startDate' => ['sometimes', 'date'],
            'endDate' => ['sometimes', 'date'],
            'isPublished' => ['nullable', 'boolean'],
            'targetSessionAreaIds' => ['nullable', 'array'],
            'targetSessionAreaIds.*' => ['uuid', 'exists:self_assessment_session_areas,id'],
            'targetAgendaIds' => ['nullable', 'array'],
            'userIds' => ['nullable', 'array'],
            'userIds.*' => ['uuid', 'exists:users,id'],
            'categoryAssignments' => ['nullable', 'array'],
            'categoryAssignments.*.userId' => ['required', 'uuid', 'exists:users,id'],
            'categoryAssignments.*.categoryIds' => ['nullable', 'array'],
            'categoryAssignments.*.categoryIds.*' => [
                'uuid',
                'exists:self_assessment_question_categories,id',
            ],
        ];
        if ($supportsTargetAgendaIds) {
            $rules['targetAgendaIds.*'] = [
                'uuid',
                Rule::exists('self_assessment_sessions', 'id')
                    ->where(fn ($query) => $query->where('scope', 'monitoring')),
            ];
        }
        $validated = $request->validate($rules);

        $userIds = null;
        if (array_key_exists('userIds', $validated)) {
            $userIds = collect($validated['userIds'] ?? [])
                ->filter()
                ->unique()
                ->values();
            unset($validated['userIds']);
        }

        $targetSessionAreaIds = null;
        if (array_key_exists('targetSessionAreaIds', $validated)) {
            $targetSessionAreaIds = collect($validated['targetSessionAreaIds'] ?? [])
                ->filter()
                ->unique()
                ->values();
            unset($validated['targetSessionAreaIds']);
        }
        $targetAgendaIds = null;
        if ($supportsTargetAgendaIds && array_key_exists('targetAgendaIds', $validated)) {
            $targetAgendaIds = collect($validated['targetAgendaIds'] ?? [])
                ->filter()
                ->unique()
                ->values();
        }
        unset($validated['targetAgendaIds']);

        $categoryAssignments = null;
        if (array_key_exists('categoryAssignments', $validated)) {
            $categoryAssignments = collect($validated['categoryAssignments'] ?? []);
            unset($validated['categoryAssignments']);
        }

        $effectiveTargetSessionAreaIds = $targetSessionAreaIds
            ?? collect($session->target_session_area_ids ?? [])
                ->filter()
                ->unique()
                ->values();
        if ($session->scope === 'monitoring' && $effectiveTargetSessionAreaIds->isEmpty()) {
            throw ValidationException::withMessages([
                'targetSessionAreaIds' => ['Pilih minimal 1 target CAP untuk monitoring.'],
            ]);
        }

        $payload = $this->normalize($validated, [
            'startDate' => 'start_date',
            'endDate' => 'end_date',
            'isPublished' => 'is_published',
            'teamLeader' => 'team_leader',
            'teamMembers' => 'team_members',
            'teamAudity' => 'team_audity',
        ]);
        if ($targetSessionAreaIds !== null) {
            $payload['target_session_area_ids'] = $targetSessionAreaIds->isNotEmpty()
                ? $targetSessionAreaIds->all()
                : null;
        }
        if ($supportsTargetAgendaIds && $targetAgendaIds !== null) {
            $payload['target_agenda_ids'] = $targetAgendaIds->isNotEmpty()
                ? $targetAgendaIds->all()
                : null;
        }

        return DB::transaction(function () use ($session, $payload, $userIds, $categoryAssignments, $effectiveTargetSessionAreaIds) {
            $session->fill($payload)->save();

            if ($userIds !== null) {
                SelfAssessmentSessionUser::query()
                    ->where('session_id', $session->id)
                    ->delete();
                if ($userIds->isNotEmpty()) {
                    $now = now();
                    $sessionUsers = $userIds->map(function ($userId) use ($session, $now) {
                        return [
                            'id' => (string) Str::uuid(),
                            'session_id' => $session->id,
                            'user_id' => $userId,
                            'created_at' => $now,
                            'updated_at' => $now,
                        ];
                    })->all();
                    SelfAssessmentSessionUser::query()->insert($sessionUsers);
                }
            }

            if ($categoryAssignments !== null) {
                $validCategoryIds = SelfAssessmentQuestionCategory::query()
                    ->where('scope', $session->scope)
                    ->pluck('id')
                    ->flip();

                $existingAssignments = SelfAssessmentSessionQuestionCategoryUser::query()
                    ->where('session_id', $session->id)
                    ->get(['user_id', 'question_category_id'])
                    ->groupBy('user_id')
                    ->map(function ($items) {
                        return $items->pluck('question_category_id')->values();
                    });

                $now = now();
                $rows = [];
                $nextAssignments = [];

                foreach ($categoryAssignments as $assignment) {
                    $userId = $assignment['userId'] ?? null;
                    if (!$userId) {
                        continue;
                    }
                    $categoryIds = collect($assignment['categoryIds'] ?? [])
                        ->filter(fn ($categoryId) => $validCategoryIds->has($categoryId))
                        ->unique()
                        ->values();
                    $nextAssignments[$userId] = $categoryIds;

                    foreach ($categoryIds as $categoryId) {
                        $rows[] = [
                            'id' => (string) Str::uuid(),
                            'session_id' => $session->id,
                            'question_category_id' => $categoryId,
                            'user_id' => $userId,
                            'created_at' => $now,
                            'updated_at' => $now,
                        ];
                    }
                }

                $this->deleteRemovedAssignmentAnswers(
                    $session,
                    $existingAssignments,
                    collect($nextAssignments)
                );

                SelfAssessmentSessionQuestionCategoryUser::query()
                    ->where('session_id', $session->id)
                    ->delete();
                if (!empty($rows)) {
                    SelfAssessmentSessionQuestionCategoryUser::query()->insert($rows);
                }
            }

            if (
                $session->scope === 'monitoring'
                && (bool) ($session->is_published ?? false)
                && $effectiveTargetSessionAreaIds->isNotEmpty()
            ) {
                $effectiveUserIds = $userIds !== null
                    ? $userIds
                    : SelfAssessmentSessionUser::query()
                        ->where('session_id', $session->id)
                        ->pluck('user_id')
                        ->filter()
                        ->unique()
                        ->values();

                if ($effectiveUserIds->isNotEmpty()) {
                    $this->allowReplyForMonitoringTargets(
                        $effectiveUserIds->all(),
                        $effectiveTargetSessionAreaIds->all()
                    );
                }
            }

            return $this->respondData($session);
        });
    }

    public function adminUploadFile(Request $request, SelfAssessmentSession $session)
    {
        if ($session->scope !== 'monitoring') {
            return response()->json([
                'error' => 'Upload file hanya tersedia untuk sesi monitoring.',
            ], 422);
        }

        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:pdf,png,jpg,jpeg', 'max:10240'],
        ]);

        $this->deleteFileIfExists($session->file_url);
        $path = $validated['file']->store('self-assessment-sessions', 'public');
        $session->file_name = $validated['file']->getClientOriginalName();
        $session->file_url = Storage::disk('public')->url($path);
        $session->save();

        return $this->respondData([
            'name' => $session->file_name,
            'url' => $session->file_url,
        ]);
    }

    public function downloadFileSigned(SelfAssessmentSession $session)
    {
        if (!$session->file_url || !$session->file_name) {
            return response()->json(['error' => 'File tidak ditemukan.'], 404);
        }

        $relative = $this->resolveStoragePath((string) $session->file_url, ['self-assessment-sessions/']);
        if (!$relative || !Storage::disk('public')->exists($relative)) {
            return response()->json(['error' => 'File tidak ditemukan.'], 404);
        }

        return Storage::disk('public')->download($relative, $session->file_name);
    }

    private function deleteFileIfExists(?string $url): void
    {
        if (!$url) {
            return;
        }
        $path = str_replace(Storage::disk('public')->url(''), '', $url);
        $path = ltrim($path, '/');
        if ($path && Storage::disk('public')->exists($path)) {
            Storage::disk('public')->delete($path);
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

    private function deleteRemovedAssignmentAnswers(
        SelfAssessmentSession $session,
        $existingAssignments,
        $nextAssignments
    ): void {
        if ($existingAssignments->isEmpty()) {
            return;
        }

        $removedByUser = collect();
        foreach ($existingAssignments as $userId => $existingCategoryIds) {
            if (!$nextAssignments->has($userId)) {
                continue;
            }
            $nextCategoryIds = $nextAssignments->get($userId, collect());
            $removed = $existingCategoryIds->diff($nextCategoryIds)->values();
            if ($removed->isNotEmpty()) {
                $removedByUser->put($userId, $removed);
            }
        }

        if ($removedByUser->isEmpty()) {
            return;
        }

        $removedCategoryIds = $removedByUser->flatten()->unique()->values();
        $questionCategories = SelfAssessmentQuestionCategory::query()
            ->whereIn('id', $removedCategoryIds)
            ->get(['id', 'name', 'prefix']);
        if ($questionCategories->isEmpty()) {
            return;
        }

        $questions = SelfAssessmentQuestion::query()
            ->where('scope', $session->scope)
            ->get(['code', 'question_category_prefix', 'question_category']);

        $sessionAreaIds = SelfAssessmentSessionArea::query()
            ->where('session_id', $session->id)
            ->pluck('id');

        if ($sessionAreaIds->isEmpty()) {
            return;
        }

        foreach ($removedByUser as $userId => $removedCategoryIdsForUser) {
            $allowedKeys = $questionCategories
                ->whereIn('id', $removedCategoryIdsForUser)
                ->mapWithKeys(function ($category) {
                    return [$category->prefix.'|'.$category->name => true];
                });

            if ($allowedKeys->isEmpty()) {
                continue;
            }

            $questionCodes = $questions->filter(function ($question) use ($allowedKeys) {
                $prefix = $question->question_category_prefix;
                $name = $question->question_category;
                if (!$prefix || !$name) {
                    return false;
                }
                return isset($allowedKeys[$prefix.'|'.$name]);
            })->pluck('code');

            if ($questionCodes->isEmpty()) {
                continue;
            }

            SelfAssessmentEvidence::query()
                ->whereIn('session_area_id', $sessionAreaIds)
                ->where('user_id', $userId)
                ->whereIn('question_code', $questionCodes)
                ->delete();

            SelfAssessmentAnswer::query()
                ->whereIn('session_area_id', $sessionAreaIds)
                ->where('user_id', $userId)
                ->whereIn('question_code', $questionCodes)
                ->delete();
        }
    }

    private function allowReplyForMonitoringTargets(array $userIds, array $targetSessionAreaIds): void
    {
        $targetUserIds = collect($userIds)
            ->filter()
            ->unique()
            ->values();
        $targetAreaIds = collect($targetSessionAreaIds)
            ->filter()
            ->unique()
            ->values();

        if ($targetUserIds->isEmpty() || $targetAreaIds->isEmpty()) {
            return;
        }

        $answerIds = SelfAssessmentCap::query()
            ->whereIn('user_id', $targetUserIds)
            ->where(function ($query) {
                $query->where('status', 'sent')
                    ->orWhereHas('fulfillments', function ($fulfillmentQuery) {
                        $fulfillmentQuery->whereIn('status', ['sent', 'submitted']);
                    });
            })
            ->whereHas('answer', function ($query) use ($targetAreaIds) {
                $query->whereIn('session_area_id', $targetAreaIds);
            })
            ->pluck('answer_id')
            ->filter()
            ->unique()
            ->values();

        if ($answerIds->isEmpty()) {
            return;
        }

        SelfAssessmentReview::query()
            ->whereIn('answer_id', $answerIds)
            ->update([
                'allow_reply' => true,
                'is_final' => false,
                'updated_at' => now(),
            ]);
    }

    public function adminDestroy(SelfAssessmentSession $session)
    {
        $session->delete();
        return $this->respondData(['success' => true]);
    }

    private function supportsTargetAgendaIds(): bool
    {
        return Schema::hasColumn('self_assessment_sessions', 'target_agenda_ids');
    }
}
