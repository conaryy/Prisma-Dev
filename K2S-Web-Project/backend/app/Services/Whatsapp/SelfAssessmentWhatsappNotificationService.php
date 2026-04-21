<?php

namespace App\Services\Whatsapp;

use App\Jobs\RunWhatsappBatchSend;
use App\Models\SelfAssessmentAnswer;
use App\Models\SelfAssessmentCap;
use App\Models\SelfAssessmentCapFulfillment;
use App\Models\SelfAssessmentEvidence;
use App\Models\SelfAssessmentReview;
use App\Models\SelfAssessmentSession;
use App\Models\User;
use App\Models\WhatsappNotificationPanel;
use App\Models\WhatsappUserNotificationRecipient;
use Carbon\Carbon;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class SelfAssessmentWhatsappNotificationService
{
    /**
     * @return array<string, array{label:string,description:string,audience:string,usesPhoneNumbers:bool,defaultEnabled:bool}>
     */
    public static function panelDefinitions(): array
    {
        return [
            'self_assessment' => [
                'label' => 'Self Assessment',
                'description' => 'Notifikasi saat user mengirim self assessment lokal selain scope monitoring.',
                'audience' => 'admin',
                'usesPhoneNumbers' => true,
                'defaultEnabled' => true,
            ],
            'cap_draft' => [
                'label' => 'Penyusunan CAP',
                'description' => 'Notifikasi saat user mengirim penyusunan CAP lokal selain scope monitoring.',
                'audience' => 'admin',
                'usesPhoneNumbers' => true,
                'defaultEnabled' => true,
            ],
            'cap_fulfillment' => [
                'label' => 'Pemenuhan CAP',
                'description' => 'Notifikasi saat user mengirim pemenuhan CAP lokal selain scope monitoring.',
                'audience' => 'admin',
                'usesPhoneNumbers' => true,
                'defaultEnabled' => true,
            ],
            'monitoring' => [
                'label' => 'Monitoring',
                'description' => 'Notifikasi seluruh kiriman self assessment atau CAP yang berada pada scope monitoring.',
                'audience' => 'admin',
                'usesPhoneNumbers' => true,
                'defaultEnabled' => true,
            ],
            'user_self_assessment_session_opened' => [
                'label' => 'Sesi Self Assessment Baru',
                'description' => 'Notifikasi ke nomor WhatsApp user yang terdaftar di profil saat sesi self assessment baru dibuka.',
                'audience' => 'user',
                'usesPhoneNumbers' => false,
                'defaultEnabled' => true,
            ],
            'user_self_assessment_reviewed' => [
                'label' => 'Review Self Assessment',
                'description' => 'Notifikasi ke nomor WhatsApp user yang terdaftar di profil saat admin mengirim review Unit Safety per pertanyaan.',
                'audience' => 'user',
                'usesPhoneNumbers' => false,
                'defaultEnabled' => true,
            ],
            'user_cap_reviewed' => [
                'label' => 'Review Penyusunan CAP',
                'description' => 'Notifikasi ke nomor WhatsApp user yang terdaftar di profil saat admin mengirim review penyusunan CAP.',
                'audience' => 'user',
                'usesPhoneNumbers' => false,
                'defaultEnabled' => true,
            ],
            'user_cap_fulfillment_reviewed' => [
                'label' => 'Review Pemenuhan CAP',
                'description' => 'Notifikasi ke nomor WhatsApp user yang terdaftar di profil saat admin mengirim review pemenuhan CAP.',
                'audience' => 'user',
                'usesPhoneNumbers' => false,
                'defaultEnabled' => true,
            ],
            'user_monitoring_session_opened' => [
                'label' => 'Sesi Monitoring Baru',
                'description' => 'Notifikasi ke nomor WhatsApp user yang terdaftar di profil saat admin membuka sesi monitoring baru.',
                'audience' => 'user',
                'usesPhoneNumbers' => false,
                'defaultEnabled' => true,
            ],
        ];
    }

    /**
     * @return array<int, array{key:string,label:string,description:string,audience:string,usesPhoneNumbers:bool,enabled:bool,phoneNumbers:array<int,string>}>
     */
    public function getPanelSettings(): array
    {
        $storedPanels = WhatsappNotificationPanel::query()
            ->get()
            ->keyBy('panel');

        $items = [];
        foreach (self::panelDefinitions() as $key => $meta) {
            /** @var WhatsappNotificationPanel|null $stored */
            $stored = $storedPanels->get($key);
            $items[] = [
                'key' => $key,
                'label' => $meta['label'],
                'description' => $meta['description'],
                'audience' => $meta['audience'],
                'usesPhoneNumbers' => $meta['usesPhoneNumbers'],
                'enabled' => $stored?->enabled ?? $meta['defaultEnabled'],
                'phoneNumbers' => $this->normalizePhoneNumbers($stored?->phone_numbers ?? []),
            ];
        }

        return $items;
    }

    /**
     * @return array<int, array{id:string,phoneNumber:string,userIds:array<int,string>}>
     */
    public function getUserNotificationRecipients(): array
    {
        $activeUserIds = User::query()
            ->where('status', '!=', 'Disabled')
            ->pluck('id')
            ->all();

        return WhatsappUserNotificationRecipient::query()
            ->orderBy('created_at')
            ->get()
            ->map(function (WhatsappUserNotificationRecipient $recipient) use ($activeUserIds) {
                return [
                    'id' => $recipient->id,
                    'phoneNumber' => $recipient->phone_number,
                    'userIds' => array_values(array_intersect(
                        $this->normalizeUserIds($recipient->user_ids ?? []),
                        $activeUserIds
                    )),
                ];
            })
            ->filter(fn (array $recipient) => $recipient['userIds'] !== [])
            ->values()
            ->all();
    }

    /**
     * @param  array<int, array{id?:string,phoneNumber:string,userIds?:array<int,string>}>  $recipients
     * @return array<int, array{id:string,phoneNumber:string,userIds:array<int,string>}>
     */
    public function updateUserNotificationRecipients(array $recipients): array
    {
        $incoming = collect($recipients)
            ->filter(fn ($item) => is_array($item) && is_string($item['phoneNumber'] ?? null))
            ->values();

        $keepIds = [];
        foreach ($incoming as $item) {
            $phoneNumber = $this->normalizePhoneNumbers([$item['phoneNumber']])[0] ?? null;
            if (!$phoneNumber) {
                continue;
            }

            $recipient = null;
            $id = $item['id'] ?? null;
            if (is_string($id) && trim($id) !== '') {
                $recipient = WhatsappUserNotificationRecipient::query()->find(trim($id));
            }

            if (!$recipient) {
                $recipient = new WhatsappUserNotificationRecipient();
            }

            $userIds = $this->normalizeActiveUserIds($item['userIds'] ?? []);
            if ($userIds === []) {
                continue;
            }

            $recipient->phone_number = $phoneNumber;
            $recipient->user_ids = $userIds;
            $recipient->save();

            $keepIds[] = $recipient->id;
        }

        WhatsappUserNotificationRecipient::query()
            ->when($keepIds !== [], fn ($query) => $query->whereNotIn('id', $keepIds), fn ($query) => $query)
            ->delete();

        return $this->getUserNotificationRecipients();
    }

    public function removeUserFromNotificationRecipients(string $userId): void
    {
        $userId = trim($userId);
        if ($userId === '') {
            return;
        }

        WhatsappUserNotificationRecipient::query()
            ->get()
            ->each(function (WhatsappUserNotificationRecipient $recipient) use ($userId) {
                $nextUserIds = array_values(array_filter(
                    $this->normalizeUserIds($recipient->user_ids ?? []),
                    fn (string $storedUserId) => $storedUserId !== $userId
                ));

                if ($nextUserIds === []) {
                    $recipient->delete();
                    return;
                }

                $recipient->user_ids = $nextUserIds;
                $recipient->save();
            });
    }

    /**
     * @return array<int, array{key:string,text:string}>
     */
    public function getPreviewTemplates(): array
    {
        return [
            [
                'key' => 'self_assessment',
                'text' => implode("\n", [
                    'NOTIF SELF ASSESSMENT',
                    '',
                    'Judul   : Self Assessment Audit Apron Timur',
                    'User    : admin',
                    'Scope   : Audit',
                    'Area    : 172-172',
                    'Jumlah  : 1 jawaban',
                    'Nomor PQ : A.1',
                    'Waktu   : 06 April 2026 13:24:59 WIB',
                    'File evidence : - evidence-foto-1.jpg',
                    '                - evidence-foto-2.pdf',
                    'Comment : - Kondisi implementasi sudah berjalan',
                    'Evidence note : - Bukti terlampir pada area inspeksi',
                ]),
            ],
            [
                'key' => 'cap_draft',
                'text' => implode("\n", [
                    'NOTIF PENYUSUNAN CAP',
                    '',
                    'Judul   : Self Assessment Audit Apron Timur',
                    'User    : admin',
                    'Scope   : Audit',
                    'Area    : 172-172',
                    'Jumlah  : 1 jawaban',
                    'Waktu   : 06 April 2026 13:24:59 WIB',
                    'Action plan : Perbaikan marking area parkir pesawat',
                    'Target Date : 12 April 2026',
                ]),
            ],
            [
                'key' => 'cap_fulfillment',
                'text' => implode("\n", [
                    'NOTIF PEMENUHAN CAP',
                    '',
                    'Judul   : Self Assessment Audit Apron Timur',
                    'User    : admin',
                    'Scope   : Audit',
                    'Area    : 172-172',
                    'Jumlah  : 1 jawaban',
                    'Waktu   : 06 April 2026 13:24:59 WIB',
                    'Propose Action : Pengecatan ulang telah selesai dilakukan',
                    'Action Office  : Unit Airside Operation',
                    'Evidence Reference : BA-OPS-APR-026',
                    'Progress : 100%',
                    'File evidence : - bukti-pemenuhan-1.jpg',
                    '                - bukti-pemenuhan-2.pdf',
                ]),
            ],
            [
                'key' => 'monitoring',
                'text' => implode("\n", [
                    'NOTIF PEMENUHAN CAP',
                    '',
                    'Judul   : Monitoring Follow Up Apron Timur',
                    'User    : admin',
                    'Scope   : Monitoring',
                    'Area    : 172-172',
                    'Jumlah  : 1 jawaban',
                    'Waktu   : 06 April 2026 13:24:59 WIB',
                    'Propose Action : Verifikasi lapangan sudah selesai',
                    'Action Office  : Unit Monitoring',
                    'Evidence Reference : MON-APR-011',
                    'Progress : 80%',
                    'File evidence : - monitoring-evidence-1.jpg',
                ]),
            ],
            [
                'key' => 'user_self_assessment_session_opened',
                'text' => implode("\n", [
                    'NOTIF SESI self ASSESMENT BARU',
                    '',
                    'Sesi self assesment baru telah dibuka',
                    '',
                    'Judul : Self Assessment Audit Apron Timur',
                    'Schedule : 06 April 2026 - 12 April 2026',
                ]),
            ],
            [
                'key' => 'user_self_assessment_reviewed',
                'text' => implode("\n", [
                    'NOTIF REVIEW SELF ASSESMENT',
                    '',
                    'Admin telah melakukan review self assesment',
                    '',
                    'Judul : Self Assessment Audit Apron Timur',
                    'Schedule : 06 April 2026 - 12 April 2026',
                    'Nomor PQ : PQ-1.2.3',
                    'Status of Implementation : Implemented',
                    'Severity : Medium',
                    'Description : Pengamanan area perlu dirapikan kembali',
                    'Finding : Rambu pembatas belum terpasang sempurna',
                ]),
            ],
            [
                'key' => 'user_cap_reviewed',
                'text' => implode("\n", [
                    'NOTIF REVIEW PENYUSUNAN CAP :',
                    '',
                    'Admin telah melakukan review penyusunan CAP :',
                    '',
                    'Judul : Self Assessment Audit Apron Timur',
                    'Schedule : 06 April 2026 - 12 April 2026',
                    'Nomor PQ : PQ-1.2.3',
                    'Result : Acceptable',
                    'Comment : Action plan dapat dilanjutkan sesuai target',
                    'Status : Satisfactory',
                ]),
            ],
            [
                'key' => 'user_cap_fulfillment_reviewed',
                'text' => implode("\n", [
                    'NOTIF REVIEW PEMENUHAN CAP :',
                    '',
                    'Admin telah melakukan review pemenuhan CAP :',
                    '',
                    'Judul : Self Assessment Audit Apron Timur',
                    'Schedule : 06 April 2026 - 12 April 2026',
                    'Nomor PQ : PQ-1.2.3',
                    'CAP status : Closed',
                    'Comment : Bukti pemenuhan sudah sesuai',
                ]),
            ],
            [
                'key' => 'user_monitoring_session_opened',
                'text' => implode("\n", [
                    'NOTIF SESI MONITORING BARU :',
                    '',
                    'Sesi monitoring baru telah dibuka',
                    '',
                    'Judul : Monitoring Follow Up Apron Timur',
                    'Schedule : 15 April 2026 - 18 April 2026',
                ]),
            ],
        ];
    }

    /**
     * @param  array<int, array{key:string, enabled?:bool, phoneNumbers?:array<int, string>}>  $panels
     * @return array<int, array{key:string,label:string,description:string,audience:string,usesPhoneNumbers:bool,enabled:bool,phoneNumbers:array<int,string>}>
     */
    public function updatePanelSettings(array $panels): array
    {
        $incomingByKey = collect($panels)
            ->filter(fn ($item) => is_array($item) && is_string($item['key'] ?? null))
            ->keyBy('key');

        foreach (self::panelDefinitions() as $panelKey => $meta) {
            $phoneNumbers = $this->normalizePhoneNumbers(
                Arr::get($incomingByKey->get($panelKey, []), 'phoneNumbers', [])
            );
            $enabled = (bool) Arr::get(
                $incomingByKey->get($panelKey, []),
                'enabled',
                $meta['defaultEnabled']
            );

            WhatsappNotificationPanel::query()->updateOrCreate(
                ['panel' => $panelKey],
                [
                    'enabled' => $enabled,
                    'phone_numbers' => $meta['usesPhoneNumbers'] ? $phoneNumbers : [],
                ]
            );
        }

        return $this->getPanelSettings();
    }

    public function notifySelfAssessmentSubmitted(Collection $answers): void
    {
        /** @var SelfAssessmentAnswer|null $answer */
        $answer = $answers->first();
        if (!$answer) {
            return;
        }

        $session = $answer->sessionArea?->session;
        $scope = (string) ($session?->scope ?? '');
        $panelKey = $scope === 'monitoring' ? 'monitoring' : 'self_assessment';
        $questionCodes = $answers
            ->pluck('question_code')
            ->filter(fn ($item) => is_string($item) && trim($item) !== '')
            ->values()
            ->all();
        $evidenceFiles = SelfAssessmentEvidence::query()
            ->where('session_area_id', $answer->session_area_id)
            ->where('user_id', $answer->user_id)
            ->when(
                $questionCodes !== [],
                fn ($query) => $query->whereIn('question_code', $questionCodes)
            )
            ->orderBy('created_at')
            ->get(['name'])
            ->pluck('name')
            ->filter(fn ($item) => is_string($item) && trim($item) !== '')
            ->values()
            ->all();

        $comments = $answers
            ->pluck('comment')
            ->filter(fn ($item) => is_string($item) && trim($item) !== '')
            ->map(fn (string $item) => trim($item))
            ->unique()
            ->values()
            ->all();
        $evidenceNotes = $answers
            ->pluck('evidence_note')
            ->filter(fn ($item) => is_string($item) && trim($item) !== '')
            ->map(fn (string $item) => trim($item))
            ->unique()
            ->values()
            ->all();

        $message = implode("\n", array_merge(
            ['NOTIF SELF ASSESSMENT', ''],
            $this->buildBaseLines(
                $answer,
                $answers->count(),
                optional($answer->submitted_at)->toDateTimeString(),
                $this->resolveQuestionCodes($answers)
            ),
            $this->formatListBlock('File evidence', $evidenceFiles),
            $this->formatListBlock('Comment', $comments),
            $this->formatListBlock('Evidence note', $evidenceNotes),
        ));

        $this->dispatchToPanel($panelKey, $message);
    }

    public function notifyUserSessionOpened(SelfAssessmentSession $session): void
    {
        $panelKey = $session->scope === 'monitoring'
            ? 'user_monitoring_session_opened'
            : 'user_self_assessment_session_opened';
        $heading = $session->scope === 'monitoring'
            ? 'NOTIF SESI MONITORING BARU'
            : 'NOTIF SESI self ASSESMENT BARU';
        $intro = $session->scope === 'monitoring'
            ? 'Sesi monitoring baru telah dibuka'
            : 'Sesi self assesment baru telah dibuka';
        $message = implode("\n", [
            $heading,
            '',
            $intro,
            '',
            'Judul : '.$this->formatText($session->title),
            'Schedule : '.$this->resolveSessionSchedule($session),
        ]);

        $userIds = $session->users()->pluck('users.id')->values()->all();
        $this->dispatchToUsersOrPanel($userIds, $panelKey, $message);
    }

    public function notifyUserSelfAssessmentReviewed(SelfAssessmentReview $review): void
    {
        $review->loadMissing(['answer.sessionArea.session', 'answer.user']);
        $answer = $review->answer;
        if (!$answer) {
            return;
        }

        $message = implode("\n", [
            'NOTIF REVIEW SELF ASSESMENT',
            '',
            'Admin telah melakukan review self assesment',
            '',
            'Judul : '.$this->resolveSessionTitle($answer),
            'Schedule : '.$this->resolveAnswerSchedule($answer),
            'Nomor PQ : '.$this->formatText($answer->question_code),
            'Status of Implementation : '.$this->formatText($review->status),
            'Severity : '.$this->formatText($review->severity),
            'Description : '.$this->formatText($review->description),
            'Finding : '.$this->formatText($review->finding),
        ]);

        $this->dispatchToUsersOrPanel(
            [$answer->user_id],
            'user_self_assessment_reviewed',
            $message
        );
    }

    public function notifyUserCapReviewed(
        SelfAssessmentCap $cap,
        ?string $result,
        ?string $comment,
        ?string $status
    ): void {
        $cap->loadMissing(['answer.sessionArea.session', 'answer.user']);
        $answer = $cap->answer;
        if (!$answer) {
            return;
        }

        $message = implode("\n", [
            'NOTIF REVIEW PENYUSUNAN CAP :',
            '',
            'Admin telah melakukan review penyusunan CAP :',
            '',
            'Judul : '.$this->resolveSessionTitle($answer),
            'Schedule : '.$this->resolveAnswerSchedule($answer),
            'Nomor PQ : '.$this->formatText($answer->question_code),
            'Result : '.$this->formatText($result),
            'Comment : '.$this->formatText($comment),
            'Status : '.$this->formatText($status),
        ]);

        $this->dispatchToUsersOrPanel(
            [$answer->user_id],
            'user_cap_reviewed',
            $message
        );
    }

    public function notifyUserCapFulfillmentReviewed(
        SelfAssessmentCap $cap,
        ?string $comment,
        ?string $status
    ): void {
        $cap->loadMissing(['answer.sessionArea.session', 'answer.user']);
        $answer = $cap->answer;
        if (!$answer) {
            return;
        }

        $message = implode("\n", [
            'NOTIF REVIEW PEMENUHAN CAP :',
            '',
            'Admin telah melakukan review pemenuhan CAP :',
            '',
            'Judul : '.$this->resolveSessionTitle($answer),
            'Schedule : '.$this->resolveAnswerSchedule($answer),
            'Nomor PQ : '.$this->formatText($answer->question_code),
            'CAP status : '.$this->formatText($status),
            'Comment : '.$this->formatText($comment),
        ]);

        $this->dispatchToUsersOrPanel(
            [$answer->user_id],
            'user_cap_fulfillment_reviewed',
            $message
        );
    }

    public function notifyCapDraftSubmitted(SelfAssessmentCap $cap): void
    {
        $scope = (string) ($cap->answer?->sessionArea?->session?->scope ?? '');
        $panelKey = $scope === 'monitoring' ? 'monitoring' : 'cap_draft';
        $message = implode("\n", array_merge(
            ['NOTIF PENYUSUNAN CAP', ''],
            $this->buildBaseLines($cap->answer, 1, optional($cap->sent_at)->toDateTimeString()),
            ['Action plan : '.$this->formatText($cap->action_plan)],
            ['Target Date : '.$this->formatDate($cap->target_date?->format('Y-m-d'))],
        ));

        $this->dispatchToPanel($panelKey, $message);
    }

    public function notifyCapFulfillmentSubmitted(
        SelfAssessmentCap $cap,
        SelfAssessmentCapFulfillment $fulfillment
    ): void {
        $scope = (string) ($cap->answer?->sessionArea?->session?->scope ?? '');
        $panelKey = $scope === 'monitoring' ? 'monitoring' : 'cap_fulfillment';
        $message = implode("\n", array_merge(
            ['NOTIF PEMENUHAN CAP', ''],
            $this->buildBaseLines($cap->answer, 1, optional($fulfillment->submitted_at)->toDateTimeString()),
            ['Propose Action : '.$this->formatText($fulfillment->propose_action)],
            ['Action Office  : '.$this->formatText($fulfillment->action_office)],
            ['Evidence Reference : '.$this->formatText($fulfillment->evidence_reference)],
            ['Progress : '.(int) $fulfillment->progress.'%'],
            $this->formatListBlock(
                'File evidence',
                $fulfillment->files()
                    ->orderBy('created_at')
                    ->get(['name'])
                    ->pluck('name')
                    ->filter(fn ($item) => is_string($item) && trim($item) !== '')
                    ->values()
                    ->all()
            ),
        ));

        $this->dispatchToPanel($panelKey, $message);
    }

    private function dispatchToPanel(string $panelKey, string $message): void
    {
        if (!$this->isPanelEnabled($panelKey)) {
            return;
        }

        $phoneNumbers = $this->getPhoneNumbersForPanel($panelKey);
        if ($phoneNumbers === []) {
            return;
        }

        $targets = array_map(
            fn (string $phoneNumber) => [
                'phoneNumber' => $phoneNumber,
                'text' => $message,
            ],
            $phoneNumbers
        );

        RunWhatsappBatchSend::dispatch($targets);
    }

    /**
     * @param  array<int, string|null>  $userIds
     */
    private function dispatchToUsersOrPanel(array $userIds, string $panelKey, string $message): void
    {
        if (!$this->isPanelEnabled($panelKey)) {
            return;
        }

        $phoneNumbers = array_values(array_unique(array_merge(
            $this->getPhoneNumbersForUsers($userIds),
            $this->getPhoneNumbersForRecipientCopies($userIds)
        )));

        if ($phoneNumbers === []) {
            return;
        }

        $targets = array_map(
            fn (string $phoneNumber) => [
                'phoneNumber' => $phoneNumber,
                'text' => $message,
            ],
            $phoneNumbers
        );

        RunWhatsappBatchSend::dispatch($targets);
    }

    /**
     * @return array<int, string>
     */
    private function getPhoneNumbersForPanel(string $panelKey): array
    {
        $panel = WhatsappNotificationPanel::query()
            ->where('panel', $panelKey)
            ->first();

        return $this->normalizePhoneNumbers($panel?->phone_numbers ?? []);
    }

    private function isPanelEnabled(string $panelKey): bool
    {
        $panel = WhatsappNotificationPanel::query()
            ->where('panel', $panelKey)
            ->first();

        $default = (bool) (self::panelDefinitions()[$panelKey]['defaultEnabled'] ?? false);

        return $panel?->enabled ?? $default;
    }

    /**
     * @param  array<int, string|null>  $userIds
     * @return array<int, string>
     */
    private function getPhoneNumbersForUsers(array $userIds): array
    {
        $ids = collect($userIds)
            ->filter(fn ($item) => is_string($item) && trim($item) !== '')
            ->map(fn (string $item) => trim($item))
            ->unique()
            ->values();

        if ($ids->isEmpty()) {
            return [];
        }

        $phones = User::query()
            ->whereIn('id', $ids->all())
            ->where('status', '!=', 'Disabled')
            ->pluck('phone')
            ->all();

        return $this->normalizePhoneNumbers($phones);
    }

    /**
     * @param  array<int, string|null>  $userIds
     * @return array<int, string>
     */
    private function getPhoneNumbersForRecipientCopies(array $userIds): array
    {
        $ids = $this->normalizeActiveUserIds($userIds);
        if ($ids === []) {
            return [];
        }

        return WhatsappUserNotificationRecipient::query()
            ->get()
            ->filter(function (WhatsappUserNotificationRecipient $recipient) use ($ids) {
                $targetIds = $this->normalizeUserIds($recipient->user_ids ?? []);
                return $targetIds !== [] && count(array_intersect($ids, $targetIds)) > 0;
            })
            ->pluck('phone_number')
            ->filter(fn ($item) => is_string($item) && trim($item) !== '')
            ->map(fn (string $item) => trim($item))
            ->unique()
            ->values()
            ->all();
    }

    /**
     * @param  mixed  $values
     * @return array<int, string>
     */
    private function normalizeUserIds(mixed $values): array
    {
        if (!is_array($values)) {
            return [];
        }

        return collect($values)
            ->filter(fn ($item) => is_string($item) && trim($item) !== '')
            ->map(fn (string $item) => trim($item))
            ->unique()
            ->values()
            ->all();
    }

    /**
     * @param  mixed  $values
     * @return array<int, string>
     */
    private function normalizeActiveUserIds(mixed $values): array
    {
        $ids = $this->normalizeUserIds($values);
        if ($ids === []) {
            return [];
        }

        return User::query()
            ->whereIn('id', $ids)
            ->where('status', '!=', 'Disabled')
            ->pluck('id')
            ->all();
    }

    /**
     * @param  mixed  $values
     * @return array<int, string>
     */
    private function normalizePhoneNumbers(mixed $values): array
    {
        if (!is_array($values)) {
            return [];
        }

        $normalized = [];
        foreach ($values as $value) {
            if (!is_string($value)) {
                continue;
            }

            $digits = preg_replace('/\D+/', '', trim($value)) ?? '';
            if ($digits === '' || !preg_match('/^628\d{7,15}$/', $digits)) {
                continue;
            }

            $normalized[] = $digits;
        }

        return array_values(array_unique($normalized));
    }

    private function resolveAreaName(?SelfAssessmentAnswer $answer): string
    {
        return trim((string) ($answer?->sessionArea?->category ?? 'Tidak diketahui')) ?: 'Tidak diketahui';
    }

    private function resolveUserName(?SelfAssessmentAnswer $answer): string
    {
        return trim((string) ($answer?->user?->name ?? 'User tidak diketahui')) ?: 'User tidak diketahui';
    }

    private function resolveQuestionCode(SelfAssessmentCap $cap): string
    {
        $questionCode = (string) ($cap->answer?->question_code ?? '');
        return $questionCode !== '' ? $questionCode : '-';
    }

    /**
     * @return array<int, string>
     */
    private function buildBaseLines(
        ?SelfAssessmentAnswer $answer,
        int $questionCount,
        ?string $submittedAt,
        ?string $questionCodes = null
    ): array
    {
        $lines = [
            'Judul   : '.$this->resolveSessionTitle($answer),
            'User    : '.$this->resolveUserName($answer),
            'Scope   : '.$this->formatScopeLabel((string) ($answer?->sessionArea?->session?->scope ?? '')),
            'Area    : '.$this->resolveAreaName($answer),
            'Jumlah  : '.$questionCount.' jawaban',
        ];

        if ($questionCodes !== null && trim($questionCodes) !== '') {
            $lines[] = 'Nomor PQ : '.$this->formatText($questionCodes);
        }

        $lines[] = 'Waktu   : '.$this->formatDateTime($submittedAt);

        return $lines;
    }

    private function resolveQuestionCodes(Collection $answers): string
    {
        $codes = $answers
            ->pluck('question_code')
            ->filter(fn ($item) => is_string($item) && trim($item) !== '')
            ->map(fn (string $item) => trim($item))
            ->unique()
            ->values()
            ->all();

        return $codes === [] ? '-' : implode(', ', $codes);
    }

    /**
     * @param  array<int, string>  $items
     * @return array<int, string>
     */
    private function formatListBlock(string $label, array $items): array
    {
        if ($items === []) {
            return [$label.' : -'];
        }

        $lines = [];
        foreach (array_values($items) as $index => $item) {
            $prefix = $index === 0 ? $label.' : ' : str_repeat(' ', strlen($label)).'   ';
            $lines[] = $prefix.'- '.$this->formatText($item);
        }

        return $lines;
    }

    private function formatScopeLabel(string $scope): string
    {
        if ($scope === '') {
            return '-';
        }

        return Str::headline($scope);
    }

    private function formatDate(?string $value): string
    {
        if (!$value) {
            return '-';
        }

        try {
            return Carbon::parse($value)
                ->locale('id')
                ->timezone('Asia/Jakarta')
                ->translatedFormat('d F Y');
        } catch (\Throwable) {
            return $value;
        }
    }

    private function formatDateTime(?string $value): string
    {
        if (!$value) {
            return '-';
        }

        try {
            return Carbon::parse($value)
                ->locale('id')
                ->timezone('Asia/Jakarta')
                ->translatedFormat('d F Y H:i:s').' WIB';
        } catch (\Throwable) {
            return $value;
        }
    }

    private function resolveSessionTitle(?SelfAssessmentAnswer $answer): string
    {
        $title = trim((string) ($answer?->sessionArea?->session?->title ?? ''));
        return $title !== '' ? $title : '-';
    }

    private function resolveAnswerSchedule(?SelfAssessmentAnswer $answer): string
    {
        return $this->resolveSessionSchedule($answer?->sessionArea?->session);
    }

    private function resolveSessionSchedule(?SelfAssessmentSession $session): string
    {
        if (!$session) {
            return '-';
        }

        $startDate = $session->start_date?->format('Y-m-d');
        $endDate = $session->end_date?->format('Y-m-d');

        if (!$startDate && !$endDate) {
            return '-';
        }

        if ($startDate && $endDate && $startDate !== $endDate) {
            return $this->formatDate($startDate).' - '.$this->formatDate($endDate);
        }

        return $this->formatDate($startDate ?: $endDate);
    }

    private function formatText(?string $value): string
    {
        $text = trim((string) ($value ?? ''));
        return $text !== '' ? preg_replace('/\s+/', ' ', $text) ?? $text : '-';
    }
}
