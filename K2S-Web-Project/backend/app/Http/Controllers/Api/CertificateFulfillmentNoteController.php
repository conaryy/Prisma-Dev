<?php

namespace App\Http\Controllers\Api;

use App\Models\Certificate;
use App\Models\CertificateFulfillmentNote;
use App\Models\Instansi;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

class CertificateFulfillmentNoteController extends ApiController
{
    private function userInstansiId(Request $request): ?string
    {
        return Instansi::query()
            ->where('user_id', $request->user()->id)
            ->value('id');
    }

    private function authorizeCertificate(Request $request, Certificate $certificate): ?\Illuminate\Http\JsonResponse
    {
        $instansiId = $this->userInstansiId($request);

        if (!$instansiId || $certificate->instansi_id !== $instansiId) {
            return response()->json(['error' => 'Forbidden.'], 403);
        }

        if (($certificate->evidence_type ?? 'Sertifikat Non Evidence') !== 'Sertifikat Evidence') {
            return response()->json(['error' => 'Catatan hanya tersedia untuk Sertifikat Evidence.'], 422);
        }

        return null;
    }

    public function index(Request $request, Certificate $certificate)
    {
        if ($response = $this->authorizeCertificate($request, $certificate)) {
            return $response;
        }

        $items = CertificateFulfillmentNote::query()
            ->where('certificate_id', $certificate->id)
            ->latest()
            ->get()
            ->map(fn (CertificateFulfillmentNote $note) => $this->withSignedEvidenceUrl($note));

        return $this->respondData($items);
    }

    public function store(Request $request, Certificate $certificate)
    {
        if ($response = $this->authorizeCertificate($request, $certificate)) {
            return $response;
        }

        $validated = $request->validate([
            'note' => ['nullable', 'string'],
            'comment' => ['required', 'string'],
            'fulfillmentPercentage' => ['required', 'integer', 'in:0,25,50,75,100'],
            'file' => ['nullable', 'file', 'max:20480', 'mimes:pdf,png,jpg,jpeg,doc,docx,xls,xlsx'],
            'files' => ['nullable', 'array', 'max:20'],
            'files.*' => ['file', 'max:20480', 'mimes:pdf,png,jpg,jpeg,doc,docx,xls,xlsx'],
        ]);

        $payload = [
            'certificate_id' => $certificate->id,
            'note' => $validated['note'] ?? null,
            'comment' => $validated['comment'],
            'fulfillment_percentage' => $validated['fulfillmentPercentage'],
        ];

        $evidenceFiles = $this->storeEvidenceFiles($this->validatedEvidenceFiles($validated));
        if ($evidenceFiles !== []) {
            $payload['evidence_files'] = $evidenceFiles;
            $payload['evidence_file_name'] = $evidenceFiles[0]['name'] ?? null;
            $payload['evidence_file_url'] = $evidenceFiles[0]['url'] ?? null;
        }

        $note = CertificateFulfillmentNote::create($payload);

        return $this->respondData($this->withSignedEvidenceUrl($note), 201);
    }

    public function update(Request $request, Certificate $certificate, CertificateFulfillmentNote $note)
    {
        if ($response = $this->authorizeCertificate($request, $certificate)) {
            return $response;
        }

        if ($note->certificate_id !== $certificate->id) {
            return response()->json(['error' => 'Catatan tidak ditemukan.'], 404);
        }

        $validated = $request->validate([
            'note' => ['sometimes', 'nullable', 'string'],
            'comment' => ['sometimes', 'string'],
            'fulfillmentPercentage' => ['sometimes', 'integer', 'in:0,25,50,75,100'],
            'file' => ['nullable', 'file', 'max:20480', 'mimes:pdf,png,jpg,jpeg,doc,docx,xls,xlsx'],
            'files' => ['nullable', 'array', 'max:20'],
            'files.*' => ['file', 'max:20480', 'mimes:pdf,png,jpg,jpeg,doc,docx,xls,xlsx'],
        ]);

        $payload = [];
        if (array_key_exists('note', $validated)) {
            $payload['note'] = $validated['note'];
        }
        if (array_key_exists('comment', $validated)) {
            $payload['comment'] = $validated['comment'];
        }
        if (array_key_exists('fulfillmentPercentage', $validated)) {
            $payload['fulfillment_percentage'] = $validated['fulfillmentPercentage'];
        }

        $newEvidenceFiles = $this->storeEvidenceFiles($this->validatedEvidenceFiles($validated));
        if ($newEvidenceFiles !== []) {
            $evidenceFiles = array_merge($this->normalizeEvidenceFiles($note), $newEvidenceFiles);
            $payload['evidence_files'] = $evidenceFiles;
            $payload['evidence_file_name'] = $evidenceFiles[0]['name'] ?? null;
            $payload['evidence_file_url'] = $evidenceFiles[0]['url'] ?? null;
        }

        $note->fill($payload)->save();

        return $this->respondData($this->withSignedEvidenceUrl($note->refresh()));
    }

