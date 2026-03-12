<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;

class GuideManualController extends ApiController
{
    public function userManualUrl(Request $request)
    {
        return $this->respondData([
            'url' => URL::temporarySignedRoute(
                'guide.manual.signed',
                now()->addMinutes(30),
                ['type' => 'user'],
                absolute: false
            ),
        ]);
    }

    public function adminManualUrl(Request $request)
    {
        return $this->respondData([
            'url' => URL::temporarySignedRoute(
                'guide.manual.signed',
                now()->addMinutes(30),
                ['type' => 'admin'],
                absolute: false
            ),
        ]);
    }

    public function questionTemplateUrl(Request $request)
    {
        return $this->respondData([
            'url' => URL::temporarySignedRoute(
                'guide.template.signed',
                now()->addMinutes(30),
                ['type' => 'question'],
                absolute: false
            ),
        ]);
    }

    public function downloadSigned(Request $request, string $type)
    {
        $manual = $this->resolveManual($type);
        if (!$manual) {
            return response()->json(['error' => 'Manual tidak ditemukan.'], 404);
        }

        if (!is_file($manual['path'])) {
            return response()->json(['error' => 'File manual tidak ditemukan.'], 404);
        }

        return response()->download($manual['path'], $manual['name']);
    }

    public function downloadTemplateSigned(Request $request, string $type)
    {
        $template = $this->resolveTemplate($type);
        if (!$template) {
            return response()->json(['error' => 'Template tidak ditemukan.'], 404);
        }

        if (!is_file($template['path'])) {
            return response()->json(['error' => 'File template tidak ditemukan.'], 404);
        }

        return response()->download($template['path'], $template['name']);
    }

    private function resolveManual(string $type): ?array
    {
        $normalized = strtolower(trim($type));

        return match ($normalized) {
            'user' => [
                'path' => resource_path('manual/guide/User Guide.pdf'),
                'name' => 'User Guide.pdf',
            ],
            'admin' => [
                'path' => resource_path('manual/guide/Admin Guide.pdf'),
                'name' => 'Admin Guide.pdf',
            ],
            default => null,
        };
    }

    private function resolveTemplate(string $type): ?array
    {
        $normalized = strtolower(trim($type));

        return match ($normalized) {
            'question' => [
                'path' => resource_path('manual/template_pertanyaan/template.csv'),
                'name' => 'template.csv',
            ],
            default => null,
        };
    }
}
