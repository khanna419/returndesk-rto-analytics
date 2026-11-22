# ReturnDesk in Power BI

Open **ReturnDesk.pbix** in Power BI Desktop for the populated report. It contains the imported shipment rows and works offline. Both the visible figures and the recommended actions describe a synthetic Indian logistics operation at 09:00 IST on 21 November 2026.

## Explore the report

- **RTO performance** opens with the full resolved cohort. Select a first-failure reason, courier, or payment segment to see how the rest of the page responds. The weekly trend uses the Monday of the first failed delivery attempt. Hover over a point for its exact value. Recent weeks may still have open shipments.
- **Follow-up queue** lists actionable open cases sorted by their original snapshot rank. The first 50 form the proposed daily plan. Selecting a priority or next action narrows the displayed backlog. The **In first 50** measure counts visible cases belonging to that original plan. Filtering preserves their original rank.
- **Power BI Filters** can restrict each visual or page. The two tables are independent so a historical cohort filter cannot silently remove open cases from the queue. The browser dashboard adds search, case timelines, and interactive capacity selection for operational demonstrations.

## Measures and interpretation

Each row in History represents one resolved shipment with a failed delivery attempt. RTO rate is returned shipments divided by resolved shipments in the current filter context. Recovery rate uses delivered shipments after a failed attempt and the same denominator. These percentages describe the failed-delivery cohort. The full network shipment population is outside this dataset.

Queue contains one row per actionable open shipment. The wait metric uses completed hours since the latest failed attempt as of the snapshot. Order values represent customer order amounts in INR. The model contains no observed intervention effects, savings, or reduction in RTO. See the analytical model documentation for queue eligibility and tie-break rules.

## Editable source and refresh

Keep **ReturnDesk.pbip**, **ReturnDesk.Report**, and **ReturnDesk.SemanticModel** together. Open the PBIP in Desktop and select **Home → Refresh** to populate the editable report. The semantic model imports a compressed copy of the two CSV exports by default. No database connection or project-specific file path is required.

To refresh with new SQL exports, open **Transform data → Edit parameters**. Set **DataFolder** to the absolute path of the project's `data/analytics` folder containing `history.csv` and `queue.csv`, then apply and refresh. Leaving the parameter empty selects the embedded snapshot. If you replace the scenario, update the static snapshot labels on both report pages as well. The report visuals, DAX measures, and Power Query transformations are editable in the project.

## Verification

Power BI Desktop opened the PBIP, imported both datasets, displayed both pages, and saved the populated PBIX. The two embedded CSV payloads matched the packaged SQL exports byte for byte. The saved PBIX archive passed an integrity check and includes its native data model.

| Check | Native report value |
| --- | ---: |
| Resolved failures | 9,555 |
| Returned | 3,167 |
| RTO rate | 33.1% |
| Recovery rate | 66.9% |
| Eligible open cases | 207 |
| Cases in first 50 | 50 |
| High priority | 99 |
| Median hours since latest attempt | 20.0 |
