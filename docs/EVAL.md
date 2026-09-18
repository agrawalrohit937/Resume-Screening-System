# CareerPilot Evaluation Report

Golden dataset: `backend/eval/resumeJD2_pairs.csv` (500 labeled pairs across multi-domain occupations).

| Metric | Score | Target / Direction |
|---|---|---|
| **NDCG@10** | **0.5489** | Higher is better (CI gate: no drop > 0.02) |
| **NDCG@50** | **0.8148** | Higher is better |
| **Precision@10** | **0.7000** | Higher is better |
| **MRR** | **0.2500** | Higher is better |
| **Kendall Tau** | **-0.0148** | Higher is better |
| **Expected Calibration Error (ECE)** | **0.2640** | Lower is better |

*Evaluated on 50 candidate-job pairs.*
