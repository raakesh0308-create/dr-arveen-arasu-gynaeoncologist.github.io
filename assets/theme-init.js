/* Applies the saved theme and text size before the page is drawn (kept in a file so the Content Security Policy needs no inline script). */
try{var t=JSON.parse(localStorage.getItem("arveen.theme"));if(t)document.documentElement.dataset.theme=t;var l=JSON.parse(localStorage.getItem("arveen.textlevel"));if(typeof l==="number")document.documentElement.style.fontSize=[87.5,100,112.5,125,137.5,150][Math.max(-1,Math.min(4,l))+1]+"%"}catch(e){}
/* Clickjacking protection (SECURITY_AUDIT.md M6): GitHub Pages cannot send a frame-ancestors header, so a page
   shown inside another website's frame hides itself and tries to open at the top level instead. */
if (window.top !== window.self) { document.documentElement.style.display = "none"; try { window.top.location.replace(window.self.location.href); } catch (e) {} }
