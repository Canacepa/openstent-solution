# syntax=docker/dockerfile:1
#
# Production image: FrankenPHP (Caddy + PHP) serving the Symfony app.
# Build:  docker compose -f compose.yaml -f compose.preprod.yaml --env-file .env.preprod build

ARG PHP_VERSION=8.4

FROM dunglas/frankenphp:1-php${PHP_VERSION} AS base
WORKDIR /app
RUN install-php-extensions pdo_mysql intl opcache zip
COPY --from=composer/composer:2-bin /composer /usr/bin/composer
ENV COMPOSER_ALLOW_SUPERUSER=1


# ---- dependencies, cached until composer.json / composer.lock change ----
FROM base AS vendor
COPY composer.json composer.lock symfony.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction


# ---- the application ----
FROM base AS prod
ENV APP_ENV=prod APP_DEBUG=0

RUN mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"
COPY docker/php.ini "$PHP_INI_DIR/conf.d/zz-app.ini"
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY docker/entrypoint.sh /usr/local/bin/docker-entrypoint
# strip any Windows line endings: a CRLF script cannot run in the container
RUN sed -i 's/$//' /usr/local/bin/docker-entrypoint && chmod +x /usr/local/bin/docker-entrypoint

COPY . .
COPY --from=vendor /app/vendor ./vendor

# Symfony's Dotenv wants a .env file to exist; the real settings come from the container environment.
# The values below only let the build commands boot the kernel: none of them is kept in the image.
RUN set -eux; \
    echo "# runtime configuration comes from the container environment" > .env; \
    composer dump-autoload --classmap-authoritative --no-dev --no-interaction; \
    export APP_SECRET=build-only DEFAULT_URI=http://localhost MAILER_DSN=null://null \
           MESSENGER_TRANSPORT_DSN='doctrine://default?auto_setup=0' \
           DATABASE_URL='mysql://build:build@database:3306/build?serverVersion=8.4&charset=utf8mb4'; \
    php bin/console importmap:install --no-interaction; \
    php bin/console asset-map:compile --no-interaction; \
    php bin/console cache:warmup --env=prod --no-debug; \
    mkdir -p var public/uploads/team

ENTRYPOINT ["docker-entrypoint"]
CMD ["frankenphp", "run", "--config", "/etc/caddy/Caddyfile"]
