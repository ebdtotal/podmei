import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Cada troca de menu abre a página no topo, sem herdar a rolagem da tela anterior. */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    const jump = () => {
      const root = document.documentElement;
      const prev = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      root.scrollTop = 0;
      document.body.scrollTop = 0;
      root.style.scrollBehavior = prev;
    };
    jump();
    const frame = window.requestAnimationFrame(jump);
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  return null;
}
