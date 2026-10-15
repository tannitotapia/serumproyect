// Simulador: panel fijo (horizontal) vs panel orientable.
// Modelo simple: el sol cruza el cielo de 6 a 18 h.
// Fijo: potencia relativa = sin(elevación). Orientable: apunta al sol, 100 %.
const $ = id => document.getElementById(id);
const hora = $('hora');

function actualizar() {
  const h = parseFloat(hora.value);
  const e = ((h - 6) / 12) * Math.PI;           // 0 a 180° en radianes
  const x = 210 - 170 * Math.cos(e);
  const y = 200 - 170 * Math.sin(e);

  ['simSun', 'simGlow'].forEach(id => { $(id).setAttribute('cx', x.toFixed(1)); $(id).setAttribute('cy', y.toFixed(1)); });

  // Rayos del sol hacia el centro de cada panel
  [['rayoF', 120, 158], ['rayoM', 300, 162]].forEach(([id, px, py]) => {
    const r = $(id);
    r.setAttribute('x1', x.toFixed(1)); r.setAttribute('y1', y.toFixed(1));
    r.setAttribute('x2', px); r.setAttribute('y2', py);
  });

  // El panel orientable gira hasta quedar perpendicular al sol
  const giro = -(90 - (e * 180) / Math.PI);
  $('panelMovil').setAttribute('transform', `translate(300 162) rotate(${giro.toFixed(1)})`);

  const fijo = Math.max(0, Math.sin(e)) * 100;
  $('barFijo').style.width = fijo.toFixed(0) + '%';
  $('pFijo').textContent = fijo.toFixed(0) + ' %';

  const hh = Math.floor(h);
  $('horaOut').textContent = `${hh}:${Math.round((h - hh) * 60).toString().padStart(2, '0')}`;
}
hora.addEventListener('input', actualizar);
actualizar();

// Menú: resalta la sección visible
const links = [...document.querySelectorAll('.top nav a')];
const obs = new IntersectionObserver(es => es.forEach(en => {
  if (en.isIntersecting) links.forEach(l => l.classList.toggle('on', l.getAttribute('href') === '#' + en.target.id));
}), { rootMargin: '-45% 0px -50% 0px' });
document.querySelectorAll('main section[id]').forEach(s => obs.observe(s));


