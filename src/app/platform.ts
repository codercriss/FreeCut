/** iPhone only (Safari, Chrome and the installed PWA on iOS all report "iPhone"). */
export const IS_IPHONE =
  typeof navigator !== "undefined" &&
  (/iPhone|iPod/.test(navigator.userAgent) || navigator.platform === "iPhone");

interface StandaloneNavigator extends Navigator {
  standalone?: boolean;
}

/** Installed to the Home Screen (standalone). Only there can we trust screen size = visible area. */
export const IS_STANDALONE =
  typeof window !== "undefined" &&
  ((window.navigator as StandaloneNavigator).standalone === true ||
    (!!window.matchMedia && window.matchMedia("(display-mode: standalone)").matches));
