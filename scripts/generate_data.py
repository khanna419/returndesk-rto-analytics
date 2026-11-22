"""Generate the ReturnDesk failed-delivery cohort. Run with Python 3.10+."""

import csv
import hashlib
import json
import math
import random
from collections import Counter, defaultdict
from datetime import date, datetime, time, timedelta
from pathlib import Path


DATA = Path(__file__).resolve().parents[1] / "data"
SEED = 381174
START = date(2026, 8, 17)
SNAPSHOT = datetime(2026, 11, 21, 9)
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"
SHIPMENT_FIELDS = (
    "shipment_id", "created_at", "merchant", "courier", "city", "state",
    "pincode", "payment_type", "order_value_inr", "status", "resolved_at",
)
ATTEMPT_FIELDS = ("shipment_id", "attempt_no", "attempt_at", "result", "failure_reason")
DESTINATIONS = [
    ("New Delhi", "Delhi", "110001"), ("New Delhi", "Delhi", "110017"),
    ("Mumbai", "Maharashtra", "400001"), ("Mumbai", "Maharashtra", "400050"),
    ("Bengaluru", "Karnataka", "560001"), ("Bengaluru", "Karnataka", "560066"),
    ("Hyderabad", "Telangana", "500001"), ("Chennai", "Tamil Nadu", "600001"),
    ("Kolkata", "West Bengal", "700001"), ("Pune", "Maharashtra", "411001"),
    ("Jaipur", "Rajasthan", "302001"), ("Lucknow", "Uttar Pradesh", "226001"),
    ("Ahmedabad", "Gujarat", "380001"), ("Indore", "Madhya Pradesh", "452001"),
    ("Patna", "Bihar", "800001"), ("Guwahati", "Assam", "781001"),
]
CITY_WEIGHTS = (8, 5, 8, 5, 8, 6, 8, 7, 8, 7, 6, 7, 7, 5, 5, 4)
COURIERS = ("Aster Express", "Meridian Parcel", "Kite Freight", "Orbit Logistics")
MERCHANTS = ("Studio Alder", "Field & Loom", "Mango Lane", "Relay Goods", "Paper Harbor")
REASONS = (
    "Buyer unavailable", "Address issue", "Reschedule requested",
    "COD payment issue", "Buyer refused", "Courier capacity",
)


def event_time(rng, day):
    return datetime.combine(day, time(rng.randrange(9, 20), rng.randrange(60), rng.randrange(60)))


def draw_reason(rng, payment, pressure):
    weights = [34, 21, 17, 14 if payment == "COD" else 0, 9 if payment == "COD" else 5,
               15 if pressure else 7]
    return rng.choices(REASONS, weights)[0]


def simulate_episode(rng, day, serial):
    shipment_id = f"RD-{serial:06d}"
    first = event_time(rng, day)
    created = first - timedelta(hours=rng.randint(29, 139), minutes=rng.randrange(60))
    city, state, pincode = rng.choices(DESTINATIONS, CITY_WEIGHTS)[0]
    courier = rng.choices(COURIERS, (34, 29, 22, 15))[0]
    merchant = rng.choices(MERCHANTS, (25, 22, 20, 18, 15))[0]
    payment = "COD" if rng.random() < (.74 if merchant == "Relay Goods" else .61) else "Prepaid"
    value = min(12099, max(199, 10 * int(rng.lognormvariate(7.15, .65) / 10) - 1))
    # A simulated capacity shock creates an interpretable date/courier interaction.
    pressure = date(2026, 10, 22) <= day <= date(2026, 11, 9) and courier == "Kite Freight"
    reason = draw_reason(rng, payment, pressure)
    # These constants are scenario assumptions. There is no learned risk model.
    base_rto = dict(zip(REASONS, (.21, .35, .13, .32, .79, .23)))
    rto_probability = (base_rto[reason] + .065 * (payment == "COD")
                       + .07 * pressure + .045 * (pincode in {"781001", "800001"}))
    ultimately_returned = rng.random() < rto_probability
    events = [(first, "Failed", reason)]
    latest = first
    # Refusals may close after one failed attempt. Other episodes may receive
    # a second failure before successful delivery or withdrawal from forward flow.
    second_failure = rng.random() < (.61 if ultimately_returned and reason != "Buyer refused" else .25)
    if second_failure:
        latest = event_time(rng, day + timedelta(days=rng.choices([1, 2, 3], [60, 32, 8])[0]))
        second_reason = reason if rng.random() < .71 else draw_reason(rng, payment, pressure)
        events.append((latest, "Failed", second_reason))
    if ultimately_returned:
        # Closure means RTO is confirmed in the forward workflow, not receipt by the seller.
        resolved = latest + timedelta(hours=rng.randint(3, 52), minutes=rng.randrange(60))
        status = "RTO"
    else:
        resolved = event_time(rng, latest.date() + timedelta(days=rng.choices([1, 2, 3, 4], [59, 29, 10, 2])[0]))
        status = "Delivered"
        events.append((resolved, "Delivered", ""))
    attempts = [
        (shipment_id, index, stamp.strftime(DATE_FORMAT), result, failure_reason)
        for index, (stamp, result, failure_reason) in enumerate(events, 1) if stamp <= SNAPSHOT
    ]
    closed = resolved <= SNAPSHOT
    shipment = (shipment_id, created.strftime(DATE_FORMAT), merchant, courier, city, state, pincode,
                payment, value, status if closed else "Open", resolved.strftime(DATE_FORMAT) if closed else "")
    return shipment, attempts


