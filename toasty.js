/* Easter egg: Konami code (↑ ↑ ↓ ↓ ← → ← → B A) → ¡Toasty! con Dieguito.
   En el celular: deslizar ↑ ↑ ↓ ↓ ← → ← → y después dos toques. */
(function () {
    const SEQ = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'];
    const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', b: 'b', B: 'b', a: 'a', A: 'a' };
    let pos = 0, busy = false, el = null, audio = null;

    function feed(k) {
        // un ↑ de más (↑ ↑ ↑ ↓ …) no corta la secuencia
        if (k === SEQ[pos]) pos++;
        else pos = k === 'up' ? (pos === 2 ? 2 : 1) : 0;
        if (pos === SEQ.length) { pos = 0; toasty(); }
    }

    function build() {
        const css = document.createElement('style');
        css.textContent = `
        .toasty { position: fixed; right: 0; bottom: 0; z-index: 9999; pointer-events: none;
            transform: translate(105%, 30%) rotate(8deg); transition: transform .32s cubic-bezier(.2,1.4,.4,1); }
        .toasty.in { transform: translate(0, 0) rotate(-6deg); }
        .toasty.out { transition: transform .35s ease-in; transform: translate(105%, 30%) rotate(8deg); }
        .toasty img { display: block; width: min(240px, 46vw); height: auto; border-radius: 14px 0 0 0;
            border: 3px solid #fd5006; border-right: 0; border-bottom: 0; box-shadow: -20px 20px 60px rgba(0,0,0,.6); }
        @media (prefers-reduced-motion: reduce) { .toasty, .toasty.out { transition: opacity .2s; } }`;
        document.head.appendChild(css);
        el = document.createElement('div');
        el.className = 'toasty'; el.setAttribute('aria-hidden', 'true');
        el.innerHTML = '<img src="assets/toasty.jpg" alt="">';
        document.body.appendChild(el);
        audio = new Audio('assets/toasty.mp3'); audio.preload = 'auto';
    }

    function toasty() {
        if (busy) return;
        busy = true;
        if (!el) build();
        el.classList.remove('out');
        void el.offsetWidth;
        el.classList.add('in');
        try { audio.currentTime = 0; audio.volume = 0.9; audio.play().catch(() => {}); } catch (e) {}
        setTimeout(() => { el.classList.add('out'); el.classList.remove('in'); }, 1100);
        setTimeout(() => { el.classList.remove('out'); busy = false; }, 1600);
    }

    window.addEventListener('keydown', e => {
        if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && !/^Arrow/.test(e.key)) return;
        const k = KEYS[e.key];
        if (k) feed(k); else pos = 0;
    });

    // táctil: swipes para las flechas, toques para B y A
    let sx = 0, sy = 0, st = 0;
    window.addEventListener('touchstart', e => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now(); }, { passive: true });
    window.addEventListener('touchend', e => {
        const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
        const ax = Math.abs(dx), ay = Math.abs(dy);
        if (Math.max(ax, ay) < 30) {
            if (Date.now() - st < 400 && pos >= 8) feed(SEQ[pos]); else pos = 0;
            return;
        }
        feed(ax > ay ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    }, { passive: true });

    window.toasty = toasty; // para probar desde la consola
})();
