import os
import sys
import json
import joblib
import numpy as np

def load_intent_model():
    base_dir = os.path.dirname(__file__)
    models_dir = os.path.join(base_dir, "models")

    clf_path = os.path.join(models_dir, "intent_classifier.joblib")
    vec_path = os.path.join(models_dir, "intent_vectorizer.joblib")

    if not os.path.exists(clf_path) or not os.path.exists(vec_path):
        raise FileNotFoundError("Intent model artifacts missing. Run train_intent_model.py first.")

    clf = joblib.load(clf_path)
    vectorizer = joblib.load(vec_path)
    return clf, vectorizer

try:
    INTENT_CLF, INTENT_VEC = load_intent_model()
except Exception as e:
    INTENT_CLF, INTENT_VEC = None, None

def predict_intent(text):
    if not INTENT_CLF or not INTENT_VEC:
        return {"intent": "UNKNOWN", "confidence": 0.0, "error": "Model not loaded"}

    cleaned = text.lower().strip()

    # Rule checks for exact ultra-short greetings/thanks to guarantee 100% precision
    if cleaned in ["hi", "hello", "hey", "hii", "hiii", "hello there", "hey there", "good morning", "good afternoon", "good evening", "namaste", "namaskar"]:
        return {"intent": "GREETING", "confidence": 0.99}
    if cleaned in ["thanks", "thank you", "thankyou", "thanks a lot", "thank you so much", "dhanyawad", "shukriya"]:
        return {"intent": "THANKS", "confidence": 0.99}
    if cleaned in ["yes", "yeah", "yep", "correct", "confirm", "proceed", "submit it", "ha", "haan"]:
        return {"intent": "CONFIRMATION", "confidence": 0.99}
    if cleaned in ["no", "nope", "incorrect", "cancel", "stop", "na", "nahi"]:
        return {"intent": "DENIAL", "confidence": 0.99}

    X = INTENT_VEC.transform([cleaned])
    predicted_intent = INTENT_CLF.predict(X)[0]

    if hasattr(INTENT_CLF, "predict_proba"):
        probs = INTENT_CLF.predict_proba(X)[0]
        confidence = float(np.max(probs))
    else:
        confidence = 0.90

    # Low confidence threshold -> UNKNOWN
    if confidence < 0.35 and predicted_intent != "GRIEVANCE":
        predicted_intent = "UNKNOWN"

    return {
        "intent": predicted_intent,
        "confidence": round(confidence, 2)
    }

if __name__ == "__main__":
    input_text = sys.argv[1] if len(sys.argv) > 1 else "hi hello"
    res = predict_intent(input_text)
    print(json.dumps(res, indent=2))
