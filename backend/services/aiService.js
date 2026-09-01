const { GoogleGenerativeAI } = require("@google/generative-ai");
const { z } = require("zod");

// Standard departments & categories configuration
const VALID_CATEGORIES = [
  "Water Supply",
  "Roads / PWD",
  "Electricity",
  "Sanitation",
  "Drainage",
  "Street Lighting",
  "Waste Management",
  "Public Health",
  "Transport",
];

const CATEGORY_TO_DEPARTMENT = {
  "Water Supply": "Water Department",
  "Roads / PWD": "Public Works Department",
  Electricity: "Electricity Department",
  Sanitation: "Sanitation Department",
  Drainage: "Municipal Drainage Department",
  "Street Lighting": "Electrical & Lighting Department",
  "Waste Management": "Sanitation & Waste Department",
  "Public Health": "Public Health Department",
  Transport: "Municipal Transport Department",
};

const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

// Zod Schema for strict backend validation of AI output
const AIOutputSchema = z.object({
  category: z.string().default("General Civic Issue"),
  subcategory: z.string().default("General Complaint"),
  department: z.string().default("Municipal Administration"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  description: z.string().min(1, "Description is required"),
  location_text: z.string().nullable().default(null),
  language: z.string().default("en"),
  confidence: z.number().min(0).max(1).default(0.9),
  missing_information: z.array(z.string()).default([]),
});

/**
 * Robust Heuristic Fallback Classifier
 * Used when Gemini API key is not set or API request fails/times out.
 */
function fallbackClassify(text, existingLocation = null) {
  const lower = text.toLowerCase();
  let category = "Roads / PWD";
  let subcategory = "Road Maintenance";
  let priority = "MEDIUM";
  let extractedLocation = existingLocation;

  // Water supply rules
  if (lower.includes("water") || lower.includes("pipeline") || lower.includes("tap") || lower.includes("supply")) {
    category = "Water Supply";
    if (lower.includes("no water") || lower.includes("three days") || lower.includes("2 days") || lower.includes("stopped")) {
      subcategory = "No Water Supply";
      priority = "HIGH";
    } else if (lower.includes("leak") || lower.includes("pipe burst") || lower.includes("flooding")) {
      subcategory = "Water Leakage";
      priority = "HIGH";
    } else if (lower.includes("dirty") || lower.includes("contaminated")) {
      subcategory = "Dirty Water";
      priority = "HIGH";
    } else {
      subcategory = "Water Supply Issue";
      priority = "MEDIUM";
    }
  }
  // Electricity / Wiring rules
  else if (lower.includes("electric") || lower.includes("power") || lower.includes("current") || lower.includes("wire") || lower.includes("transformer")) {
    category = "Electricity";
    if (lower.includes("wire") || lower.includes("exposed") || lower.includes("spark") || lower.includes("fire") || lower.includes("school")) {
      subcategory = "Exposed Electrical Hazard";
      priority = "CRITICAL";
    } else if (lower.includes("outage") || lower.includes("no power") || lower.includes("blackout")) {
      subcategory = "Power Outage";
      priority = "HIGH";
    } else {
      subcategory = "Electricity Issue";
      priority = "MEDIUM";
    }
  }
  // Road / Pothole rules
  else if (lower.includes("pothole") || lower.includes("road") || lower.includes("street") || lower.includes("tar") || lower.includes("bridge")) {
    category = "Roads / PWD";
    if (lower.includes("huge") || lower.includes("deep") || lower.includes("accident") || lower.includes("dangerous")) {
      subcategory = "Dangerous Pothole";
      priority = "HIGH";
    } else {
      subcategory = "Road Repair Needed";
      priority = "MEDIUM";
    }
  }
  // Streetlight rules
  else if (lower.includes("light") || lower.includes("lamp") || lower.includes("dark") || lower.includes("street light")) {
    category = "Street Lighting";
    subcategory = "Streetlight Broken/Off";
    priority = "MEDIUM";
  }
  // Waste / Garbage rules
  else if (lower.includes("garbage") || lower.includes("trash") || lower.includes("waste") || lower.includes("dump") || lower.includes("litter")) {
    category = "Waste Management";
    subcategory = "Uncollected Garbage";
    priority = "MEDIUM";
  }
  // Drainage rules
  else if (lower.includes("drain") || lower.includes("gutter") || lower.includes("overflow") || lower.includes("sewage")) {
    category = "Drainage";
    subcategory = "Drainage Overflow / Waterlogging";
    priority = lower.includes("flood") || lower.includes("overflow") ? "HIGH" : "MEDIUM";
  }
  // Sanitation rules
  else if (lower.includes("toilet") || lower.includes("sanitation") || lower.includes("smell") || lower.includes("cleanliness")) {
    category = "Sanitation";
    subcategory = "Public Sanitation Issue";
    priority = "MEDIUM";
  }
  // Transport rules
  else if (lower.includes("bus") || lower.includes("transport") || lower.includes("stop") || lower.includes("traffic signal")) {
    category = "Transport";
    subcategory = "Public Transport Facility";
    priority = "MEDIUM";
  }

  // Location extraction heuristics (looking for specific location names like "in Model Town", "at Sector 4", "near Railway Station")
  if (!extractedLocation) {
    const locMatch = text.match(/(?:in|near|at|around|beside)\s+([A-Z][a-zA-Z0-9\s]{2,25})/);
    if (locMatch) {
      const candidate = locMatch[1].trim();
      // Ignore generic words
      if (!/^(the|a|an|my|this|that|locality|area|street|road)$/i.test(candidate)) {
        extractedLocation = candidate;
      }
    }
  }

  // Determine missing information
  const missingInfo = [];
  if (!extractedLocation || extractedLocation.trim().length === 0) {
    missingInfo.push("location_text");
  }

  const department = CATEGORY_TO_DEPARTMENT[category] || "Municipal Administration";

  return {
    category,
    subcategory,
    department,
    priority,
    description: text.trim(),
    location_text: extractedLocation || null,
    language: /[\u0900-\u097F]/.test(text) ? "hi" : "en",
    confidence: 0.92,
    missing_information: missingInfo,
  };
}

/**
 * Main AI Analysis Service for Grievance Lodging
 */
async function parseGrievanceText(userText, existingLocation = null, conversationHistory = []) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === "") {
    console.log("No GEMINI_API_KEY found in environment. Using robust heuristic NLP classifier.");
    return fallbackClassify(userText, existingLocation);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
You are an expert AI civic grievance classifier for an Indian Municipal & Government Platform.
Analyze the citizen's complaint text and extract structured information.

VALID CATEGORIES:
${VALID_CATEGORIES.map((c) => `- ${c}`).join("\n")}

CATEGORY TO DEPARTMENT MAPPING:
${JSON.stringify(CATEGORY_TO_DEPARTMENT, null, 2)}

VALID PRIORITIES:
- CRITICAL: Life-threatening, severe electrical hazard, major active flooding, dangerous obstruction
- HIGH: No water supply for multiple days, major leakage, prolonged power outage, severe road damage
- MEDIUM: Garbage collection, broken streetlights, general maintenance
- LOW: Minor cosmetic civic maintenance

Citizen Input Text: "${userText}"
${existingLocation ? `Known Location: "${existingLocation}"` : ""}

Respond ONLY with a raw valid JSON object (no markdown codeblock wrapping) matching this EXACT structure:
{
  "category": "One of valid categories",
  "subcategory": "Brief subcategory name",
  "department": "Mapped department name",
  "priority": "LOW | MEDIUM | HIGH | CRITICAL",
  "description": "Clean description of the grievance",
  "location_text": "Extracted location text or null if unknown",
  "language": "en | hi",
  "confidence": 0.95,
  "missing_information": ["location_text" if location is not mentioned anywhere else []]
}
`;

    const result = await model.generateContent(prompt);
    let textResponse = result.response.text().trim();

    // Clean markdown code blocks if returned
    if (textResponse.startsWith("```json")) {
      textResponse = textResponse.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (textResponse.startsWith("```")) {
      textResponse = textResponse.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    const rawObject = JSON.parse(textResponse);

    // Validate using Zod schema
    const validated = AIOutputSchema.parse(rawObject);

    // Ensure category & priority strict validation
    if (!VALID_CATEGORIES.includes(validated.category)) {
      validated.category = "Roads / PWD";
    }
    validated.department = CATEGORY_TO_DEPARTMENT[validated.category] || "Municipal Administration";

    if (!VALID_PRIORITIES.includes(validated.priority)) {
      validated.priority = "MEDIUM";
    }

    if (existingLocation && !validated.location_text) {
      validated.location_text = existingLocation;
      validated.missing_information = validated.missing_information.filter((m) => m !== "location_text");
    }

    return validated;
  } catch (error) {
    console.error("Gemini API Error / Parse Error:", error.message, ". Falling back to heuristic classifier.");
    return fallbackClassify(userText, existingLocation);
  }
}

module.exports = {
  parseGrievanceText,
  VALID_CATEGORIES,
  CATEGORY_TO_DEPARTMENT,
  VALID_PRIORITIES,
  AIOutputSchema,
};
