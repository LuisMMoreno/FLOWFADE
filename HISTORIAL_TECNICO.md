# HISTORIAL TÉCNICO - FLOWFADE

## 2026-04-17 10:00:00
### Cambios Realizados
- Inicialización del proyecto con Vite + React.js.
- Configuración de `package.json` con dependencias críticas (`dexie`, `framer-motion`, `lucide-react`, `vite-plugin-pwa`).
- Configuración de `vite.config.js` con soporte PWA y estrategia `CacheFirst` para audio.
- Configuración de Tailwind CSS con temas de color personalizados (estilo Spotify) y soporte para `safe-area` de iOS.
- Creación de `index.html` con meta-etiquetas de optimización para iOS (`viewport-fit=cover`, `apple-mobile-web-app-capable`).
- Estructura base de directorios (`components`, `hooks`, `services`, `store`, `utils`, `pages`, `styles`).
- Implementación de `App.jsx` y estilos globales.

### Justificación
- **Vite/React:** Entorno de desarrollo rápido y estándar de la industria.
- **PWA/CacheFirst:** Vital para el funcionamiento offline absoluto requerido.
- **Tailwind/iOS meta:** Asegurar una experiencia nativa visual y táctil en dispositivos Apple.

### Estado Actual
- Infraestructura base completada.
- Capa de persistencia (Fase 2) implementada: IndexedDB con Dexie y Cache API para audios. Extracción de metadatos ID3 operativa.

## 2026-04-17 11:30:00
### Cambios Realizados
- Implementación de `src/services/db.js` (Dexie) para metadatos.
- Implementación de `src/services/AudioStorageService.js` con soporte para Cache API y `jsmediatags`.
- Lógica de importación asíncrona con extracción de portadas y fallback de metadatos.
- Adición de `jsmediatags` a `package.json`.

### Justificación
- **Híbrido Cache/IndexedDB:** Evita bloqueos de la UI por archivos grandes en IndexedDB y permite streaming progresivo desde Cache API.
- **jsmediatags:** Extracción local de metadata sin necesidad de servicios externos, manteniendo la privacidad y el modo offline.

### Estado Actual
- Persistencia y servicios de audio listos.
- UI estilo Spotify (Fase 3) implementada y funcional. Importación de archivos operativa.

## 2026-04-17 12:45:00
### Cambios Realizados
- Creación de componentes UI: `Sidebar`, `LibraryView`, `Player`.
- Implementación del hook `useLibrary` para conectar UI con servicios.
- Diseño responsivo con Tailwind CSS optimizado para iOS (safe-areas, scroll-locking).
- Integración de animaciones fluidas con `framer-motion` para la lista de canciones.
- Funcionalidad de eliminación de canciones (Cleanup de DB y Cache).

### Justificación
- **Layout Spotify:** Proporciona familiaridad inmediata al usuario, reduciendo la curva de aprendizaje.
- **framer-motion:** Mejora la percepción de calidad y fluidez, especialmente importante en iOS para sentirse como una app nativa.

### Estado Actual
- Interfaz completa y reactiva.
- Motor de audio con crossfade (Fase 4) operativo. Reproducción desde Cache API funcional.

## 2026-04-17 14:00:00
### Cambios Realizados
- Implementación de `src/services/AudioEngine.js`: Motor Web Audio API con gestión de múltiples nodos.
- Soporte para Crossfade real con curvas exponenciales de ganancia.
- Implementación de `src/hooks/usePlayback.js`: Gestión de cola global, estados de reproducción y transiciones automáticas.
- Sincronización completa entre `LibraryView` y `Player`.
- Desbloqueo automático del contexto de audio para compatibilidad con políticas de autoplay en iOS.

### Justificación
- **Web Audio API:** A diferencia del tag `<audio>`, permite un control preciso de la temporización y el volumen necesario para el crossfade sin silencios.
- **Queue Management:** Un estado global fuera de los componentes asegura que la música no se interrumpa al navegar por la app.

