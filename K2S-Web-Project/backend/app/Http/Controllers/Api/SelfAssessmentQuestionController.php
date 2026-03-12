<?php

namespace App\Http\Controllers\Api;

use App\Models\SelfAssessmentQuestion;
use App\Models\SelfAssessmentQuestionCategory;
use App\Models\SelfAssessmentSessionArea;
use App\Models\SelfAssessmentSessionQuestionCategoryUser;
use Illuminate\Http\Request;

class SelfAssessmentQuestionController extends ApiController
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['required', 'in:audit,monitoring,inspeksi,surveillance'],
            'category' => ['nullable'],
            'sessionId' => ['nullable', 'uuid', 'exists:self_assessment_sessions,id'],
            'sessionAreaId' => ['nullable', 'uuid', 'exists:self_assessment_session_areas,id'],
        ]);

        $items = SelfAssessmentQuestion::query()
            ->when($validated['scope'] ?? null, function ($query, $scope) {
                $query->where('scope', $scope);
            })
            ->when($validated['category'] ?? null, function ($query, $category) {
                $query->where('category', $category);
            })
            ->where('is_active', true)
            ->orderBy('question_category_prefix')
            ->orderBy('sort_order')
            ->get();

        $questionCategories = SelfAssessmentQuestionCategory::query()
            ->where('scope', $validated['scope'])
            ->get(['id', 'name', 'prefix']);

        $sessionId = $validated['sessionId'] ?? null;
        if (!$sessionId && !empty($validated['sessionAreaId'])) {
            $sessionId = SelfAssessmentSessionArea::query()
                ->where('id', $validated['sessionAreaId'])
                ->value('session_id');
        }

        if ($sessionId && $questionCategories->isNotEmpty()) {
            $assignments = SelfAssessmentSessionQuestionCategoryUser::query()
                ->where('session_id', $sessionId)
                ->get(['question_category_id', 'user_id']);

            if ($assignments->isNotEmpty()) {
                $categoryKeyById = $questionCategories->mapWithKeys(function ($category) {
                    return [$category->id => $category->prefix.'|'.$category->name];
                });

                $userId = $request->user()->id;
                $allowedKeys = [];
                $assignedCategoryIds = $assignments
                    ->where('user_id', $userId)
                    ->pluck('question_category_id')
                    ->unique();

                foreach ($assignedCategoryIds as $categoryId) {
                    $key = $categoryKeyById[$categoryId] ?? null;
                    if ($key) {
                        $allowedKeys[$key] = true;
                    }
                }

                $items = $items->filter(function ($item) use ($allowedKeys) {
                    if (empty($allowedKeys)) {
                        return false;
                    }
                    $prefix = $item->question_category_prefix;
                    $name = $item->question_category;
                    if (!$prefix || !$name) {
                        return false;
                    }
                    $key = $prefix.'|'.$name;
                    return isset($allowedKeys[$key]);
                })->values();
            }
        }

        return $this->respondData($items);
    }

    public function adminIndex(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['nullable', 'in:audit,monitoring,inspeksi,surveillance'],
            'category' => ['nullable'],
        ]);

        $items = SelfAssessmentQuestion::query()
            ->when($validated['scope'] ?? null, function ($query, $scope) {
                $query->where('scope', $scope);
            })
            ->when($validated['category'] ?? null, function ($query, $category) {
                $query->where('category', $category);
            })
            ->orderBy('scope')
            ->orderBy('category')
            ->orderBy('question_category_prefix')
            ->orderBy('sort_order')
            ->get();

        return $this->respondData($items);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['required', 'in:audit,monitoring,inspeksi,surveillance'],
            'category' => ['nullable'],
            'questionCategoryId' => ['required'],
            'text' => ['required'],
            'reference' => ['nullable'],
            'isActive' => ['nullable', 'boolean'],
        ]);

        $questionCategory = SelfAssessmentQuestionCategory::query()->find($validated['questionCategoryId']);
        if (!$questionCategory) {
            return response()->json(['error' => 'Question category not found.'], 404);
        }

        $prefix = $questionCategory->prefix;
        $lastNumber = SelfAssessmentQuestion::query()
            ->where('scope', $validated['scope'])
            ->when($validated['category'] ?? null, function ($query, $category) {
                $query->where('category', $category);
            })
            ->where('question_category_prefix', $prefix)
            ->max('sort_order');
        $nextNumber = (int) $lastNumber + 1;

        $payload = $this->normalize($validated, [
            'isActive' => 'is_active',
        ]);
        $payload['question_category'] = $questionCategory->name;
        $payload['question_category_prefix'] = $prefix;
        $payload['sort_order'] = $nextNumber;
        $payload['code'] = $prefix . '.' . $nextNumber;

        $item = SelfAssessmentQuestion::create($payload);

        return $this->respondData($item, 201);
    }

    public function update(Request $request, SelfAssessmentQuestion $question)
    {
        $validated = $request->validate([
            'scope' => ['sometimes', 'in:audit,monitoring,inspeksi,surveillance'],
            'category' => ['nullable'],
            'questionCategoryId' => ['nullable'],
            'text' => ['sometimes'],
            'reference' => ['nullable'],
            'isActive' => ['nullable', 'boolean'],
        ]);

        $payload = $this->normalize($validated, [
            'isActive' => 'is_active',
        ]);

        if (!empty($validated['questionCategoryId'])) {
            $questionCategory = SelfAssessmentQuestionCategory::query()->find($validated['questionCategoryId']);
            if ($questionCategory) {
                $nextScope = $validated['scope'] ?? $question->scope;
                $nextCategory = $validated['category'] ?? $question->category;
                $prefix = $questionCategory->prefix;
                $lastNumber = SelfAssessmentQuestion::query()
                    ->where('scope', $question->scope)
                    ->when($question->category, function ($query, $category) {
                        $query->where('category', $category);
                    })
                    ->where('question_category_prefix', $prefix)
                    ->max('sort_order');
                $nextNumber = (int) $lastNumber + 1;
                $payload['question_category'] = $questionCategory->name;
                $payload['question_category_prefix'] = $prefix;
                $payload['sort_order'] = $nextNumber;
                $payload['code'] = $prefix . '.' . $nextNumber;
            }
        }

        $question->fill($payload)->save();

        return $this->respondData($question);
    }

    public function destroy(SelfAssessmentQuestion $question)
    {
        $question->delete();
        return $this->respondData(['success' => true]);
    }

    public function adminDestroyAll(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['required', 'in:audit,monitoring,inspeksi,surveillance'],
            'category' => ['required'],
        ]);

        $deleted = SelfAssessmentQuestion::query()
            ->where('scope', $validated['scope'])
            ->where('category', $validated['category'])
            ->delete();

        return $this->respondData(['deleted' => $deleted]);
    }

    public function import(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['required', 'in:audit,monitoring,inspeksi,surveillance'],
            'category' => ['required'],
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:10240'],
        ]);

        $file = $request->file('file');
        $handle = fopen($file->getRealPath(), 'r');
        if (!$handle) {
            return response()->json(['error' => 'File tidak bisa dibaca.'], 422);
        }

        $firstLine = fgets($handle);
        if ($firstLine === false) {
            fclose($handle);
            return response()->json(['error' => 'File kosong.'], 422);
        }
        $commaCount = substr_count($firstLine, ',');
        $semiCount = substr_count($firstLine, ';');
        $delimiter = $semiCount > $commaCount ? ';' : ',';
        rewind($handle);

        $header = fgetcsv($handle, 0, $delimiter);
        if (!$header) {
            fclose($handle);
            return response()->json(['error' => 'Header CSV tidak ditemukan.'], 422);
        }

        $normalizedHeader = array_map(function ($value) {
            return strtolower(trim($value));
        }, $header);

        $requiredColumns = ['kategori', 'prefix', 'pertanyaan'];
        foreach ($requiredColumns as $column) {
            if (!in_array($column, $normalizedHeader, true)) {
                fclose($handle);
                return response()->json(['error' => "Kolom CSV wajib: {$column}."], 422);
            }
        }

        $indexMap = array_flip($normalizedHeader);
        $created = 0;
        $errors = [];
        $maxRows = 2000;
        $rowNumber = 1;

        $categoryCache = [];
        $lastNumberCache = [];

        while (($row = fgetcsv($handle, 0, $delimiter)) !== false) {
            $rowNumber++;
            if ($rowNumber > $maxRows + 1) {
                $errors[] = ['row' => $rowNumber, 'message' => 'Batas maksimum baris terlampaui.'];
                break;
            }

            $kategori = $this->sanitizeCsvValue($row[$indexMap['kategori']] ?? '');
            $prefix = strtoupper($this->sanitizeCsvValue($row[$indexMap['prefix']] ?? ''));
            $pertanyaan = $this->sanitizeCsvValue($row[$indexMap['pertanyaan']] ?? '');
            $deskripsi = $this->sanitizeCsvValue($row[$indexMap['deskripsi']] ?? '');

            if ($kategori === '' || $prefix === '' || $pertanyaan === '') {
                $errors[] = [
                    'row' => $rowNumber,
                    'message' => 'Kolom kategori, prefix, dan pertanyaan wajib diisi.',
                ];
                continue;
            }

            try {
                $categoryKey = $validated['scope'].'|'.$kategori.'|'.$prefix;
                if (!isset($categoryCache[$categoryKey])) {
                    $questionCategory = SelfAssessmentQuestionCategory::query()
                        ->where('scope', $validated['scope'])
                        ->where('name', $kategori)
                        ->where('prefix', $prefix)
                        ->first();

                    if (!$questionCategory) {
                        $questionCategory = SelfAssessmentQuestionCategory::create([
                            'scope' => $validated['scope'],
                            'name' => $kategori,
                            'prefix' => $prefix,
                            'is_active' => true,
                            'sort_order' => 0,
                        ]);
                    }

                    $categoryCache[$categoryKey] = $questionCategory;
                }

                $numberKey = $validated['scope'].'|'.$validated['category'].'|'.$prefix;
                if (!isset($lastNumberCache[$numberKey])) {
                    $lastNumberCache[$numberKey] = (int) SelfAssessmentQuestion::query()
                        ->where('scope', $validated['scope'])
                        ->where('category', $validated['category'])
                        ->where('question_category_prefix', $prefix)
                        ->max('sort_order');
                }

                $lastNumberCache[$numberKey]++;
                $nextNumber = $lastNumberCache[$numberKey];

                SelfAssessmentQuestion::create([
                    'scope' => $validated['scope'],
                    'category' => $validated['category'],
                    'question_category' => $kategori,
                    'question_category_prefix' => $prefix,
                    'code' => $prefix.'.'.$nextNumber,
                    'text' => $pertanyaan,
                    'reference' => $deskripsi !== '' ? $deskripsi : null,
                    'is_active' => true,
                    'sort_order' => $nextNumber,
                ]);

                $created++;
            } catch (\Throwable $exception) {
                $errors[] = [
                    'row' => $rowNumber,
                    'message' => $exception->getMessage(),
                ];
            }
        }

        fclose($handle);

        return $this->respondData([
            'created' => $created,
            'errors' => $errors,
        ]);
    }

    private function sanitizeCsvValue(string $value): string
    {
        $value = trim($value);
        $value = strip_tags($value);
        $value = preg_replace('/\s+/', ' ', $value);
        return $value ?? '';
    }
}
