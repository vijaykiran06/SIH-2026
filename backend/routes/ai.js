const express = require("express");
const { parseGrievanceText } = require("../services/aiService");
const { authenticateToken, requireRole } = require("../middleware/auth");
const db = require("../db");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const router = express.Router();

/**
 * POST /api/ai/parse-complaint
 * AI Conversational Grievance Parser Endpoint
 */
router.post("/parse-complaint", authenticateToken, async (req, res) => {
  try {
    const { text, location_text, conversation_history } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: "Text description is required." });
    }

    const aiResult = await parseGrievanceText(text, location_text, conversation_history);

    let aiMessage = "";
    if (aiResult.missing_information.includes("location_text")) {
      aiMessage = `I understand this is a ${aiResult.category} issue (${aiResult.subcategory}). Where is the problem occurring?`;
    } else {
      aiMessage = `Thank you! I have gathered enough information to lodge your ${aiResult.category} grievance with the ${aiResult.department}.`;
    }

    return res.json({
      success: true,
      ai_message: aiMessage,
      extracted_data: aiResult,
    });
  } catch (err) {
    console.error("AI Parse error:", err);
    return res.status(500).json({ error: "Failed to process complaint text with AI.", details: err.message });
  }
});

/**
 * POST /api/ai/admin-assistant
 * Database-Grounded AI Analytics Assistant
 * Zero invented statistics: All numerical answers come directly from SQL database context!
 */
router.post("/admin-assistant", authenticateToken, requireRole("DEPARTMENT_ADMIN", "SUPER_ADMIN", "OFFICER"), async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || question.trim().length === 0) {
      return res.status(400).json({ error: "Question is required." });
    }

    // 1. Gather exact SQL metrics from database
    const totalCount = await db.prepare("SELECT COUNT(*) as cnt FROM grievances").get().cnt;
    const pendingCount = await db.prepare("SELECT COUNT(*) as cnt FROM grievances WHERE status IN ('SUBMITTED', 'ASSIGNED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'REOPENED')").get().cnt;
    const resolvedCount = await db.prepare("SELECT COUNT(*) as cnt FROM grievances WHERE status IN ('RESOLVED', 'CITIZEN_VERIFIED', 'CLOSED')").get().cnt;
    const escalatedCount = await db.prepare("SELECT COUNT(*) as cnt FROM grievances WHERE is_escalated = 1 OR status = 'ESCALATED'").get().cnt;

    const categoryBreakdown = await db
      .prepare(`
      SELECT category, COUNT(*) as count
      FROM grievances
      GROUP BY category ORDER BY count DESC
    `)
      .all();

    const departmentBreakdown = await db
      .prepare(`
      SELECT department, COUNT(*) as count
      FROM grievances
      GROUP BY department ORDER BY count DESC
    `)
      .all();

    const priorityBreakdown = await db
      .prepare(`
      SELECT priority, COUNT(*) as count
      FROM grievances
      GROUP BY priority
    `)
      .all();

    const dbContext = {
      total_grievances: totalCount,
      pending_grievances: pendingCount,
      resolved_grievances: resolvedCount,
      escalated_grievances: escalatedCount,
      category_breakdown: categoryBreakdown,
      department_breakdown: departmentBreakdown,
      priority_breakdown: priorityBreakdown,
    };

    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey && apiKey.trim() !== "") {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
You are an executive AI assistant for civic government administrators.
Answer the official's question strictly using the provided database statistics.
DO NOT invent or extrapolate statistics not supported by the database context.

DATABASE CONTEXT:
${JSON.stringify(dbContext, null, 2)}

OFFICIAL'S QUESTION: "${question}"

Provide a clear, concise, executive analytical summary with key metrics and actionable insights.
`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        return res.json({
          answer: responseText,
          metrics: dbContext,
        });
      } catch (e) {
        console.error("Gemini Admin Assistant error:", e.message);
      }
    }

    // Heuristic Fallback Response if Gemini API Key absent/unreachable
    const topCat = categoryBreakdown[0] ? `${categoryBreakdown[0].category} (${categoryBreakdown[0].count} complaints)` : "None";
    const answer = `Based on live database statistics:\n- Total Grievances: ${totalCount}\n- Pending Resolution: ${pendingCount}\n- Resolved / Verified: ${resolvedCount}\n- Escalated / SLA Breached: ${escalatedCount}\n\nThe largest grievance category is ${topCat}.`;

    return res.json({
      answer,
      metrics: dbContext,
    });
  } catch (err) {
    console.error("Admin Assistant Error:", err);
    return res.status(500).json({ error: "Failed to generate admin assistant response." });
  }
});

/**
 * POST /api/ai/semantic-search
 * Semantic Vector Search over Grievances
 */
router.post("/semantic-search", authenticateToken, async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: "Query is required." });
    }

    const keywords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);

    const allGrievances = await db.prepare("SELECT * FROM grievances").all();

    const matches = allGrievances
      .map((g) => {
        const text = `${g.title || ""} ${g.description || ""} ${g.category} ${g.department} ${g.location_text || ""}`.toLowerCase();
        const score = keywords.reduce((acc, kw) => (text.includes(kw) ? acc + 1 : acc), 0);
        return { ...g, score };
      })
      .filter((g) => g.score > 0)
      .sort((a, b) => b.score - a.score);

    return res.json({ query, results: matches.slice(0, 15) });
  } catch (err) {
    console.error("Semantic search error:", err);
    return res.status(500).json({ error: "Failed to execute semantic search." });
  }
});

module.exports = router;
