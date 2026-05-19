<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Authentication Mode
    |--------------------------------------------------------------------------
    |
    | local  : only Sanctum/local credentials
    | hybrid : accept Sanctum first, fallback to OIDC bearer token
    | sso    : only OIDC bearer token
    |
    */
    'mode' => env('AUTH_MODE', 'local'),

    'issuer' => env('SSO_ISSUER'),
    'audience' => env('SSO_AUDIENCE'),
    'jwks_url' => env('SSO_JWKS_URL'),
    'authorize_url' => env('SSO_AUTHORIZE_URL'),
    'token_url' => env('SSO_TOKEN_URL'),
    'end_session_url' => env('SSO_END_SESSION_URL'),
    'client_id' => env('SSO_CLIENT_ID'),
    'scope' => env('SSO_SCOPE', 'openid profile email'),
    'clock_skew' => (int) env('SSO_CLOCK_SKEW', 60),
    'jwks_cache_ttl' => (int) env('SSO_JWKS_CACHE_TTL', 300),

    /*
    |--------------------------------------------------------------------------
    | Claim Mapping
    |--------------------------------------------------------------------------
    */
    'claims' => [
        'subject' => env('SSO_SUB_CLAIM', 'sub'),
        'email' => env('SSO_EMAIL_CLAIM', 'email'),
        'username' => env('SSO_USERNAME_CLAIM', 'preferred_username'),
        'name' => env('SSO_NAME_CLAIM', 'name'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Role Mapping
    |--------------------------------------------------------------------------
    |
    | Incoming SSO roles are mapped into local roles used by the existing
    | K2S authorization checks.
    |
    */
    'roles' => [
        'admin' => array_values(array_filter(array_map('trim', explode(',', (string) env('SSO_ADMIN_ROLES', 'admin,k2s_admin'))))),
        'viewer' => array_values(array_filter(array_map('trim', explode(',', (string) env('SSO_VIEWER_ROLES', 'user,viewer,k2s_user,k2s_viewer'))))),
        'external_dnp' => array_values(array_filter(array_map('trim', explode(',', (string) env('SSO_EXTERNAL_DNP_ROLES', 'external_dnp,k2s_external_dnp'))))),
    ],

    'provision_users' => filter_var(env('SSO_PROVISION_USERS', false), FILTER_VALIDATE_BOOL),
];
