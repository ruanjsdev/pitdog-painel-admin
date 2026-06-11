import { useEffect, useState } from "react";

import Login from "./pages/Login";
import { Dashboard } from "./pages/dashboard";
import {
  adminSessionExpiredEvent,
  clearAdminSession,
  hasAdminSession,
} from "./services/admin-api";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(hasAdminSession);
  const [sessionMessage, setSessionMessage] = useState("");

  useEffect(() => {
    const handleSessionExpired = () => {
      setIsAuthenticated(false);
      setSessionMessage("Sua sessão expirou. Entre novamente para continuar.");
    };

    window.addEventListener(adminSessionExpiredEvent, handleSessionExpired);

    return () => {
      window.removeEventListener(adminSessionExpiredEvent, handleSessionExpired);
    };
  }, []);

  function handleLogin() {
    setSessionMessage("");
    setIsAuthenticated(true);
  }

  function handleLogout() {
    clearAdminSession();
    setSessionMessage("");
    setIsAuthenticated(false);
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} sessionMessage={sessionMessage} />;
  }

  return <Dashboard onLogout={handleLogout} />;
}
