# Auditoría de 404 reales

Fecha: 20 septiembre 2026.  
Fuente: **informe GoAccess** (52 Not Found en dos días) + código + `public/` + `vercel.json` / `deploy/nginx/redirects.conf`.  
El comprobador de build (`scripts/astro-internal-link-check.mjs`) sigue cubriendo solo el HTML generado: un build verde implica que el sitio no se pide a sí mismo páginas rotas. GoAccess cubre lo demás (bots, URLs antiguas, iconos por convención).

---

## Resumen ejecutivo

De las 52 rutas, **la mayoría son escáneres de WordPress** (`/wp-admin`, `/wp-login.php`, `/xmlrpc.php`, etc.). 404 legítimo: no hay WordPress, no tocar.

Cuatro sí son nuestras o de producto:

| Ruta | Hits | Qué era | Qué devolver ahora |
| --- | ---: | --- | --- |
| `/favicon.ico` | **27** (52 % de todos los 404) | No existía el fichero; el `<link rel="icon">` apuntaba a `/logo.png` | **200** `public/favicon.ico` (16/32/48 px) |
| `/herramientas/null` | (baja) | El island del buscador serializaba `descuentoPct: null` en JSON. En `/herramientas/`, un crawler resuelve el token `null` como ruta relativa | **301** → `/herramientas/` + ya no se emite `null` en el island |
| `/producto/ortopedica-cama-para-perros-grande-y-medianos-90x57cm-colchon-perro-de-doble-cara-col` | (baja) | Producto eliminado sin redirect | **301** → `/categoria/camas-ortopedicas/` |
| `/pinterest-fceef.html` | (baja) | Pinterest comprueba fichero además del meta `p:domain_verify` | **404 consciente**. La verificación ya funciona por meta; no crear el fichero |

Comprobado aparte (no salía en GoAccess como problema, pero se pidió):

| Ruta | Resultado |
| --- | --- |
| `/.git/HEAD`, `/.git/config` | **404** en producción. `deploy.sh` solo rsync de `dist/`; nginx `root` es ese HTML. Aun así, `location ^~ /.git { return 404; }` en `deploy/nginx/solucioncanina.conf` |
| `/.well-known/security.txt` | **200** nuevo (`public/.well-known/security.txt`, contacto `hola@solucioncanina.es`) |

---

## 1. Rutas reales de GoAccess

### 1.1 Las que sí hay que tocar (hechas)

**`/favicon.ico` — 27 peticiones.** Navegadores y bots la piden aunque el icono declarado sea PNG. `public/favicon.ico` es ICO multi-resolución (16, 32 y 48 px) generado desde `public/logo.png` (recorte del perro, fondo blanco). `Layout.astro` declara `<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">` además del PNG.

**`/herramientas/null`.** No hay `href="/herramientas/null"` en el HTML ni en `src/`. El hub `/herramientas/` embebe el island `HeaderCatalogControls` con el catálogo entero. Casi todos los productos tenían `"descuentoPct":[0,null]` en ese JSON. Un crawler que trata `null` como URL relativa sobre `/herramientas/` pide exactamente `/herramientas/null`. Arreglo: no serializar `descuentoPct` si no hay número (`src/layouts/Layout.astro`). Cinturón: 301 en `redirects.conf` y `vercel.json`.

**Producto cama 90×57 eliminado.** 301 a la categoría de camas, con y sin barra final, en nginx y Vercel.

### 1.2 Pinterest: no crear `/pinterest-fceef.html`

Pinterest verifica el dominio de dos maneras: meta `p:domain_verify` (ya está en `Layout.astro`, content `fceefba5cd3fc4201c57eef84a3c38ff`) y un fichero `pinterest-<5 primeras del hash>.html` en la raíz. La cuenta ya está verificada por meta. El GET al HTML es su crawler comprobando el método alternativo. Crear el fichero solo silenciaría un 404 de volumen bajo y no cambia la verificación. **Lo dejamos.**

### 1.3 Bots WordPress y chrome de escáner (404 legítimo)

Todo lo que encaja en sondeo de CMS / secretos: `/wp-admin`, `/wp-login.php`, `/xmlrpc.php`, `/.env`, `/ads.txt`, `/apple-touch-icon-precomposed.png` y tamaños Apple no declarados, `/browserconfig.xml`. No hay WordPress ni AdSense. Un `ads.txt` inventado empeora. No redirigir.

`/.well-known/security.txt` era 404 de escáner; ahora existe (RFC 9116). El resto de `/.well-known/` (`assetlinks.json`, `apple-app-site-association`) sigue en 404: no hay app.

---

## 2. Lo que el propio sitio no pide

El comprobador de build recorre `href`/`src` internos del HTML en `dist/`. Tras este cambio, `/favicon.ico` y `/.well-known/security.txt` existen. `/herramientas/null` no se genera como enlace; el 301 cubre a quien ya lo tenga.

Sigue fuera del comprobador: bots, URLs antiguas indexadas, imágenes de fichas borradas, `llms.txt`, `/producto/<carpeta>/` cuando el slug canónico es otro.

---

## 3. Productos eliminados (Memor-One, Gooddy, SLE, cama 90×57)

HTML de ficha → 301 a categoría (nginx + Vercel). La cama 90×57 era el único de este lote que **no** tenía redirect y sí salía en GoAccess.

Las JPG de Memor-One / Gooddy / SLE siguen en 404 duro (`/images/articulos/<carpeta>/imagen.jpg`). GoAccess no las destacó en estas 52; no hace falta redirect de imagen ahora.

---

## 4. GSC (snapshot 19 ago–17 sep), no visto en este corte de GoAccess

Siguen sin 301, por si reaparecen: Nobleza rampa, variantes «suelte pelo», YuMOVE 60, Purina Neurocare, `y-rampa-…`. No tocar a ciegas: este informe de logs no las confirma.

---

## 5. Hecho en este bloque

1. `public/favicon.ico` + `<link rel="icon">` en `Layout.astro`.
2. Dejar de serializar `descuentoPct: null` en el island del header; 301 `/herramientas/null` → `/herramientas/`.
3. 301 del producto cama 90×57 → `/categoria/camas-ortopedicas/`.
4. `public/.well-known/security.txt` (contacto `hola@solucioncanina.es`, caduca 20 sep 2027).
5. `/.git/` comprobado 404 en producción; deny explícito en la config nginx del repo (hay que copiarla al VPS a mano, como el resto de nginx).
6. Pinterest: no fichero.
