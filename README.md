# 🕹️ Arcade: games.ernestoag.space

Juegos clásicos para jugar en el navegador, hechos con HTML, CSS y JavaScript puro. No hace falta compilar nada ni tener servidor.

## Juegos

| Juego | Carpeta | Controles |
|-------|---------|-----------|
| 🐍 Snake | `juegos/snake` | Flechas / WASD, deslizar en móvil |
| 🧱 Tetris | `juegos/tetris` | ← → mover, ↑ girar, ↓ bajar, Espacio caída rápida |
| 🏓 Breakout | `juegos/breakout` | Ratón / dedo / flechas, Espacio lanzar |
| 🐤 Flappy | `juegos/flappy` | Espacio / clic / toque |
| 👾 Space Invaders | `juegos/invaders` | ← → mover, Espacio disparar |

Todos se pausan con **P** o **Esc** y guardan tu récord en el navegador (`localStorage`).

## Estructura

```
index.html          Portada con la lista de juegos
shared/style.css    Estilos comunes (modo claro/oscuro, controles táctiles)
shared/common.js    Utilidades: récords, pantallas superpuestas, pausa, partículas
juegos/<juego>/     index.html + game.js de cada juego
CNAME               Dominio personalizado para GitHub Pages
```

## Probar en local

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```

## Publicar en games.ernestoag.space

1. **GitHub Pages**: en el repo, ve a *Settings → Pages*. En *Source* elige
   *Deploy from a branch*, la rama `main` y la carpeta `/ (root)`.
2. **DNS**: en el panel de tu proveedor de dominio, crea este registro:

   | Tipo  | Nombre  | Valor                 |
   |-------|---------|-----------------------|
   | CNAME | `games` | `ernes-cloud.github.io` |

3. Vuelve a *Settings → Pages*: el dominio `games.ernestoag.space` ya aparece
   (viene del archivo `CNAME`). Cuando el DNS propague (de minutos a unas horas),
   activa **Enforce HTTPS**.

## Añadir un juego nuevo

1. Copia una carpeta de `juegos/` como plantilla.
2. Cambia el id en `Arcade.scoreboard('<id>')` dentro de `game.js`.
3. Añádelo a la lista `GAMES` de `index.html`.
