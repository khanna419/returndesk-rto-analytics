-- MySQL 8.0.16+; run in a new project database. The rd_ prefix scopes all objects.
CREATE TABLE rd_shipments (
    shipment_id VARCHAR(64) PRIMARY KEY,
    created_at DATETIME NOT NULL,
    merchant VARCHAR(120) NOT NULL,
    courier VARCHAR(120) NOT NULL,
    city VARCHAR(120) NOT NULL,
    state VARCHAR(120) NOT NULL,
    pincode CHAR(6) NOT NULL,
    payment_type VARCHAR(16) NOT NULL,
    order_value_inr DECIMAL(12, 2) NOT NULL,
    status VARCHAR(16) NOT NULL,
    resolved_at DATETIME NULL,
    CHECK (payment_type IN ('COD', 'Prepaid')),
    CHECK (status IN ('Delivered', 'RTO', 'Open')),
    CHECK (order_value_inr >= 0),
    CHECK ((status = 'Open' AND resolved_at IS NULL)
        OR (status IN ('Delivered', 'RTO') AND resolved_at >= created_at AND resolved_at IS NOT NULL))
);

CREATE TABLE rd_attempts (
    shipment_id VARCHAR(64) NOT NULL,
    attempt_no INTEGER NOT NULL,
    attempt_at DATETIME NOT NULL,
    result VARCHAR(16) NOT NULL,
    failure_reason VARCHAR(120) NOT NULL DEFAULT '',
    PRIMARY KEY (shipment_id, attempt_no),
    FOREIGN KEY (shipment_id) REFERENCES rd_shipments(shipment_id),
    CHECK (attempt_no > 0),
    CHECK ((result = 'Failed' AND failure_reason <> '')
        OR (result = 'Delivered' AND failure_reason = ''))
);
