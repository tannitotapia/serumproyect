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


// Carrusel de componentes: una imagen por vez
const view = document.getElementById('cView');
const total = view.children.length;
const cnt = document.getElementById('cCnt');
let idx = 0, tScroll;
function irA(d) {
  idx = (idx + d + total) % total;          // vuelve al inicio/final
  view.scrollTo({ left: idx * view.clientWidth });
}
document.getElementById('cPrev').onclick = () => irA(-1);
document.getElementById('cNext').onclick = () => irA(1);
view.addEventListener('scroll', () => {
  const i = Math.round(view.scrollLeft / view.clientWidth);
  cnt.textContent = (i + 1) + ' / ' + total;
  clearTimeout(tScroll); tScroll = setTimeout(() => { idx = i; }, 150);   // sincroniza si se desliza con el dedo
});
view.addEventListener('keydown', e => { if (e.key === 'ArrowRight') irA(1); if (e.key === 'ArrowLeft') irA(-1); });

// Diagrama: hora del día, luces y batería
(() => {
  const g = id => document.getElementById(id);
  const diag = g('diag'), slider = g('horaDia'), salida = g('horaDiaOut'), btnCarga = g('btnCarga'), estado = g('estado'), batTxt = g('batEstado');
  const lvls = [...diag.querySelectorAll('.lvl')];
  let dia = true, carga = false, bateria = 0.35;      // bateria: 0 (vacía) a 1 (llena)

  function cielo(h) {
    dia = h >= 6 && h < 18;
    const t = dia ? (h - 6) / 12 : ((h + 6) % 24) / 12;           // recorrido del astro de 0 a 1
    const x = 60 + 860 * t, y = 112 - 78 * Math.sin(Math.PI * t);
    g('gSolMov').style.opacity = dia ? 1 : 0; g('gLuna').style.opacity = dia ? 0 : 1;
    g(dia ? 'gSolMov' : 'gLuna').setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    g('gPanel').setAttribute('transform', `rotate(${dia ? ((t - 0.5) * 50).toFixed(1) : 0} 95 162)`);   // sigue al sol, de noche descansa
    const hh = Math.floor(h);
    salida.textContent = hh + ':' + String(Math.round((h - hh) * 60)).padStart(2, '0');
  }

  function pintar() {
    const llena = bateria >= 0.999;
    const luz = carga && (dia || bateria > 0.001);                 // hay energía para las luces
    const cargando = dia && !llena, descargando = !dia && luz;
    diag.classList.toggle('dia', dia); diag.classList.toggle('noche', !dia); diag.classList.toggle('cargaOn', luz);
    diag.querySelector('.sunwire').classList.toggle('on', dia);
    g('pCharge').classList.toggle('on', cargando);
    g('pBypass').classList.toggle('on', dia && luz); g('bypTxt').classList.toggle('on', dia && luz);
    g('pBatUps').classList.toggle('on', descargando);
    diag.querySelector('.loadwire').classList.toggle('on', luz);
    g('pIna1').classList.toggle('on', dia); g('pIna2').classList.toggle('on', luz); g('pMov').classList.toggle('on', dia);
    lvls.forEach((el, i) => el.style.transform = `scaleY(${Math.max(0, Math.min(1, bateria * 3 - i)).toFixed(3)})`);
    batTxt.textContent = cargando ? 'Cargando' : descargando ? 'Descargando' : llena ? 'Llena' : bateria <= 0.001 ? 'Vacía' : 'En reposo';
    btnCarga.setAttribute('aria-pressed', carga); btnCarga.textContent = 'Luces: ' + (carga ? 'encendidas' : 'apagadas');
    estado.textContent =
      dia && carga ? 'De día, las luces se alimentan directamente desde el controlador PWM. Mientras tanto las baterías se cargan hasta el máximo y se quedan ahí.' :
      dia ? (llena ? 'Las baterías llegaron al máximo y se mantienen llenas mientras haya sol. El INA219 mide la generación y el ESP32 orienta el panel.' : 'Con sol, el panel carga las baterías a través del controlador. El INA219 mide la generación y el ESP32 orienta el panel.') :
      carga ? (bateria > 0.001 ? 'De noche el panel no genera: las luces se alimentan desde las baterías, que se descargan muy de a poco.' : 'Las baterías se vaciaron y ya no hay energía para las luces hasta que vuelva el sol.') :
      'De noche y con las luces apagadas, las baterías conservan su carga.';
  }

  setInterval(() => {
    if (dia && bateria < 1) bateria = Math.min(1, bateria + 0.004);                       // se carga y se queda en el máximo
    else if (!dia && carga && bateria > 0) bateria = Math.max(0, bateria - 0.0006);       // se descarga muy lentamente
    pintar();
  }, 200);
  slider.addEventListener('input', () => { cielo(parseFloat(slider.value)); pintar(); });
  btnCarga.onclick = () => { carga = !carga; pintar(); };
  cielo(12); pintar();
})();

