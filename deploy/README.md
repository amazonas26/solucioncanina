# Despliegue

    ./deploy/deploy.sh --dry-run   # ver qué cambiaría
    ./deploy/deploy.sh             # desplegar

Build local, rsync a /var/www/solucioncanina/html.
El servidor solo sirve ficheros estáticos: sin Node, sin systemd.

La config de nginx vive en deploy/nginx/ y se copia a mano
a /etc/nginx/sites-available/solucioncanina.

Informe GoAccess (logs nginx, basic auth): ver deploy/stats/README.md.
No forma parte de `./deploy/deploy.sh`.

## Python (scripts locales)

Catálogo, precios y `scripts/semanal.sh` corren en el venv `.venv/`
(está en `.gitignore`; no se despliega al VPS).

Crearlo una vez:

    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt

`scripts/semanal.sh` activa `.venv` si existe. Si no, aborta con estas
mismas instrucciones.