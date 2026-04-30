# MASTER DESIGN SYSTEM — FlowFade "Now Playing"

## Filosofía
**Glassmorphism + Dark Mode Inmersivo**
Una experiencia visual premium que combina profundidad, transparencia y movimiento orgánico para crear una interfaz que se siente viva.

---

## Paleta de Colores

### Estática (Fallback)
| Token | Valor | Uso |
|---|---|---|
| `--bg-black` | `#000000` | Fondo principal |
| `--bg-surface` | `#121212` | Superficies elevadas |
| `--color-primary` | `#1DB954` | Acentos, CTAs |
| `--color-accent` | `#535353` | Texto secundario |

### Dinámica (Runtime)
| Variable CSS | Fuente | Fallback |
|---|---|---|
| `--current-primary` | Color dominante de carátula | `#1DB954` |
| `--current-secondary` | Color secundario de carátula | `#191414` |
| `--current-gradient` | Gradiente generado | `linear-gradient(135deg, var(--current-primary), var(--current-secondary))` |

### Contraste (WCAG AA)
- Texto blanco sobre fondos dinámicos: **≥ 4.5:1**
- Si el color extraído no cumple, se ajusta la luminosidad automáticamente.

---

## Tipografía

**Familia**: `Outfit` (Google Fonts)
**Fallback**: `system-ui, -apple-system, sans-serif`

| Nivel | Tamaño | Peso | Uso |
|---|---|---|---|
| Display | 32px | 900 (Black) | Títulos de sección |
| Heading | 24px | 700 (Bold) | Nombre de canción (FullPlayer) |
| Subheading | 18px | 600 (SemiBold) | Subtítulos |
| Body | 16px | 400 (Regular) | Texto general |
| Caption | 14px | 500 (Medium) | Artista, tiempos |
| Micro | 12px | 500 (Medium) | Labels, badges |

---

## Espaciado

**Base**: 8px (múltiplos estrictos)

| Token | Valor |
|---|---|
| `xs` | 4px |
| `sm` | 8px |
| `md` | 16px |
| `lg` | 24px |
| `xl` | 32px |
| `2xl` | 40px |
| `3xl` | 48px |
| `4xl` | 56px |
| `5xl` | 64px |

---

## Iconografía

**Librería**: Lucide React (ya instalada)
- NO usar emojis como iconos estructurales.
- Tamaños: 16px (inline), 20px (controles), 24px (acciones principales), 32px (transporte).
- Stroke width: 2px estándar.

---

## Interacciones Táctiles

| Elemento | Tamaño Mínimo | Touch Target |
|---|---|---|
| Botón transporte (Play/Pause) | 56×56px | 56×56px |
| Botón transporte (Skip) | 44×44px | 44×44px |
| Botón utilidad (Letras, Cola) | 40×40px | 44×44px |
| Slider de progreso | Height: 44px | Full width |
| Drag handle (dismiss) | 40×5px visible | 64×32px target |

---

## Animaciones

| Tipo | Duración | Easing | GPU |
|---|---|---|---|
| Apertura FullPlayer | 300ms | `cubic-bezier(0.4, 0, 0.2, 1)` | `translateZ(0)` |
| Cierre FullPlayer | 250ms | `cubic-bezier(0.4, 0, 0.2, 1)` | `translateZ(0)` |
| Hover botones | 150ms | `ease-out` | — |
| Active/Press | Instant | `scale(0.95)` | `transform` |
| Ondas de fondo | 60fps RAF | Continuo | `transform: translateZ(0)` |

---

## Safe Areas (iOS)

```css
padding-top: calc(env(safe-area-inset-top) + 8px);
padding-bottom: calc(env(safe-area-inset-bottom) + 16px);
padding-left: env(safe-area-inset-left);
padding-right: env(safe-area-inset-right);
```

---

## Glassmorphism Layers

```
Capa 1 (fondo):     Carátula escalada + blur(80px) + opacity(0.4)
Capa 2 (ondas):     Canvas 2D waves reactivas al ritmo
Capa 3 (cristal):   backdrop-filter: blur(40px) saturate(180%) + rgba(0,0,0,0.3)
Capa 4 (contenido): Controles, textos, carátula nítida
```

---

## Checklist de Calidad

- [ ] Contraste ≥ 4.5:1 sobre fondos dinámicos
- [ ] Touch targets ≥ 44×44pt
- [ ] Espaciado en múltiplos de 8px
- [ ] `transform: translateZ(0)` en capas animadas
- [ ] Safe areas aplicadas en top y bottom
- [ ] Zero-scroll cuando FullPlayer activo
- [ ] Animaciones a 60fps (RAF)
- [ ] Fallback de colores cuando no hay carátula
