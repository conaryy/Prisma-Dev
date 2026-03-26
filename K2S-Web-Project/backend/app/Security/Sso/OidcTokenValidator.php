<?php

namespace App\Security\Sso;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class OidcTokenValidator
{
    /**
     * @return array<string, mixed>
     */
    public function validate(string $jwt): array
    {
        [$header, $payload, $signature, $signedPart] = $this->splitJwt($jwt);

        $alg = (string) ($header['alg'] ?? '');
        if ($alg !== 'RS256') {
            throw new RuntimeException('Unsupported token algorithm.');
        }

        $kid = (string) ($header['kid'] ?? '');
        if ($kid === '') {
            throw new RuntimeException('Token key id is missing.');
        }

        $this->validateClaims($payload);
        $pem = $this->resolvePublicKeyPem($kid);
        $this->verifySignature($signedPart, $signature, $pem);

        return $payload;
    }

    /**
     * @return array{array<string, mixed>, array<string, mixed>, string, string}
     */
    private function splitJwt(string $jwt): array
    {
        $parts = explode('.', $jwt);
        if (count($parts) !== 3) {
            throw new RuntimeException('Malformed token.');
        }

        [$encodedHeader, $encodedPayload, $encodedSignature] = $parts;

        $header = $this->decodeJsonSegment($encodedHeader);
        $payload = $this->decodeJsonSegment($encodedPayload);
        $signature = $this->base64UrlDecode($encodedSignature);

        return [$header, $payload, $signature, $encodedHeader.'.'.$encodedPayload];
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeJsonSegment(string $segment): array
    {
        $decoded = $this->base64UrlDecode($segment);
        $data = json_decode($decoded, true);
        if (!is_array($data)) {
            throw new RuntimeException('Invalid token payload.');
        }

        return $data;
    }

    private function base64UrlDecode(string $value): string
    {
        $remainder = strlen($value) % 4;
        if ($remainder > 0) {
            $value .= str_repeat('=', 4 - $remainder);
        }

        $decoded = base64_decode(strtr($value, '-_', '+/'), true);
        if ($decoded === false) {
            throw new RuntimeException('Invalid base64url token segment.');
        }

        return $decoded;
    }

    /**
     * @param array<string, mixed> $claims
     */
    private function validateClaims(array $claims): void
    {
        $issuer = (string) config('sso.issuer');
        $audience = (string) config('sso.audience');
        $clockSkew = (int) config('sso.clock_skew', 60);
        $now = time();

        if ($issuer !== '' && (($claims['iss'] ?? null) !== $issuer)) {
            throw new RuntimeException('Token issuer is invalid.');
        }

        if ($audience !== '' && !$this->matchesAudience($claims['aud'] ?? null, $audience)) {
            throw new RuntimeException('Token audience is invalid.');
        }

        $exp = (int) ($claims['exp'] ?? 0);
        if ($exp <= 0 || ($now - $clockSkew) >= $exp) {
            throw new RuntimeException('Token has expired.');
        }

        if (isset($claims['nbf']) && (int) $claims['nbf'] > ($now + $clockSkew)) {
            throw new RuntimeException('Token is not active yet.');
        }

        if (isset($claims['iat']) && (int) $claims['iat'] > ($now + $clockSkew)) {
            throw new RuntimeException('Token issue time is invalid.');
        }
    }

    private function matchesAudience(mixed $audClaim, string $expectedAudience): bool
    {
        if (is_string($audClaim)) {
            return hash_equals($expectedAudience, $audClaim);
        }

        if (!is_array($audClaim)) {
            return false;
        }

        foreach ($audClaim as $audience) {
            if (is_string($audience) && hash_equals($expectedAudience, $audience)) {
                return true;
            }
        }

        return false;
    }

    private function resolvePublicKeyPem(string $kid): string
    {
        $jwksUrl = (string) config('sso.jwks_url');
        if ($jwksUrl === '') {
            throw new RuntimeException('SSO_JWKS_URL is not configured.');
        }

        $cacheKey = 'sso:jwks:'.sha1($jwksUrl);
        $ttl = (int) config('sso.jwks_cache_ttl', 300);

        /** @var array<string, mixed> $jwks */
        $jwks = Cache::remember($cacheKey, max($ttl, 60), function () use ($jwksUrl) {
            $response = Http::timeout(10)->acceptJson()->get($jwksUrl);
            if (!$response->successful()) {
                throw new RuntimeException('Unable to fetch JWKS.');
            }

            $data = $response->json();
            if (!is_array($data)) {
                throw new RuntimeException('Invalid JWKS response.');
            }

            return $data;
        });

        $keys = $jwks['keys'] ?? null;
        if (!is_array($keys)) {
            throw new RuntimeException('JWKS keys are missing.');
        }

        foreach ($keys as $key) {
            if (!is_array($key)) {
                continue;
            }

            if (($key['kid'] ?? null) !== $kid) {
                continue;
            }

            $kty = (string) ($key['kty'] ?? '');
            $n = (string) ($key['n'] ?? '');
            $e = (string) ($key['e'] ?? '');
            if ($kty !== 'RSA' || $n === '' || $e === '') {
                throw new RuntimeException('JWKS RSA key is invalid.');
            }

            return $this->buildRsaPem($n, $e);
        }

        throw new RuntimeException('Matching JWKS key was not found.');
    }

    private function verifySignature(string $signedPart, string $signature, string $publicKeyPem): void
    {
        $result = openssl_verify($signedPart, $signature, $publicKeyPem, OPENSSL_ALGO_SHA256);
        if ($result !== 1) {
            throw new RuntimeException('Token signature verification failed.');
        }
    }

    private function buildRsaPem(string $modulusB64Url, string $exponentB64Url): string
    {
        $modulus = $this->base64UrlDecode($modulusB64Url);
        $exponent = $this->base64UrlDecode($exponentB64Url);

        $modulus = ltrim($modulus, "\x00");
        $exponent = ltrim($exponent, "\x00");
        if ($modulus === '' || $exponent === '') {
            throw new RuntimeException('Invalid RSA key material.');
        }

        if ((ord($modulus[0]) & 0x80) !== 0) {
            $modulus = "\x00".$modulus;
        }
        if ((ord($exponent[0]) & 0x80) !== 0) {
            $exponent = "\x00".$exponent;
        }

        $modulusField = $this->asn1EncodeInteger($modulus);
        $exponentField = $this->asn1EncodeInteger($exponent);
        $rsaPublicKey = $this->asn1EncodeSequence($modulusField.$exponentField);

        $algorithmIdentifier = hex2bin('300d06092a864886f70d0101010500');
        if ($algorithmIdentifier === false) {
            throw new RuntimeException('Failed to build ASN.1 algorithm identifier.');
        }
        $subjectPublicKey = $this->asn1EncodeBitString($rsaPublicKey);
        $spki = $this->asn1EncodeSequence($algorithmIdentifier.$subjectPublicKey);

        return "-----BEGIN PUBLIC KEY-----\n".
            chunk_split(base64_encode($spki), 64, "\n").
            "-----END PUBLIC KEY-----\n";
    }

    private function asn1EncodeInteger(string $value): string
    {
        return "\x02".$this->asn1Length(strlen($value)).$value;
    }

    private function asn1EncodeSequence(string $value): string
    {
        return "\x30".$this->asn1Length(strlen($value)).$value;
    }

    private function asn1EncodeBitString(string $value): string
    {
        return "\x03".$this->asn1Length(strlen($value) + 1)."\x00".$value;
    }

    private function asn1Length(int $length): string
    {
        if ($length < 128) {
            return chr($length);
        }

        $binary = ltrim(pack('N', $length), "\x00");

        return chr(0x80 | strlen($binary)).$binary;
    }
}

