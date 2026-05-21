CAPTA — Sistema de identidad
═════════════════════════════════════════════════════════

Capta es la plataforma de capacitación que sí se asimila.
Este kit contiene la identidad visual completa: logos,
íconos y guía de uso.

CONTENIDO
─────────────────────────────────────────────────────────

logos/                    Cinco conceptos de logo
  01-aperture/              Recomendado. La C como lente.
  02-eco/                   El conocimiento que se propaga.
  03-triad/                 Tres fuentes, un foco. Técnico.
  04-lazo/                  Charrería mexicana. Cultural.
  05-lazo-vuelo/            Variación gestual del lazo.

  Cada carpeta contiene 4 archivos:
    mark-light.svg          Solo el ícono, fondo claro
    mark-dark.svg           Solo el ícono, fondo oscuro
    horizontal-light.svg    Ícono + texto, fondo claro
    horizontal-dark.svg     Ícono + texto, fondo oscuro

icons/                    38 íconos del sistema
  Todos a 24×24 viewBox, stroke 1.6, currentColor.
  Categorías:
    · Navegación      (home, grid, menu, search, plus…)
    · Contenido       (book, video, play, file, folder)
    · Personas        (user, users)
    · Datos           (chart-bar, chart-line)
    · Confianza       (certificate, shield, check)
    · Sistema         (bell, gear, sun, moon, download…)
    · Acento          (sparkle, lightning, route, wave…)

Sistema-de-identidad.html  Guía visual interactiva.
  Abrila en cualquier navegador. Tiene historia, taglines,
  previsualización de íconos y manual de modificación.

CÓMO USAR LOS ÍCONOS
─────────────────────────────────────────────────────────

1. Color
   Los íconos usan stroke="currentColor". Cambiá el color
   del contenedor y el ícono lo hereda automáticamente.

   .button { color: var(--accent-deep); }
   .button:hover { color: white; }

2. Tamaño
   Sobreescribí width y height. El viewBox 24×24 escala
   perfecto a 16, 20, 24, 32 o 48px.

   <svg width="16" height="16" viewBox="0 0 24 24">…
   <svg width="32" height="32" viewBox="0 0 24 24">…

3. Grosor
   Default stroke-width="1.6". Subí a 2 para énfasis,
   2.4 para bold, 1.2 para versión ligera.

4. En React (con vite-plugin-svgr o similar)
   import Sparkle from './icons/sparkle.svg?react';
   <Sparkle width={20} color="var(--accent)" />

CÓMO USAR LOS LOGOS
─────────────────────────────────────────────────────────

Los logos usan un gradiente lineal del color profundo al
suave (#1F5C4D → #7FD1AE para fondo claro). Para color
sólido, reemplazá url(#m) por el hex que quieras.

Para favicons, usá *-mark-light.svg directamente. El
viewBox 48×48 escala perfecto a 16, 32, 48, 64, 128px.

PALETA DE COLORES
─────────────────────────────────────────────────────────

Tinta principal     #0B1F2A
Fondo cálido        #FAFAF7
Acento profundo     #1F5C4D
Acento suave        #7FD1AE
Acento tint         #DCEDE5
Acento glow         #A8E6CF (sobre fondos oscuros)

═════════════════════════════════════════════════════════
Hecho con cuidado · Mayo 2026
