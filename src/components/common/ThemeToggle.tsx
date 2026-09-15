import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', showLabel = false }) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative inline-flex items-center justify-center gap-2 p-2 rounded-xl transition-all duration-300 cursor-pointer border ${
        isDark
          ? 'bg-slate-800 text-amber-300 hover:bg-slate-700 border-slate-700 shadow-inner'
          : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200 shadow-xs'
      } ${className}`}
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-label="Alternar modo de color claro/oscuro"
    >
      <div className="relative w-5 h-5 flex items-center justify-center">
        {isDark ? (
          <Moon className="w-4 h-4 text-amber-300 animate-in spin-in-180 duration-300 fill-amber-300/20" />
        ) : (
          <Sun className="w-4 h-4 text-amber-500 animate-in spin-in-180 duration-300" />
        )}
      </div>
      {showLabel && (
        <span className="text-xs font-semibold select-none">
          {isDark ? 'Modo Oscuro' : 'Modo Claro'}
        </span>
      )}
    </button>
  );
};
