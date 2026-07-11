"""
竞品监控 - CLI 入口

支持四种执行模式：
- weekly: 全量监控（搜索 → 分析 → 生成周报）
- daily: 每日扫描（搜索 → 判断新功能 → 输出报告）
- flow: 交互流程梳理（搜索 → 抓取 → 提取流程 → 输出文档）
- framework: 完整流程框架（深度爬取 → AI 分析 → 生成框架文档）
"""

import os
import sys
import json
import logging
import argparse
from datetime import datetime, timedelta
from typing import List

# 确保可以导入同目录模块
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import config
from models import (
    Competitor, WeeklyReport, ScanResult,
    ChangeRecord, InteractionFlow,
)
import scraper
import analyzer
import reporter
import site_crawler


def _change_sources(changes: List[ChangeRecord]) -> List[dict]:
    sources = []
    seen = set()
    for change in changes:
        urls = change.source_urls or []
        if not urls:
            key = f"{change.competitor}:{change.summary}"
            if key in seen:
                continue
            seen.add(key)
            sources.append({
                "title": change.summary,
                "url": "",
                "type": "weekly_change",
                "snippet": change.details[:240],
                "competitor": change.competitor,
                "discovered_at": change.discovered_at,
            })
            continue
        for url in urls[:5]:
            key = str(url or "").strip()
            if not key or key in seen:
                continue
            seen.add(key)
            sources.append({
                "title": change.summary,
                "url": key,
                "type": "weekly_change",
                "snippet": change.details[:240],
                "competitor": change.competitor,
                "discovered_at": change.discovered_at,
            })
    return sources[:80]


def _changes_raw_data(changes: List[ChangeRecord]) -> str:
    parts = []
    for change in changes[:30]:
        urls = "、".join(change.source_urls[:5]) if change.source_urls else ""
        parts.append(
            f"{change.competitor}｜{change.category.value}｜{change.summary}\n"
            f"{change.details}\n{urls}".strip()
        )
    return "\n---\n".join([part for part in parts if part])


def setup_logging(output_dir: str = None, verbose: bool = False):
    """配置日志系统"""
    config.ensure_output_dirs()

    log_level = logging.DEBUG if verbose else logging.INFO
    log_file = os.path.join(config.LOG_DIR, f"monitor_{datetime.now().strftime('%Y%m%d')}.log")

    logging.basicConfig(
        level=log_level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler(log_file, encoding="utf-8"),
        ]
    )


def run_weekly_monitor(competitors: List[Competitor]) -> WeeklyReport:
    """
    执行全量监控流程。

    流程：搜索各竞品动态 → AI 分析变更 → 评估影响 → 生成周报

    Args:
        competitors: 竞品列表

    Returns:
        周报数据
    """
    logger = logging.getLogger("weekly")
    logger.info(f"===== 开始全量监控，共 {len(competitors)} 个竞品 =====")

    end_date = datetime.now()
    start_date = end_date - timedelta(days=config.WEEKLY_DAYS)

    all_changes: List[ChangeRecord] = []

    for competitor in competitors:
        logger.info(f"--- 处理竞品: {competitor.name} ---")

        # 1. 搜索竞品动态
        entries = scraper.search_competitor(
            name=competitor.name,
            keywords=competitor.keywords,
            days=config.WEEKLY_DAYS,
        )

        # 2. 抓取前几个页面的详细内容
        entries = scraper.enrich_entries_with_content(entries, max_pages=3)

        # 3. 分析变更
        changes = analyzer.analyze_changes(
            competitor.name,
            entries,
            period_start=start_date.strftime("%Y-%m-%d"),
            period_end=end_date.strftime("%Y-%m-%d"),
        )

        # 4. 评估影响（对高/中影响的变更做深入评估）
        for change in changes:
            if change.impact.value in ["高", "中"]:
                new_impact, reason = analyzer.assess_impact(change)
                change.impact = new_impact
                change.impact_reason = reason

        all_changes.extend(changes)
        logger.info(f"竞品 [{competitor.name}] 发现 {len(changes)} 条变更")

    # 5. 生成周报摘要（如有 LLM）
    summary = ""
    key_highlights = []
    recommendations = []

    if config.LLM_API_KEY and all_changes:
        summary, key_highlights, recommendations = _generate_weekly_summary(all_changes)

    # 6. 构建周报数据
    report = WeeklyReport(
        report_date=end_date.strftime("%Y-%m-%d"),
        period_start=start_date.strftime("%Y-%m-%d"),
        period_end=end_date.strftime("%Y-%m-%d"),
        changes=all_changes,
        summary=summary or f"本周共监控到 {len(all_changes)} 条变更动态，涉及 {len(competitors)} 个竞品。",
        key_highlights=key_highlights,
        recommendations=recommendations,
    )
    report.evidence_count = len(all_changes)
    report.evidence_quality = "full" if all_changes else "none"
    report.sources = _change_sources(all_changes)
    report.raw_data = _changes_raw_data(all_changes)
    report.structured_data = {
        "changes": [change.to_dict() for change in all_changes],
        "period_start": report.period_start,
        "period_end": report.period_end,
        "competitor_count": len(competitors),
    }

    # 7. 生成报告文件
    report_path = reporter.generate_weekly_report(report)

    # 同时保存 JSON 数据
    reporter.save_raw_data(
        report.to_dict(),
        f"weekly_data_{report.report_date}.json",
        config.WEEKLY_REPORT_DIR,
    )

    logger.info(f"全量监控完成！报告已保存: {report_path}")
    print(f"\n✅ 全量监控完成")
    print(f"   共发现 {len(all_changes)} 条变更")
    print(f"   报告路径: {report_path}\n")

    return report


