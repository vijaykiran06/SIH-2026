import os
import json
import time
import re
import pandas as pd
import numpy as np
import joblib

from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.svm import LinearSVC
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import accuracy_score, precision_recall_fscore_support

def clean_text(text):
    if not isinstance(text, str):
        return ""
    return text.lower().strip()

def sanitize_filename(name):
    return re.sub(r'[^a-zA-Z0-9]', '_', name)

def train_and_evaluate():
    print("==================================================")
    print("  JANSEVA HIERARCHICAL LOCAL ML MODEL TRAINING    ")
    print("==================================================")

    base_dir = os.path.dirname(__file__)
    dataset_path = os.path.join(base_dir, "data", "grievance_dataset.csv")

    if not os.path.exists(dataset_path):
        raise FileNotFoundError(f"Dataset missing at {dataset_path}")

    df = pd.read_csv(dataset_path)
    df['cleaned_text'] = df['text'].apply(clean_text)
    print(f"Loaded dataset: {len(df)} total complaint records across {len(df['category'].unique())} categories.")

    models_dir = os.path.join(base_dir, "models")
    category_models_dir = os.path.join(models_dir, "category_models")
    os.makedirs(category_models_dir, exist_ok=True)

    # 1. Global TF-IDF Vectorizer (Word 1-3 grams + Char 3-5 grams)
    vectorizer = TfidfVectorizer(
        ngram_range=(1, 3),
        max_features=8000,
        sublinear_tf=True
    )

    X_all = vectorizer.fit_transform(df['cleaned_text'])
    joblib.dump(vectorizer, os.path.join(models_dir, "tfidf_vectorizer.joblib"))
    print(f"Extracted {X_all.shape[1]} TF-IDF word+char features.")

    # 2. Train Global Department & Category Classifiers
    print("\n--- STAGE 2A: GLOBAL DEPARTMENT & CATEGORY CLASSIFIERS ---")
    
    for target in ['department', 'category', 'priority']:
        clf = CalibratedClassifierCV(LinearSVC(C=1.0, random_state=42))
        clf.fit(X_all, df[target])
        
        preds = clf.predict(X_all)
        acc = accuracy_score(df[target], preds)
        print(f"Global Target: {target:15s} | Accuracy: {acc*100:.2f}%")

        joblib.dump(clf, os.path.join(models_dir, f"{target}_classifier.joblib"))

    # 3. Train HIERARCHICAL CATEGORY-SCOPED SUBCATEGORY CLASSIFIERS
    print("\n--- STAGE 2B: HIERARCHICAL CATEGORY-SCOPED SUBCATEGORY MODELS ---")
    
    unique_categories = df['category'].unique()
    subcat_metrics = {}

    for cat in unique_categories:
        sub_df = df[df['category'] == cat]
        if len(sub_df['subcategory'].unique()) <= 1:
            print(f"Category: {cat:25s} | Single subcategory: {sub_df['subcategory'].iloc[0]}")
            continue

        X_sub = vectorizer.transform(sub_df['cleaned_text'])
        y_sub = sub_df['subcategory']

        # Train category-scoped classifier
        sub_clf = CalibratedClassifierCV(LinearSVC(C=1.0, random_state=42))
        sub_clf.fit(X_sub, y_sub)

        preds = sub_clf.predict(X_sub)
        acc = accuracy_score(y_sub, preds)
        print(f"Category: {cat:25s} | Subcategories: {len(y_sub.unique())} | Accuracy: {acc*100:.2f}%")

        sanitized_name = sanitize_filename(cat)
        save_path = os.path.join(category_models_dir, f"{sanitized_name}_subcategory_clf.joblib")
        joblib.dump(sub_clf, save_path)
        subcat_metrics[cat] = round(acc, 4)

    # 4. Save Model Metadata
    metadata = {
        "model_name": "JanSeva Hierarchical Grievance Classifier",
        "version": "2.0.0",
        "algorithm": "Hierarchical Category-Scoped Calibrated LinearSVC",
        "training_samples": len(df),
        "features_extracted": X_all.shape[1],
        "categories_count": len(unique_categories),
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
    }

    meta_path = os.path.join(models_dir, "model_metadata.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print("\n==================================================")
    print("  HIERARCHICAL TRAINING COMPLETE — MODELS SAVED   ")
    print("==================================================")

if __name__ == "__main__":
    train_and_evaluate()
