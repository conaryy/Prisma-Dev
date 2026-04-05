<?php

namespace App\Jobs;

use App\Http\Controllers\Api\SelfAssessmentQuestionController;
use App\Models\SelfAssessmentQuestionImportJob;
use App\Models\User;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Http\Request;
use Throwable;

class RunSelfAssessmentQuestionImport implements ShouldQueue
{
    use Queueable;

    public int $timeout = 1200;

    public int $tries = 1;

    public function __construct(
        public string $importJobId,
        public string $userId,
        public array $payload
    ) {
    }

    public function handle(SelfAssessmentQuestionController $controller): void
    {
        $importJob = SelfAssessmentQuestionImportJob::query()->find($this->importJobId);
        if (!$importJob) {
            return;
        }

        $importJob->status = 'running';
        $importJob->message = 'Import pertanyaan DNP sedang diproses.';
        $importJob->started_at = now();
        $importJob->save();

        $user = User::query()->find($this->userId);
        if (!$user) {
            $importJob->status = 'failed';
            $importJob->error_message = 'User tidak ditemukan.';
            $importJob->message = 'Import pertanyaan DNP gagal.';
            $importJob->finished_at = now();
            $importJob->save();
            return;
        }

        $request = Request::create('/api/admin/self-assessment/questions/import-dnp/run', 'POST', $this->payload);
        $request->setUserResolver(static fn () => $user);

        try {
            $response = $controller->importDnpScrapeRun($request);
            $statusCode = method_exists($response, 'getStatusCode') ? $response->getStatusCode() : 500;
            $payload = method_exists($response, 'getContent')
                ? json_decode((string) $response->getContent(), true)
                : null;

            if ($statusCode >= 400) {
                $message = is_array($payload)
                    ? (string) ($payload['error'] ?? 'Import pertanyaan DNP gagal.')
                    : 'Import pertanyaan DNP gagal.';
                $importJob->status = 'failed';
                $importJob->error_message = $message;
                $importJob->message = 'Import pertanyaan DNP gagal.';
                $importJob->finished_at = now();
                $importJob->save();
                return;
            }

            $summary = is_array($payload) ? ($payload['data'] ?? null) : null;
            $importJob->status = 'succeeded';
            $importJob->message = 'Import pertanyaan DNP selesai.';
            $importJob->summary = is_array($summary) ? $summary : null;
            $importJob->finished_at = now();
            $importJob->save();
        } catch (Throwable $exception) {
            $importJob->status = 'failed';
            $importJob->error_message = $exception->getMessage();
            $importJob->message = 'Import pertanyaan DNP gagal.';
            $importJob->finished_at = now();
            $importJob->save();
        }
    }
}