// Cómo funciona: las etapas avanzan al desplazarse y la cámara del diagrama las sigue
(() => {
  const g = id => document.getElementById(id);
  const diag = g('diag'), btnPanel = g('btnPanel'), btnFuente = g('btnFuente'), batTxt = g('batEstado'), upsTxt = g('conmEstado');
  const stgNum = g('stgNum'), stgName = g('stgName'), progBar = g('progBar'), stage = document.querySelector('.flow-stage');
  const steps = [...document.querySelectorAll('.fstep')], trk = [...document.querySelectorAll('.ftrk')], sts = [...diag.querySelectorAll('.st')], lvls = [...diag.querySelectorAll('.lvl')];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Altura de la barra superior, para que el diagrama quede pegado justo debajo
  const barra = document.querySelector('.top');
  const medirBarra = () => { document.documentElement.style.setProperty('--hh', barra.offsetHeight + 'px'); document.documentElement.style.setProperty('--sh', stage.offsetHeight + 'px'); };
  medirBarra(); addEventListener('resize', medirBarra);

  // Cámara: a qué zona del diagrama se acerca en cada etapa (centro x, centro y, ancho)
  const ASPECT = 545 / 980;
  const cam = (cx, cy, w) => { const h = w * ASPECT; return [Math.min(Math.max(cx - w / 2, 0), 980 - w), Math.min(Math.max(cy - h / 2, 0), 545 - h), w, h]; };
  const CAMS = [cam(170, 165, 360), cam(238, 150, 360), cam(375, 150, 360), cam(545, 155, 360), cam(698, 215, 480), cam(850, 150, 340), cam(470, 300, 720), cam(490, 272.5, 980)];
  let vb = [...CAMS[0]], objetivo = CAMS[0], raf = 0, etapa = -1;
  const ponerVB = () => diag.setAttribute('viewBox', vb.map(v => v.toFixed(1)).join(' '));
  function mover() {
    let seguir = false;
    for (let i = 0; i < 4; i++) { const d = objetivo[i] - vb[i]; if (Math.abs(d) > 0.2) { vb[i] += d * 0.1; seguir = true; } else vb[i] = objetivo[i]; }
    ponerVB(); raf = seguir ? requestAnimationFrame(mover) : 0;
  }
  function irAEtapa(n) {
    etapa = n; objetivo = CAMS[n];
    if (reduce) { vb = [...objetivo]; ponerVB(); } else if (!raf) raf = requestAnimationFrame(mover);
    sts.forEach(el => { const k = +el.dataset.st - 1; el.classList.toggle('rev', k <= n); el.classList.toggle('cur', k === n); });
    steps.forEach((s, i) => s.classList.toggle('on', i === n));
    stgNum.textContent = 'Etapa ' + (n + 1) + ' de ' + steps.length;
    stgName.textContent = steps[n].querySelector('h3').textContent;
    progBar.style.width = ((n + 1) / steps.length * 100) + '%';
  }
  let esperando = false;
  function leerScroll() {
    const movil = innerWidth <= 900, r = stage.getBoundingClientRect();
    const ref = movil ? r.bottom + (innerHeight - r.bottom) * 0.45 : innerHeight * 0.5;   // línea que decide la etapa activa
    let n = 0; trk.forEach((s, i) => { if (s.getBoundingClientRect().top <= ref) n = i; });
    if (n !== etapa) irAEtapa(n);
  }
  addEventListener('scroll', () => { if (!esperando) { esperando = true; requestAnimationFrame(() => { esperando = false; leerScroll(); }); } }, { passive: true });
  addEventListener('resize', leerScroll);

  // Simulación: panel con / sin energía y fuente elegida (renovable o red)
  let panel = true, red = false, bateria = 0.35;      // bateria: 0 (vacía) a 1 (llena)
  function pintar() {
    const llena = bateria >= 0.999, vacia = bateria <= 0.001;
    const autoRed = !panel && vacia;                  // sin panel y sin baterías, el UPS pasa solo a la red
    const usaRed = red || autoRed, ren = !usaRed;
    diag.classList.add('dia', 'cargaOn'); diag.classList.toggle('sinSol', !panel);   // la carga (LED) está siempre encendida
    diag.querySelectorAll('.sunwire').forEach(el => el.classList.toggle('on', panel));
    g('pCharge').classList.toggle('on', panel && !llena);
    g('pBatUps').classList.toggle('on', ren);
    g('pRed').classList.toggle('on', usaRed); g('redBlk').classList.toggle('sel', usaRed);
    diag.querySelector('.loadwire').classList.add('on');
    ['pIna1', 'pIna2', 'pMov'].forEach(id => g(id).classList.add('on'));             // los INA219 siempre miden y envían datos
    lvls.forEach((el, i) => el.style.transform = `scaleY(${Math.max(0, Math.min(1, bateria * 3 - i)).toFixed(3)})`);
    batTxt.textContent = panel ? (llena ? (ren ? 'Entregando' : 'Llena') : (ren ? 'Cargando y entregando' : 'Cargando')) : (ren ? 'Descargando' : vacia ? 'Vacía' : 'En reposo');
    g('inaGenTxt').textContent = panel ? 'generación' : 'generación: 0 W';
    upsTxt.textContent = 'Fuente: ' + (usaRed ? 'red eléctrica' : 'baterías');
    btnPanel.setAttribute('aria-pressed', panel); btnPanel.textContent = 'Panel: ' + (panel ? 'con energía' : 'sin energía');
    btnFuente.setAttribute('aria-pressed', red); btnFuente.textContent = 'Fuente: ' + (red ? 'red eléctrica' : 'energía renovable');
  }
  setInterval(() => {
    const usaRed = red || (!panel && bateria <= 0.001);
    if (panel && bateria < 1) bateria = Math.min(1, bateria + 0.004);                        // con energía: carga hasta el máximo
    else if (!panel && !usaRed && bateria > 0) bateria = Math.max(0, bateria - 0.003);       // sin energía y con la baterías como fuente: se descarga
    pintar();
  }, 200);
  btnPanel.onclick = () => { panel = !panel; pintar(); };
  btnFuente.onclick = () => { red = !red; pintar(); };
  irAEtapa(0); pintar(); leerScroll();
})();

