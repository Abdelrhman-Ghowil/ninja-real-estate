# Branch Scoring System

## Scoring Methodology

Each criterion will be scored from **1 (least ideal)** to **5 (most ideal)** based on predefined ranges or conditions. The total score for a branch will be the sum of its scores across all criteria. This total score will then be converted into a **percentage match** against a perfect score (all 5s).

---

## Dynamic Pricing for Accuracy

To ensure our pricing scores remain accurate despite varying district prices and inflation, the **"Price" criterion** will now be evaluated against a **dynamic District Market Average**. This means the system will compare a potential branch's price to the current average market price for its specific district. This market average should be regularly updated (e.g., monthly or quarterly) using reliable external data sources or internal real estate data.

---

## Branch Scoring Criteria and Ranges (Score 1 – 5)

| Criterion | Score 1 (Least Ideal) | Score 2 | Score 3 | Score 4 | Score 5 (Most Ideal) |
|---|---|---|---|---|---|
| **Distance from Target (km)** | > 4 KM | > 3 KM to 4 KM | > 2 KM to 3 KM | > 1 KM to 2 KM | <= 1 KM |
| **Size (sqm)** | < 50 sqm or Unsuitable | 51 – 149 sqm | 149.5 – 301 sqm | 150 – 300 sqm | 200 – 250 sqm |
| **Store Height (m)** | < 2.5 meters or Unsuitable | 2.5 – 2.9 meters | 3.0 – 3.4 meters | 3.5 – 3.9 meters | 4.0 meters |
| **Price (vs. District Market Avg.)** | Above Market Avg. | 0 – 4% Below Market Avg. | 5 – 9% Below Market Avg. | 10 – 14% Below Market Avg. | 15%+ Below Market Avg. |
| **Contract Duration (years)** | < 4 years | 4 – 5 years | 6 – 7 years | 8 – 9 years | >= 10 years |
| **Store Status** | Occupied (long-term) > 6 months | Occupied (lease ending < 6 months) | Under Construction (long timeline > 6 months) | Under Construction (short timeline < 3 months) | Ready for Rent (immediate) |

---

## Scoring Examples

### Example 1: The Perfect Match (100%)

This branch perfectly aligns with all our ideal criteria, achieving the maximum possible score.

| Criterion | Input Value | Score (1–5) |
|---|---|:---:|
| Distance from Target (km) | 0.5 KM | **5** |
| Size (sqm) | 220 sqm | **5** |
| Store Height (m) | 4.0 meters | **5** |
| Price (vs. District Market Avg.) | 20% Below Market Avg. | **5** |
| Contract Duration (years) | 10 years | **5** |
| Store Status | Ready for Rent | **5** |
| **Total Score** | | **30 / 30** |

---

### Example 2: Strong Candidate (83%)

This branch is a strong potential candidate with only minor deviations from our ideal profile.

| Criterion | Input Value | Score (1–5) |
|---|---|:---:|
| Distance from Target (km) | 1.5 KM | **4** |
| Size (sqm) | 180 sqm | **5** |
| Store Height (m) | 3.7 meters | **4** |
| Price (vs. District Market Avg.) | 12% Below Market Avg. | **4** |
| Contract Duration (years) | 9 years | **4** |
| Store Status | Under Construction (short timeline < 3 months) | **4** |
| **Total Score** | | **25 / 30** |