from pathlib import Path
from celery import Celery
from app.core import SessionLocal, settings
from app.models import ImportJob
from app.importer import import_pdf

celery_app = Celery('dacsan', broker=settings().celery_broker_url, backend=settings().celery_result_backend)
celery_app.conf.update(task_track_started=True, worker_prefetch_multiplier=1, task_acks_late=True)


@celery_app.task(name='app.tasks.process_pdf_import')
def process_pdf_import(job_id: str):
    with SessionLocal() as db:
        job = db.get(ImportJob,job_id)
        if not job: return
        job.status='processing'; job.progress=10;job.message='Đang phân tích PDF và mục lục';db.commit()
        try:
            issue=import_pdf(db,Path(settings().media_root)/job.storage_key,publish_sample=False)
            job.issue_id=issue.id
            job.status='needs_review';job.progress=100
            job.message='Đã tạo bản nháp. Vui lòng kiểm tra mục lục, trang và toàn văn trước khi xuất bản.'
            db.commit()
        except Exception as exc:
            db.rollback()
            job = db.get(ImportJob,job_id)
            if job:
                job.status='failed';job.progress=0;job.message=str(exc)[:1000];db.commit()
            raise
