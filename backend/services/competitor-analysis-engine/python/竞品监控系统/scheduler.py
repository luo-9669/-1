"""
竞品监控 - 定时任务调度模块

封装定时任务逻辑，支持每日扫描和每周全量监控的定时执行。
可独立运行：python scheduler.py
"""

import time
import logging
import signal
import sys
from datetime import datetime

import schedule

import config
from models import WeeklyReport
from main import run_weekly_monitor, run_daily_scan

logger = logging.getLogger(__name__)

# 运行标志，用于优雅停止
_running = True


def _signal_handler(signum, frame):
    """处理终止信号，优雅停止"""
    global _running
    logger.info(f"收到信号 {signum}，正在停止调度器...")
    _running = False


def job_daily_scan():
    """定时任务：每日新功能扫描"""
    logger.info("===== 开始执行每日扫描任务 =====")
    try:
        competitors = config.get_competitors_from_config()
        results = run_daily_scan(competitors)
        logger.info(f"每日扫描完成，共扫描 {len(results)} 个竞品")

        # 统计
        with_features = sum(1 for r in results if r.has_new_features)
        if with_features > 0:
            logger.info(f"⚠️ 发现 {with_features} 个竞品有新功能动态！")
    except Exception as e:
        logger.error(f"每日扫描任务执行失败: {e}", exc_info=True)


def job_weekly_monitor():
    """定时任务：每周全量监控"""
    logger.info("===== 开始执行每周全量监控任务 =====")
    try:
        competitors = config.get_competitors_from_config()
        report = run_weekly_monitor(competitors)
        logger.info(f"每周监控完成，共发现 {len(report.changes)} 条变更")
    except Exception as e:
        logger.error(f"每周监控任务执行失败: {e}", exc_info=True)


def start_scheduler(daily_time: str = "09:00", weekly_day: str = "monday", weekly_time: str = "10:00"):
    """
    启动定时调度器。

    Args:
        daily_time: 每日扫描时间（HH:MM 格式）
        weekly_day: 每周监控执行日期（monday, tuesday, ...）
        weekly_time: 每周监控执行时间（HH:MM 格式）
    """
    # 注册信号处理
    signal.signal(signal.SIGINT, _signal_handler)
    signal.signal(signal.SIGTERM, _signal_handler)

    # 配置定时任务
    # 每日扫描
    schedule.every().day.at(daily_time).do(job_daily_scan)
    logger.info(f"已配置每日扫描任务，执行时间: 每天 {daily_time}")

    # 每周全量监控
    day_map = {
        "monday": schedule.every().monday,
        "tuesday": schedule.every().tuesday,
        "wednesday": schedule.every().wednesday,
        "thursday": schedule.every().thursday,
        "friday": schedule.every().friday,
        "saturday": schedule.every().saturday,
        "sunday": schedule.every().sunday,
    }
    day_job = day_map.get(weekly_day.lower(), schedule.every().monday)
    day_job.at(weekly_time).do(job_weekly_monitor)
    logger.info(f"已配置每周监控任务，执行时间: 每{weekly_day} {weekly_time}")

    logger.info("竞品监控调度器已启动，按 Ctrl+C 停止")
    print(f"\n📅 竞品监控定时任务已启动")
    print(f"   每日扫描: 每天 {daily_time}")
    print(f"   每周监控: 每{weekly_day} {weekly_time}")
    print(f"   按 Ctrl+C 停止\n")

    # 主循环
    while _running:
        schedule.run_pending()
        time.sleep(60)  # 每分钟检查一次

    logger.info("调度器已停止")
    print("\n✅ 调度器已停止")


def run_once(mode: str = "daily"):
    """
    立即执行一次任务（不启动定时循环）。

    Args:
        mode: "daily" 执行每日扫描，"weekly" 执行每周监控
    """
    if mode == "daily":
        job_daily_scan()
    elif mode == "weekly":
        job_weekly_monitor()
    else:
        logger.error(f"不支持的模式: {mode}")


# =============================================================================
# 独立运行入口
# =============================================================================

if __name__ == "__main__":
    """
    独立运行调度器。

    用法:
        python scheduler.py              # 启动定时调度器（默认每日09:00扫描，每周一10:00全量监控）
        python scheduler.py --now daily  # 立即执行一次每日扫描
        python scheduler.py --now weekly # 立即执行一次每周监控
    """
    import argparse

    # 配置日志
    config.ensure_output_dirs()
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler(
                f"{config.LOG_DIR}/scheduler.log",
                encoding="utf-8"
            ),
        ]
    )

    parser = argparse.ArgumentParser(description="竞品监控定时调度器")
    parser.add_argument(
        "--now", choices=["daily", "weekly"],
        help="立即执行一次任务（daily=每日扫描, weekly=每周监控）"
    )
    parser.add_argument("--daily-time", default="09:00", help="每日扫描时间（默认 09:00）")
    parser.add_argument("--weekly-day", default="monday", help="每周监控日期（默认 monday）")
    parser.add_argument("--weekly-time", default="10:00", help="每周监控时间（默认 10:00）")

    args = parser.parse_args()

    if args.now:
        # 立即执行一次
        run_once(args.now)
    else:
        # 启动定时调度
        start_scheduler(
            daily_time=args.daily_time,
            weekly_day=args.weekly_day,
            weekly_time=args.weekly_time,
        )
