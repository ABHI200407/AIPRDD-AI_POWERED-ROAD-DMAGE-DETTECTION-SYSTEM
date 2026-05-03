web: gunicorn -w $((2 * $(nproc) + 1)) -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:${PORT:-8000}
