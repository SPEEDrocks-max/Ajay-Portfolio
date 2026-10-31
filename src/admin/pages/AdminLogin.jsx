import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useAdminAuth } from "../auth/AdminAuthContext";

export default function AdminLogin() {
  const { notice, signIn } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const result = await signIn(email.trim(), password);
      if (result.authorized) {
        navigate(location.state?.from?.pathname || "/", { replace: true });
      } else if (result.status === "verification-error") {
        setError("We couldn’t verify admin access. Check your Supabase setup and try again.");
      }
    } catch (authError) {
      if (authError?.code === "invalid_credentials" || /invalid login credentials/i.test(authError?.message || "")) {
        setError("Email or password is incorrect.");
      } else {
        setError("Sign-in failed. Check your connection and Supabase configuration, then try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="admin-login">
      <section className="admin-login__card" aria-labelledby="admin-login-title">
        <a className="admin-login__brand" href="/" aria-label="Ajay Mehta portfolio home">AM <span>AJAY MEHTA</span></a>
        <p className="admin-login__eyebrow">PRIVATE WORKSPACE / 01</p>
        <h1 id="admin-login-title">Admin<br /><em>sign in.</em></h1>
        <p className="admin-login__intro">Use an authorized account to manage the portfolio workspace.</p>

        {notice && <p className="admin-alert" role="status">{notice}</p>}
        {!isSupabaseConfigured && <p className="admin-alert" role="status">Supabase isn’t configured yet. Add the project URL and publishable or anon key to `.env.local`.</p>}
        {error && <p className="admin-alert" role="alert">{error}</p>}

        <form className="admin-login__form" onSubmit={handleSubmit}>
          <label>Email address<input type="email" name="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={!isSupabaseConfigured || isSubmitting} /></label>
          <label>Password<input type="password" name="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} disabled={!isSupabaseConfigured || isSubmitting} /></label>
          <button type="submit" disabled={!isSupabaseConfigured || isSubmitting}>{isSubmitting ? "VERIFYING ACCESS…" : "SIGN IN"}<span aria-hidden="true">↗</span></button>
        </form>

        <p className="admin-login__footnote">Access is restricted to users explicitly listed in the Supabase admin allowlist. Public registration is disabled.</p>
      </section>
      <span className="admin-login__folio">AJAY MEHTA / ADMIN</span>
    </main>
  );
}
