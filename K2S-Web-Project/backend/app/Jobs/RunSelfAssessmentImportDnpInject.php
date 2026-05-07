<?php

namespace App\Jobs;

use App\Http\Controllers\Api\SelfAssessmentImportDnpController;
use App\Models\SelfAssessmentImportDnpInjectJob;
use App\Models\User;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Throwable;

class RunSelfAssessmentImportDnpInject implements ShouldQueue
{
    use Queueable;

    public int $timeout = 1800;

    public int $tries = 1;

    public string $encryptedPayload;

    public function __construct(
        public string $jobId,
        public string $userId,
        array $payload
    ) {
        $this->encryptedPayload = Crypt::encrypt($payload);
    }

    public function handle(SelfAssessmentImportDnpController $controller): void
    {
        $job = SelfAssessmentImportDnpInjectJob::query()->find($this->jobId);
        if (!$job) {
            return;
        }

        $job->status = 'running';
        $job->message = 'Inject jawaban DNP sedang diproses.';
        $job->started_at = now();
        $job->save();

        $user = User::query()->find($this->userId);
        if (!$user) {
            $job->status = 'failed';
            $job->error_message = 'User tidak ditemukan.';
            $job->message = 'Inject jawaban DNP gagal.';
            $job->finished_at = now();
            $job->save();
            return;
        }

        try {
            $payload = Crypt::decrypt($this->encryptedPayload);
            if (!is_array($payload)) {
                throw new \RuntimeException('Payload inject jawaban DNP tidak valid.');
            }

            $request = Request::create('/api/admin/self-assessment/import-dnp/inject/run', 'POST', $payload);
            $request->setUserResolver(static fn () => $user);

            $response = $controller->injectRun($request);
            $statusCode = method_exists($response, 'getStatusCode') ? $response->getStatusCode() : 500;
            $payload = method_exists($response, 'getContent')
                ? json_decode((string) $response->getContent(), true)
                : null;

            if ($statusCode >= 400) {
                $message = is_array($payload)
                    ? (string) ($payload['error'] ?? 'Inject jawaban DNP gagal.')
                    : 'Inject jawaban DNP gagal.';
                $job->status = 'failed';
                $job->error_message = $message;
                $job->message = 'Inject jawaban DNP gagal.';
                $job->finished_at = now();
                $job->save();
                return;
            }

            $summary = is_array($payload) ? ($payload['data'] ?? null) : null;
            $job->status = 'succeeded';
            $job->message = 'Inject jawaban DNP selesai.';
            $job->summary = is_array($summary) ? $summary : null;
            $job->finished_at = now();
            $job->save();
        } catch (Throwable $exception) {
            $job->status = 'failed';
            $job->error_message = $exception->getMessage();
            $job->message = 'Inject jawaban DNP gagal.';
            $job->summary = [
                'detail' => $exception->getMessage(),
            ];
            $job->finished_at = now();
            $job->save();
        }
    }
}