    public function destroy(Request $request, Certificate $certificate, CertificateFulfillmentNote $note)
    {
        if ($response = $this->authorizeCertificate($request, $certificate)) {
            return $response;
        }

        if ($note->certificate_id !== $certificate->id) {
            return response()->json(['error' => 'Catatan tidak ditemukan.'], 404);
        }

        $this->deleteEvidenceFiles($this->normalizeEvidenceFiles($note));

        $note->delete();

        return $this->respondData(['success' => true]);
    }

    public function downloadSigned(Request $request, CertificateFulfillmentNote $note)
    {
        $evidenceFile = $this->resolveEvidenceFile($note, $request->query('file'));
        $relativePath = $this->resolveStoragePath((string) ($evidenceFile['url'] ?? ''), [
            'certificate-fulfillment-evidence/',
        ]);
        if (!$relativePath || !Storage::disk('public')->exists($relativePath)) {
            return response()->json(['error' => 'File tidak ditemukan.'], 404);
        }

        return response()->file(Storage::disk('public')->path($relativePath));
    }

    private function withSignedEvidenceUrl(CertificateFulfillmentNote $note): array
    {
        $evidenceFiles = $this->withSignedEvidenceFiles($note);

        return [
            'id' => $note->id,
            'certificate_id' => $note->certificate_id,
            'note' => $note->note,
            'comment' => $note->comment,
            'fulfillment_percentage' => $note->fulfillment_percentage,
            'evidence_files' => $evidenceFiles,
            'evidence_file_name' => $evidenceFiles[0]['name'] ?? null,
            'evidence_file_url' => $evidenceFiles[0]['url'] ?? null,
            'evidence_signed_url' => $evidenceFiles[0]['signed_url'] ?? null,
            'created_at' => $note->created_at,
            'updated_at' => $note->updated_at,
        ];
    }

    private function validatedEvidenceFiles(array $validated): array
    {
        $files = [];

        if (!empty($validated['file'])) {
            $files[] = $validated['file'];
        }

        foreach (($validated['files'] ?? []) as $file) {
            if ($file) {
                $files[] = $file;
            }
        }

        return $files;
    }

    private function storeEvidenceFiles(array $files): array
    {
        return array_map(function ($file): array {
            $path = $file->store('certificate-fulfillment-evidence', 'public');

            return [
                'name' => $file->getClientOriginalName(),
                'url' => Storage::disk('public')->url($path),
                'size' => $file->getSize(),
                'mime_type' => $file->getClientMimeType(),
            ];
        }, $files);
    }

    private function normalizeEvidenceFiles(CertificateFulfillmentNote $note): array
    {
        $files = [];

        foreach (($note->evidence_files ?? []) as $file) {
            if (!is_array($file)) {
                continue;
            }

            $url = (string) ($file['url'] ?? $file['file_url'] ?? '');
            if ($url === '') {
                continue;
            }

            $files[] = [
                'name' => (string) ($file['name'] ?? $file['file_name'] ?? basename($url)),
                'url' => $url,
                'size' => $file['size'] ?? null,
                'mime_type' => $file['mime_type'] ?? null,
            ];
        }

        if ($files === [] && $note->evidence_file_url) {
            $files[] = [
                'name' => (string) ($note->evidence_file_name ?: basename((string) $note->evidence_file_url)),
                'url' => (string) $note->evidence_file_url,
                'size' => null,
                'mime_type' => null,
            ];
        }

        return $files;
    }

    private function withSignedEvidenceFiles(CertificateFulfillmentNote $note): array
    {
        $files = [];

        foreach ($this->normalizeEvidenceFiles($note) as $index => $file) {
            $files[] = [
                'name' => $file['name'],
                'url' => $file['url'],
                'size' => $file['size'],
                'mime_type' => $file['mime_type'],
                'signed_url' => URL::temporarySignedRoute(
                    'certificates.fulfillment-notes.evidence.signed',
                    now()->addMinutes(10),
                    [
                        'note' => $note->id,
                        'file' => $index,
                    ]
                ),
            ];
        }

        return $files;
    }

    private function resolveEvidenceFile(CertificateFulfillmentNote $note, mixed $fileIndex): ?array
    {
        $files = $this->normalizeEvidenceFiles($note);
        if ($files === []) {
            return null;
        }

        if ($fileIndex === null || $fileIndex === '') {
            return $files[0];
        }

        $index = filter_var($fileIndex, FILTER_VALIDATE_INT);
        if ($index === false || !array_key_exists($index, $files)) {
            return null;
        }

        return $files[$index];
    }

    private function deleteEvidenceFiles(array $files): void
    {
        foreach ($files as $file) {
            $relativePath = $this->resolveStoragePath((string) ($file['url'] ?? ''), [
                'certificate-fulfillment-evidence/',
            ]);

            if ($relativePath && Storage::disk('public')->exists($relativePath)) {
                Storage::disk('public')->delete($relativePath);
            }
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

        foreach ($allowedPrefixes as $prefix) {
            if ($prefix !== '' && str_starts_with($path, $prefix)) {
                return $path;
            }
        }

        return empty($allowedPrefixes) ? $path : null;
    }
}
