# GoAccess (informe diario de logs nginx)

El HTML vive en `/var/www/stats/`, fuera del root del site.
`./deploy/deploy.sh` hace rsync `--delete` a `/var/www/solucioncanina/html`
y no toca estas stats.

URL: `https://www.solucioncanina.es/stats/` (basic auth).

## Qué va en local y qué en el servidor

| Dónde | Qué |
|---|---|
| **Local** | Editar estos ficheros. Commit. `./deploy/deploy.sh` **no** instala GoAccess ni copia `deploy/stats/`. |
| **Servidor** (`ssh jan@ion`, luego `sudo`) | Todo lo de abajo: paquetes, directorios, copiar snippets, htpasswd, cron, primer informe. |

Copiar ficheros del repo al VPS (desde **local**):

```bash
rsync -avz deploy/stats/ jan@ion:/tmp/solucioncanina-stats/
```

El resto de comandos son **en el servidor**.

## 1. Paquetes (servidor)

```bash
sudo apt update
sudo apt install -y goaccess apache2-utils
```

`apache2-utils` trae `htpasswd`. No instales `geoip-database` / MaxMind.

## 2. Directorios (servidor)

```bash
sudo mkdir -p /var/www/stats /var/log/solucioncanina /etc/nginx/htpasswd
sudo chown www-data:adm /var/log/solucioncanina
sudo chmod 750 /var/log/solucioncanina
sudo chown root:www-data /var/www/stats
sudo chmod 750 /var/www/stats
```

## 3. Script, cron, logrotate, snippet nginx (servidor)

```bash
sudo install -m 755 /tmp/solucioncanina-stats/generate-report.sh \
  /usr/local/sbin/solucioncanina-goaccess

sudo install -m 644 /tmp/solucioncanina-stats/cron \
  /etc/cron.d/solucioncanina-goaccess

sudo install -m 644 /tmp/solucioncanina-stats/logrotate \
  /etc/logrotate.d/solucioncanina

sudo install -m 644 /tmp/solucioncanina-stats/nginx-stats.conf \
  /etc/nginx/snippets/solucioncanina-stats.conf
```

## 4. htpasswd (servidor)

Solo la primera vez usa `-c` (crea el fichero; lo pisa si ya existe):

```bash
sudo htpasswd -c /etc/nginx/htpasswd/solucioncanina-stats jan
```

Añadir otro usuario, sin `-c`:

```bash
sudo htpasswd /etc/nginx/htpasswd/solucioncanina-stats otro
```

```bash
sudo chmod 640 /etc/nginx/htpasswd/solucioncanina-stats
sudo chown root:www-data /etc/nginx/htpasswd/solucioncanina-stats
```

## 5. Vhost: log propio + include (servidor)

En `/etc/nginx/sites-available/solucioncanina`, dentro de
`server { server_name www.solucioncanina.es; }`, añade (el espejo
versionado está en `deploy/nginx/solucioncanina.conf`):

```nginx
    access_log /var/log/solucioncanina/access.log;
    include /etc/nginx/snippets/solucioncanina-stats.conf;
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## 6. Primer informe (servidor)

Hasta que nginx escriba el log nuevo, `generate-report` sale 0 sin HTML.
Genera un hit y lanza:

```bash
sudo /usr/local/sbin/solucioncanina-goaccess
```

Cron: 07:30 diario, después de logrotate.

## Informes

| URL | Contenido |
|---|---|
| `/stats/` | Todo el tráfico, bots incluidos. |
| `/stats/humanos.html` | Sin crawlers declarados (`--ignore-crawlers`), sin UA desconocidos (`--unknowns-as-crawlers`) y sin 404 (`--ignore-status=404`, los escáneres de `.env`/`wp-*`). Los dos últimos flags se omiten si la versión de GoAccess no los tiene (lo avisa en el log del cron). |

Flags comunes: `-q --anonymize-ip`, sin `--real-time-html`, panel Geo ignorado.
Sin `--keep-last`: el periodo lo marca `logrotate` de este vhost (32 días).
El `access.log` global de las otras apps no se mezcla.

Tras cambiar `generate-report.sh` hay que reinstalarlo en el servidor (paso 3).
