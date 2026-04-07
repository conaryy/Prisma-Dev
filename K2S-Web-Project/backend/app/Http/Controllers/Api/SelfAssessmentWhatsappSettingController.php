<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use App\Services\Whatsapp\SelfAssessmentWhatsappNotificationService;
use Illuminate\Http\Request;

class SelfAssessmentWhatsappSettingController extends ApiController
{
    public function __construct(
        private readonly SelfAssessmentWhatsappNotificationService $service
    ) {
    }

    public function show()
    {
        return $this->respondData([
            'panels' => $this->service->getPanelSettings(),
            'previews' => $this->service->getPreviewTemplates(),
            'userRecipients' => $this->service->getUserNotificationRecipients(),
            'users' => User::query()
                ->where('role', '!=', 'Admin')
                ->orderBy('name')
                ->get(['id', 'name', 'username', 'email', 'phone'])
                ->map(fn (User $user) => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'username' => $user->username,
                    'email' => $user->email,
                    'phone' => $user->phone,
                ])
                ->values()
                ->all(),
        ]);
    }

    public function update(Request $request)
    {
        $panelKeys = array_keys(SelfAssessmentWhatsappNotificationService::panelDefinitions());

        $validated = $request->validate([
            'panels' => ['required', 'array'],
            'panels.*.key' => ['required', 'string', 'in:'.implode(',', $panelKeys)],
            'panels.*.enabled' => ['nullable', 'boolean'],
            'panels.*.phoneNumbers' => ['nullable', 'array'],
            'panels.*.phoneNumbers.*' => ['string', 'regex:/^628\\d{7,15}$/'],
            'userRecipients' => ['nullable', 'array'],
            'userRecipients.*.id' => ['nullable', 'string'],
            'userRecipients.*.phoneNumber' => ['required', 'string', 'regex:/^628\\d{7,15}$/'],
            'userRecipients.*.userIds' => ['nullable', 'array'],
            'userRecipients.*.userIds.*' => ['string', 'exists:users,id'],
        ]);

        return $this->respondData([
            'panels' => $this->service->updatePanelSettings($validated['panels']),
            'previews' => $this->service->getPreviewTemplates(),
            'userRecipients' => $this->service->updateUserNotificationRecipients($validated['userRecipients'] ?? []),
            'users' => User::query()
                ->where('role', '!=', 'Admin')
                ->orderBy('name')
                ->get(['id', 'name', 'username', 'email', 'phone'])
                ->map(fn (User $user) => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'username' => $user->username,
                    'email' => $user->email,
                    'phone' => $user->phone,
                ])
                ->values()
                ->all(),
        ]);
    }
}
