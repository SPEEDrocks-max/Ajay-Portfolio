import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [status, setStatus] = useState(isSupabaseConfigured ? "checking" : "not-configured");
  const [user, setUser] = useState(null);
  const [notice, setNotice] = useState("");
  const verificationId = useRef(0);
  const verifiedAdminId = useRef(null);
  const verifyingAdminId = useRef(null);

  const verifyAdminSession = useCallback(async (session) => {
    const currentVerification = ++verificationId.current;
    if (!session?.user) {
      verifiedAdminId.current = null;
      verifyingAdminId.current = null;
      setUser(null);
      setStatus("unauthenticated");
      return { authorized: false, status: "unauthenticated" };
    }

    if (verifiedAdminId.current !== session.user.id) verifiedAdminId.current = null;
    verifyingAdminId.current = session.user.id;
    setStatus("checking");
    setUser(session.user);
    let timedOut = false;
    let rejectTimeout;
    const timeoutPromise = new Promise((_, reject) => { rejectTimeout = reject; });
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      rejectTimeout(new Error("Admin authorization check timed out."));
    }, 10000);
    try {
      const lookup = supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      const { data, error } = await Promise.race([lookup, timeoutPromise]);

      if (currentVerification !== verificationId.current) {
        return { authorized: false, status: "superseded" };
      }
      if (error) throw error;
      if (!data?.user_id) {
        verifiedAdminId.current = null;
        setNotice("Account is not authorized as an admin.");
        setUser(null);
        setStatus("unauthorized");
        void supabase.auth.signOut({ scope: "local" }).catch(() => {});
        return { authorized: false, status: "unauthorized" };
      }

      verifiedAdminId.current = session.user.id;
      setNotice("");
      setUser(session.user);
      setStatus("authorized");
      return { authorized: true, status: "authorized" };
    } catch (error) {
      if (currentVerification !== verificationId.current) {
        return { authorized: false, status: "superseded" };
      }
      verifiedAdminId.current = null;
      setNotice(timedOut
        ? "Admin access verification timed out. Check your connection and try again."
        : "Admin access verification failed. Check your connection and Supabase permissions, then try again.");
      setUser(null);
      setStatus("verification-error");
      void supabase.auth.signOut({ scope: "local" }).catch(() => {});
      return { authorized: false, status: "verification-error", error };
    } finally {
      window.clearTimeout(timeoutId);
      if (currentVerification === verificationId.current) verifyingAdminId.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let mounted = true;
    let initialSessionHandled = false;
    const sessionTimeoutId = window.setTimeout(() => {
      if (!mounted || initialSessionHandled) return;
      initialSessionHandled = true;
      setUser(null);
      setNotice("Session check timed out. Please try signing in again.");
      setStatus("verification-error");
    }, 10000);
    const checkSession = (session) => {
      if (mounted) void verifyAdminSession(session);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      initialSessionHandled = true;
      window.clearTimeout(sessionTimeoutId);
      if (session?.user?.id && session.user.id === verifiedAdminId.current) {
        setUser(session.user);
        setStatus("authorized");
        return;
      }
      if (session?.user?.id && session.user.id === verifyingAdminId.current) return;
      // Defer Supabase queries until after its auth callback finishes.
      window.setTimeout(() => checkSession(session), 0);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted || initialSessionHandled) return;
      initialSessionHandled = true;
      window.clearTimeout(sessionTimeoutId);
      checkSession(data.session);
    }).catch(() => {
      if (!mounted || initialSessionHandled) return;
      initialSessionHandled = true;
      window.clearTimeout(sessionTimeoutId);
      setUser(null);
      setNotice("Could not restore your session. Please sign in again.");
      setStatus("verification-error");
    });

    return () => {
      mounted = false;
      window.clearTimeout(sessionTimeoutId);
      verificationId.current += 1;
      subscription.unsubscribe();
    };
  }, [verifyAdminSession]);

  const signIn = useCallback(async (email, password) => {
    if (!isSupabaseConfigured) {
      throw new Error("Supabase is not configured. Add the project URL and publishable/anon key first.");
    }
    setNotice("");
    setStatus("checking");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setStatus("unauthenticated");
      throw error;
    }
    return verifyAdminSession(data.session);
  }, [verifyAdminSession]);

  const signOut = useCallback(async () => {
    setNotice("");
    try {
      if (supabase) {
        const { error } = await supabase.auth.signOut({ scope: "local" });
        if (error) throw error;
      }
    } finally {
      setUser(null);
      setStatus(isSupabaseConfigured ? "unauthenticated" : "not-configured");
    }
  }, []);

  return (
    <AdminAuthContext.Provider value={{ status, user, notice, signIn, signOut }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

// The provider and its hook intentionally live together to keep auth state private to the admin app.
// eslint-disable-next-line react-refresh/only-export-components
export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error("useAdminAuth must be used inside AdminAuthProvider.");
  return context;
}
