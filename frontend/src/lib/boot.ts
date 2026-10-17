export const BOOT_KEY = "xt_booted";

/** Inline <head> script: hides the boot overlay before paint for returning visitors / reduced motion. */
export const bootGuardScript = `try{if(sessionStorage.getItem("${BOOT_KEY}")||matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.dataset.booted="1"}catch(e){}`;
