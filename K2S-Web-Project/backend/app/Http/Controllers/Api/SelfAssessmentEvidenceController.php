<?php

namespace App\Http\Controllers\Api;

use App\Models\SelfAssessmentAnswer;
use App\Models\SelfAssessmentEvidence;
use App\Models\SelfAssessmentResult;
use App\Models\SelfAssessmentSessionArea;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

class SelfAssessmentEvidenceController extends ApiController
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'sessionAreaId' => ['required'],
            'questionCode' => ['required'],
        ]);

        $items = SelfAssessmentEvidence::query()
            ->where('session_area_id', $validated['sessionAreaId'])
            ->where('question_code', $validated['questionCode'])
            ->where('user_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->get()
            ->map(function (SelfAssessmentEvidence $item) {
                $item->url = $this->signedDownloadUrl($item);
                return $item;
            });

        return $this->respondData($items);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'sessionAreaId' => ['required'],
            'questionCode' => ['required'],
            'file' => ['required', 'file', 'max:20480', 'mimes:jpg,jpeg,png,pdf,docx,xlsx,mp3,mp4'],
        ]);

        $area = SelfAssessmentSessionArea::find($validated['sessionAreaId']);
        if (!$area) {
            return response()->json(['error' => 'Session area not found.'], 404);
        }
        if ($this->hasFinalizedResult($area->id, $request->user()->id)) {
            return response()->json([
                'error' => 'Hasil self assessment sudah difinalisasi Unit Safety dan evidence tidak bisa diubah.',
            ], 403);
        }

        $file = $validated['file'];
        $path = $file->store('self-assessment-evidence', 'public');

        $item = SelfAssessmentEvidence::create([
            'session_area_id' => $area->id,
            'user_id' => $request->user()->id,
            'question_code' => $validated['questionCode'],
            'name' => $file->getClientOriginalName(),
            'url' => Storage::disk('public')->url($path),
            'created_at' => now(),
        ]);
        // Replace URL in response with a temporary signed URL for direct access
        $item->url = $this->signedDownloadUrl($item);
        return $this->respondData($item, 201);
    }

    public function destroy(Request $request, SelfAssessmentEvidence $evidence)
    {
        if ($evidence->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Evidence not found.'], 404);
        }
        if ($this->hasFinalizedResult($evidence->session_area_id, $request->user()->id)) {
            return response()->json([
                'error' => 'Hasil self assessment sudah difinalisasi Unit Safety dan evidence tidak bisa dihapus.',
            ], 403);
        }

        $relativePath = $this->resolveStoragePath($evidence->url ?? '', ['self-assessment-evidence/']);
        if ($relativePath && Storage::disk('public')->exists($relativePath)) {
            Storage::disk('public')->delete($relativePath);
        }

        $evidence->delete();
        return $this->respondData(['success' => true]);
    }

    public function adminStore(Request $request)
    {
        $validated = $request->validate([
            'answerId' => ['required', 'uuid'],
            'file' => ['required', 'file', 'max:20480', 'mimes:jpg,jpeg,png,pdf,docx,xlsx,mp3,mp4'],
            'overrideFinalLock' => ['nullable', 'boolean'],
        ]);

        $overrideFinalLock = (bool) ($validated['overrideFinalLock'] ?? false);
        $answer = SelfAssessmentAnswer::query()
            ->with('review')
            ->find($validated['answerId']);

        if (!$answer) {
            return response()->json(['error' => 'Jawaban tidak ditemukan.'], 404);
        }

        if (!$overrideFinalLock && $this->hasFinalizedResult($answer->session_area_id, $answer->user_id)) {
            return response()->json([
                'error' => 'Hasil self assessment sudah difinalisasi Unit Safety dan evidence tidak bisa diubah.',
            ], 403);
        }

        $file = $validated['file'];
        $path = $file->store('self-assessment-evidence', 'public');

        $item = SelfAssessmentEvidence::create([
            'session_area_id' => $answer->session_area_id,
            'user_id' => $answer->user_id,
            'question_code' => $answer->question_code,
            'name' => $file->getClientOriginalName(),
            'url' => Storage::disk('public')->url($path),
            'created_at' => now(),
        ]);

        $item->url = $this->signedDownloadUrl($item);

        return $this->respondData($item, 201);
    }

    public function adminDestroy(Request $request, SelfAssessmentEvidence $evidence)
    {
        $validated = $request->validate([
            'overrideFinalLock' => ['nullable', 'boolean'],
        ]);

        $overrideFinalLock = (bool) ($validated['overrideFinalLock'] ?? false);
        $answer = SelfAssessmentAnswer::query()
            ->with('review')
            ->where('session_area_id', $evidence->session_area_id)
            ->where('user_id', $evidence->user_id)
            ->where('question_code', $evidence->question_code)
            ->first();

        if (!$overrideFinalLock && $answer && $this->hasFinalizedResult($answer->session_area_id, $answer->user_id)) {
            return response()->json([
                'error' => 'Hasil self assessment sudah difinalisasi Unit Safety dan evidence tidak bisa dihapus.',
            ], 403);
        }

        $relativePath = $this->resolveStoragePath($evidence->url ?? '', ['self-assessment-evidence/']);
        if ($relativePath && Storage::disk('public')->exists($relativePath)) {
            Storage::disk('public')->delete($relativePath);
        }

        $evidence->delete();

        return $this->respondData(['success' => true]);
    }

    public function download(Request $request, SelfAssessmentEvidence $evidence)
    {
        $user = $request->user();
        $role = strtolower((string) ($user?->role ?? ''));
        $isAdmin = $role === 'admin';

        if (!$isAdmin && $evidence->user_id !== $user?->id) {
            return response()->json(['error' => 'Evidence not found.'], 404);
        }

        $relativePath = $this->resolveStoragePath($evidence->url ?? '', ['self-assessment-evidence/']);
        if (!$relativePath || !Storage::disk('public')->exists($relativePath)) {
            return response()->json(['error' => 'File tidak ditemukan.'], 404);
        }

        $absolutePath = Storage::disk('public')->path($relativePath);
        return response()->file($absolutePath);
    }

    private function resolveStoragePath(string $url, array $allowedPrefixes = []): ?string
    {
        if ($url === '') {
            return null;
        }

        $path = parse_url($url, PHP_URL_PATH) ?? $url;
        $path = ltrim($path, '/');

        // Handle malformed URLs like "localhost/storage/..." (no scheme)
        // and normal URLs like "http://host/storage/...".
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

    private function hasFinalizedResult(string $sessionAreaId, string $userId): bool
    {
        return SelfAssessmentResult::query()
            ->where('session_area_id', $sessionAreaId)
            ->where('user_id', $userId)
            ->whereNotNull('finalized_at')
            ->exists();
    }

    public function downloadSigned(Request $request, SelfAssessmentEvidence $evidence)
    {
        // Signature validated by 'signed' middleware
        $relativePath = $this->resolveStoragePath($evidence->url ?? '', ['self-assessment-evidence/']);
        if (!$relativePath || !Storage::disk('public')->exists($relativePath)) {
            return response()->json(['error' => 'File tidak ditemukan.'], 404);
        }

        $absolutePath = Storage::disk('public')->path($relativePath);
        return response()->download($absolutePath, $evidence->name ?: basename($relativePath));
    }

    private function signedDownloadUrl(SelfAssessmentEvidence $evidence): string
    {
        return URL::temporarySignedRoute(
            'self-assessment.evidence.signed',
            now()->addMinutes(10),
            ['evidence' => $evidence->id]
        );
    }
}
