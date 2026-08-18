# Phase 18

PostgreSQL-backed tickets support create/list/reply with strict ownership, staff/internal-note semantics, status transitions, and in-app reply notifications. Attachment metadata is allow-listed by MIME/name and limited to 5 MiB with randomized storage names. Notification rows provide the durable in-app center; EMAIL-channel rows are the durable queue boundary for the configured SMTP worker without exposing SMTP credentials.
