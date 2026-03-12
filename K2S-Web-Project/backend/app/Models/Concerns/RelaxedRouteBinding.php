<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Model;

trait RelaxedRouteBinding
{
    public function resolveRouteBinding($value, $field = null): ?Model
    {
        $key = $field ?? $this->getRouteKeyName();
        return $this->where($key, $value)->first();
    }
}
