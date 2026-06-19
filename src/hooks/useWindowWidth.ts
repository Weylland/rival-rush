"use client";

import { useEffect, useState } from "react";

/**
 * Largeur de la fenêtre, réactive au redimensionnement / rotation.
 * SSR-safe : retourne `defaultWidth` côté serveur puis se synchronise au montage.
 * À utiliser pour dimensionner des grilles en pixels (ex : plateau Naval 10×10).
 */
export function useWindowWidth(defaultWidth = 390) {
  const [width, setWidth] = useState(defaultWidth);
  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return width;
}
