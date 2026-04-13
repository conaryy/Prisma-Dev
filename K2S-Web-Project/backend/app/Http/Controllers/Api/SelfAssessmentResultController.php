<?php

namespace App\Http\Controllers\Api;

use App\Models\SelfAssessmentMonitoringResult;
use App\Models\SelfAssessmentMonitoringResultFile;
use App\Models\SelfAssessmentResult;
use App\Models\SelfAssessmentResultFile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

class SelfAssessmentResultController extends ApiController
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['nullable', 'in:audit,monitoring,inspeksi,surveillance'],
            'status' => ['nullable', 'in:interim,final'],
            'year' => ['nullable', 'integer'],
        ]);

        $userId = $request->user()->id;

        $results = SelfAssessmentResult::query()
            ->where('user_id', $userId)
            ->when($validated['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
            ->when($validated['year'] ?? null, fn ($query, $year) => $query->whereYear('finalized_at', $year))
            ->when($validated['scope'] ?? null, function ($query, $scope) {
                $query->whereHas('sessionArea', function ($areaQuery) use ($scope) {
                    $areaQuery->whereHas('session', fn ($sessionQuery) => $sessionQuery->where('scope', $scope));
                });
            })
            ->with(['sessionArea.session', 'files'])
            ->orderByDesc('finalized_at')
            ->get();

        $payload = $results->map(function (SelfAssessmentResult $result) {
            $session = $result->sessionArea?->session;
            $schedule = $session && $session->start_date && $session->end_date
                ? $session->start_date->format('Y-m-d').' - '.$session->end_date->format('Y-m-d')
                : null;

            return [
                'id' => $result->id,
                'sessionAreaId' => $result->session_area_id,
                'area' => $result->sessionArea?->category ?? '-',
                'scope' => $session?->scope ?? '-',
                'schedule' => $schedule,
                'leader' => $session?->team_leader ?? '-',
                'dnp' => $session?->team_members ?? [],
                'kobo' => $session?->team_audity ?? [],
                'status' => $result->status,
                'finalizedAt' => optional($result->finalized_at)->toDateTimeString(),
                'files' => $result->files->map(function ($file) {
                    return [
                        'id' => $file->id,
                        'name' => $file->name,
                        'url' => URL::temporarySignedRoute(
                            'self-assessment.results.file.signed',
                            now()->addMinutes(10),
                            ['file' => $file->id]
                        ),
                    ];
                })->values(),
            ];
        });

        return $this->respondData($payload);
    }

    public function monitoringIndex(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['nullable', 'in:audit,monitoring,inspeksi,surveillance'],
            'status' => ['nullable', 'in:interim,final'],
            'year' => ['nullable', 'integer'],
        ]);

        $userId = $request->user()->id;

        $results = SelfAssessmentMonitoringResult::query()
            ->where('user_id', $userId)
            ->when($validated['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
            ->when($validated['year'] ?? null, fn ($query, $year) => $query->whereYear('finalized_at', $year))
            ->when($validated['scope'] ?? null, function ($query, $scope) {
                $query->whereHas('sessionArea', function ($areaQuery) use ($scope) {
                    $areaQuery->whereHas('session', fn ($sessionQuery) => $sessionQuery->where('scope', $scope));
                });
            })
            ->with(['sessionArea.session', 'files'])
            ->orderByDesc('finalized_at')
            ->get();

        $payload = $results->map(function (SelfAssessmentMonitoringResult $result) {
            $session = $result->sessionArea?->session;
            $schedule = $session && $session->start_date && $session->end_date
                ? $session->start_date->format('Y-m-d').' - '.$session->end_date->format('Y-m-d')
                : null;

            return [
                'id' => $result->id,
                'sessionAreaId' => $result->session_area_id,
                'area' => $result->sessionArea?->category ?? '-',
                'scope' => $session?->scope ?? '-',
                'schedule' => $schedule,
                'leader' => $session?->team_leader ?? '-',
                'dnp' => $session?->team_members ?? [],
                'kobo' => $session?->team_audity ?? [],
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
            ];
        });

        return $this->respondData($payload);
    }

    public function adminFinalize(Request $request)
    {
        $validated = $request->validate([
            'sessionAreaId' => ['required', 'uuid'],
            'userId' => ['required', 'uuid'],
            'status' => ['required', 'in:interim,final'],
            'files' => ['nullable', 'array', 'max:3'],
            'files.*' => ['file', 'mimes:pdf,doc,docx,xls,xlsx,png,jpg,jpeg,zip', 'max:10240'],
            'replaceFiles' => ['nullable', 'boolean'],
        ]);

        $result = SelfAssessmentResult::query()->firstOrNew([
            'session_area_id' => $validated['sessionAreaId'],
            'user_id' => $validated['userId'],
        ]);

        $result->status = $validated['status'];
        $result->finalized_by = $request->user()->id;
        $result->finalized_at = now();
        $result->save();

        if (!empty($validated['replaceFiles']) && $validated['replaceFiles']) {
            foreach ($result->files as $file) {
                $this->deleteFileIfExists($file->url);
                $file->delete();
            }
        }

        if (!empty($validated['files'])) {
            foreach ($validated['files'] as $file) {
                $path = $file->store('self-assessment-results', 'public');
                SelfAssessmentResultFile::create([
                    'result_id' => $result->id,
                    'name' => $file->getClientOriginalName(),
                    'url' => Storage::disk('public')->url($path),
                ]);
            }
        }

        $result->load('files');

        return $this->respondData([
            'id' => $result->id,
            'status' => $result->status,
            'finalizedAt' => optional($result->finalized_at)->toDateTimeString(),
            'files' => $result->files->map(function ($file) {
                return [
                    'id' => $file->id,
                    'name' => $file->name,
                    'url' => URL::temporarySignedRoute(
                        'self-assessment.results.file.signed',
                        now()->addMinutes(10),
                        ['file' => $file->id]
                    ),
                ];
            })->values(),
        ]);
    }

    public function adminFinalizeMonitoring(Request $request)
    {
        $validated = $request->validate([
            'sessionAreaId' => ['required', 'uuid'],
            'userId' => ['required', 'uuid'],
            'status' => ['required', 'in:interim,final'],
            'files' => ['nullable', 'array', 'max:3'],
            'files.*' => ['file', 'mimes:pdf,doc,docx,xls,xlsx,png,jpg,jpeg,zip', 'max:10240'],
            'replaceFiles' => ['nullable', 'boolean'],
        ]);

        $result = SelfAssessmentMonitoringResult::query()->firstOrNew([
            'session_area_id' => $validated['sessionAreaId'],
            'user_id' => $validated['userId'],
        ]);

        $result->status = $validated['status'];
        $result->finalized_by = $request->user()->id;
        $result->finalized_at = now();
        $result->save();

        if (!empty($validated['replaceFiles']) && $validated['replaceFiles']) {
            foreach ($result->files as $file) {
                $this->deleteFileIfExists($file->url, ['self-assessment-monitoring-results/']);
                $file->delete();
            }
        }

        if (!empty($validated['files'])) {
            foreach ($validated['files'] as $file) {
                $path = $file->store('self-assessment-monitoring-results', 'public');
                SelfAssessmentMonitoringResultFile::create([
                    'result_id' => $result->id,
                    'name' => $file->getClientOriginalName(),
                    'url' => Storage::disk('public')->url($path),
                ]);
            }
        }

        $result->load('files');

        return $this->respondData([
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
        ]);
    }

    public function adminDeleteFile(Request $request, SelfAssessmentResultFile $file)
    {
        $this->deleteFileIfExists($file->url);
        $file->delete();

        return $this->respondData(['deleted' => true]);
    }

    public function adminDeleteMonitoringFile(Request $request, SelfAssessmentMonitoringResultFile $file)
    {
        $this->deleteFileIfExists($file->url, ['self-assessment-monitoring-results/']);
        $file->delete();

        return $this->respondData(['deleted' => true]);
    }

    private function deleteFileIfExists(string $url, array $allowedPrefixes = ['self-assessment-results/']): void
    {
        $path = $this->resolveStoragePath($url, $allowedPrefixes);
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

    public function downloadFileSigned(Request $request, SelfAssessmentResultFile $file)
    {
        // Signature validated via 'signed' middleware on route
        $relative = $this->resolveStoragePath((string) $file->url, ['self-assessment-results/']);
        if (!$relative || !Storage::disk('public')->exists($relative)) {
            return response()->json(['error' => 'File tidak ditemukan.'], 404);
        }
        $absolute = Storage::disk('public')->path($relative);
        return response()->download($absolute, $file->name ?: basename($relative));
    }

    public function downloadMonitoringFileSigned(Request $request, SelfAssessmentMonitoringResultFile $file)
    {
        $relative = $this->resolveStoragePath((string) $file->url, ['self-assessment-monitoring-results/']);
        if (!$relative || !Storage::disk('public')->exists($relative)) {
            return response()->json(['error' => 'File tidak ditemukan.'], 404);
        }
        $absolute = Storage::disk('public')->path($relative);
        return response()->download($absolute, $file->name ?: basename($relative));
    }
}
