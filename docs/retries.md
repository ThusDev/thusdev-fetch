# Retries

Retries are disabled unless configured. Default retryable statuses are `408`, `425`, `429`, `500`, `502`, `503`, and `504`.

The default retry policy allows `GET`, `HEAD`, `OPTIONS`, `PUT`, and `DELETE`. `POST` and `PATCH` require `retryUnsafeMethods: true`.

Use idempotency keys for APIs that support them when a mutation must be retried safely.
