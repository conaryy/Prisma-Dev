<?php

namespace App\Http\Controllers\Api;

use App\Models\SelfAssessmentAnswer;
use App\Models\SelfAssessmentEvidence;
use App\Models\SystemNotification;
use App\Models\User;
use App\Services\Whatsapp\SelfAssessmentWhatsappNotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class SelfAssessmentAnswerController extends ApiController
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'sessionAreaId' => ['required', 'uuid'],
        ]);

        $answers = SelfAssessmentAnswer::query()
            ->where('session_area_id', $validated['sessionAreaId'])
            ->where('user_id', $request->user()->id)
            ->with(['review.reviewer'])
            ->get();

        $payload = $answers->map(function (SelfAssessmentAnswer $answer) {
            $review = $answer->review && $answer->review->sent_at ? $answer->review : null;
            return [
                'id' => $answer->id,
                'questionCode' => $answer->question_code,
                'status' => $answer->status,
                'comment' => $answer->comment,
                'evidenceNote' => $answer->evidence_note,
                'isSubmitted' => $answer->is_submitted,
                'submittedAt' => optional($answer->submitted_at)->toDateTimeString(),
                'review' => $review ? [
                    'id' => $review->id,
                    'status' => $review->status,
                    'comment' => $review->comment,
                    'allowReply' => $review->allow_reply,
                    'isFinal' => $review->is_final,
                    'sentAt' => optional($review->sent_at)->toDateTimeString(),
                    'reviewer' => $review->reviewer?->only(['id', 'name', 'email']),
                ] : null,
            ];
        });

        return $this->respondData($payload);
    }

    public function storeBulk(Request $request)
    {
        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.sessionAreaId' => ['required', 'uuid'],
            'items.*.questionCode' => ['required', 'string'],
            'items.*.status' => ['required', 'string'],
            'items.*.comment' => ['nullable', 'string'],
            'items.*.evidenceNote' => ['nullable', 'string'],
            'items.*.submit' => ['nullable', 'boolean'],
        ]);

        $userId = $request->user()->id;
        $saved = [];

        $missingEvidenceQuestionCodes = $this->findMissingEvidenceQuestionCodes(
            $validated['items'],
            $userId
        );
        if (!empty($missingEvidenceQuestionCodes)) {
            return response()->json([
                'error' => 'Upload evidence wajib sebelum kirim PQ untuk: '
                    .implode(', ', $missingEvidenceQuestionCodes).'.',
            ], 422);
        }

        $submittedAnswerIds = [];
        foreach ($validated['items'] as $item) {
            $answer = SelfAssessmentAnswer::query()->firstOrNew([
                'session_area_id' => $item['sessionAreaId'],
                'user_id' => $userId,
                'question_code' => $item['questionCode'],
            ]);

            if ($answer->exists && $answer->review && $answer->review->is_final) {
                return response()->json([
                    'error' => 'Jawaban sudah difinalisasi dan tidak bisa diubah.',
                ], 403);
            }

            $answer->status = $item['status'];
            $answer->comment = $item['comment'] ?? null;
            $answer->evidence_note = $item['evidenceNote'] ?? null;

            $shouldSubmit = $item['submit'] ?? true;
            $answer->is_submitted = $shouldSubmit;
            $answer->submitted_at = $shouldSubmit ? now() : null;

            $answer->save();
            $saved[] = $answer->id;
            if ($shouldSubmit) {
                $submittedAnswerIds[] = $answer->id;
            }
        }

        if (!empty($submittedAnswerIds)) {
            $admins = User::query()
                ->where('role', 'admin')
                ->get(['id']);
            $now = now();
            $notifications = [];
            foreach ($submittedAnswerIds as $answerId) {
                foreach ($admins as $admin) {
                    $notifications[] = [
                        'id' => (string) Str::uuid(),
                        'user_id' => $admin->id,
                        'type' => 'submission-received',
                        'title' => 'Self assessment terkirim',
                        'message' => 'Ada jawaban self assessment baru dari user.',
                        'data' => json_encode([
                            'answerId' => $answerId,
                        ]),
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
            }
            if (!empty($notifications)) {
                SystemNotification::query()->insert($notifications);
            }

            $submittedAnswers = SelfAssessmentAnswer::query()
                ->with(['sessionArea.session', 'user'])
                ->whereIn('id', $submittedAnswerIds)
                ->get()
                ->groupBy('session_area_id');

            $whatsappService = app(SelfAssessmentWhatsappNotificationService::class);
            foreach ($submittedAnswers as $answers) {
                $whatsappService->notifySelfAssessmentSubmitted($answers);
            }
        }

        return $this->respondData(['saved' => $saved]);
    }

    /**
     * @param array<int, array<string, mixed>> $items
     * @return array<int, string>
     */
    private function findMissingEvidenceQuestionCodes(array $items, string $userId): array
    {
        $requiredPairs = collect($items)
            ->filter(fn (array $item) => (bool) ($item['submit'] ?? true))
            ->map(function (array $item) {
                return [
                    'session_area_id' => (string) $item['sessionAreaId'],
                    'question_code' => (string) $item['questionCode'],
                    'pair_key' => (string) $item['sessionAreaId'].'::'.(string) $item['questionCode'],
                ];
            })
            ->unique('pair_key')
            ->values();

        if ($requiredPairs->isEmpty()) {
            return [];
        }

        $evidenceQuery = SelfAssessmentEvidence::query()
            ->where('user_id', $userId)
            ->where(function ($query) use ($requiredPairs) {
                foreach ($requiredPairs as $pair) {
                    $query->orWhere(function ($inner) use ($pair) {
                        $inner->where('session_area_id', $pair['session_area_id'])
                            ->where('question_code', $pair['question_code']);
                    });
                }
            });

        $existingPairKeys = $evidenceQuery
            ->get(['session_area_id', 'question_code'])
            ->map(fn (SelfAssessmentEvidence $item) => $item->session_area_id.'::'.$item->question_code)
            ->unique()
            ->values()
            ->all();

        $existingLookup = array_fill_keys($existingPairKeys, true);

        return $requiredPairs
            ->filter(fn (array $pair) => !isset($existingLookup[$pair['pair_key']]))
            ->map(fn (array $pair) => $pair['question_code'])
            ->unique()
            ->values()
            ->all();
    }
}
