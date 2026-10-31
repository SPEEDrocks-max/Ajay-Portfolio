import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAdminAuth } from "../auth/AdminAuthContext";

const NAVIGATION = [
  { label: "Dashboard", path: "/", code: "01" },
  { label: "Home", path: "/home-editor", code: "02" },
  { label: "About", path: "/about-editor", code: "03" },
  { label: "Work", path: "/work-categories", code: "04" },
  { label: "Page Design", path: "/design-studio", code: "05" },
  { label: "Website Info", path: "/global-settings", code: "06" },
];

function getInitials(email = "") {
  const username = email.split("@")[0] || "Admin";
  return username.split(/[._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "A";
}

export default function AdminLayout() {
  const { user, signOut } = useAdminAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch {
      navigate("/login", { replace: true });
    }
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <a className="admin-brand" href="/admin/" aria-label="Ajay Mehta admin overview">
          <span className="admin-brand__mark">AM</span>
          <span><strong>AJAY MEHTA</strong><small>PORTFOLIO / ADMIN</small></span>
        </a>

        <div className="admin-sidebar__label">WORKSPACE</div>
        <nav className="admin-navigation" aria-label="Admin navigation">
          {NAVIGATION.map((item) => (
            <NavLink key={item.path} to={item.path} end={item.path === "/"} className={({ isActive }) => `admin-navigation__link${isActive ? " is-active" : ""}`}>
              <span className="admin-navigation__code">{item.code}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="admin-profile">
          <span className="admin-profile__avatar">{getInitials(user?.email)}</span>
          <span className="admin-profile__identity"><strong>{user?.email || "Admin"}</strong><small>AUTHORIZED ADMIN</small></span>
          <button className="admin-profile__logout" type="button" onClick={handleSignOut} aria-label="Log out" title="Log out">↗</button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div><span className="admin-topbar__eyebrow">PORTFOLIO CONTROL ROOM</span><span className="admin-topbar__status"><i /> ADMIN SESSION ACTIVE</span></div>
          <button className="admin-topbar__logout" type="button" onClick={handleSignOut}>LOG OUT <span aria-hidden="true">↗</span></button>
        </header>
        <div className="admin-content"><Outlet /></div>
      </main>
    </div>
  );
}