// Software: puntos tocables sobre la pantalla + pasos del programa (van sincronizados)
// x e y son la posición del punto sobre la pantalla, en %. Ajustalos según tu captura real.
(() => {
  const pasos = [
    { t: 'Leer sensores', x: 45.5, y: 20, r: [18.7, 17.5, 52.7, 12.3], q: 'Pide a los dos INA219 la tensión y la corriente.', c: 'El ESP32 les consulta uno por uno: un sensor mide la generación y el otro el consumo. Lo hace siempre, aunque el panel no genere o la carga esté apagada.', p: 'Para medir en tiempo real la tensión y la corriente de la generación y del consumo, tener un estimado del gasto energético y fomentar la conciencia sobre el consumo.' },
    { t: 'Calcular potencia', x: 85.5, y: 22, q: 'Obtiene la potencia que se genera y la que se consume.', c: 'Multiplica la tensión por la corriente de cada sensor (P = V × I).', p: 'Para saber cuánta energía produce el panel y cuánta usa la carga.' },
    { t: 'Leer GPS', x: 86, y: 42.5, q: 'Obtiene la latitud, la longitud, la altitud y el estado de la señal.', c: 'El módulo NEO-6M envía su posición por puerto serie y la librería TinyGPS++ la interpreta.', p: 'Para conocer la posición del dispositivo en tiempo real, calcular dónde está el sol y orientar los paneles hacia él.' },
    { t: 'Guardar historial', x: 85.5, y: 70, q: 'Registra los valores medidos y los eventos junto con la hora.', c: 'Los va sumando a una lista que conserva las últimas mediciones y eventos, como lecturas correctas o avisos de producción baja.', p: 'Para ver cómo cambian con el tiempo y poder consultarlos después.' },
    { t: 'Monitoreo', x: 43.8, y: 61.7, q: 'Muestra en gráficos el consumo de la carga y la producción solar.', c: 'La página pide los datos al ESP32 y dibuja cada lectura nueva en los gráficos.', p: 'Para ofrecer una visualización más interactiva del consumo y la generación.' },
    { t: 'Más opciones del servidor', x: 6, y: 33, q: 'Ofrece otras secciones además del inicio, como el control de motores y el monitoreo completo.', p: 'Para controlar el sistema desde el celular o la computadora y orientar los paneles.' }
  ];
  const acc = document.getElementById('acc'), hots = document.getElementById('hots');
  const items = [], dots = [], areas = [];
  function verItem(it) {
    const barra = document.querySelector('.top'), mon = document.querySelector('.monitor');
    const tope = barra.offsetHeight + (innerWidth <= 900 ? mon.offsetHeight : 0) + 12;
    const r = it.getBoundingClientRect();
    if (r.top < tope) scrollBy({ top: r.top - tope, behavior: 'smooth' });
    else if (r.bottom > innerHeight - 12) scrollBy({ top: Math.min(r.bottom - innerHeight + 12, r.top - tope), behavior: 'smooth' });
  }
  function elegir(i) {
    const abrir = !items[i].classList.contains('open');
    items.forEach((x, k) => { x.classList.remove('open'); x.querySelector('.acc-h').setAttribute('aria-expanded', 'false'); dots[k].classList.remove('on'); if (areas[k]) areas[k].classList.remove('on'); });
    if (abrir) { setTimeout(() => verItem(items[i]), 340); items[i].classList.add('open'); items[i].querySelector('.acc-h').setAttribute('aria-expanded', 'true'); dots[i].classList.add('on'); if (areas[i]) areas[i].classList.add('on'); }
  }
  pasos.forEach((p, i) => {
    const it = document.createElement('div');
    it.className = 'acc-item';
    it.innerHTML = `<button class="acc-h" aria-expanded="false"><b>${i + 1}</b><span>${p.t}</span><i>⌄</i></button><div class="acc-b"><div class="acc-in"><p><b>Qué hace:</b> ${p.q}</p>${p.c ? `<p><b>Cómo:</b> ${p.c}</p>` : ''}<p><b>Para qué:</b> ${p.p}</p></div></div>`;
    it.querySelector('.acc-h').onclick = () => elegir(i);
    acc.appendChild(it); items.push(it);
    const d = document.createElement('button');
    d.className = 'punto'; d.textContent = i + 1; d.style.left = p.x + '%'; d.style.top = p.y + '%';
    d.setAttribute('aria-label', 'Paso ' + (i + 1) + ': ' + p.t);
    d.onclick = () => elegir(i);
    hots.appendChild(d); dots.push(d);
    if (p.r) { const ar = document.createElement('div'); ar.className = 'area'; ar.style.left = p.r[0] + '%'; ar.style.top = p.r[1] + '%'; ar.style.width = p.r[2] + '%'; ar.style.height = p.r[3] + '%'; hots.appendChild(ar); areas[i] = ar; }
  });
})();

// Contacto: en computadora abre Gmail en una pestaña nueva; en celular usa la app de correo
(() => {
  const a = document.getElementById('mailLink');
  if (a && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    a.href = 'mailto:giovanni07tapia@gmail.com?subject=Consulta%20sobre%20SERUM';
    a.removeAttribute('target');
  }
})();
