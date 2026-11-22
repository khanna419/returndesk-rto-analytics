# ReturnDesk interview walkthrough

**The decision.** A seller can act on 50 failed deliveries today. Which shipments need attention first, what should the operator do, and how would the team know whether those decisions recovered more deliveries?

Shiprocket documents a workflow for contacting a buyer, requesting another delivery attempt or initiating a return after a failed attempt. ReturnDesk is an independent portfolio project that explores this decision using simulated shipments. [Shiprocket NDR guide](https://support.shiprocket.in/support/solutions/articles/43000664209-what-is-ndr-)

## Three-minute demo

| Time | What to show and say |
|---|---|
| 0:00–0:35 | Open **Overview** and select **All dates**. “I started with 19,535 delivery-attempt records. One parcel can have multiple failures, so my SQL counts each shipment once. Of 9,555 resolved failed-delivery cases, 3,167 ended in a confirmed return decision and 6,388 reached the buyer. The other 220 shipments were open at the snapshot.” |
| 0:35–1:20 | Open **Segment explorer**, group by **Failure reason**, and rank by **RTO count**. Buyer unavailable produced 869 returns among 3,433 resolved cases (25.3%). Buyer refused produced 628 among 739 (85.0%). “A manager looking only at the highest rate might overlook the largest pool of returns. I’d test whether confirming a delivery time helps the unavailable group. For a reported refusal, the team should respect the buyer’s decision.” |
| 1:20–1:50 | Under **Filters**, select **Address issue**, then group by **Payment type**. COD shipments had 532 returns among 1,286 resolved cases (41.4%). Prepaid shipments had 312 among 894 (34.9%). “This simulated difference helps me pose a question. If the same pattern appeared in live data, I’d check courier and destination mix before proposing an address-confirmation pilot.” |
| 1:50–2:30 | Open **Follow-up queue** with **Top 50 cases**. Select **RD-109366**, the third-ranked shipment. “At 09:00 IST on 21 November, this prepaid Hyderabad shipment had been waiting 90 hours since an address issue. The next step is to confirm the address details before requesting a reattempt. You can see the rule behind the rank. Of the 220 open cases, 207 have an eligible action. The remaining 13 have a latest reason of buyer refusal.” |
| 2:30–3:00 | “I demonstrated a workflow on simulated data. To estimate the impact, I’d compare it with the existing process at the same daily follow-up capacity and track eventual delivery and RTO for every eligible shipment.” |

**If asked “Did you reduce RTO?”** “A production reduction is unmeasured. I built and tested the workflow, validated its shipment counts and made each recommended action explainable. Its effect on actual returns is a question for a controlled pilot.”

## How to test it with a real team

1. **Define eligibility before assignment.** Enroll each newly eligible open shipment once. Respect verified refusals and customer contact preferences. Record the latest known failure and its timestamp. Keep each shipment with its original group through closure.
2. **Hold resources constant.** Within day and courier, randomly assign eligible shipments to two comparable pools. Give each pool the same staff time and 25 follow-up slots per day. One pool uses the team's current ordering policy. The other uses the ReturnDesk queue. Use the same allowed actions and record who was contacted, when and how.
3. **Measure all assigned shipments.** Compare confirmed RTO decisions by day 14 as a share of *all* shipments originally assigned to each group, including unworked shipments. Report the difference in percentage points, a confidence interval, recovery by day 14 and the proportion still open. Choose a study duration and sample size in advance using the real baseline, and repeat the analysis after remaining cases close.

Historical rates here are conditional on a failed first attempt and a resolved outcome at the snapshot. Recent cohorts have had less time to close. Order value describes merchandise value and cannot establish freight savings or recovered profit. Carrier names and effects in this dataset are fictional. [Data source and assumptions](data/DATA_CARD.md)

## Résumé bullets

- Built an interactive RTO operations dashboard and SQL reporting layer using 19,535 simulated delivery attempts across 9,775 shipments, reconciling repeat failures into shipment-level recovery and return metrics.
- Designed an explainable follow-up queue that prioritized 50 cases from 207 actionable shipments, surfaced a specific next action for each shipment and supported case-level review and CSV export.