def validate(shipments, attempts):
    grouped = defaultdict(list)
    for row in attempts:
        grouped[row[0]].append(row)
    ids = {s[0] for s in shipments}
    assert len(ids) == len(shipments) and ids == set(grouped)
    cutoff = SNAPSHOT.strftime(DATE_FORMAT)
    for row in shipments:
        shipment_id, created, *_, payment, amount, status, closed = row
        events = grouped[shipment_id]
        stamps = [e[2] for e in events]
        assert created < stamps[0] and stamps[-1] <= cutoff
        assert stamps == sorted(set(stamps))
        assert [e[1] for e in events] == list(range(1, len(events) + 1))
        assert events[0][3] == "Failed" and all(e[3] == "Failed" for e in events[:-1])
        assert all((e[4] in REASONS) == (e[3] == "Failed") for e in events)
        assert payment == "COD" or all(e[4] != "COD payment issue" for e in events)
        assert amount > 0 and len(events) <= 3
        if status == "Open":
            assert not closed and events[-1][3] == "Failed" and len(events) <= 2
        elif status == "Delivered":
            assert closed == stamps[-1] and events[-1][3] == "Delivered"
        else:
            assert status == "RTO" and stamps[-1] < closed <= cutoff and events[-1][3] == "Failed"


def write_csv(filename, header, rows):
    path = DATA / filename
    with path.open("w", encoding="utf-8", newline="") as output:
        writer = csv.writer(output, lineterminator="\n")
        writer.writerow(header)
        writer.writerows(rows)
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    rng = random.Random(SEED)
    shipments = []
    attempts = []
    for offset in range((SNAPSHOT.date() - START).days):
        day = START + timedelta(days=offset)
        # Weekly mix, a gradual volume change and day-level noise.
        mean = 80 + 14 * math.sin(2 * math.pi * (day.weekday() - 1) / 7) + .38 * offset
        if date(2026, 10, 22) <= day <= date(2026, 11, 9):
            mean += 18
        for _ in range(round(rng.gauss(mean, 7.5))):
            shipment, shipment_attempts = simulate_episode(rng, day, len(shipments) + 100001)
            shipments.append(shipment)
            attempts.extend(shipment_attempts)
    validate(shipments, attempts)
    DATA.mkdir(parents=True, exist_ok=True)
    hashes = {
        "shipments.csv": write_csv("shipments.csv", SHIPMENT_FIELDS, shipments),
        "attempts.csv": write_csv("attempts.csv", ATTEMPT_FIELDS, attempts),
    }
    manifest = {
        "source": "Original synthetic NDR cohort", "seed": SEED, "timezone": "Asia/Kolkata",
        "snapshot_at": SNAPSHOT.strftime(DATE_FORMAT), "first_failure_start": START.isoformat(),
        "shipments": len(shipments), "attempts": len(attempts),
        "shipment_status_counts": dict(sorted(Counter(s[-2] for s in shipments).items())),
        "sha256": hashes,
    }
    text = json.dumps(manifest, indent=2) + "\n"
    (DATA / "manifest.json").write_bytes(text.encode("utf-8"))
    print(text, end="")


if __name__ == "__main__":
    main()
