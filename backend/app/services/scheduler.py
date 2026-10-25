import logging

from apscheduler.schedulers.background import BackgroundScheduler

from app.db import SessionLocal
from app.services import security, site_settings
from app.services.discord_sync import run_sync

log = logging.getLogger(__name__)

JOB_ID = "discord-bot-sync"
_scheduler: BackgroundScheduler | None = None


def _interval_minutes() -> int:
    with SessionLocal() as db:
        value = site_settings.get_setting(db, "discord_sync_interval_minutes")
    return max(5, min(int(value or 45), 24 * 60))


def start_scheduler(sync_on_startup: bool) -> None:
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = BackgroundScheduler(timezone="UTC", job_defaults={"coalesce": True, "max_instances": 1})
    _scheduler.add_job(
        run_sync,
        "interval",
        minutes=_interval_minutes(),
        id=JOB_ID,
        kwargs={"trigger": "scheduled"},
        replace_existing=True,
    )
    if sync_on_startup:
        _scheduler.add_job(run_sync, id="discord-bot-sync-startup", kwargs={"trigger": "startup"})
    # Security X member pulls: a short burst of work every 10s (resumable, rate-limit aware).
    _scheduler.add_job(security.run_pulls, "interval", seconds=10, id="security-x-pulls", replace_existing=True)
    _scheduler.start()
    log.info("Scheduler started (bot sync every %s min)", _interval_minutes())


def reschedule(minutes: int) -> None:
    if _scheduler is not None:
        _scheduler.reschedule_job(JOB_ID, trigger="interval", minutes=max(5, minutes))
        log.info("Bot sync rescheduled to every %s min", minutes)


def next_run_at():
    if _scheduler is None:
        return None
    job = _scheduler.get_job(JOB_ID)
    return job.next_run_time if job else None


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
