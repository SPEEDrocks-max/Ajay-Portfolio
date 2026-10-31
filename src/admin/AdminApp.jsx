import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AdminAuthProvider, useAdminAuth } from "./auth/AdminAuthContext";
import RequireAdmin from "./auth/RequireAdmin";
import AdminLayout from "./components/AdminLayout";
import AdminLogin from "./pages/AdminLogin";
import Overview from "./pages/Overview";
import "./admin.css";

const HomeEditor = lazy(() => import("./pages/HomeEditor"));
const AboutEditor = lazy(() => import("./pages/AboutEditor"));
const MediaLibrary = lazy(() => import("./pages/MediaLibrary"));
const WorkCategories = lazy(() => import("./pages/WorkCategories"));
const VideoManager = lazy(() => import("./pages/VideoManager"));
const DesignStudio = lazy(() => import("./pages/DesignStudio"));
const SectionBuilder = lazy(() => import("./pages/SectionBuilder"));
const GlobalSettings = lazy(() => import("./pages/GlobalSettings"));

function LoginRoute() {
  const { status } = useAdminAuth();
  if (status === "checking") return <main className="admin-auth-check" role="status">Checking admin access…</main>;
  if (status === "authorized") return <Navigate to="/" replace />;
  return <AdminLogin />;
}

export default function AdminApp() {
  return (
    <BrowserRouter basename="/admin">
      <AdminAuthProvider>
        <Routes>
          <Route path="login" element={<LoginRoute />} />
          <Route element={<RequireAdmin />}>
            <Route element={<AdminLayout />}>
              <Route index element={<Overview />} />
              <Route path="home-editor" element={<Suspense fallback={<main className="admin-auth-check" role="status">Loading Home Editor…</main>}><HomeEditor /></Suspense>} />
              <Route path="about-editor" element={<Suspense fallback={<main className="admin-auth-check" role="status">Loading About Editor…</main>}><AboutEditor /></Suspense>} />
              <Route path="work-categories" element={<Suspense fallback={<main className="admin-auth-check" role="status">Loading Work &amp; Categories…</main>}><WorkCategories /></Suspense>} />
              <Route path="video-manager" element={<Suspense fallback={<main className="admin-auth-check" role="status">Loading Video Manager…</main>}><VideoManager /></Suspense>} />
              <Route path="media-library" element={<Suspense fallback={<main className="admin-auth-check" role="status">Loading media library…</main>}><MediaLibrary /></Suspense>} />
              <Route path="design-studio" element={<Suspense fallback={<main className="admin-auth-check" role="status">Loading Design Studio…</main>}><DesignStudio /></Suspense>} />
              <Route path="section-builder" element={<Suspense fallback={<main className="admin-auth-check" role="status">Loading Section Builder…</main>}><SectionBuilder /></Suspense>} />
              <Route path="global-settings" element={<Suspense fallback={<main className="admin-auth-check" role="status">Loading Global Settings…</main>}><GlobalSettings /></Suspense>} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AdminAuthProvider>
    </BrowserRouter>
  );
}
