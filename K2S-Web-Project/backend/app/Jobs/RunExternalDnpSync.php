<?php

namespace App\Jobs;

use App\Http\Controllers\Api\ExternalDnpCapController;
use App\Models\ExternalDnpSyncJob;
use App\Models\User;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Throwable;

class RunExternalDnpSync implements ShouldQueue
{
    use Queueable;

    public int $timeout = 1200;

    public int $tries = 1;

    public string $encryptedPayload;

    public function __construct(
        public string $syncJobId,
        public string $userId,
        array $payload
    ) {
        $this->encryptedPayload = Crypt::encrypt($payload);
    }

    public function handle(ExternalDnpCapController $controller): void
    {
        $syncJob = ExternalDnpSyncJob::query()->find($this->syncJobId);
        if (!$syncJob) {
            return;
        }

        $syncJob->status = 'running';
        $syncJob->message = 'Sinkronisasi data sedang diproses.';
        $syncJob->started_at = now();
        $syncJob->save();

        $user = User::query()->find($this->userId);
        if (!$user) {
            $syncJob->status = 'failed';
            $syncJob->error_message = 'User tidak ditemukan.';
            $syncJob->finished_at = now();
            $syncJob->save();
            return;
        }

        try {
            $payload = Crypt::decrypt($this->encryptedPayload);
            if (!is_array($payload)) {
                throw new \RuntimeException('Payload sinkronisasi tidak valid.');
            }

            $request = Request::create('/api/external-dnp/sync/run', 'POST', $payload);
            $request->setUserResolver(static fn () => $user);

            $response = $controller->syncRun($request);
            $statusCode = method_exists($response, 'getStatusCode') ? $response->getStatusCode() : 500;
            $payload = method_exists($response, 'getContent')
                ? json_decode((string) $response->getContent(), true)
                : null;

            if ($statusCode >= 400) {
                $message = is_array($payload)
                    ? (string) ($payload['error'] ?? 'Sinkronisasi gagal.')
                    : 'Sinkronisasi gagal.';
                $syncJob->status = 'failed';
                $syncJob->error_message = $message;
                $syncJob->message = 'Sinkronisasi gagal.';
                $syncJob->finished_at = now();
                $syncJob->save();
                return;
            }

            $summary = is_array($payload) ? ($payload['data'] ?? null) : null;
            $syncJob->status = 'succeeded';
            $syncJob->message = 'Sinkronisasi selesai.';
            $syncJob->summary = is_array($summary) ? $summary : null;
            $syncJob->finished_at = now();
            $syncJob->save();
        } catch (Throwable $exception) {
            $syncJob->status = 'failed';
            $syncJob->error_message = $exception->getMessage();
            $syncJob->message = 'Sinkronisasi gagal.';
            $syncJob->finished_at = now();
            $syncJob->save();
        }
    }
}
