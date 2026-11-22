# ReturnDesk data card

**All shipment records, attempts, courier names, merchant names, transaction amounts and performance differences in this case study are simulated.** Indian city, state and PIN code labels provide geographical context. A fixed historical snapshot lets a reviewer reproduce the queue and its metrics.

## Coverage

The population consists of 9,775 shipments whose first delivery attempt failed between 17 August and 20 November 2026. The extract contains the events visible at 09:00 IST on 21 November 2026. Each shipment enters the cohort once. Subsequent failed attempts add events to the same shipment. The sample contains four fictional couriers, five fictional merchants, 13 cities, 16 destination PIN codes and two payment methods.

| Snapshot measure | Count |
|---|---:|
| Unique shipments with a failed first attempt | 9,775 |
| Attempt scans, including successful deliveries | 19,535 |
| Recovered and delivered | 6,388 |
| Confirmed RTO decision | 3,167 |
| Open at the snapshot | 220 |
| Resolved forward-delivery cases | 9,555 |

The all-period NDR-to-RTO rate is 3,167 / 9,555, or 33.1%. The recovery rate uses the same denominator. Open shipments remain in the backlog until they resolve. Shipments delivered on the first attempt fall outside the cohort, so an overall merchant or industry RTO rate cannot be calculated here.

## Provenance

Shiprocket documents the choices that follow an unsuccessful delivery attempt, including contacting the buyer, requesting another attempt and initiating RTO. These workflows informed the decision that this case study supports. Shiprocket supplied no shipment records or performance estimates. [Shiprocket NDR workflow](https://support.shiprocket.in/support/solutions/articles/43000664209-what-is-ndr-)

SmartShip's documented scan codes cover incorrect addresses, cash unavailable at delivery, unreachable recipients, refusal and requests for a later delivery. These informed the reason categories. Courier capacity is an additional scenario assumption. Each failed-attempt reason represents a reported observation and may require verification. [SmartShip tracking status definitions, page 51](https://www.smartship.in/pickup/apiDocument)

Two real public sources were evaluated. Amazon's 2021 routing challenge identifies delivery attempts within individual routes. Its package identifiers are specific to each route, which prevents a reliable shipment-level link across routes to a final return. OCLT's Indian seller study describes actual NDR and RTO outcomes, but its publisher withholds the underlying records. An original simulation provides the combination of event timing, failure reasons, open inventory and confirmed outcomes required to demonstrate this workflow. [Amazon dataset paper](https://pubsonline.informs.org/doi/10.1287/trsc.2022.1173) · [OCLT study methodology](https://oclt.in/research/ndr-customer-unavailable-study/)

## Files and grain

All timestamps use local India time, UTC+05:30, in the format YYYY-MM-DD HH:MM:SS. An empty CSV field represents a missing value. Keep identifiers and PIN codes as text.

| shipments.csv field | Meaning |
|---|---|
| shipment_id | Unique synthetic shipment ID and join key. |
| created_at | Time the shipment was created, before its first failed attempt. |
| merchant, courier | Fictional business labels assigned to the shipment. |
| city, state, pincode | Destination city, state or union territory, and six-digit postal code. |
| payment_type | COD (cash on delivery) or Prepaid. |
| order_value_inr | Face value in Indian rupees. A returned order's value is distinct from the freight cost, margin loss or achievable savings. |
| status | Delivered after one or more failed attempts, RTO after confirmation of the return decision, or Open at the data cutoff. |
| resolved_at | Delivery time or time the courier confirmed the return decision. Empty for open shipments. Physical receipt of a returned parcel by the seller is outside this workflow. |

| attempts.csv field | Meaning |
|---|---|
| shipment_id | Parent shipment. |
| attempt_no | Sequence starting at 1 for each shipment. Together with shipment_id it forms a unique event key. |
| attempt_at | Timestamp of the attempt. Each subsequent attempt occurs after the previous one. |
| result | Failed or Delivered. RTO confirmation is represented on the shipment row. |
| failure_reason | Address issue, Buyer unavailable, Reschedule requested, COD payment issue, Buyer refused, or Courier capacity. Empty for successful deliveries. |

Use the first failed reason to describe the episode at entry. Use the latest known reason to guide the action on an open case. Count distinct shipment IDs when summarizing outcomes. Restrict repeat-event counts to questions about attempts.

## How the simulation works

The generator produces first failed attempts at a varying daily volume. Payment mix, first reported reason, a coded lane effect and a temporary courier-capacity shock influence the simulated probability of a confirmed return. Some shipments fail twice. A successful delivery or confirmed RTO decision closes each forward-delivery episode. The export truncates the timeline at the snapshot, leaving recent cases genuinely open in the exported data. Each open record contains only observable events.

Scenario probabilities, workloads and city-level effects are illustrative. Observed correlations recur because of the simulation assumptions. They cannot establish an actual courier's performance or the causal effect of follow-up. In particular, the source contains no outreach assignment or treatment response. A test on live shipments would require action logs, a comparison group, matched follow-up capacity and outcome observation through closure.

## Reproduction

From the project root, run:

```text
python scripts/generate_data.py
```

The standard-library generator uses seed 381174. It validates identity and event sequencing, timestamp cutoffs, terminal-state consistency and payment-specific failure reasons. It writes both source CSVs and a manifest with SHA-256 file checksums. Rebuild derived analytics and the dashboard payload after changing source data.