def _generate_weekly_summary(changes: List[ChangeRecord]) -> tuple:
    """使用 LLM 生成周报摘要、重点事项和建议"""
    # 整理变更信息
    change_summary = []
    for c in changes:
        change_summary.append(
            f"[{c.competitor}] [{c.category.value}] [{c.impact.value}] {c.summary}"
        )

    prompt = f"""以下是本周竞品监控发现的所有变更：

{chr(10).join(change_summary)}

请完成以下任务：
1. 写一段周报摘要（2-3句话，概括本周竞品动态要点）
2. 列出3-5条重点事项（最需要关注的变更）
3. 列出2-3条建议（我们应采取的行动）

以 JSON 格式返回：
{{
    "summary": "周报摘要",
    "highlights": ["重点1", "重点2"],
    "recommendations": ["建议1", "建议2"]
}}
只返回 JSON。"""

    from analyzer import _call_llm
    response = _call_llm(prompt)
    if response:
        try:
            response_text = response.strip()
            if response_text.startswith("```"):
                lines = response_text.split("\n")
                response_text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
            data = json.loads(response_text)
            return (
                data.get("summary", ""),
                data.get("highlights", []),
                data.get("recommendations", []),
            )
        except Exception:
            pass

    return ("", [], [])


def run_daily_scan(competitors: List[Competitor]) -> List[ScanResult]:
    """
    执行每日新功能扫描。

    流程：搜索各竞品近期动态 → 判断是否有新功能 → 生成扫描报告

    Args:
        competitors: 竞品列表

    Returns:
        扫描结果列表
    """
    logger = logging.getLogger("daily")
    logger.info(f"===== 开始每日扫描，共 {len(competitors)} 个竞品 =====")

    scan_results: List[ScanResult] = []

    for competitor in competitors:
        logger.info(f"--- 扫描竞品: {competitor.name} ---")

        # 1. 搜索近期动态
        entries = scraper.search_competitor(
            name=competitor.name,
            keywords=competitor.keywords,
            days=config.DAILY_DAYS,
        )

        # 2. 扫描新功能
        result = analyzer.scan_for_new_features(competitor.name, entries)
        scan_results.append(result)

    # 3. 生成报告
    report_path = reporter.generate_scan_report(scan_results)

    # 保存 JSON 数据
    scan_date = datetime.now().strftime("%Y-%m-%d")
    reporter.save_raw_data(
        {"results": [r.to_dict() for r in scan_results]},
        f"scan_data_{scan_date}.json",
        config.DAILY_SCAN_DIR,
    )

    logger.info(f"每日扫描完成！报告已保存: {report_path}")

    # 打印摘要
    with_features = [r for r in scan_results if r.has_new_features]
    print(f"\n✅ 每日扫描完成")
    print(f"   共扫描 {len(scan_results)} 个竞品")
    if with_features:
        print(f"   ⚠️ 发现 {len(with_features)} 个竞品有新功能:")
        for r in with_features:
            print(f"      - {r.competitor}: {', '.join(r.new_features[:3])}")
    else:
        print(f"   ✅ 未发现新功能动态")
    print(f"   报告路径: {report_path}\n")

    return scan_results


