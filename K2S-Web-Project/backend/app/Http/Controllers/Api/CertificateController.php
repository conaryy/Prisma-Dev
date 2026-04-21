<?php

namespace App\Http\Controllers\Api;

use App\Models\Certificate;
use App\Models\Instansi;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class CertificateController extends ApiController
{
    private function resolveInstansiId(Request $request, bool $createIfMissing = false): ?string
    {
        $userId = $request->user()->id;

        $instansi = Instansi::query()
            ->where('user_id', $userId)
            ->first();

        if ($instansi) {
            return $instansi->id;
        }

        $orphan = Instansi::query()
            ->whereNull('user_id')
            ->first();

        if ($orphan) {
            $orphan->user_id = $userId;
            $orphan->save();

            return $orphan->id;
        }

        if (!$createIfMissing) {
            return null;
        }

        return Instansi::create([
            'user_id' => $userId,
            'facility_group' => 'Pelayanan Navigasi Penerbangan',
            'kobu' => 'KANTOR OTORITAS BANDAR UDARA WILAYAH III',
            'bandara' => 'JUANDA',
            'cabang_airnav' => 'PERUM LPPNPI CABANG SURABAYA',
            'name' => 'Perum LPPNPI Cabang Surabaya',
            'alias' => 'Surabaya',
            'address' => '',
            'contact_name' => '',
            'contact_email' => '',
            'contact_phone' => '',
            'fax' => '',
            'postal_code' => '',
            'longitude' => '',
            'latitude' => '',
            'service_area' => '',
            'operating_hours' => '',
            'traffic_type' => '',
            'runway_capacity' => '',
            'runway_condition' => '',
            'location' => '',
        ])->id;
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $limit = (int) $request->query('limit', 20);
        $instansiId = $this->resolveInstansiId($request);
        if (!$instansiId) {
            return $this->respondPaginated(Certificate::query()->whereRaw('1 = 0')->paginate($limit));
        }
        $items = Certificate::query()
            ->where('instansi_id', $instansiId)
            ->paginate($limit);
        return $this->respondPaginated($items);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required'],
            'type' => ['required'],
            'number' => ['required'],
            'validUntil' => ['required', 'date'],
            'status' => ['required', 'in:Berlaku,Tidak Berlaku'],
            'evidenceType' => ['sometimes', 'in:Sertifikat Evidence,Sertifikat Non Evidence'],
            'file' => ['nullable', 'file', 'mimes:pdf,png,jpg,jpeg', 'max:10240'],
        ]);

        $payload = $this->normalize($validated);
        $instansiId = $this->resolveInstansiId($request, true);
        $payload['instansi_id'] = $instansiId;
        if (!empty($validated['file'])) {
            $path = $validated['file']->store('certificates', 'public');
            $payload['file_name'] = $validated['file']->getClientOriginalName();
            $payload['file_url'] = Storage::disk('public')->url($path);
        }
        $item = Certificate::create($payload);

        return $this->respondData($item, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Certificate $certificate)
    {
        $instansiId = Instansi::query()
            ->where('user_id', request()->user()->id)
            ->value('id');
        if ($instansiId && $certificate->instansi_id !== $instansiId) {
            return response()->json(['error' => 'Forbidden.'], 403);
        }
        return $this->respondData($certificate);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Certificate $certificate)
    {
        $instansiId = Instansi::query()
            ->where('user_id', $request->user()->id)
            ->value('id');
        if ($instansiId && $certificate->instansi_id !== $instansiId) {
            return response()->json(['error' => 'Forbidden.'], 403);
        }
        $validated = $request->validate([
            'name' => ['sometimes'],
            'type' => ['sometimes'],
            'number' => ['sometimes'],
            'validUntil' => ['sometimes', 'date'],
            'status' => ['sometimes', 'in:Berlaku,Tidak Berlaku'],
            'evidenceType' => ['sometimes', 'in:Sertifikat Evidence,Sertifikat Non Evidence'],
            'file' => ['nullable', 'file', 'mimes:pdf,png,jpg,jpeg', 'max:10240'],
        ]);

        $payload = $this->normalize($validated);
        if (!empty($validated['file'])) {
            $this->deleteFileIfExists($certificate->file_url);
            $path = $validated['file']->store('certificates', 'public');
            $payload['file_name'] = $validated['file']->getClientOriginalName();
            $payload['file_url'] = Storage::disk('public')->url($path);
        }
        $certificate->fill($payload)->save();

        return $this->respondData($certificate);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Certificate $certificate)
    {
        $instansiId = Instansi::query()
            ->where('user_id', request()->user()->id)
            ->value('id');
        if ($instansiId && $certificate->instansi_id !== $instansiId) {
            return response()->json(['error' => 'Forbidden.'], 403);
        }
        $this->deleteFileIfExists($certificate->file_url);
        $certificate->delete();
        return $this->respondData(['success' => true]);
    }

    private function deleteFileIfExists(?string $url): void
    {
        if (!$url) {
            return;
        }
        $path = str_replace(Storage::disk('public')->url(''), '', $url);
        $path = ltrim($path, '/');
        if ($path && Storage::disk('public')->exists($path)) {
            Storage::disk('public')->delete($path);
        }
    }
}
