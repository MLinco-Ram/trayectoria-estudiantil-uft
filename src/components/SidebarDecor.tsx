import React from 'react';
import { useTheme } from '../context/ThemeContext';

export function HexNetworkBackdrop() {
  return null;
}

export function HexPanelBackdrop() {
  return null;
}

export function SidebarFinisLogo() {
  const { isDark } = useTheme();
  return (
    <img
      src={isDark ? "/UFT_LogoHorizontal_Blanco.png" : "/UFT_LogoHorizontal_Negro.png"}
      alt="Universidad Finis Terrae"
      className="hidden md:block fixed bottom-4 left-5 h-8 w-auto object-contain pointer-events-none select-none z-30 transition-all duration-200"
    />
  );
}
