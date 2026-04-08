<?php

namespace App\Http\Controllers\Api;

use App\Models\ExternalDnpCap;
use App\Models\ExternalDnpQuestion;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PhpOffice\PhpWord\IOFactory;
use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\Settings;
use PhpOffice\PhpWord\SimpleType\Jc;
use PhpOffice\PhpWord\SimpleType\JcTable;
use PhpOffice\PhpWord\SimpleType\VerticalJc;

class ExternalDnpExportDocumentController extends ApiController
{
    public function items(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['required', 'in:audit,inspeksi,surveillance'],
        ]);

        return $this->respondData(
            $this->queryExportItems($validated['scope'])->values()->all()
        );
    }

    public function generate(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['required', 'in:audit,inspeksi,surveillance'],
            'itemIds' => ['required', 'array', 'min:1'],
            'itemIds.*' => ['required', 'string', 'max:255'],
        ]);

        $userId = (string) optional($request->user())->id;
        if ($userId === '') {
            return response()->json(['error' => 'User tidak valid.'], 401);
        }

        $availableItems = $this->queryExportItems($validated['scope']);
        $selectedIds = collect($validated['itemIds'])
            ->map(fn ($id) => trim((string) $id))
            ->filter()
            ->unique()
            ->values();

        $selectedItems = $availableItems
            ->filter(function (array $item) use ($selectedIds) {
                return $selectedIds->contains((string) ($item['id'] ?? ''))
                    || $selectedIds->contains((string) ($item['sessionAreaId'] ?? ''));
            })
            ->values();

        if ($selectedItems->isEmpty()) {
            return response()->json([
                'error' => 'Data yang dipilih tidak tersedia atau sudah berubah.',
            ], 422);
        }

        $path = $this->exportPath($userId, $validated['scope']);
        $this->storeDocument($path, $validated['scope'], $selectedItems->values());

        return $this->respondData([
            'generated' => true,
            'scope' => $validated['scope'],
            'filename' => $this->downloadFilename($validated['scope']),
            'totalItems' => $selectedItems->count(),
            'generatedAt' => now()->toDateTimeString(),
            'downloadUrl' => '/api/external-dnp/export-document/download?scope='.$validated['scope'],
        ]);
    }

    public function download(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['required', 'in:audit,inspeksi,surveillance'],
        ]);

        $userId = (string) optional($request->user())->id;
        if ($userId === '') {
            return response()->json(['error' => 'User tidak valid.'], 401);
        }

        $path = $this->exportPath($userId, $validated['scope']);
        if (!Storage::disk('local')->exists($path)) {
            return response()->json([
                'error' => 'Dokumen belum digenerate untuk scope ini.',
            ], 404);
        }

        return response()->download(
            Storage::disk('local')->path($path),
            $this->downloadFilename($validated['scope']),
            ['Content-Type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
        );
    }

    private function queryExportItems(string $scope): Collection
    {
        $caps = ExternalDnpCap::query()
            ->whereHas('answer.sessionArea.session', function ($query) use ($scope) {
                $query->where('scope', $scope);
            })
            ->whereHas('answer.review', function ($query) {
                $query->where('status', 'Not Satisfactory')
                    ->whereNotNull('sent_at');
            })
            ->whereHas('fulfillments')
            ->with([
                'answer.review',
                'answer.sessionArea.session',
                'fulfillments',
            ])
            ->get();

        if ($caps->isEmpty()) {
            return collect();
        }

        $questions = ExternalDnpQuestion::query()
            ->where('scope', $scope)
            ->whereIn('code', $caps->pluck('answer.question_code')->filter()->unique()->values())
            ->get()
            ->keyBy('code');

        return $caps
            ->map(function (ExternalDnpCap $cap) use ($questions, $scope) {
                $answer = $cap->answer;
                $sessionArea = $answer?->sessionArea;
                $session = $sessionArea?->session;
                $review = $answer?->review;

                if (!$answer || !$sessionArea || !$session) {
                    return null;
                }

                $latestFulfillment = $cap->fulfillments
                    ->sortByDesc(function ($fulfillment) {
                        $completeDate = optional($fulfillment->complete_date)?->timestamp ?? 0;
                        $createdAt = optional($fulfillment->created_at)?->timestamp ?? 0;

                        return sprintf('%010d-%010d-%05d', $completeDate, $createdAt, (int) $fulfillment->step);
                    })
                    ->first();

                if (!$latestFulfillment) {
                    return null;
                }

                $question = $questions->get($answer->question_code);
                $temuan = trim((string) (
                    $review?->finding
                    ?: $review?->description
                    ?: $review?->resume
                    ?: $cap->action_plan
                    ?: ''
                ));

                return [
                    'id' => (string) $cap->id,
                    'sessionAreaId' => (string) $sessionArea->id,
                    'scope' => $scope,
                    'scopeLabel' => Str::title($scope),
                    'instansiName' => (string) ($session->instansi_name ?? '-'),
                    'area' => (string) ($sessionArea->category ?? '-'),
                    'schedule' => $this->formatSchedule($session->start_date, $session->end_date),
                    'scheduleSort' => optional($session->start_date)->format('Y-m-d') ?? '9999-12-31',
                    'leader' => (string) ($session->team_leader ?? '-'),
                    'members' => array_values(array_filter($session->team_members ?? [], fn ($value) => is_string($value) && trim($value) !== '')),
                    'audity' => array_values(array_filter($session->team_audity ?? [], fn ($value) => is_string($value) && trim($value) !== '')),
                    'pqNumber' => (string) ($answer->question_code ?? '-'),
                    'reference' => trim((string) ($question?->reference ?? '')),
                    'temuan' => $temuan,
                    'recommendations' => trim((string) ($review?->recommendations ?? '')),
                    'actionPlan' => trim((string) ($cap->action_plan ?? '')),
                    'actionOffice' => trim((string) ($latestFulfillment->action_office ?? '')),
                    'progress' => (int) ($latestFulfillment->progress ?? 0),
                ];
            })
            ->filter()
            ->sortBy([
                ['scheduleSort', 'asc'],
                ['scope', 'asc'],
                ['instansiName', 'asc'],
                ['pqNumber', 'asc'],
            ])
            ->values();
    }

    private function storeDocument(string $path, string $scope, Collection $items): void
    {
        $disk = Storage::disk('local');
        $disk->makeDirectory(dirname($path));

        $absolutePath = $disk->path($path);
        if (is_file($absolutePath)) {
            @unlink($absolutePath);
        }

        $phpWord = new PhpWord();
        $phpWord->setDefaultFontName('Times New Roman');
        $phpWord->setDefaultFontSize(11);
        $phpWord->setDefaultParagraphStyle([
            'spaceAfter' => 0,
            'lineHeight' => 1.0,
        ]);

        $phpWord->addTitleStyle(1, ['bold' => true, 'size' => 22], ['alignment' => Jc::CENTER, 'spaceAfter' => 240]);

        $section = $phpWord->addSection([
            'orientation' => 'landscape',
            'marginTop' => 720,
            'marginBottom' => 720,
            'marginLeft' => 720,
            'marginRight' => 720,
        ]);

        $section->addTitle('DNP Findings Document', 1);

        $sectionTitleStyle = [
            'bold' => true,
            'size' => 16,
        ];
        $sectionTitleParagraph = [
            'alignment' => Jc::CENTER,
            'spaceAfter' => 120,
            'lineHeight' => 1.0,
        ];
        $sectionScopeStyle = [
            'bold' => true,
            'size' => 14,
        ];
        $sectionScopeParagraph = [
            'alignment' => Jc::CENTER,
            'spaceAfter' => 220,
            'lineHeight' => 1.0,
        ];
        $scheduleParagraph = [
            'spaceAfter' => 140,
            'lineHeight' => 1.0,
        ];

        $tableStyle = [
            'alignment' => JcTable::CENTER,
            'borderSize' => 6,
            'borderColor' => 'B7C0CC',
            'cellMarginTop' => 30,
            'cellMarginBottom' => 30,
            'cellMarginLeft' => 40,
            'cellMarginRight' => 40,
        ];
        $headerCellStyle = [
            'bgColor' => 'E5E7EB',
            'valign' => VerticalJc::CENTER,
        ];
        $headerTextStyle = [
            'bold' => true,
            'size' => 11,
        ];
        $headerParagraphStyle = [
            'alignment' => Jc::START,
            'spaceAfter' => 0,
            'lineHeight' => 1.0,
        ];
        $bodyTextStyle = [
            'size' => 11,
        ];
        $bodyParagraphStyle = [
            'spaceAfter' => 0,
            'lineHeight' => 1.0,
        ];
        $centerParagraphStyle = [
            'alignment' => Jc::CENTER,
            'spaceAfter' => 0,
            'lineHeight' => 1.0,
        ];
        $areaRowStyle = [
            'gridSpan' => 6,
            'bgColor' => 'F8FAFC',
            'valign' => VerticalJc::CENTER,
        ];

        $sections = $items
            ->sortBy([
                ['instansiName', 'asc'],
                ['scheduleSort', 'asc'],
                ['scope', 'asc'],
                ['pqNumber', 'asc'],
            ])
            ->groupBy('instansiName')
            ->values();

        foreach ($sections as $sectionIndex => $group) {
            $instansiName = (string) ($group->first()['instansiName'] ?? '-');
            $scheduleInfo = $group->pluck('schedule')
                ->filter(fn ($value) => is_string($value) && trim($value) !== '')
                ->unique()
                ->values()
                ->implode(', ');

            $section->addText($this->normalizeExportText($instansiName), $sectionTitleStyle, $sectionTitleParagraph);
            $section->addText(Str::title($scope), $sectionScopeStyle, $sectionScopeParagraph);
            $section->addText('Schedule : '.$this->normalizeExportText($scheduleInfo), null, $scheduleParagraph);

            $table = $section->addTable($tableStyle);
            $table->addRow(500);
            $this->addCellText($table, 800, 'No', $headerCellStyle, $headerTextStyle, $headerParagraphStyle);
            $this->addCellText($table, 1200, 'PQ Number', $headerCellStyle, $headerTextStyle, $headerParagraphStyle);
            $this->addCellText($table, 4200, 'Finding', $headerCellStyle, $headerTextStyle, $headerParagraphStyle);
            $this->addCellText($table, 4200, 'Recommendation', $headerCellStyle, $headerTextStyle, $headerParagraphStyle);
            $this->addCellText($table, 2700, 'Action Office', $headerCellStyle, $headerTextStyle, $headerParagraphStyle);
            $this->addCellText($table, 1100, 'Progress', $headerCellStyle, $headerTextStyle, $centerParagraphStyle);

            foreach ($group
                ->groupBy(fn (array $item) => (string) ($item['area'] ?? '-'))
                ->values() as $areaItems) {
                $areaName = (string) ($areaItems->first()['area'] ?? '-');

                $table->addRow(350);
                $areaCell = $table->addCell(14100, $areaRowStyle);
                $areaCell->addText('Area : '.$this->normalizeExportText($areaName), ['bold' => true, 'size' => 11], $bodyParagraphStyle);

                foreach ($areaItems->values() as $index => $item) {
                    $table->addRow();
                    $this->addCellText($table, 800, (string) ($index + 1), ['valign' => VerticalJc::CENTER], $bodyTextStyle, $centerParagraphStyle);
                    $this->addCellMultilineText($table, 1200, (string) ($item['pqNumber'] ?? '-'), ['valign' => VerticalJc::CENTER], $bodyTextStyle, $centerParagraphStyle);
                    $this->addCellMultilineText($table, 4200, $this->normalizeExportText((string) ($item['temuan'] ?? '-')), ['valign' => VerticalJc::TOP], $bodyTextStyle, $bodyParagraphStyle);
                    $this->addCellMultilineText($table, 4200, $this->normalizeExportText((string) ($item['recommendations'] ?? '-')), ['valign' => VerticalJc::TOP], $bodyTextStyle, $bodyParagraphStyle);
                    $this->addCellMultilineText($table, 2700, $this->normalizeExportText((string) ($item['actionOffice'] ?? '-')), ['valign' => VerticalJc::TOP], $bodyTextStyle, $bodyParagraphStyle);
                    $this->addCellText($table, 1100, ((string) ($item['progress'] ?? 0)).'%', ['valign' => VerticalJc::CENTER], $bodyTextStyle, $centerParagraphStyle);
                }
            }

            if ($sectionIndex < $sections->count() - 1) {
                $section->addTextBreak(2);
            }
        }

        $previousOutputEscaping = Settings::isOutputEscapingEnabled();
        Settings::setOutputEscapingEnabled(true);

        try {
            IOFactory::createWriter($phpWord, 'Word2007')->save($absolutePath);
        } finally {
            Settings::setOutputEscapingEnabled($previousOutputEscaping);
        }
    }

    private function addCellText($table, int $width, string $text, array $cellStyle, array $fontStyle, array $paragraphStyle): void
    {
        $table->addCell($width, $cellStyle)->addText($this->normalizeExportText($text), $fontStyle, $paragraphStyle);
    }

    private function addCellMultilineText($table, int $width, string $text, array $cellStyle, array $fontStyle, array $paragraphStyle): void
    {
        $cell = $table->addCell($width, $cellStyle);
        $lines = preg_split("/\r\n|\n|\r/", $this->normalizeExportText($text)) ?: ['-'];

        foreach ($lines as $line) {
            $cell->addText($line !== '' ? $line : ' ', $fontStyle, $paragraphStyle);
        }
    }

    private function normalizeExportText(string $text): string
    {
        $normalized = $this->removeInvalidXmlCharacters($text);
        $normalized = preg_replace("/\r\n|\r/u", "\n", trim($normalized)) ?? '';
        $normalized = preg_replace("/[ \t]+/u", ' ', $normalized) ?? '';

        return $normalized !== '' ? $normalized : '-';
    }

    private function removeInvalidXmlCharacters(string $text): string
    {
        $withoutControlCharacters = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $text) ?? '';

        return preg_replace('/[^\x09\x0A\x0D\x20-\x{D7FF}\x{E000}-\x{FFFD}]/u', '', $withoutControlCharacters) ?? '';
    }

    private function formatSchedule(mixed $startDate, mixed $endDate): string
    {
        $start = optional($startDate)->format('Y-m-d');
        $end = optional($endDate)->format('Y-m-d');

        if ($start && $end) {
            return $start.' - '.$end;
        }

        return $start ?: $end ?: '-';
    }

    private function exportPath(string $userId, string $scope): string
    {
        return 'external-dnp-exports/'.$userId.'/'.$scope.'.docx';
    }

    private function downloadFilename(string $scope): string
    {
        return 'external-dnp-export-'.Str::slug($scope).'.docx';
    }
}
