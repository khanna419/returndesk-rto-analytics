-- Shared, executable SQL for MySQL 8+ and the portable build.
-- One timestamp defines the latest information visible to both dashboard pages.
CREATE VIEW rd_snapshot AS
SELECT '2026-11-21 09:00:00' AS as_of;

CREATE VIEW rd_seen_attempts AS
SELECT a.*
FROM rd_attempts AS a
CROSS JOIN rd_snapshot AS clock
WHERE a.attempt_at <= clock.as_of;

CREATE VIEW rd_failures AS
SELECT
    shipment_id, attempt_no, attempt_at, failure_reason,
    ROW_NUMBER() OVER (PARTITION BY shipment_id ORDER BY attempt_at, attempt_no) AS first_n,
    ROW_NUMBER() OVER (PARTITION BY shipment_id ORDER BY attempt_at DESC, attempt_no DESC) AS last_n,
    COUNT(*) OVER (PARTITION BY shipment_id) AS failed_attempts
FROM rd_seen_attempts
WHERE result = 'Failed';

-- The first and latest failure joins each contribute exactly one row per NDR shipment.
CREATE VIEW rd_cases AS
SELECT s.shipment_id AS id, s.created_at AS createdAt, s.merchant, s.courier,
       s.city, s.state, s.pincode AS pin, s.payment_type AS payment, s.order_value_inr AS `value`,
       first_fail.attempt_at AS firstFailure, first_fail.failure_reason AS firstReason,
       last_fail.attempt_at AS lastFailure, last_fail.failure_reason AS latestReason,
       last_fail.failed_attempts AS failedAttempts,
       CASE WHEN s.resolved_at <= clock.as_of THEN s.status ELSE 'Open' END AS asOfStatus,
       CASE WHEN s.resolved_at <= clock.as_of THEN s.resolved_at END AS resolvedAt,
       FLOOR((TO_SECONDS(clock.as_of) - TO_SECONDS(first_fail.attempt_at)) / 3600.0) AS hoursOpen,
       FLOOR((TO_SECONDS(clock.as_of) - TO_SECONDS(last_fail.attempt_at)) / 3600.0) AS hoursSinceLast
FROM rd_shipments AS s
JOIN rd_failures AS first_fail ON first_fail.shipment_id = s.shipment_id AND first_fail.first_n = 1
JOIN rd_failures AS last_fail ON last_fail.shipment_id = s.shipment_id AND last_fail.last_n = 1
CROSS JOIN rd_snapshot AS clock
WHERE s.created_at <= clock.as_of;

CREATE VIEW rd_history AS
SELECT c.id, DATE(c.firstFailure) AS `date`, c.courier, c.city, c.pin, c.payment,
       c.firstReason AS reason,
       CASE WHEN c.asOfStatus = 'Delivered' THEN 'Recovered' ELSE 'RTO' END AS outcome,
       c.failedAttempts AS attempts, c.`value`, c.merchant, c.state, c.resolvedAt, c.createdAt
FROM rd_cases AS c
WHERE c.asOfStatus IN ('Delivered', 'RTO');

-- Only cases with a concrete next action enter the outreach/escalation queue.
CREATE VIEW rd_queue_candidates AS
SELECT c.*,
       CASE
           WHEN hoursSinceLast >= 24 OR (failedAttempts >= 2 AND hoursSinceLast >= 12) THEN 1
           WHEN hoursSinceLast >= 12 OR failedAttempts >= 2 THEN 2
           ELSE 3
       END AS tier,
       CASE latestReason
           WHEN 'Address issue' THEN 'Confirm address details'
           WHEN 'Buyer unavailable' THEN 'Confirm buyer availability'
           WHEN 'Reschedule requested' THEN 'Confirm reattempt slot'
           WHEN 'COD payment issue' THEN 'Confirm payment readiness'
           WHEN 'Courier capacity' THEN 'Escalate to courier'
       END AS action
FROM rd_cases AS c
WHERE asOfStatus = 'Open'
  AND latestReason IN ('Address issue','Buyer unavailable','Reschedule requested','COD payment issue','Courier capacity');

CREATE VIEW rd_queue AS
SELECT id, DATE(lastFailure) AS `date`, courier, city, pin, payment,
       latestReason AS reason, failedAttempts AS attempts, `value`, lastFailure AS lastAttempt,
       hoursOpen, CASE tier WHEN 1 THEN 'High' WHEN 2 THEN 'Medium' ELSE 'Standard' END AS priority,
       action,
       CASE
           WHEN hoursSinceLast >= 24 THEN 'Latest failure is at least 24 hours old'
           WHEN failedAttempts >= 2 AND hoursSinceLast >= 12 THEN 'Repeat failure with at least 12 hours elapsed'
           WHEN failedAttempts >= 2 THEN 'Shipment has repeated failed attempts'
           WHEN hoursSinceLast >= 12 THEN 'Latest failure is at least 12 hours old'
           ELSE 'Recent failure with an available follow-up action'
       END AS why,
       ROW_NUMBER() OVER (ORDER BY tier, lastFailure, failedAttempts DESC, id) AS `rank`,
       merchant, state, createdAt, hoursSinceLast
FROM rd_queue_candidates;