def run_interaction_flow(
    competitors: List[Competitor],
    competitor_name: str,
    feature: str,
) -> InteractionFlow:
    """
    执行交互流程梳理。

    流程：搜索教程/文档 → 抓取页面内容 → 提取交互流程 → 生成文档

    Args:
        competitors: 竞品列表（用于查找目标竞品）
        competitor_name: 目标竞品名称
        feature: 目标功能名称

    Returns:
        交互流程数据
    """
    logger = logging.getLogger("flow")
    logger.info(f"===== 开始交互流程梳理: [{competitor_name}] [{feature}] =====")

    # 查找目标竞品
    target = None
    for c in competitors:
        if c.name.lower() == competitor_name.lower():
            target = c
            break

    if not target:
        # 如果不在列表中，创建一个临时竞品对象
        logger.warning(f"竞品 [{competitor_name}] 不在默认列表中，使用通用关键词搜索")
        target = Competitor(
            name=competitor_name,
            url=f"https://www.{competitor_name.lower().replace(' ', '')}.com",
            tier=None,
            keywords=[
                f"{competitor_name} {feature} tutorial",
                f"{competitor_name} {feature} 教程",
                f"{competitor_name} {feature} how to",
                f"{competitor_name} {feature} guide",
            ],
        )

    # 1. 搜索教程和帮助文档
    flow_keywords = [
        f"{target.name} {feature} 教程",
        f"{target.name} {feature} tutorial",
        f"{target.name} {feature} how to use",
        f"{target.name} {feature} 使用指南",
        f"{target.name} {feature} guide",
    ]

    entries = scraper.search_competitor(
        name=target.name,
        keywords=flow_keywords,
        days=365,  # 搜索范围更大
    )

    # 2. 抓取页面内容（交互流程需要详细内容）
    entries = scraper.enrich_entries_with_content(entries, max_pages=5)

    # 3. 提取交互流程
    flow = analyzer.extract_interaction_flow(target.name, feature, entries)

    # 4. 生成文档
    doc_path = reporter.generate_interaction_doc(flow)

    # 保存 JSON 数据
    reporter.save_raw_data(
        flow.to_dict(),
        f"flow_{target.name}_{feature.replace(' ', '_')}.json",
        config.FLOW_DIR,
    )

    logger.info(f"交互流程梳理完成！文档已保存: {doc_path}")
    print(f"\n✅ 交互流程梳理完成")
    print(f"   竞品: {target.name}")
    print(f"   功能: {feature}")
    print(f"   步骤数: {len(flow.steps)}")
    print(f"   文档路径: {doc_path}\n")

    return flow


def run_framework(
    product_url: str,
    product_name: str = "",
    output_dir: str = None,
) -> dict:
    """
    执行完整流程框架分析。

    流程：深度爬取站点 → AI 分析6大章节 → 输出框架文档

    Args:
        product_url: 产品 URL
        product_name: 产品名称（可选，默认从 URL 推断）
        output_dir: 输出目录

    Returns:
        框架数据字典
    """
    logger = logging.getLogger("framework")

    if not product_name:
        from urllib.parse import urlparse
        parsed = urlparse(product_url)
        product_name = parsed.netloc.replace("www.", "").split(".")[0].capitalize()

    logger.info(f"===== 开始完整流程框架分析: {product_name} ({product_url}) =====")

    # 1. 深度爬取站点
    logger.info("步骤 1/3: 深度爬取产品站点...")
    crawl_result = site_crawler.deep_crawl_product(product_url, product_name)

    logger.info(
        f"爬取完成: {crawl_result.total_pages} 页, "
        f"{len(crawl_result.all_links)} 个链接"
    )

    # 2. AI 分析生成6大章节
    logger.info("步骤 2/3: AI 分析产品流程框架...")
    framework = analyzer.analyze_product_framework(
        product_name=product_name,
        product_url=product_url,
        crawled_pages=crawl_result,
    )

    # 3. 输出完整流程框架文档
    logger.info("步骤 3/3: 生成框架文档...")
    report_path = reporter.generate_framework_report(
        framework=framework,
        output_dir=output_dir,
    )

    logger.info(f"完整流程框架分析完成！文档已保存: {report_path}")
    print(f"\n✅ 完整流程框架分析完成")
    print(f"   产品: {product_name}")
    print(f"   URL: {product_url}")
    print(f"   爬取页面: {crawl_result.total_pages}")
    print(f"   识别功能: {len(framework.feature_modules)} 个")
    print(f"   用户旅程: {len(framework.user_journeys)} 个")
    print(f"   决策点: {len(framework.decision_points)} 个")
    print(f"   异常场景: {len(framework.exception_flows)} 个")
    print(f"   状态转换: {len(framework.state_transitions)} 个")
    print(f"   跨功能关联: {len(framework.cross_function_links)} 个")
    print(f"   文档路径: {report_path}\n")

    return framework.to_dict()