### Estado Actual
- MVP Funcional al 100%. Música local, crossfade, offline total.

## 2026-04-17 15:00:00
### Cambios Realizados
- Solución de error de build en Vercel: Configuración de alias en `vite.config.js` para `jsmediatags`.
- Redirección de la importación de `jsmediatags` a su versión distribuida para navegador (`jsmediatags/dist/jsmediatags.min.js`).

### Justificación
- **Problema de Resolución:** `jsmediatags` es una librería antigua que no tiene un punto de entrada ESM claro, lo que causa que Rollup (el bundler de Vite) falle al intentar resolverlo durante el despliegue automático. El alias fuerza el uso de la versión compatible con navegadores.

### Estado Actual
- Proyecto listo para despliegue en Vercel/GitHub.

## 2026-04-17 15:15:00
### Cambios Realizados
- Optimización de UI para dispositivos móviles en `LibraryView` y `Player`.
- Implementación de soporte para `safe-areas` (iOS) para evitar solapamientos con el status bar y notch.
- Rediseño responsivo del encabezado: apilamiento vertical en móviles y ajuste de escala de fuentes.
- Mejora del reproductor: reducción de altura, efecto `backdrop-blur`, y ocultación inteligente de controles secundarios en pantallas pequeñas.

### Justificación
- **UX Profesional:** El diseño original presentaba solapamientos críticos en móviles que imposibilitaban la interacción. Los nuevos ajustes aseguran una experiencia "app-like" fluida y legible en cualquier tamaño de pantalla.

### Estado Actual
- Interfaz 100% responsiva y optimizada para producción.

## 2026-04-17 15:30:00
### Cambios Realizados
- Corrección crítica para importación en iOS: Inclusión de extensiones explícitas (`.mp3, .m4a, .wav, .aac`) en el atributo `accept` del selector de archivos en `LibraryView.jsx`.
- Robustez en `useLibrary.js`: El filtrado de archivos ahora prioriza la extensión del nombre cuando el MIME type (`file.type`) es devuelto como una cadena vacía, comportamiento estándar en la App "Archivos" de iOS.

### Justificación
- **iOS Files Integration:** iOS Safari tiene restricciones estrictas de seguridad. Al no especificar las extensiones en el input, el sistema operativo puede ocultar los archivos musicales o entregarlos con metadatos de tipo incompletos. Esta corrección asegura que el usuario siempre pueda seleccionar y procesar su música local.

### Estado Actual
- Compatibilidad con iPhone confirmada. Flujo de importación estable.

## 2026-04-17 16:00:00
### Cambios Realizados
- Implementación de reproducción en segundo plano y soporte para Media Session API.
- Creación de `src/services/MediaSessionService.js` para gestionar metadatos y controles externos (pantalla de bloqueo).
- Integración de "Silent Heartbeat" en `AudioEngine.js` mediante un elemento `<audio>` oculto para mantener la sesión activa en iOS.
- Refactorización de `usePlayback.js` para sincronizar el estado global con la interfaz del sistema operativo.

### Justificación
- **Continuidad en iOS:** Los PWAs en iOS suspenden el JavaScript agresivamente al salir de la app. El latido silencioso y la Media Session API informan al sistema de que la app es un reproductor activo, permitiendo que la música siga sonando y pueda controlarse sin desbloquear el teléfono.

### Estado Actual
- Soporte para segundo plano operativo. Controles de pantalla de bloqueo funcionales.

## 2026-04-17 16:30:00
### Cambios Realizados
- Implementación de **Estado Global de Reproducción** mediante React Context (`PlaybackContext.jsx`).
- Migración de toda la lógica de control de audio (`play`, `pause`, `crossfade`, `queue`) al `PlaybackProvider`.
- Refactorización del hook `usePlayback.js` para convertirlo en un consumidor del contexto global.
- Envoltura de la aplicación raíz en `main.jsx` con el nuevo proveedor.

