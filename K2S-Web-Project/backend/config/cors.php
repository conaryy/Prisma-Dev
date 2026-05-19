<?php

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    // Comma-separated in env: e.g. https://app.example.com,https://admin.example.com
    'allowed_origins' => array_filter(array_map('trim', explode(',', (string) env('CORS_ALLOW_ORIGINS', '*')))),

    'allowed_origins_patterns' => [],

    // Allow Authorization for bearer token
    'allowed_headers' => ['Content-Type', 'X-Requested-With', 'Authorization', 'Accept', 'Origin'],

    'exposed_headers' => [],

    'max_age' => 3600,

    'supports_credentials' => false,

];