def main():
    """CLI 主入口"""
    parser = argparse.ArgumentParser(
        description="竞品监控系统 - 独立运行工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  python main.py weekly                                  # 全量监控
  python main.py daily                                   # 每日扫描
  python main.py flow --competitor HeyGen --feature "AI Avatar"  # 交互流程梳理
  python main.py framework --url https://www.heygen.com --name "HeyGen"  # 完整流程框架
  python main.py framework --all                         # 对所有默认竞品生成框架
  python main.py weekly --output ./my_reports            # 指定输出目录
  python main.py daily --verbose                         # 详细日志模式
        """,
    )

    # 模式选择
    parser.add_argument(
        "mode",
        choices=["weekly", "daily", "flow", "framework"],
        help="执行模式: weekly=全量监控, daily=每日扫描, flow=交互流程梳理, framework=完整流程框架",
    )

    # 交互流程模式专用参数
    parser.add_argument("--competitor", "-c", help="目标竞品名称（仅 flow 模式必需）")
    parser.add_argument("--feature", "-f", help="目标功能名称（仅 flow 模式必需）")

    # 完整流程框架模式专用参数
    parser.add_argument("--url", help="产品 URL（framework 模式必需）")
    parser.add_argument("--name", help="产品名称（framework 模式可选，默认从 URL 推断）")
    parser.add_argument("--all", action="store_true", help="对所有默认竞品执行框架分析（framework 模式）")

    # 通用参数
    parser.add_argument("--output", "-o", help="指定输出目录（覆盖默认配置）")
    parser.add_argument("--config", help="指定自定义配置文件路径")
    parser.add_argument("--verbose", "-v", action="store_true", help="启用详细日志输出")

    args = parser.parse_args()

    # 配置日志
    setup_logging(verbose=args.verbose)
    logger = logging.getLogger("main")

    # 配置验证
    warnings = config.validate_config()
    for w in warnings:
        logger.warning(f"配置提醒: {w}")

    # 覆盖输出目录
    if args.output:
        config.OUTPUT_DIR = args.output
        config.WEEKLY_REPORT_DIR = os.path.join(args.output, "weekly_reports")
        config.DAILY_SCAN_DIR = os.path.join(args.output, "daily_scans")
        config.FLOW_DIR = os.path.join(args.output, "interaction_flows")
        config.FRAMEWORK_DIR = os.path.join(args.output, "frameworks")

    # 确保目录存在
    config.ensure_output_dirs()

    # 获取竞品列表
    competitors = config.get_competitors_from_config()
    logger.info(f"竞品列表: {', '.join(c.name for c in competitors)}")

    # 根据模式执行
    try:
        if args.mode == "weekly":
            run_weekly_monitor(competitors)

        elif args.mode == "daily":
            run_daily_scan(competitors)

        elif args.mode == "flow":
            if not args.competitor or not args.feature:
                parser.error("flow 模式需要指定 --competitor 和 --feature 参数")
            run_interaction_flow(competitors, args.competitor, args.feature)

        elif args.mode == "framework":
            if getattr(args, "all", False):
                # 对所有默认竞品执行框架分析
                for comp in competitors:
                    try:
                        run_framework(comp.url, comp.name, args.output)
                    except Exception as e:
                        logger.error(f"框架分析失败 [{comp.name}]: {e}", exc_info=True)
                        print(f"\n⚠️ [{comp.name}] 框架分析失败: {e}\n")
            else:
                if not args.url:
                    parser.error("framework 模式需要指定 --url 参数（或使用 --all 对所有竞品执行）")
                run_framework(args.url, args.name or "", args.output)

    except KeyboardInterrupt:
        logger.info("用户中断执行")
        print("\n⚠️ 用户中断执行")
        sys.exit(1)
    except Exception as e:
        logger.error(f"执行失败: {e}", exc_info=True)
        print(f"\n❌ 执行失败: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
