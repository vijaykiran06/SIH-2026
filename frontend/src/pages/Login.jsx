import React, { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { LogIn, UserCheck, Shield, ShieldAlert, Sparkles } from "lucide-react";

export default function Login() {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const [email, setEmail] = useState("citizen@sih.gov.in");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (demoEmail) => {
    setEmail(demoEmail);
    setPassword("password123");
    setLoading(true);
    setError("");
    try {
      await login(demoEmail, "password123");
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "450px", margin: "3rem auto" }}>
      <div className="card">
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div className="brand-icon" style={{ margin: "0 auto 0.75rem", width: "48px", height: "48px" }}>
            <ShieldAlert size={28} />
          </div>
          <h2 style={{ fontSize: "1.5rem" }}>SIH Unified Portal Login</h2>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Citizen Grievance Lodging & Officer / Admin Resolution Platform
          </p>
        </div>

        {error && (
          <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", color: "#f87171", padding: "0.75rem", borderRadius: "8px", fontSize: "0.85rem", marginBottom: "1rem" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label className="preview-label">Email Address</label>
            <input
              type="email"
              className="chat-input"
              style={{ width: "100%", marginTop: "0.25rem" }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="preview-label">Password</label>
            <input
              type="password"
              className="chat-input"
              style={{ width: "100%", marginTop: "0.25rem" }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: "0.5rem" }} disabled={loading}>
            <LogIn size={18} /> {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        <div style={{ marginTop: "1.5rem", paddingTop: "1.25rem", borderTop: "1px solid var(--border-color)" }}>
          <div style={{ fontSize: "0.8rem", color: "#94a3b8", textAlign: "center", marginBottom: "0.75rem" }}>
            ⚡ SIH QUICK DEMO LOGIN ACCOUNTS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <button
              type="button"
              className="btn btn-outline"
              style={{ fontSize: "0.8rem", justifyContent: "flex-start" }}
              onClick={() => handleQuickLogin("citizen@sih.gov.in")}
            >
              <UserCheck size={14} style={{ color: "#3b82f6" }} /> Citizen Demo (`citizen@sih.gov.in`)
            </button>
            <button
              type="button"
              className="btn btn-outline"
              style={{ fontSize: "0.8rem", justifyContent: "flex-start" }}
              onClick={() => handleQuickLogin("officer@sih.gov.in")}
            >
              <Shield size={14} style={{ color: "#f59e0b" }} /> Water Officer Demo (`officer@sih.gov.in`)
            </button>
            <button
              type="button"
              className="btn btn-outline"
              style={{ fontSize: "0.8rem", justifyContent: "flex-start" }}
              onClick={() => handleQuickLogin("admin@sih.gov.in")}
            >
              <Sparkles size={14} style={{ color: "#8b5cf6" }} /> Executive Super Admin (`admin@sih.gov.in`)
            </button>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: "1.25rem", fontSize: "0.85rem", color: "#94a3b8" }}>
          Don't have an account? <Link to="/register">Register Citizen Account</Link>
        </div>
      </div>
    </div>
  );
}
