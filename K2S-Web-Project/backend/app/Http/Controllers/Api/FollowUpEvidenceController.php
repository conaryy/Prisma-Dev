<?php

namespace App\Http\Controllers\Api;

use App\Models\FollowUp;
use App\Models\FollowUpEvidence;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

class FollowUpEvidenceController extends ApiController
{
    public function store(Request $request, FollowUp $followUp)
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'max:20480', 'mimes:jpg,jpeg,png,pdf,docx,xlsx,mp3,mp4'],
        ]);

        $file = $validated['file'];
        $path = $file->store('evidence', 'public');

        $item = FollowUpEvidence::create([
            'follow_up_id' => $followUp->id,
            'name' => $file->getClientOriginalName(),
            'url' => Storage::disk('public')->url($path),
            'created_at' => now(),
        ]);
        // Return signed URL in payload for direct access
        $signedUrl = URL::temporarySignedRoute(
            'follow-ups.evidence.signed',
            now()->addMinutes(10),
            ['evidence' => $item->id]
        );
        $item->url = $signedUrl;
        return $this->respondData($item, 201);
    }

    public function destroy(FollowUp $followUp, FollowUpEvidence $evidence)
    {
        if ($evidence->follow_up_id !== $followUp->id) {
            return response()->json(['error' => 'Evidence not found.'], 404);
        }

        $relativePath = $this->resolveStoragePath((string) ($evidence->url ?? ''), ['evidence/']);
        if ($relativePath && Storage::disk('public')->exists($relativePath)) {
            Storage::disk('public')->delete($relativePath);
        }

        $evidence->delete();
        return $this->respondData(['success' => true]);
    }

    public function downloadSigned(Request $request, FollowUpEvidence $evidence)
    {
        $relativePath = $this->resolveStoragePath((string) ($evidence->url ?? ''), ['evidence/']);
        if (!$relativePath || !Storage::disk('public')->exists($relativePath)) {
            return response()->json(['error' => 'File tidak ditemukan.'], 404);
        }

        $absolute = Storage::disk('public')->path($relativePath);
        return response()->file($absolute);
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
}
