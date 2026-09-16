FROM node:24-bookworm-slim AS frontend
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
RUN npm run build && node scripts/package-laravel.mjs

FROM php:8.5-apache AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends libzip-dev unzip \
    && docker-php-ext-install zip \
    && php -r 'if (!function_exists("mb_strlen") || !class_exists("ZipArchive") || !function_exists("opcache_get_status")) { fwrite(STDERR, "Required PHP extension missing\n"); exit(1); }' \
    && rm -rf /var/lib/apt/lists/* \
    && a2enmod rewrite headers
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
WORKDIR /var/www/html
COPY --from=frontend /build/laravel/ ./
RUN composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader \
    && chown -R www-data:www-data storage bootstrap/cache \
    && sed -ri 's!/var/www/html!/var/www/html/public!g' /etc/apache2/sites-available/000-default.conf
ENV APP_NAME=MONITORA APP_ENV=production APP_DEBUG=false LOG_CHANNEL=stderr CACHE_STORE=file SESSION_DRIVER=array QUEUE_CONNECTION=sync
EXPOSE 80
