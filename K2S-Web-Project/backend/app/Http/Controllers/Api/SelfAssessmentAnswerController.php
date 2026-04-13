<?php

namespace App\Http\Controllers\Api;

use App\Models\SelfAssessmentAnswer;
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

    public function adminStoreBulk(Request $request)
    {
        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.answerId' => ['required', 'uuid'],
            'items.*.status' => ['required', 'string'],
            'items.*.comment' => ['nullable', 'string'],
            'items.*.evidenceNote' => ['nullable', 'string'],
        ]);

        $saved = [];
        foreach ($validated['items'] as $item) {
            $answer = SelfAssessmentAnswer::query()
                ->with('review')
                ->find($item['answerId']);

            if (!$answer) {
                return response()->json(['error' => 'Jawaban tidak ditemukan.'], 404);
            }

            if ($answer->review && $answer->review->is_final) {
                return response()->json([
                    'error' => 'Jawaban sudah difinalisasi dan tidak bisa diubah.',
                ], 403);
            }

            $answer->status = $item['status'];
            $answer->comment = $item['comment'] ?? null;
            $answer->evidence_note = $item['evidenceNote'] ?? null;
            $answer->save();

            $saved[] = $answer->id;
        }

        return $this->respondData(['saved' => $saved]);
    }
}
