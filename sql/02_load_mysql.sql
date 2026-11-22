-- Run the mysql client from the ReturnDesk folder. Use the supplied source CSVs.
-- Staging and a single transaction keep repeated loads of the project data consistent.
CREATE TEMPORARY TABLE rd_new_shipments LIKE rd_shipments;
CREATE TEMPORARY TABLE rd_new_attempts LIKE rd_attempts;

LOAD DATA LOCAL INFILE 'data/shipments.csv'
INTO TABLE rd_new_shipments CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"' ESCAPED BY '"'
LINES TERMINATED BY '\n' IGNORE 1 LINES
(shipment_id, created_at, merchant, courier, city, state, pincode, payment_type,
 order_value_inr, status, @raw_resolved)
SET resolved_at = NULLIF(TRIM(TRAILING '\r' FROM @raw_resolved), '');

LOAD DATA LOCAL INFILE 'data/attempts.csv'
INTO TABLE rd_new_attempts CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"' ESCAPED BY '"'
LINES TERMINATED BY '\n' IGNORE 1 LINES
(shipment_id, attempt_no, attempt_at, result, @raw_reason)
SET failure_reason = TRIM(TRAILING '\r' FROM @raw_reason);

-- An incomplete source load must not replace a previously usable demo snapshot.
DROP PROCEDURE IF EXISTS rd_install_demo_snapshot;
DELIMITER //
CREATE PROCEDURE rd_install_demo_snapshot()
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    IF (SELECT COUNT(*) FROM rd_new_shipments) <> 9775
       OR (SELECT COUNT(*) FROM rd_new_attempts) <> 19535 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Staged counts do not match the supplied demo manifest';
    END IF;
    START TRANSACTION;
    DELETE FROM rd_attempts;
    DELETE FROM rd_shipments;
    INSERT INTO rd_shipments SELECT * FROM rd_new_shipments;
    INSERT INTO rd_attempts SELECT * FROM rd_new_attempts;
    COMMIT;
END//
DELIMITER ;
CALL rd_install_demo_snapshot();
DROP PROCEDURE rd_install_demo_snapshot;
DROP TEMPORARY TABLE rd_new_shipments;
DROP TEMPORARY TABLE rd_new_attempts;