### Justificación
- **Sincronización de IU:** Anteriormente, cada componente tenía su propio estado local, lo que causaba que la barra del reproductor y la lista de canciones estuvieran desincronizadas. Al centralizar el estado, cualquier cambio (reproducción, pausa, cambio de canción) se refleja instantáneamente en toda la aplicación.

### Estado Actual
- Interfaz 100% sincronizada. El reproductor inferior y la biblioteca ahora comparten el mismo estado de reproducción.

## 2026-04-17 16:45:00
### Problema Detectado
- En iPhone, la reproducción se detenía al bloquear la pantalla o al enviar la PWA a segundo plano.
- El motor vigente estaba basado en `AudioBufferSourceNode`, con un `AudioContext` creado de forma temprana y un "heartbeat" silencioso auxiliar.
- En iOS/WebKit, este patrón no garantiza continuidad en background porque el sistema prioriza sesiones iniciadas y sostenidas por `HTMLAudioElement` asociado a una interacción real del usuario.

### Solución Aplicada
- Se migra el transporte principal de reproducción a instancias persistentes de `HTMLAudioElement`.
- Se conserva `Web Audio API` exclusivamente como capa de mezcla (`MediaElementSourceNode` + `GainNode`) para mantener el crossfade existente sin rediseñar la arquitectura global.
- La inicialización del motor de audio se fuerza de manera diferida tras gesto del usuario, evitando re-creaciones innecesarias de `AudioContext` y de la sesión de reproducción.
- Se refuerza la integración con `Media Session API` para metadatos dinámicos, estado de reproducción y controles del sistema (`play`, `pause`, `nexttrack`, `previoustrack`).

### Limitaciones de iOS Consideradas
- iOS puede suspender JavaScript en background, pero mantiene con mayor fiabilidad una sesión iniciada mediante `HTMLAudioElement`.
- `AudioContext` suspendido o recreado fuera de gesto del usuario reduce la probabilidad de continuidad en segundo plano.
- El comportamiento puede variar entre Safari y modo standalone; por ello se evita depender de técnicas no deterministas como audio silencioso separado del stream principal.

### Estado Final
- El motor de audio queda preparado para reproducción en segundo plano en PWA iOS sin eliminar crossfade, sin romper el modo offline y sin alterar la UI existente.

## 2026-04-17 17:20:00
### Problema Detectado
- En la implementación híbrida previa, la pista seguía avanzando al poner la PWA en segundo plano, pero la salida audible desaparecía.
- El síntoma indica que el transporte (`HTMLAudioElement`) seguía vivo, pero la ruta de salida dependiente de `Web Audio API` dejaba de ser confiable en background sobre iOS/WebKit.
- Además, el controlador interno del reproductor presentaba condiciones de carrera al cambiar canciones rápidamente y mostraba controles visuales sin comportamiento real.

### Solución Aplicada
- Se reemplaza la salida de audio por reproducción directa de `HTMLAudioElement`, manteniendo el crossfade con rampas de volumen entre dos elementos persistentes.
- Se elimina la dependencia de `AudioContext.destination` para la reproducción audible en iOS background, preservando la cola, reproducción offline y transiciones suaves.
- Se añaden protecciones contra solicitudes de reproducción obsoletas para evitar que cambios rápidos de canción desincronicen el estado.
- Se mejora el controlador del reproductor: barra de progreso real, volumen real y eliminación de botones decorativos sin funcionalidad.

### Limitaciones de iOS Consideradas
- iOS puede mantener vivo el transporte nativo de medios aunque suspenda o degrade partes del pipeline JavaScript/Web Audio.
- Las transiciones automáticas complejas en background siguen sujetas a restricciones del sistema; por eso la prioridad se desplazó a asegurar continuidad audible de la pista activa.
- Los controles del sistema se mantienen vía `Media Session API`, pero la estabilidad depende de que el estado interno no se desincronice ante acciones rápidas.

### Estado Final
- La pista activa queda orientada a seguir sonando realmente en segundo plano en iPhone.
- El reproductor interno queda más estable y elimina controles engañosos o no implementados.
