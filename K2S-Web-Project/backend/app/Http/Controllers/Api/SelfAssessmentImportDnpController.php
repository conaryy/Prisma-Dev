<?php

namespace App\Http\Controllers\Api;

use App\Jobs\RunSelfAssessmentImportDnpInject;
use App\Http\Controllers\Controller;
use App\Models\SelfAssessmentAnswer;
use App\Models\SelfAssessmentEvidence;
use App\Models\SelfAssessmentExportDnpSnapshot;
use App\Models\SelfAssessmentExportDnpSnapshotItem;
use App\Models\SelfAssessmentImportDnpInjectJob;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class SelfAssessmentImportDnpController extends Controller
{
    private const MAX_IMPORTED_FILES_PER_ANSWER = 5;

    public function inject(Request $request)
    {
        $validated = $this->validateInjectPayload($request);
        $adminUserId = (string) optional($request->user())->id;
        if ($adminUserId === '') {
            return response()->json(['error' => 'User tidak valid.'], 401);
        }

        $runningJob = SelfAssessmentImportDnpInjectJob::query()
            ->where('user_id', $adminUserId)
            ->where('session_area_id', $validated['sessionAreaId'])
            ->where('target_user_id', $validated['userId'])
            ->whereIn('status', ['queued', 'running'])
            ->latest('created_at')
            ->first();

        if ($runningJob) {
            return response()->json(['data' => [
                'jobId' => $runningJob->id,
                'status' => $runningJob->status,
                'message' => 'Inject jawaban DNP sebelumnya masih berjalan.',
            ]], 202);
        }

        $job = SelfAssessmentImportDnpInjectJob::query()->create([
            'user_id' => $adminUserId,
            'session_area_id' => $validated['sessionAreaId'],
            'target_user_id' => $validated['userId'],
            'include_evidence' => (bool) ($validated['includeEvidence'] ?? false),
            'match_count' => count($validated['matches'] ?? []),
            'status' => 'queued',
            'message' => 'Inject jawaban DNP dimasukkan ke antrean.',
        ]);

        RunSelfAssessmentImportDnpInject::dispatch(
            jobId: (string) $job->id,
            userId: $adminUserId,
            payload: $validated
        );

        return response()->json(['data' => [
            'jobId' => $job->id,
            'status' => $job->status,
            'message' => $job->message,
        ]], 202);
    }

    public function injectStatus(Request $request, SelfAssessmentImportDnpInjectJob $job)
    {
        $userId = (string) optional($request->user())->id;
        if ($userId === '' || (string) $job->user_id !== $userId) {
            return response()->json(['error' => 'Job tidak ditemukan.'], 404);
        }

        return response()->json(['data' => [
            'jobId' => $job->id,
            'status' => $job->status,
            'message' => $job->message,
            'error' => $job->error_message,
            'summary' => $job->summary,
            'startedAt' => optional($job->started_at)->toDateTimeString(),
            'finishedAt' => optional($job->finished_at)->toDateTimeString(),
            'createdAt' => optional($job->created_at)->toDateTimeString(),
        ]]);
    }

    public function injectRun(Request $request)
    {
        $validated = $this->validateInjectPayload($request);

        return response()->json([
            'data' => $this->performInject($validated),
        ]);
    }

    private function validateInjectPayload(Request $request): array
    {
        return $request->validate([
            'sessionAreaId' => ['required', 'uuid', 'exists:self_assessment_session_areas,id'],
            'userId' => ['required', 'uuid', 'exists:users,id'],
            'includeEvidence' => ['nullable', 'boolean'],
            'matches' => ['present', 'array'],
            'matches.*.answerId' => ['required', 'uuid'],
            'matches.*.dnpSnapshotItemId' => ['required', 'uuid'],
        ]);
    }

    private function performInject(array $validated): array
    {
        $includeEvidence = (bool) ($validated['includeEvidence'] ?? false);

        $snapshot = SelfAssessmentExportDnpSnapshot::query()
            ->where('session_area_id', $validated['sessionAreaId'])
            ->where('user_id', $validated['userId'])
            ->with('items:id,snapshot_id,question_code,status,comment,evidence_note,files')
            ->first();

        if (!$snapshot) {
            throw new HttpResponseException(
                response()->json(['error' => 'Snapshot import/compare DNP belum tersedia.'], 404)
            );
        }

        $validItemIds = $snapshot->items->pluck('id')->map(fn ($id) => (string) $id)->all();
        $validItemLookup = array_fill_keys($validItemIds, true);

        $answers = SelfAssessmentAnswer::query()
            ->where('session_area_id', $validated['sessionAreaId'])
            ->where('user_id', $validated['userId'])
            ->get()
            ->keyBy('id');

        $injectedCount = 0;
        $evidenceImportedCount = 0;
        $evidenceSkippedCount = 0;

        $snapshotItems = $snapshot->items->keyBy('id');

        foreach ($validated['matches'] as $match) {
            $dnpSnapshotItemId = (string) $match['dnpSnapshotItemId'];
            $answerId = (string) $match['answerId'];

            if (!isset($validItemLookup[$dnpSnapshotItemId]) || !$answers->has($answerId)) {
                continue;
            }

            /** @var SelfAssessmentAnswer $answer */
            $answer = $answers->get($answerId);
            /** @var SelfAssessmentExportDnpSnapshotItem $snapshotItem */
            $snapshotItem = $snapshotItems->get($dnpSnapshotItemId);

            $status = match (Str::upper(trim((string) $snapshotItem->status))) {
                'SA' => 'Satisfactory',
                'NS' => 'Not Satisfactory',
                'NA' => 'Not Applicable',
                default => 'Satisfactory',
            };

            $answer->update([
                'status' => $status,
                'comment' => $snapshotItem->comment ?? '',
                'evidence_note' => $snapshotItem->evidence_note ?? '',
            ]);

            $injectedCount++;

            if ($includeEvidence) {
                $result = $this->importEvidenceFiles($snapshot, $answer, $snapshotItem);
                $evidenceImportedCount += $result['imported'];
                $evidenceSkippedCount += $result['skipped'];
            }
        }

        $message = 'Berhasil inject ' . $injectedCount . ' data jawaban teks dari DNP.';
        if ($includeEvidence) {
            $message .= ' Evidence terimport ' . $evidenceImportedCount . ' file';
            if ($evidenceSkippedCount > 0) {
                $message .= ', dilewati ' . $evidenceSkippedCount . ' file';
            }
            $message .= '.';
        }

        return [
            'injectedCount' => $injectedCount,
            'evidenceImportedCount' => $evidenceImportedCount,
            'evidenceSkippedCount' => $evidenceSkippedCount,
            'message' => $message,
        ];
    }

    private function importEvidenceFiles(
        SelfAssessmentExportDnpSnapshot $snapshot,
        SelfAssessmentAnswer $answer,
        SelfAssessmentExportDnpSnapshotItem $snapshotItem
    ): array {
        $files = is_array($snapshotItem->files) ? $snapshotItem->files : [];
        if (empty($files)) {
            return ['imported' => 0, 'skipped' => 0];
        }

        $sessionId = (string) ($snapshot->wrapper_session_id ?? '');
        $scope = trim((string) ($snapshot->scope ?? ''));
        if ($sessionId === '' || $scope === '') {
            return ['imported' => 0, 'skipped' => count($files)];
        }

        $imported = 0;
        $skipped = 0;
        foreach (array_slice($files, 0, self::MAX_IMPORTED_FILES_PER_ANSWER) as $index => $fileMeta) {
            if (!is_array($fileMeta)) {
                $skipped++;
                continue;
            }

            $fileId = $this->resolveDnpFileId($fileMeta);
            if ($fileId === '') {
                $skipped++;
                continue;
            }

            try {
                $download = $this->downloadSelfAssessmentFile($sessionId, $scope, $fileId);
                $fileName = $this->resolveDownloadedFileName(
                    $download['headers']['content-disposition'] ?? null,
                    $fileMeta,
                    $snapshotItem,
                    $index
                );

                $exists = SelfAssessmentEvidence::query()
                    ->where('session_area_id', $answer->session_area_id)
                    ->where('user_id', $answer->user_id)
                    ->where('question_code', $answer->question_code)
                    ->where('name', $fileName)
                    ->exists();
                if ($exists) {
                    $skipped++;
                    continue;
                }

                $storedPath = 'self-assessment-evidence/'.Str::uuid().'-'.$fileName;
                Storage::disk('public')->put($storedPath, $download['body']);

                SelfAssessmentEvidence::query()->create([
                    'session_area_id' => $answer->session_area_id,
                    'user_id' => $answer->user_id,
                    'question_code' => $answer->question_code,
                    'name' => $fileName,
                    'url' => Storage::disk('public')->url($storedPath),
                    'created_at' => now(),
                ]);

                $imported++;
            } catch (\Throwable $exception) {
                $skipped++;
            }
        }

        if (count($files) > self::MAX_IMPORTED_FILES_PER_ANSWER) {
            $skipped += count($files) - self::MAX_IMPORTED_FILES_PER_ANSWER;
        }

        return ['imported' => $imported, 'skipped' => $skipped];
    }

    private function resolveDnpFileId(array $fileMeta): string
    {
        foreach (['file_id', 'id', 'fileId'] as $key) {
            $value = trim((string) ($fileMeta[$key] ?? ''));
            if ($value !== '') {
                return $value;
            }
        }

        return '';
    }

    private function resolveDownloadedFileName(
        ?string $contentDisposition,
        array $fileMeta,
        SelfAssessmentExportDnpSnapshotItem $snapshotItem,
        int $index
    ): string {
        $fromDisposition = $this->extractFileNameFromContentDisposition($contentDisposition);
        if ($fromDisposition !== '') {
            return $fromDisposition;
        }

        foreach (['file_name', 'filename', 'name', 'judul', 'title'] as $key) {
            $value = trim((string) ($fileMeta[$key] ?? ''));
            if ($value !== '') {
                return $this->sanitizeFileName($value);
            }
        }

        $questionCode = preg_replace('/[^A-Za-z0-9._-]+/', '-', (string) ($snapshotItem->question_code ?? 'file'));
        return $questionCode.'-dnp-'.$index.'.bin';
    }

    private function extractFileNameFromContentDisposition(?string $contentDisposition): string
    {
        $value = (string) $contentDisposition;
        if ($value === '') {
            return '';
        }

        if (preg_match('/filename\*=UTF-8\'\'([^;]+)/i', $value, $matches) === 1) {
            return $this->sanitizeFileName(rawurldecode($matches[1]));
        }

        if (preg_match('/filename="?([^";]+)"?/i', $value, $matches) === 1) {
            return $this->sanitizeFileName($matches[1]);
        }

        return '';
    }

    private function sanitizeFileName(string $fileName): string
    {
        $sanitized = trim(str_replace(["\n", "\r", "\0"], '', $fileName));
        $sanitized = preg_replace('/[\\\\\\/:"*?<>|]+/', '-', $sanitized) ?: 'dnp-file.bin';
        return $sanitized !== '' ? $sanitized : 'dnp-file.bin';
    }

    private function downloadSelfAssessmentFile(string $sessionId, string $scope, string $fileId): array
    {
        $response = $this->wrapperHttp(120)->get($this->wrapperUrl().'/automation-selfassessment-download-file', [
            'session_id' => $sessionId,
            'scope' => $scope,
            'file_id' => $fileId,
        ]);

        if (!$response->ok()) {
            $payload = $response->json();
            $message = is_array($payload) ? ($payload['error'] ?? null) : null;
            throw new \RuntimeException($message ?: 'Gagal mengunduh file evidence DNP.');
        }

        return [
            'body' => $response->body(),
            'headers' => [
                'content-type' => $response->header('Content-Type'),
                'content-disposition' => $response->header('Content-Disposition'),
            ],
        ];
    }

    private function wrapperUrl(): string
    {
        $wrapperUrl = rtrim((string) config('services.external_dnp.wrapper_url', ''), '/');
        if ($wrapperUrl === '') {
            throw new \RuntimeException('EXTERNAL_DNP_WRAPPER_URL belum dikonfigurasi.');
        }

        return $wrapperUrl;
    }

    private function wrapperHttp(int $timeout = 120): PendingRequest
    {
        $token = (string) config('services.external_dnp.wrapper_internal_token', '');
        if ($token === '') {
            throw new \RuntimeException('EXTERNAL_DNP_WRAPPER_INTERNAL_TOKEN belum dikonfigurasi.');
        }

        return Http::timeout($timeout)->withHeaders([
            'X-Internal-Token' => $token,
        ]);
    }
}
