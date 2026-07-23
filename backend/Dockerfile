FROM python:3.12-slim@sha256:57cd7c3a7a273101a6485ba99423ee568157882804b1124b4dd04266317710de
WORKDIR /app
COPY pyproject.toml constraints.lock alembic.ini ./
COPY app ./app
COPY alembic ./alembic
RUN chmod -R a+rX /app && pip install --no-cache-dir --constraint constraints.lock .
RUN addgroup --system app && adduser --system --ingroup app app \
  && mkdir -p /data && chown app:app /data
USER app
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/ready', timeout=2)"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
