import { Routes, Route, Navigate } from "react-router-dom";
import MapPage from "./pages/MapPage";
import LoginPage from "./pages/LoginPage";
import AdminPage from "./pages/AdminPage";
import ScenarioComparePage from "./pages/ScenarioComparePage";

function getRole() {
  return localStorage.getItem("role") || "";
}
function getToken() {
  return localStorage.getItem("token") || "";
}

function RequireAuth({ children }) {
  const token = getToken();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function RequireAdmin({ children }) {
  const token = getToken();
  const role = getRole();
  if (!token) return <Navigate to="/login" replace />;
  if (role !== "admin") return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      {/* Login */}
      <Route path="/login" element={<LoginPage />} />

      {/* Harita (login zorunlu) */}
      <Route
        path="/"
        element={
          <RequireAuth>
            <MapPage />
          </RequireAuth>
        }
      />

      {/* Senaryo karşılaştırma (login zorunlu) */}
      <Route
        path="/compare"
        element={
          <RequireAuth>
            <ScenarioComparePage />
          </RequireAuth>
        }
      />

      {/* Admin panel (admin zorunlu) */}
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminPage />
          </RequireAdmin>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}