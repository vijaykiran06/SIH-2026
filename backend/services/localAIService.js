const { spawn } = require("child_process");
const path = require("path");
const { z } = require("zod");
const { generateResponseForIntent } = require("./localResponseService");

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

const AIOutputSchema = z.object({
  category: z.string().default("Roads / PWD"),
  subcategory: z.string().default("General Complaint"),
  department: z.string().default("Public Works Department"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  description: z.string().min(1, "Description is required"),
  location_text: z.string().nullable().default(null),
  language: z.string().default("en"),
  confidence: z.number().min(0).max(1).default(0.9),
  missing_information: z.array(z.string()).default([]),
  needs_clarification: z.boolean().default(false),
  explainable_features: z.array(z.string()).default([]),
  safety_override: z.string().nullable().default(null),
});

/**
 * Stage 1: Local Intent Classifier
 */
async function detectLocalIntent(userText) {
  return new Promise((resolve) => {
    const pyScript = path.join(__dirname, "../ml/predict_intent.py");
    const pyProcess = spawn("python", [pyScript, userText], { cwd: path.join(__dirname, "../ml") });

    let stdoutData = "";
    pyProcess.stdout.on("data", (data) => { stdoutData += data.toString(); });

    pyProcess.on("close", (code) => {
      if (code === 0 && stdoutData) {
        try {
          const res = JSON.parse(stdoutData);
          return resolve(res);
        } catch (e) {}
      }
      resolve({ intent: "UNKNOWN", confidence: 0.5 });
    });
  });
}

/**
 * Stage 2: Local Grievance Classifier
 */
async function parseGrievanceLocalML(userText, existingLocation = null) {
  return new Promise((resolve) => {
    const pyScript = path.join(__dirname, "../ml/predict.py");
    const args = [pyScript, userText];
    if (existingLocation) args.push(existingLocation);

    const pyProcess = spawn("python", args, { cwd: path.join(__dirname, "../ml") });

    let stdoutData = "";
    pyProcess.stdout.on("data", (data) => { stdoutData += data.toString(); });

    pyProcess.on("close", (code) => {
      if (code === 0 && stdoutData) {
        try {
          const rawObject = JSON.parse(stdoutData);
          const validated = AIOutputSchema.parse(rawObject);

          if (!VALID_CATEGORIES.includes(validated.category)) validated.category = "Roads / PWD";
          validated.department = CATEGORY_TO_DEPARTMENT[validated.category] || "Municipal Administration";
          if (!VALID_PRIORITIES.includes(validated.priority)) validated.priority = "MEDIUM";

          return resolve(validated);
        } catch (e) {}
      }
      resolve(fallbackLocalParser(userText, existingLocation));
    });
  });
}

/**
 * Two-Stage Local AI Pipeline with Conversation State Management
 */
async function processUserMessage(userText, existingState = null) {
  const text = userText.trim();
  const state = existingState || {};

  // Check if conversation state is waiting for a specific missing field (e.g. location_text)
  if (state.awaitingField === "location_text" && state.pendingGrievance) {
    const updatedGrievance = {
      ...state.pendingGrievance,
      location_text: text,
      missing_information: []
    };

    const aiMsg = `Got it. **${text}**. Here are the full details for your grievance:\n\n- **Department**: ${updatedGrievance.department}\n- **Category**: ${updatedGrievance.category} (${updatedGrievance.subcategory})\n- **Priority**: ${updatedGrievance.priority}\n- **Location**: ${text}\n\nIs this information correct?`;

    return {
      is_grievance: true,
      intent: "LOCATION_PROVIDED",
      ai_message: aiMsg,
      extracted_data: updatedGrievance,
      conversation_state: {
        ...state,
        awaitingField: null,
        pendingGrievance: updatedGrievance,
        readyForSubmission: true
      }
    };
  }

  // STAGE 1: Detect Intent
  const intentResult = await detectLocalIntent(text);
  const intent = intentResult.intent;

  // Handle NON-GRIEVANCE Intents (Greetings, Capabilities, Thanks, Denial, etc.)
  if (["GREETING", "CAPABILITIES", "THANKS", "DENIAL", "UNKNOWN"].includes(intent)) {
    const responseMessage = generateResponseForIntent(intent);

    return {
      is_grievance: false,
      intent: intent,
      ai_message: responseMessage,
      extracted_data: null,
      conversation_state: {
        ...state,
        lastIntent: intent
      }
    };
  }

  // Handle Medium Confidence GRIEVANCE
  if (intent === "GRIEVANCE" && intentResult.needs_clarification) {
    return {
      is_grievance: true,
      intent: "GRIEVANCE_CLARIFY",
      ai_message: "I understand that you are facing a civic problem. Please provide more details or your location/ward so I can help you lodge the grievance.",
      extracted_data: null,
      conversation_state: {
        ...state,
        awaitingField: "description",
        readyForSubmission: false
      }
    };
  }

  // Handle CORRECTION intent
  if (intent === "CORRECTION" && state.pendingGrievance) {
    return {
      is_grievance: true,
      intent: "CORRECTION",
      ai_message: "What details would you like to update? You can tell me the correct location or new problem description.",
      extracted_data: state.pendingGrievance,
      conversation_state: {
        ...state,
        awaitingField: "description",
        readyForSubmission: false
      }
    };
  }

  // STAGE 2: Execute Grievance Classifier for GRIEVANCE intent
  const grievanceResult = await parseGrievanceLocalML(text, state.pendingGrievance?.location_text || null);

  let awaitingField = null;
  let readyForSubmission = false;
  let responseMsg = "";

  if (grievanceResult.missing_information.includes("location_text") && !grievanceResult.location_text) {
    awaitingField = "location_text";
    responseMsg = `I understand you're reporting a **${grievanceResult.category}** issue (${grievanceResult.subcategory}). Where is this problem occurring? Please enter your locality or landmark.`;
  } else {
    readyForSubmission = true;
    responseMsg = generateResponseForIntent("GRIEVANCE", grievanceResult);
  }

  return {
    is_grievance: true,
    intent: "GRIEVANCE",
    ai_message: responseMsg,
    extracted_data: grievanceResult,
    conversation_state: {
      intent: "GRIEVANCE",
      awaitingField,
      pendingGrievance: grievanceResult,
      readyForSubmission
    }
  };
}

function fallbackLocalParser(text, existingLocation = null) {
  const lower = text.toLowerCase();
  let category = "Roads / PWD";
  let subcategory = "Road Repair Needed";
  let priority = "MEDIUM";

  if (lower.includes("water")) { category = "Water Supply"; subcategory = "No Water Supply"; priority = "HIGH"; }
  else if (lower.includes("electric") || lower.includes("wire")) { category = "Electricity"; subcategory = "Power Outage"; priority = "HIGH"; }

  return {
    category, subcategory, department: CATEGORY_TO_DEPARTMENT[category] || "Municipal Administration",
    priority, description: text.trim(), location_text: existingLocation, language: "en", confidence: 0.85,
    missing_information: existingLocation ? [] : ["location_text"], needs_clarification: !existingLocation
  };
}

module.exports = {
  processUserMessage,
  parseGrievanceLocalML,
  parseGrievanceText: async (text, loc) => {
    const res = await processUserMessage(text, { pendingGrievance: { location_text: loc } });
    return res.extracted_data || fallbackLocalParser(text, loc);
  },
  VALID_CATEGORIES,
  CATEGORY_TO_DEPARTMENT,
  VALID_PRIORITIES,
};
