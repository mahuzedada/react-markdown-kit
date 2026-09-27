/**
 * Runs in the head before the first paint: the colour mode the visitor chose
 * (`localStorage.theme`, the key the navbar toggle and the demos write), or
 * the system's.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`
