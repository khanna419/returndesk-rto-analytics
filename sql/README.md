# ReturnDesk analytical model

The two source files represent a single synthetic failed-delivery cohort. Every shipment has an initial failed attempt. All times are local to India (UTC+05:30). The source is frozen at 09:00 on 21 November 2026. The report uses the same snapshot clock on every computer.

## Rebuild the packaged dashboard data

Run from the ReturnDesk folder using Python 3.9+ with SQLite 3.25+.

```sh
python scripts/build_analytics.py
```

The build uses the Python standard library. It validates the source hashes from `data/manifest.json`, loads the tables in memory, executes the shared SQL views and example analyses, and writes the following files only after the checks pass.

| File | Grain and purpose |
| --- | --- |
| `dashboard-data.js` | Resolved cases, ranked open cases and their observed event histories for the offline browser dashboard |
| `data/analytics/history.csv` | One row per resolved shipment with a previously failed delivery |
| `data/analytics/queue.csv` | One row per currently actionable open shipment |

The Python adapter supplies MySQL's `TO_SECONDS` interval calculation to SQLite. All analytical views and window functions come from `03_views.sql`. CSV exports retain the source shipment IDs and destination PIN codes as text.

## Run in MySQL 8

Use MySQL 8.0.16 or later, with a fresh database for this project. Start the MySQL client from the ReturnDesk folder. The loader uses local CSV import, which must be enabled on your client and authorized by your database administrator. You can also use the portable build above without a database service.

```sh
mysql --local-infile=1 -u YOUR_USER -p YOUR_PROJECT_DATABASE
```

Inside the MySQL client, run these scripts in order.

```sql
SOURCE sql/01_schema_mysql.sql
SOURCE sql/02_load_mysql.sql
SOURCE sql/03_views.sql
SOURCE sql/04_analysis.sql
```

The loader stages both files, checks both row counts against the bundled demo, then replaces the contents of the two project tables together. The schema and views are created once. To reload the same sample, rerun the loader and analyses. Use InnoDB for transaction and foreign-key support. The shipped snapshot was executed through the portable build. The MySQL-specific file loader requires a live MySQL server.

## Metric definitions

| Metric or field | Definition |
| --- | --- |
| Resolved NDR | A shipment with a failed attempt and a confirmed recovery or RTO decision by the snapshot |
| RTO rate after a failure | Confirmed RTO shipments divided by resolved NDR shipments in the selected cohort |
| Recovery rate | Delivered shipments after a failed attempt divided by the same resolved NDR denominator |
| Historical date and reason | Local date and reason of the **first failure**. Later failures leave cohort membership unchanged |
| Open cases | Observed failed shipments whose forward-delivery outcomes were still open at the snapshot |
| Actionable cases | Open cases with an address issue, an unavailable buyer, a requested reschedule, a COD payment issue, or a courier capacity issue at the latest failed attempt |
| Held cases | Open cases whose latest reason lacks an outreach action under the sample policy. Buyer refusals are held for review |
| Queue date and reason | Local date and recorded reason of the **latest observed failed attempt**. The queue describes one operating snapshot |
| Attempts | Failed attempt count observed by the snapshot, including the initial failed attempt |
| Hours open | Completed hours since the first failed attempt |
| Hours since last | Completed hours since the latest failed attempt |
| Order value | Customer order value in INR. Actual freight costs and margins are unavailable |

An RTO represents a confirmed return decision ending forward delivery. Physical warehouse receipt is outside the model. The cohort contains only shipments with a failed attempt, so full-network RTO requires a wider shipment denominator. Recent cohorts have fewer resolved outcomes and can change as remaining open cases close.

## Follow-up policy

| Tier | Rule based on the latest known state |
| --- | --- |
| High | At least 24 hours since the latest failure, or at least two failures and 12 hours since the latest failure |
| Medium | At least 12 hours since the latest failure, or at least two failures, after assigning high-priority cases |
| Standard | All remaining actionable cases |

The queue orders by tier, oldest latest failure, descending failed attempt count, and shipment ID. Each case carries an action tied to its latest reason. Courier capacity triggers a courier escalation. Buyer-side issues trigger a confirmation step, which leaves the actual reattempt decision with the operator. The 50-case capacity and aging rules are illustrative operational choices. They are configurable assumptions in a real deployment, and have no measured recovery uplift in this simulation.

## Controls and reproducibility

Primary and foreign keys protect shipment identity and event ownership. The portable build reconciles recovered, RTO and open counts against the generated manifest. It checks duplicate shipment IDs, non-overlapping cohorts, queue ranks, status dates and per-case event histories. A temporary regression case verifies that a future delivery and a future failed attempt cannot affect a historical queue.

The benchmark for the distributed data is 9,555 resolved NDRs, including 3,167 RTOs and 6,388 recoveries. Of 220 open cases, 207 qualify for the follow-up queue and 13 have a recorded buyer refusal.
