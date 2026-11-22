"""Rebuild the browser dataset and Power BI extracts using only Python's standard library."""

import csv
import hashlib
import json
import math
import os
import sqlite3
import tempfile
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SQL = ROOT / "sql"
DATA = ROOT / "data"
EXTRACTS = DATA / "analytics"


def to_seconds(iso_timestamp):
    """A naive local-time scalar equivalent for interval differences in MySQL TO_SECONDS."""
    moment = datetime.fromisoformat(iso_timestamp)
    return moment.toordinal() * 86400 + moment.hour * 3600 + moment.minute * 60 + moment.second


def read_statements(filename):
    return (SQL / filename).read_text(encoding="utf-8")


def import_sources(db, manifest):
    db.executescript(read_statements("01_schema_mysql.sql"))
    db.execute("PRAGMA foreign_keys = ON")
    for name in ("shipments", "attempts"):
        filename = f"{name}.csv"
        path = DATA / filename
        if hashlib.sha256(path.read_bytes()).hexdigest() != manifest["sha256"][filename]:
            raise ValueError(f"{filename} differs from its source manifest")
        table = f"rd_{name}"
        columns = [r["name"] for r in db.execute(f"PRAGMA table_info({table})")]
        with path.open(newline="", encoding="utf-8") as source:
            reader = csv.DictReader(source)
            if reader.fieldnames != columns:
                raise ValueError(f"Unexpected column names or order in {filename}")
            values = ([None if c == "resolved_at" and not row[c] else row[c] for c in columns]
                      for row in reader)
            placeholders = ",".join("?" for _ in columns)
            db.executemany(f"INSERT INTO {table} VALUES ({placeholders})", values)
        count = db.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        if count != manifest[name]:
            raise ValueError(f"Source count mismatch for {name}")
    db.executescript(read_statements("03_views.sql"))
    db.executescript(read_statements("04_analysis.sql"))
    as_of = db.execute("SELECT as_of FROM rd_snapshot").fetchone()[0]
    if as_of != manifest["snapshot_at"]:
        raise ValueError("SQL cutoff and source manifest cutoff must agree")


def extract(db, manifest):
    history = [dict(r) for r in db.execute("SELECT * FROM rd_history ORDER BY date, id")]
    queue = [dict(r) for r in db.execute("SELECT * FROM rd_queue ORDER BY `rank`")]
    timelines = defaultdict(list)
    eligible_ids = {case["id"] for case in queue}
    for r in db.execute("SELECT * FROM rd_seen_attempts ORDER BY shipment_id, attempt_no"):
        if r["shipment_id"] in eligible_ids:
            timelines[r["shipment_id"]].append({
                "at": r["attempt_at"], "result": r["result"], "reason": r["failure_reason"],
                "no": r["attempt_no"],
            })
    case_counts = Counter(r["asOfStatus"] for r in db.execute("SELECT asOfStatus FROM rd_cases"))
    meta = {
        "asOf": manifest["snapshot_at"], "timezone": manifest["timezone"], "source": manifest["source"],
        "defaultCapacity": 50, "openCount": case_counts["Open"], "heldCount": case_counts["Open"] - len(queue),
        "totalShipments": manifest["shipments"], "totalAttemptEvents": manifest["attempts"],
    }
    # Display the unresolved part of each historical cohort next to the
    # observed outcomes, retaining the dimensions used by the browser filters.
    meta["unresolvedCohorts"] = [dict(row) for row in db.execute("""
        SELECT DATE(firstFailure) AS date, courier, state, payment, firstReason AS reason,
               COUNT(*) AS cases
        FROM rd_cases WHERE asOfStatus = 'Open'
        GROUP BY DATE(firstFailure), courier, state, payment, firstReason
        ORDER BY DATE(firstFailure), courier, state, payment, firstReason
    """)]
    assert sum(row["cases"] for row in meta["unresolvedCohorts"]) == meta["openCount"]
    return history, queue, timelines, meta


