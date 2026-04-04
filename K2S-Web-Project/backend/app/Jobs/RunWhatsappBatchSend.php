<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class RunWhatsappBatchSend implements ShouldQueue
{
    use Queueable;

    public int $timeout = 3600;

    public int $tries = 1;

    /**
     * @param array<int, array{phoneNumber:string,text:string,items?:array}> $targets
     */
    public function __construct(
        public array $targets
    ) {
    }

    public function handle(): void
    {
        $totalTargets = count($this->targets);
        $shouldDelayBetweenTargets = $totalTargets > 1;

        foreach ($this->targets as $index => $target) {
            $phoneNumber = (string) ($target['phoneNumber'] ?? '');
            $text = (string) ($target['text'] ?? '');

            if ($phoneNumber === '' || $text === '') {
                Log::warning('WhatsApp batch target dilewati karena payload tidak lengkap.', [
                    'phoneNumber' => $phoneNumber,
                    'index' => $index,
                ]);
            } else {
                try {
                    $response = $this->whatsappApiHttp(30)->post(
                        $this->whatsappApiUrl().'/internal/send-text',
                        [
                            'phoneNumber' => $phoneNumber,
                            'text' => $text,
                        ]
                    );

                    if ($response->failed()) {
                        Log::error('Gagal mengirim pesan WhatsApp dari job batch.', [
                            'phoneNumber' => $phoneNumber,
                            'status' => $response->status(),
                            'response' => $response->json() ?: $response->body(),
                        ]);
                    }
                } catch (Throwable $exception) {
                    Log::error('Exception saat mengirim pesan WhatsApp dari job batch.', [
                        'phoneNumber' => $phoneNumber,
                        'error' => $exception->getMessage(),
                    ]);
                }
            }

            if ($shouldDelayBetweenTargets && $index < ($totalTargets - 1)) {
                sleep(random_int(5, 15));
            }
        }
    }

    private function whatsappApiUrl(): string
    {
        return rtrim((string) config('services.whatsapp_api.service_url'), '/');
    }

    private function whatsappApiHttp(int $timeout = 30)
    {
        $token = (string) config('services.whatsapp_api.internal_token');

        if ($token === '') {
            throw new \RuntimeException('WHATSAPP_BOT_INTERNAL_TOKEN belum dikonfigurasi.');
        }

        return Http::acceptJson()
            ->withHeaders([
                'X-Internal-Token' => $token,
            ])
            ->timeout($timeout);
    }
}
