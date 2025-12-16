FROM python:3.11

# Install pipx and hatch for dependency management
ARG HATCH_VERSION=1.7.0
ARG PIPX_VERSION=1.2.0
ENV HATCH_ENV_TYPE_VIRTUAL_PATH=.venv \
    HATCH_VERSION=$HATCH_VERSION \
    PATH=/opt/pipx/bin:/app/.venv/bin:$PATH \
    PIPX_BIN_DIR=/opt/pipx/bin \
    PIPX_HOME=/opt/pipx/home \
    PIPX_VERSION=$PIPX_VERSION \
    PYTHONPATH=/app

# Copy application code
COPY ./app/ /app/
WORKDIR /app/

# Install pipx, hatch, and create virtual environment
RUN python -m pip install --no-cache-dir --upgrade pip "pipx==$PIPX_VERSION" && \
    pipx install "hatch==$HATCH_VERSION" && \
    hatch env prune && hatch env create production && \
    pip install --upgrade setuptools

# Install web server dependencies (FastAPI, Gunicorn, Uvicorn)
RUN pip install fastapi gunicorn uvicorn[standard]

# /start Project-specific dependencies
# RUN apt-get update && apt-get install -y --no-install-recommends \
#  && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*	
# WORKDIR /app/
# /end Project-specific dependencies

# Limit Gunicorn workers and disable reload to save RAM
ENV WEB_CONCURRENCY=1
ENV WITH_RELOAD=false

# For development, Jupyter remote kernel
# Using inside the container:
# jupyter lab --ip=0.0.0.0 --allow-root --NotebookApp.custom_display_url=http://127.0.0.1:8888
ARG INSTALL_JUPYTER=false
RUN bash -c "if [ $INSTALL_JUPYTER == 'true' ] ; then pip install jupyterlab ; fi"

ARG BACKEND_APP_MODULE=app.main:app
ARG BACKEND_PRE_START_PATH=/app/prestart.sh
ARG BACKEND_PROCESS_MANAGER=gunicorn
ARG BACKEND_WITH_RELOAD=false
ENV APP_MODULE=${BACKEND_APP_MODULE} PRE_START_PATH=${BACKEND_PRE_START_PATH} PROCESS_MANAGER=${BACKEND_PROCESS_MANAGER} WITH_RELOAD=${BACKEND_WITH_RELOAD} WEB_CONCURRENCY=${WEB_CONCURRENCY}

# Startup script
CMD ["/bin/bash", "-c", "if [ -f \"$PRE_START_PATH\" ]; then bash \"$PRE_START_PATH\"; fi && if [ \"$PROCESS_MANAGER\" = \"uvicorn\" ]; then exec uvicorn --host 0.0.0.0 --port 80 $([[ \"$WITH_RELOAD\" = \"true\" ]] && echo \"--reload\") $APP_MODULE; else exec gunicorn -k uvicorn.workers.UvicornWorker -w ${WEB_CONCURRENCY:-1} --bind 0.0.0.0:80 $APP_MODULE; fi"]