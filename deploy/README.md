# Despliegue

    ./deploy/deploy.sh --dry-run   # ver qué cambiaría
    ./deploy/deploy.sh             # desplegar

Build local, rsync a /var/www/solucioncanina/html.
El servidor solo sirve ficheros estáticos: sin Node, sin systemd.

La config de nginx vive en deploy/nginx/ y se copia a mano
a /etc/nginx/sites-available/solucioncanina.

Informe GoAccess (logs nginx, basic auth): ver deploy/stats/README.md.
No forma parte de `./deploy/deploy.sh`.

## Actualización de productos (Amazon → catálogo)

    python scripts/update_prices.py --dry-run   # lee Amazon, no escribe nada
    python scripts/update_prices.py             # todo el catálogo (~8-10 min)

Una petición por producto: precio, oferta, nota, disponibilidad y nombre;
imagen y descripción solo si faltan. No elimina nada: lo no disponible se
queda sin precio y con `disponible: false`, y lo dudoso va a «A revisar» del
informe `scratch/productos/ultimo.md`. `--prune` recupera el borrado
automático de antes. Si Amazon bloquea (CAPTCHA) se detiene y sale con código 3.

### Automático cada lunes (systemd del usuario)

`scripts/productos_auto.sh` hace pull, actualiza, compila (si el build falla no
hay commit) y hace commit de los ficheros del catálogo. Solo actúa si el repo
está en `main` y sin cambios pendientes. Push y deploy, solo con
`AUTO_PUSH=1` / `AUTO_DEPLOY=1` en el `.service`.

Instalar (rellena la ruta del repo y el PATH de node/pnpm de esta máquina):

    REPO=$(pwd)
    NODEPATH="$(dirname "$(command -v node)"):$(dirname "$(command -v pnpm)"):/usr/local/bin:/usr/bin:/bin"
    sed -e "s#@REPO@#$REPO#g" -e "s#@PATH@#$NODEPATH#" \
      deploy/systemd/solucioncanina-productos.service > ~/.config/systemd/user/solucioncanina-productos.service
    cp deploy/systemd/solucioncanina-productos.timer ~/.config/systemd/user/
    systemctl --user daemon-reload
    systemctl --user enable --now solucioncanina-productos.timer

Ver cuándo toca y el último resultado:

    systemctl --user list-timers solucioncanina-productos.timer
    journalctl --user -u solucioncanina-productos -n 50

## Python (scripts locales)

Catálogo, precios y `scripts/semanal.sh` corren en el venv `.venv/`
(está en `.gitignore`; no se despliega al VPS).

Crearlo una vez:

    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt

`scripts/semanal.sh` activa `.venv` si existe. Si no, aborta con estas
mismas instrucciones.