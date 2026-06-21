import React from "react";

export default function AdminIndicator() {
  const token = localStorage.getItem("token");
  if (!token) return null;

  const logout = () => {
    localStorage.removeItem("token");
    window.dispatchEvent(new Event("rinkintel-auth-changed"));
    window.location.href = "/admin/login";
  };

  return (
    <div
      style={{
        position: "fixed",
        top: "6px",
        right: "10px",
        fontSize: "11px",
        color: "rgba(255,255,255,0.6)",
        background: "rgba(0,0,0,0.35)",
        padding: "3px 6px",
        borderRadius: "4px",
        zIndex: 9999,
        cursor: "pointer",
        userSelect: "none"
      }}
      onClick={logout}
      title="Logout"
    >
      admin
    </div>
  );
}
