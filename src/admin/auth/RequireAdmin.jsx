import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAdminAuth } from "./AdminAuthContext";

export default function RequireAdmin() {
  const { status } = useAdminAuth();
  const location = useLocation();

  if (status === "checking") {
    return <main className="admin-auth-check" role="status">Checking admin access…</main>;
  }

  if (status !== "authorized") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