// Software: bloques que se agrandan, con explicación (qué hace, cómo y para qué)
(() => {
  const pasos = [
    { t: 'Leer sensores', q: 'Pide a los dos INA219 la tensión y la corriente.', c: 'El ESP32 les consulta uno por uno: un sensor mide la generación y el otro el consumo.', p: 'Son los datos de partida: sin ellos no se puede calcular nada más.' },
    { t: 'Calcular potencia', q: 'Obtiene la potencia que se genera y la que se consume.', c: 'Multiplica la tensión por la corriente de cada sensor (P = V × I).', p: 'Para saber cuánta energía produce el panel y cuánta usa la carga.' },
    { t: 'Leer GPS', q: 'Obtiene la latitud y la longitud del sistema.', c: 'El módulo NEO-6M envía su posición por puerto serie y la librería TinyGPS++ la interpreta.', p: 'Para conocer dónde está el equipo y mostrarlo en la interfaz.' },
    { t: 'Guardar historial', q: 'Registra los valores medidos junto con la hora.', c: 'Los va sumando a una lista que conserva las últimas mediciones.', p: 'Para ver cómo cambian con el tiempo y poder consultarlas después.' },
    { t: 'Atender la web', q: 'Funciona como servidor web local.', c: 'Entrega la página y, cuando el navegador lo pide, los datos actuales. También recibe las órdenes del usuario.', p: 'Para que cualquier persona conectada a la red pueda ver el sistema y controlarlo desde el celular o la computadora.' },
    { t: 'Mover los motores', q: 'Orienta el panel cuando llega una orden.', c: 'Envía a los drivers A4988 una señal de sentido y pulsos; cada pulso hace girar un poquito el motor NEMA 17.', p: 'Para cambiar la posición de la estructura y estudiar cuánto mejora la generación.' }
  ];
  const acc = document.getElementById('acc');
  pasos.forEach((p, i) => {
    const it = document.createElement('div');
    it.className = 'acc-item' + (i === 0 ? ' open' : '');
    it.innerHTML = `<button class="acc-h" aria-expanded="${i === 0}"><b>${i + 1}</b><span>${p.t}</span><i>⌄</i></button><div class="acc-b"><div class="acc-in"><p><b>Qué hace:</b> ${p.q}</p><p><b>Cómo:</b> ${p.c}</p><p><b>Para qué:</b> ${p.p}</p></div></div>`;
    it.querySelector('.acc-h').onclick = () => {
      const abrir = !it.classList.contains('open');
      acc.querySelectorAll('.acc-item').forEach(x => { x.classList.remove('open'); x.querySelector('.acc-h').setAttribute('aria-expanded', 'false'); });
      if (abrir) { it.classList.add('open'); it.querySelector('.acc-h').setAttribute('aria-expanded', 'true'); }
    };
    acc.appendChild(it);
  });
})();