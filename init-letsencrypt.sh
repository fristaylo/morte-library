#!/bin/sh
set -e

DOMAIN=agoncharenko.dev
DOMAIN_ARGS="-d agoncharenko.dev -d www.agoncharenko.dev"
EMAIL=andru200408@gmail.com
DATA_PATH=./certbot
RSA_KEY_SIZE=4096

mkdir -p "$DATA_PATH/conf" "$DATA_PATH/www"

if [ ! -e "$DATA_PATH/conf/options-ssl-nginx.conf" ] || [ ! -e "$DATA_PATH/conf/ssl-dhparams.pem" ]; then
    echo ">>> Downloading recommended TLS parameters"
    curl -sSfL https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "$DATA_PATH/conf/options-ssl-nginx.conf"
    curl -sSfL https://raw.githubusercontent.com/certbot/certbot/master/certbot/ssl-dhparams.pem > "$DATA_PATH/conf/ssl-dhparams.pem"
fi

if [ -e "$DATA_PATH/conf/renewal/$DOMAIN.conf" ]; then
    echo ">>> Certificate for $DOMAIN already issued, skipping bootstrap"
    docker compose up -d
    exit 0
fi

echo ">>> Creating self-signed placeholder certificate for $DOMAIN"
mkdir -p "$DATA_PATH/conf/live/$DOMAIN"
docker compose run --rm --entrypoint "openssl req -x509 -nodes -newkey rsa:$RSA_KEY_SIZE -days 1 -keyout /etc/letsencrypt/live/$DOMAIN/privkey.pem -out /etc/letsencrypt/live/$DOMAIN/fullchain.pem -subj /CN=localhost" certbot

echo ">>> Starting nginx"
docker compose up -d app
sleep 5

echo ">>> Removing placeholder certificate"
docker compose run --rm --entrypoint "rm -rf /etc/letsencrypt/live/$DOMAIN /etc/letsencrypt/archive/$DOMAIN /etc/letsencrypt/renewal/$DOMAIN.conf" certbot

echo ">>> Requesting Let's Encrypt certificate"
docker compose run --rm --entrypoint "certbot certonly --webroot -w /var/www/certbot $DOMAIN_ARGS --email $EMAIL --rsa-key-size $RSA_KEY_SIZE --agree-tos --no-eff-email" certbot

echo ">>> Reloading nginx"
docker compose exec app nginx -s reload

docker compose up -d

echo ">>> Done: https://$DOMAIN"
