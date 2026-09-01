# JanSeva AI — Unified Multi-Department Grievance Redressal & Tracking Platform

> **Smart India Hackathon (SIH) Production Prototype**  
> *"AI-powered solution enabling ease of grievance lodging and tracking for citizens across multiple departments."*

---

## 🚀 Key Features Implemented (Phase 2 — AI Grievance Lodging)

1. **AI Grievance Assistant (`/citizen/grievance/new`)**:
   - Natural language conversational assistant for citizens.
   - Extracts `Category`, `Subcategory`, `Department`, `Priority` (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), `Description`, and `Location`.
   - Asks only minimal follow-up questions when critical details (such as location) are missing.
   - Converts natural text into validated, structured grievance data.

2. **Backend AI Validation & Fallback Parser**:
   - Integrated with Google Gemini API (`@google/generative-ai`) and strict Zod schema validation.
   - Includes a deterministic heuristic NLP fallback parser if the Gemini API key is missing or offline, ensuring 100% operational uptime.

3. **Grievance Confirmation Preview Card**:
   - Before submitting, citizens are shown a structured preview card containing Category, Subcategory, Department, Priority Badge, Location, and Summary.
   - Allows inline editing before final submission.

4. **Unique Tracking Number & Audit Trail**:
   - Generates non-sequential tracking IDs formatted as `GRV-2026-XXXXXX`.
   - Records the initial grievance state as `SUBMITTED` and writes an entry to `grievance_status_history` and `audit_logs`.

5. **Multi-Department Schema**:
   - Configurable department system including Water, PWD, Electricity, Sanitation, Drainage, Street Lighting, Waste, Health, Transport.

6. **Strict Security & RBAC**:
   - JWT authentication. Citizens can only create complaints under their own identity and can only view their own registered grievances.

---

## 🛠️ Tech Stack

* **Frontend**: React 18, Vite, Lucide-React Icons, Vanilla CSS (Slate Government Design System)
* **Backend**: Node.js, Express.js, JWT, bcryptjs, Zod
* **Database**: SQLite (`better-sqlite3`) with WAL mode, foreign keys, and indexing
* **AI Engine**: Google Gemini API (`gemini-1.5-flash`) + Zod Schema Validator + Heuristic Fallback

---

## 🔑 Demo Credentials

| Role | Email | Password |
| :--- | :--- | :--- |
| **Citizen** | `citizen@sih.gov.in` | `password123` |
| **Officer** | `officer@sih.gov.in` | `password123` |
| **Super Admin** | `admin@sih.gov.in` | `password123` |

---

## 💻 Running the Application Locally

### 1. Backend Server
```bash
cd backend
npm install
node seed.js
npm start
# Backend runs on http://localhost:5000
```

### 2. Frontend Application
```bash
cd frontend
npm install
npm run dev
# Frontend runs on http://localhost:3000
```

### 3. Automated Test Suite
```bash
cd backend
npm test
# Runs 10 automated test assertions for Phase 2
```

---

## 🎥 Phase 2 Demo Steps

1. Open `http://localhost:3000` in your browser.
2. Click **Citizen Demo (`citizen@sih.gov.in`)** to log in.
3. Click **Report a Grievance** (`/citizen/grievance/new`).
4. Type in natural language:
   > *"There has been no water supply in my locality for three days."*
5. AI detects:
   * **Category**: `Water Supply`
   * **Subcategory**: `No Water Supply`
   * **Department**: `Water Department`
   * **Priority**: `HIGH`
   * **Follow-up question**: *"Where is the problem occurring?"*
6. Type:
   > *"Model Town"*
7. System presents the **Grievance Confirmation Preview Card**.
8. Click **Confirm & Submit Grievance**.
9. System generates ticket ID **`GRV-2026-XXXXXX`** with status **`SUBMITTED`**.
10. Click **View My Grievances Dashboard** to verify the ticket on your dashboard.
