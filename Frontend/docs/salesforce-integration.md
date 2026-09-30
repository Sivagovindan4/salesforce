# Salesforce integration

The integration API accepts `eventId` plus a `restaurant` or `item` payload. Restaurant and menu records are matched by unique `externalId`, never by display name. Replayed successful event IDs return an idempotent response; failed processing is recorded in `IntegrationEvent` with attempts and error details.

In development, the webhook signature is optional. In production set `SALESFORCE_WEBHOOK_SECRET` and provide a valid `X-Scanzaa-Signature` HMAC-SHA256 signature over the exact raw request body. Configure provider mode as `development` until Salesforce credentials, endpoint, API version, and object mappings are supplied. No Salesforce database details are assumed.
