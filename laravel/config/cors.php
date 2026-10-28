<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    'paths' => ['api/*', 'mcp', 'mcp/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_values(array_filter(array_map(
        'trim',
        explode(',', env('CORS_ALLOWED_ORIGINS', 'https://www.pwarmyar.com,https://pwarmyar.com,https://office.pwarmyar.com,https://shop.pwarmyar.com,https://mobilepos.pwarmyar.com,https://pos.pwarmyar.com,https://socket.pwarmyar.com,https://localhost,capacitor://localhost'))
    ))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => ['Content-Disposition', 'Retry-After', 'X-RateLimit-Scope', 'X-Request-ID'],

    'max_age' => 0,

    'supports_credentials' => true,

];
