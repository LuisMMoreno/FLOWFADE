# FLOWFADE

Un reproductor de música moderno, preparado para PWA, con transiciones de crossfade al estilo DJ, construido con React 18, Vite 5 y la API de Web Audio.

![FLOWFADE](https://img.shields.io/badge/version-5.2.2-blue)
![React](https://img.shields.io/badge/React-18-61dafb)
![Vite](https://img.shields.io/badge/Vite-5-646cff)
![PWA](https://img.shields.io/badge/PWA-ready-purple)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Características

### Reproducción principal
- **Reproducción sin pausas (gapless)** con un motor de audio de doble ranura.
- **Crossfade al estilo DJ** con sistema de fase asimétrica (INTRO → MEZCLA → TRANSFERENCIA → OUTRO).
- **Ecualizador de 3 bandas por pista** (Filtros Low/Mid/High y peaking).
- **Sincronización de beats (beat-sync)** mediante el ajuste de `playbackRate` (±8%).
- **API de Media Session** para controles en la pantalla de bloqueo y botones físicos.

### Experiencia visual
- **Extracción de colores de la portada del álbum** mediante el algoritmo K-means.
- **Visualización FFT en tiempo real** (escritorio) con alternativa generativa en iOS.
- **Interfaz responsiva** con Tailwind CSS y un sistema de diseño personalizado.
- **Soporte para áreas seguras** en dispositivos con notch.
- **Animaciones fluidas** con Framer Motion.

### PWA y uso sin conexión
- **Instalable** (Web App Manifest + Service Worker).
- **Enfoque offline-first** con Workbox (CacheFirst para el audio, StaleWhileRevalidate para los recursos).
- **Soporte de audio en segundo plano** en iOS y Android.
- **Almacenamiento de archivos de audio** usando IndexedDB y la API de Cache.

### Motor DJ inteligente
- **Reconocimiento de la estructura musical** (frases, secciones de energía).
- **Fases de sesión** (calentamiento → groove → clímax → relajación).
- **Mezcla armónica** (Compatibilidad de BPM: exacta, doble/mitad, ±8%).
- **Tres modos de mezcla**: CHILL / EQUILIBRADO / ENERGÍA.

---

## Inicio rápido

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Compilar para producción
npm run build

# Previsualizar la compilación de producción
npm run preview

# Ejecutar linter
npm run lint

# Ejecutar pruebas
npm run test

# Ejecutar pruebas con reporte de cobertura
npm run test:coverage
```

---

## Tecnologías utilizadas

| Categoría | Tecnología |
|----------|------------|
| **Framework** | React 18, Vite 5 |
| **Estilos** | Tailwind CSS 3.4 |
| **Estado** | React Context + Hooks |
| **Base de datos** | Dexie.js (Envoltorio de IndexedDB) |
| **Audio** | Web Audio API, HTMLAudioElement |
| **Análisis** | music-tempo (BPM), algoritmo FFT personalizado |
| **Animación** | Framer Motion 11 |
| **Íconos** | Lucide React |
| **Pruebas** | Vitest 2, React Testing Library, jsdom |
| **PWA** | vite-plugin-pwa, Workbox |
| **Linting** | ESLint 8 + plugins de React |

---

## Estructura del proyecto

```
src/
├── components/          # Componentes de React
│   ├── Player.jsx           # Interfaz principal del reproductor
│   ├── FullPlayerView.jsx   # Vista expandida del reproductor
│   ├── LibraryView.jsx      # Explorador de la biblioteca de pistas
│   ├── Sidebar.jsx          # Barra de navegación lateral
│   └── WaveBackground.jsx   # Visualización FFT
├── hooks/               # Hooks personalizados de React
│   ├── useAudioAnalyser.js  # Análisis FFT en tiempo real
│   ├── useLibrary.js        # Gestión de la biblioteca
│   ├── usePlaybackHelpers.js# Lógica compartida del estado de reproducción
│   └── useAlbumColors.js    # Extracción de colores de la portada
├── services/            # Lógica central del negocio
│   ├── AudioEngine.js       # Reproducción de doble ranura + Grafo de Web Audio
│   ├── DJEngine.js          # Planificación de transiciones y selección de pistas
│   ├── DJController.js      # Automatización DJ de alto nivel
│   ├── AudioStorageService.js # Almacenamiento con IndexedDB + API de Cache
│   ├── AudioAnalysisService.js # Análisis de energía y BPM
│   ├── ColorExtractionService.js # Agrupamiento de colores K-means
│   └── MediaSessionService.js # Controles para la pantalla de bloqueo
├── store/               # Proveedores de React Context
│   ├── PlaybackContext.jsx  # Proveedor del estado de reproducción
│   └── PlaybackContextCore.js # Definición del contexto (corrección para React Refresh)
├── utils/               # Utilidades compartidas
│   └── formatTime.js        # Formateo de tiempo (MM:SS)
├── test/                # Configuración de pruebas y utilidades
│   └── setup.js             # Mocks globales de Vitest
└── main.jsx             # Punto de entrada de la aplicación
```

---

## Aspectos destacados de la arquitectura

### Motor de audio de doble ranura
```
Ranura A (actual) ←→ Crossfade → Ranura B (siguiente)
     ↓                               ↓
 Cadena de EQ                     Cadena de EQ
  (3 bandas)                       (3 bandas)
     ↓                               ↓
 Nodo de ganancia                 Nodo de ganancia
     ↓                               ↓
 ────────────────── Nodo Analizador ──────────────────→ Altavoces
```

- Dos instancias de `HTMLAudioElement` para garantizar transiciones sin cortes.
- Grafo de Web Audio API por cada ranura: Fuente → EQ(3 bandas) → Ganancia → Analizador.
- Manipulación de `playbackRate` para sincronizar los beats (±8%).
- Curvas de crossfade asimétricas (smoothstep + smootherstep).

### Sistema de fases DJ
| Fase | Duración | Descripción |
|-------|----------|-------------|
| **INTRO** | 0-20% | La pista B entra solo con frecuencias altas, sin bajos. |
| **MEZCLA** | 20-55% | Ambas pistas suenan a la vez, los bajos se intercambian mediante el ecualizador. |
| **TRANSFERENCIA** | 55-82% | **Asimétrica**: La pista B sube rápido de volumen, la A baja lentamente. |
| **OUTRO** | 82-100% | La pista A se desvanece (solo queda un residuo de frecuencias altas). |

### Flujo de extracción de color
```
Portada del álbum → Canvas.drawImage → ImageData → 
Algoritmo K-means (k=2) → Conversión a HSL → 
Ajuste de contraste → { primario, secundario, degradado }
```

---

## Pruebas

```bash
# Ejecutar todas las pruebas
npm run test

# Modo de observación (watch)
npx vitest

# Reporte de cobertura (HTML en la carpeta coverage/)
npm run test:coverage
```

**Cobertura de pruebas** (módulos principales):
- `usePlaybackHelpers` — 100%
- `formatTime` — 100%
- `useAudioAnalyser` — 94%
- `useLibrary` — 98%
- `DJEngine` — 81%
- `AudioEngine` — 63%
- `ColorExtractionService` — 62%

---

## Instalación PWA

1. Abre la aplicación en Chrome, Edge o Safari.
2. Haz clic en **Instalar** en la barra de direcciones (o ve al menú y selecciona "Instalar aplicación").
3. Ábrela directamente desde tu pantalla de inicio o cajón de aplicaciones.
4. Funcionará sin conexión a internet después de la primera visita.

**Estrategia del Service Worker**:
- **Archivos de audio**: `CacheFirst` (para reproducir sin conexión).
- **JS/CSS/HTML**: `StaleWhileRevalidate` (para que la app cargue rápido).
- **API/Manifiesto**: `NetworkFirst` (para asegurar datos actualizados).

---

## Atajos de teclado

| Tecla | Acción |
|-----|--------|
| `Espacio` | Reproducir/Pausar |
| `←` / `→` | Pista anterior/siguiente |
| `↑` / `↓` | Subir/bajar volumen |
| `M` | Silenciar / Activar sonido |
| `F` | Pantalla completa |

---

## Soporte en navegadores

| Característica | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Web Audio API | Soportado | Soportado | Soportado | Soportado |
| Media Session | Soportado | Soportado | Soportado | Soportado |
| Instalación PWA | Soportado | Soportado | Soportado | Soportado |
| Audio en 2do plano | Soportado | Parcial | Soportado | Soportado |
| Analizador FFT | Soportado | Soportado | Parcial* | Soportado |

*En iOS Safari se utiliza una simulación generativa como alternativa.

---

## Licencia

Licencia MIT — siéntete libre de usar, modificar y distribuir este proyecto.

---

## Cómo contribuir

1. Haz un fork del repositorio.
2. Crea una rama para tu funcionalidad (feature branch).
3. Realiza tus cambios.
4. Ejecuta `npm run lint && npm run test`.
5. Envía un Pull Request.

---

## Agradecimientos

- **music-tempo** por la detección de BPM.
- **Dexie.js** por hacer que trabajar con IndexedDB sea un placer.
- **Workbox** por facilitar la magia del modo offline de las PWA.
- **Framer Motion** por las animaciones súper fluidas.
- **Lucide** por los íconos del proyecto.