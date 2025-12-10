from celery import Celery

celery_app = Celery("worker", broker="amqp://guest@queue//")

celery_app.conf.task_routes = {"app.worker.*": "main-queue"}

# Import tasks to ensure they are registered
from app.worker import disl_tasks  # noqa
