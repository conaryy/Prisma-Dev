<?php

namespace App\Jobs;

use App\Http\Controllers\Api\SelfAssessmentExportDnpController;
use App\Models\SelfAssessmentExportDnpImportJob;
use App\Models\User;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Throwable;

class RunSelfAssessmentExportDnpImport implements ShouldQueue
{
    use Queueable;

    public int $timeout = 1200;

    public int $tries = 1;

    public string $encryptedPayload;

    public function __construct(
        public string $importJobId,
        public string $userId,
        array $payload
    ) {
        $this->encryptedPayload = Crypt::encrypt($payload);
    }

    public function handle(SelfAssessmentExportDnpController $controller): void
    {
        $importJob = SelfAssessmentExportDnpImportJob::query()->find($this->importJobId);
        if (!$importJob) {
            return;
        }

        $importJob->status = 'running';
        $importJob->message = 'Pengambilan data export DNP sedang diproses.';
        $importJob->started_at = now();
        $importJob->save();

        $user = User::query()->find($this->userId);
        if (!$user) {
            $importJob->status = 'failed';
            $importJob->error_message = 'User tidak ditemukan.';
            $importJob->message = 'Pengambilan data export DNP gagal.';
            $importJob->finished_at = now();
            $importJob->save();
            return;
        }

        try {
            $payload = Crypt::decrypt($this->encryptedPayload);
            if (!is_array($payload)) {
                throw new \RuntimeException('Payload import DNP tidak valid.');
            }

            $request = Request::create('/api/admin/self-assessment/export-dnp/run', 'POST', $payload);
            $request->setUserResolver(static fn () => $user);

            $response = $controller->importRun($request);
            $statusCode = method_exists($response, 'getStatusCode') ? $response->getStatusCode() : 500;
            $payload = method_exists($response, 'getContent')
                ? json_decode((string) $response->getContent(), true)
                : null;

            if ($statusCode >= 400) {
                $message = is_array($payload)
                    ? (string) ($payload['error'] ?? 'Pengambilan data export DNP gagal.')
                    : 'Pengambilan data export DNP gagal.';
                $importJob->status = 'failed';
                $importJob->error_message = $message;
                $importJob->message = 'Pengambilan data export DNP gagal.';
                $importJob->summary = is_array($payload)
                    ? [
                        'detail' => $payload['detail'] ?? null,
                        'debugLog' => $payload['debugLog'] ?? null,
                    ]
                    : null;
                $importJob->finished_at = now();
                $importJob->save();
                return;
            }

            $summary = is_array($payload) ? ($payload['data'] ?? null) : null;
            $importJob->status = 'succeeded';
            $importJob->message = 'Pengambilan data export DNP selesai.';
            $importJob->summary = is_array($summary) ? $summary : null;
            $importJob->finished_at = now();
            $importJob->save();
        } catch (Throwable $exception) {
            $importJob->status = 'failed';
            $importJob->error_message = $exception->getMessage();
            $importJob->message = 'Pengambilan data export DNP gagal.';
            $importJob->summary = [
                'detail' => $exception->getMessage(),
            ];
            $importJob->finished_at = now();
            $importJob->save();
        }
    }
}
