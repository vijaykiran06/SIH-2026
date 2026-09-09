import os
import sys
import json
import re
import joblib
import numpy as np

from location_extractor import extract_location

def sanitize_filename(name):
    return re.sub(r'[^a-zA-Z0-9]', '_', name)

def load_models():
    base_dir = os.path.dirname(__file__)
    models_dir = os.path.join(base_dir, "models")
    cat_models_dir = os.path.join(models_dir, "category_models")

    vec_path = os.path.join(models_dir, "tfidf_vectorizer.joblib")
    if not os.path.exists(vec_path):
        raise FileNotFoundError(f"Vectorizer missing at {vec_path}. Run train_model.py first.")

    vectorizer = joblib.load(vec_path)

    global_classifiers = {}
    for target in ['department', 'category', 'priority']:
        clf_path = os.path.join(models_dir, f"{target}_classifier.joblib")
        if not os.path.exists(clf_path):
            raise FileNotFoundError(f"Global classifier for {target} missing at {clf_path}")
        global_classifiers[target] = joblib.load(clf_path)

    category_subcat_classifiers = {}
    if os.path.exists(cat_models_dir):
        for fname in os.listdir(cat_models_dir):
            if fname.endswith("_subcategory_clf.joblib"):
                clf_path = os.path.join(cat_models_dir, fname)
                category_subcat_classifiers[fname] = joblib.load(clf_path)

    return vectorizer, global_classifiers, category_subcat_classifiers

try:
    VECTORIZER, GLOBAL_CLASSIFIERS, CAT_SUBCAT_CLASSIFIERS = load_models()
except Exception as e:
    VECTORIZER, GLOBAL_CLASSIFIERS, CAT_SUBCAT_CLASSIFIERS = None, None, None

def get_top_features(text, vectorizer, top_n=4):
    """Extract top contributing TF-IDF terms for explainability."""
    feature_names = np.array(vectorizer.get_feature_names_out())
    tfidf_matrix = vectorizer.transform([text.lower()])
    feature_index = tfidf_matrix.nonzero()[1]
    tfidf_scores = tfidf_matrix.data

    sorted_items = sorted(zip(feature_index, tfidf_scores), key=lambda x: x[1], reverse=True)
    top_terms = [feature_names[i] for i, score in sorted_items[:top_n]]
    return top_terms

def check_safety_overrides(text, current_priority):
    """Deterministic safety override layer for critical life-threatening hazards."""
    lower = text.lower()
    critical_keywords = [
        "exposed live wire", "live wire", "sparking transformer", "transformer sparking",
        "electrical fire", "gas leak", "bridge collapse", "building collapse",
        "live electrical wire", "open manhole hazard"
    ]
    for kw in critical_keywords:
        if kw in lower:
            return "CRITICAL", f"Safety Override Triggered: Detected high-risk pattern '{kw}'"
    return current_priority, None

def predict_grievance(text, existing_location=None):
    if not VECTORIZER or not GLOBAL_CLASSIFIERS:
        return {"error": "Local ML models not loaded. Please run train_model.py first."}

    cleaned = text.lower().strip()
    X = VECTORIZER.transform([cleaned])

    # STAGE 2A: Predict Category, Department & Priority
    category = GLOBAL_CLASSIFIERS['category'].predict(X)[0]
    department = GLOBAL_CLASSIFIERS['department'].predict(X)[0]
    priority = GLOBAL_CLASSIFIERS['priority'].predict(X)[0]

    # Calculate Category Confidence
    if hasattr(GLOBAL_CLASSIFIERS['category'], "predict_proba"):
        cat_probs = GLOBAL_CLASSIFIERS['category'].predict_proba(X)[0]
        category_confidence = float(np.max(cat_probs))
    else:
        category_confidence = 0.90

    # STAGE 2B: HIERARCHICAL SUBCATEGORY CLASSIFICATION
    subcategory = "General Complaint"
    subcat_probs = {}

    sanitized_cat = sanitize_filename(category)
    model_fname = f"{sanitized_cat}_subcategory_clf.joblib"

    if model_fname in CAT_SUBCAT_CLASSIFIERS:
        sub_clf = CAT_SUBCAT_CLASSIFIERS[model_fname]
        subcategory = sub_clf.predict(X)[0]

        if hasattr(sub_clf, "predict_proba"):
            classes = sub_clf.classes_
            probs = sub_clf.predict_proba(X)[0]
            for cls, prob in zip(classes, probs):
                subcat_probs[cls] = round(float(prob), 4)
            # Sort subcat probabilities descending
            subcat_probs = dict(sorted(subcat_probs.items(), key=lambda item: item[1], reverse=True))

    # Priority Safety Override Check
    final_priority, override_reason = check_safety_overrides(text, priority)

    # Location Extraction
    extracted_loc = extract_location(text, existing_location)

    # Explainability features
    top_terms = get_top_features(text, VECTORIZER, top_n=4)

    missing_info = []
    if not extracted_loc:
        missing_info.append("location_text")

    needs_clarification = category_confidence < 0.65 or len(missing_info) > 0

    return {
        "department": department,
        "category": category,
        "subcategory": subcategory,
        "priority": final_priority,
        "description": text.strip(),
        "location_text": extracted_loc,
        "language": "hi" if any("\u0900" <= c <= "\u097f" for c in text) else "en",
        "confidence": round(category_confidence, 2),
        "subcategory_probabilities": subcat_probs,
        "missing_information": missing_info,
        "needs_clarification": needs_clarification,
        "explainable_features": top_terms,
        "safety_override": override_reason
    }

def print_judge_demo(input_text, result):
    """Formatted debug output for SIH judges demo."""
    print("================================================")
    print("JANSEVA LOCAL HIERARCHICAL AI - OFFLINE DEMO")
    print("================================================")
    print(f"Input:        {input_text}")
    print(f"Department:   {result.get('department')}")
    print(f"Category:     {result.get('category')}")
    print(f"Subcategory:  {result.get('subcategory')}")
    print(f"Priority:     {result.get('priority')}")
    print(f"Confidence:   {int(result.get('confidence', 0) * 100)}%")
    print(f"Location:     {result.get('location_text') or 'Not Detected'}")
    print("\nSubcategory Probabilities:")
    for sub, p in result.get('subcategory_probabilities', {}).items():
        print(f"  - {sub:30s}: {int(p*100):2d}%")
    print(f"\nEvidence Terms: {', '.join(result.get('explainable_features', []))}")
    if result.get('safety_override'):
        print(f"Override:       {result.get('safety_override')}")
    print("================================================")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        user_input = sys.argv[1]
        loc_arg = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] != "--json" else None
        res = predict_grievance(user_input, loc_arg)

        if "--json" in sys.argv or not sys.stdout.isatty():
            print(json.dumps(res, indent=2))
        else:
            print_judge_demo(user_input, res)
    else:
        sample = "i am rahul shamram i am fine so the problem is that there is a road on that road there is a pipe that is leaking and road is full of water"
        res = predict_grievance(sample)
        print_judge_demo(sample, res)
