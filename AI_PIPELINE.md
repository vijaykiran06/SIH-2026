# AI Pipeline Documentation

---

## 1. Natural Language Grievance Assistant Pipeline

```
Citizen Input (Text / Voice)
           │
           ▼
[ Language & Keyword Classifier ]
           │
           ▼
[ Google Gemini API (`gemini-1.5-flash`) ]
(Structured JSON Extraction Prompt)
           │
           ▼
[ Zod Schema Validator ]
(Enforces schema, valid categories & priority bounds)
           │
           ▼
[ Heuristic NLP Fallback Engine ]
(Guarantees offline reliability if API Key absent)
```

---

## 2. FAISS Vector Duplicate Detection & Clustering Engine

```
New Complaint Registered
           │
           ▼
[ Python Microservice: `backend/ml/duplicate_detector.py` ]
           │
 ┌─────────┴────────────────────────┐
 ▼                                  ▼
[ TF-IDF Sentence Similarity ]     [ Haversine Spatial Distance ]
           │                                  │
           └────────────────┬─────────────────┘
                            ▼
           [ Combined Similarity Score ]
                            │
               (If Score >= 0.45 or Match)
                            ▼
          Flagged as "POSSIBLE DUPLICATE"
           Grouped into master `INCIDENT-XXXX`
```

---

## 3. Database-Grounded AI Admin Assistant

To eliminate metric hallucination:
1. SQL aggregations query real database tables for total count, pending count, resolved count, escalated count, category breakdown, department breakdown.
2. Formatted SQL metrics context is injected into the LLM system prompt.
3. Gemini generates an analytical response grounded strictly in verified database figures.