def verify(db, manifest, history, queue, timelines, meta):
    by_status = manifest["shipment_status_counts"]
    counts = Counter(r["outcome"] for r in history)
    assert counts["Recovered"] == by_status["Delivered"] and counts["RTO"] == by_status["RTO"]
    assert len(history) + meta["openCount"] == manifest["shipments"]
    assert meta["openCount"] == by_status["Open"] and meta["heldCount"] >= 0
    assert len({r["id"] for r in history + queue}) == len(history) + len(queue)
    assert [r["rank"] for r in queue] == list(range(1, len(queue) + 1))
    for case in queue:
        events = timelines[case["id"]]
        assert len(events) == case["attempts"] and all(e["result"] == "Failed" for e in events)
        assert events[-1]["at"] == case["lastAttempt"] <= meta["asOf"]
        assert events[-1]["reason"] == case["reason"] != "Buyer refused"
        assert 0 <= case["hoursSinceLast"] <= case["hoursOpen"]
    assert all(r["resolvedAt"] <= meta["asOf"] for r in history)
    assert all(r["date"] <= r["resolvedAt"][:10] for r in history)
    assert db.execute("PRAGMA foreign_key_check").fetchone() is None

    # Regression fixture: a later delivery and later attempt may never change this snapshot.
    # Use a savepoint so the generated dataset cannot contain the fixture.
    db.execute("SAVEPOINT future_event_test")
    db.execute("""INSERT INTO rd_shipments VALUES ('__QA__','2026-11-19 09:00:00',
               'QA','QA','QA','QA','000000','Prepaid',1,'Delivered','2026-11-22 16:00:00')""")
    db.executemany("INSERT INTO rd_attempts VALUES ('__QA__',?,?,?,?)", [
        (1, "2026-11-20 16:00:00", "Failed", "Address issue"),
        (2, "2026-11-22 10:00:00", "Failed", "Buyer refused"),
        (3, "2026-11-22 16:00:00", "Delivered", ""),
    ])
    test_case = db.execute("SELECT * FROM rd_queue WHERE id='__QA__'").fetchone()
    assert test_case and test_case["attempts"] == 1 and test_case["reason"] == "Address issue"
    assert db.execute("SELECT COUNT(*) FROM rd_history WHERE id='__QA__'").fetchone()[0] == 0
    db.execute("ROLLBACK TO future_event_test")
    db.execute("RELEASE future_event_test")


def write_csv(path, rows, columns):
    with path.open("w", newline="", encoding="utf-8") as output:
        writer = csv.DictWriter(output, fieldnames=columns, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def main():
    manifest = json.loads((DATA / "manifest.json").read_text(encoding="utf-8"))
    with sqlite3.connect(":memory:") as db:
        db.row_factory = sqlite3.Row
        db.create_function("TO_SECONDS", 1, to_seconds, deterministic=True)
        db.create_function("FLOOR", 1, math.floor, deterministic=True)
        import_sources(db, manifest)
        history, queue, timelines, meta = extract(db, manifest)
        verify(db, manifest, history, queue, timelines, meta)
        history_columns = [c[0] for c in db.execute("SELECT * FROM rd_history LIMIT 0").description]
        queue_columns = [c[0] for c in db.execute("SELECT * FROM rd_queue LIMIT 0").description]

    EXTRACTS.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=EXTRACTS) as staging:
        staging = Path(staging)
        write_csv(staging / "history.csv", history, history_columns)
        write_csv(staging / "queue.csv", queue, queue_columns)
        for case in queue:
            case["timeline"] = timelines[case["id"]]
        payload = {"meta": meta, "history": history, "queue": queue}
        with (staging / "dashboard-data.js").open("w", encoding="utf-8", newline="\n") as stream:
            stream.write("window.RETURN_DESK = ")
            json.dump(payload, stream, ensure_ascii=True, separators=(",", ":"))
            stream.write(";\n")
        for name, destination in [
            ("history.csv", EXTRACTS), ("queue.csv", EXTRACTS), ("dashboard-data.js", ROOT),
        ]:
            os.replace(staging / name, destination / name)
    print(f"Verified {len(history):,} resolved cases, {len(queue):,} actionable cases, "
          f"{meta['heldCount']:,} held cases. Wrote dashboard data and two Power BI extracts.")


if __name__ == "__main__":
    main()
