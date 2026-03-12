<?php

namespace App\Http\Controllers\Api;

use App\Models\Agenda;
use App\Models\SelfAssessmentSession;
use App\Models\SelfAssessmentSessionArea;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;

class AgendaController extends ApiController
{
    public function selfAssessmentSessions(Request $request)
    {
        $validated = $request->validate([
            'year' => ['nullable', 'integer'],
        ]);

        $today = Carbon::today();
        $sessions = SelfAssessmentSession::query()
            ->where('scope', 'monitoring')
            ->where('is_published', true)
            ->whereDate('start_date', '<=', $today)
            ->whereDate('end_date', '>=', $today)
            ->when($validated['year'] ?? null, function ($query, $year) {
                $query->where(function ($sub) use ($year) {
                    $sub->whereYear('start_date', $year)
                        ->orWhereYear('end_date', $year);
                });
            })
            ->orderBy('start_date')
            ->get();

        $targetAreaIds = $sessions
            ->flatMap(function (SelfAssessmentSession $session) {
                return collect($session->target_session_area_ids ?? []);
            })
            ->filter()
            ->unique()
            ->values();

        $areasById = $targetAreaIds->isNotEmpty()
            ? SelfAssessmentSessionArea::query()
                ->whereIn('id', $targetAreaIds)
                ->with('session')
                ->get()
                ->keyBy('id')
            : collect();

        $payload = $sessions->map(function (SelfAssessmentSession $session) use ($areasById) {
            $sessionTeam = $session->team_leader ? [
                'leader' => $session->team_leader,
                'members' => $session->team_members ?? [],
                'audity' => $session->team_audity ?? [],
            ] : null;

            if (!$sessionTeam) {
                $fallbackTeam = collect($session->target_session_area_ids ?? [])
                    ->map(function ($areaId) use ($areasById) {
                        /** @var SelfAssessmentSessionArea|null $area */
                        $area = $areasById->get($areaId);
                        $sourceSession = $area?->session;
                        if (!$sourceSession || !$sourceSession->team_leader) {
                            return null;
                        }
                        return [
                            'leader' => $sourceSession->team_leader,
                            'members' => $sourceSession->team_members ?? [],
                            'audity' => $sourceSession->team_audity ?? [],
                        ];
                    })
                    ->first(fn ($item) => !empty($item));

                $sessionTeam = $fallbackTeam ?: null;
            }

            return [
                'id' => $session->id,
                'scope' => $session->scope,
                'title' => $session->title,
                'startDate' => optional($session->start_date)->format('Y-m-d'),
                'endDate' => optional($session->end_date)->format('Y-m-d'),
                'team' => $sessionTeam,
                'file' => $session->file_url ? [
                    'name' => $session->file_name,
                    'url' => URL::temporarySignedRoute(
                        'self-assessment.session.file.signed',
                        now()->addMinutes(10),
                        ['session' => $session->id]
                    ),
                ] : null,
            ];
        });

        return $this->respondData($payload);
    }
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $limit = (int) $request->query('limit', 20);
        $items = Agenda::query()->paginate($limit);
        return $this->respondPaginated($items);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'date' => ['required', 'date'],
            'activityType' => ['required'],
            'location' => ['required'],
            'status' => ['required'],
        ]);

        $payload = $this->normalize($validated);
        $item = Agenda::create($payload);

        return $this->respondData($item, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Agenda $agenda)
    {
        return $this->respondData($agenda);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Agenda $agenda)
    {
        $validated = $request->validate([
            'date' => ['sometimes', 'date'],
            'activityType' => ['sometimes'],
            'location' => ['sometimes'],
            'status' => ['sometimes'],
        ]);

        $payload = $this->normalize($validated);
        $agenda->fill($payload)->save();

        return $this->respondData($agenda);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Agenda $agenda)
    {
        $agenda->delete();
        return $this->respondData(['success' => true]);
    }
}
