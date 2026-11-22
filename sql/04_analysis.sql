-- Resolved NDR cohorts. Each id contributes exactly one shipment to these metrics.
SELECT COUNT(*) AS resolved_ndrs,
       SUM(CASE WHEN outcome='RTO' THEN 1 ELSE 0 END) AS rto_count,
       SUM(CASE WHEN outcome='Recovered' THEN 1 ELSE 0 END) AS recoveries,
       ROUND(100.0 * SUM(CASE WHEN outcome='RTO' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 2) AS rto_pct
FROM rd_history;

SELECT reason AS initial_failure, payment, COUNT(*) AS resolved_ndrs,
       SUM(CASE WHEN outcome='RTO' THEN 1 ELSE 0 END) AS rto_count,
       ROUND(100.0 * SUM(CASE WHEN outcome='RTO' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 2) AS rto_pct
FROM rd_history
GROUP BY reason, payment
ORDER BY rto_count DESC, initial_failure, payment;

SELECT courier, state, pin, COUNT(*) AS resolved_ndrs,
       SUM(CASE WHEN outcome='RTO' THEN 1 ELSE 0 END) AS rto_count,
       ROUND(100.0 * SUM(CASE WHEN outcome='RTO' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 2) AS rto_pct
FROM rd_history
GROUP BY courier, state, pin
ORDER BY rto_count DESC, resolved_ndrs DESC, courier, state, pin;

-- Example daily capacity. Rank is computed on actionable cases only.
SELECT `rank`, id, priority, reason, why, action, courier, pin, attempts, hoursSinceLast
FROM rd_queue
WHERE `rank` <= 50
ORDER BY `rank`;

-- Audit open cases excluded from the queue and their latest recorded reason.
SELECT c.latestReason AS reason, COUNT(*) AS held_shipments
FROM rd_cases AS c
LEFT JOIN rd_queue AS q ON q.id = c.id
WHERE c.asOfStatus='Open' AND q.id IS NULL
GROUP BY c.latestReason;
