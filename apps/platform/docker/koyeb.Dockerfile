# Casuya backend for Koyeb — single always-free container.
# nginx listens on $PORT (Koyeb injects it) and proxies / to uvicorn (:8765),
# serving the static frontend from /usr/share/casuya/frontend. Same origin,
# so the frontend's API_BASE logic works with no CORS.
FROM python:3.14-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      nginx \
      gettext-base \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ backend/
COPY integrations/ integrations/
COPY storage/ storage/
COPY frontend/ /usr/share/casuya/frontend/

COPY docker/nginx-koyeb.conf /etc/nginx/conf.d/default.conf.template
COPY docker/koyeb-entrypoint.sh /usr/local/bin/koyeb-entrypoint.sh
RUN chmod +x /usr/local/bin/koyeb-entrypoint.sh

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8765/health')" || exit 1

ENV PORT=8080
ENTRYPOINT ["/usr/local/bin/koyeb-entrypoint.sh"]
