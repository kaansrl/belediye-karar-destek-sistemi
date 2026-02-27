import { Navigate, useLocation } from "react-router-dom";

export default function RequireAuth({ children }) {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  // login yoksa direkt login'e
  if (!token || !role) {
    return <Navigate to="/login" replace state={{ from: useLocation() }} />;
  }

  return children;
}