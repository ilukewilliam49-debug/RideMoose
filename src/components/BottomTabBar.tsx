import { Home, Grid3X3, ClipboardList, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const tabs = [
  { icon: Home, labelKey: "bottomNav.home", path: "/rider" },
  { icon: Grid3X3, labelKey: "bottomNav.services", path: "/rider/rides" },
  { icon: ClipboardList, labelKey: "bottomNav.activity", path: "/rider/activity" },
  { icon: User, labelKey: "bottomNav.account", path: "/rider/account" },
];

const BottomTabBar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-background/95 backdrop-blur-xl md:hidden">
      <div className="flex h-16 items-stretch">
        {tabs.map((tab) => {
          const isActive =
            tab.path === "/rider"
              ? location.pathname === "/rider"
              : location.pathname.startsWith(tab.path);

          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${
                isActive ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <tab.icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
              <span className={`text-[10px] ${isActive ? "font-bold" : "font-medium"}`}>
                {t(tab.labelKey)}
              </span>
            </button>
          );
        })}
      </div>
      {/* Safe area for phones with home indicators */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
};

export default BottomTabBar;
