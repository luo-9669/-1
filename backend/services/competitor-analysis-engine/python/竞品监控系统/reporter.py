"""
竞品监控 - 报告生成模块

负责生成三种类型的报告文档：
- 竞品周报（Markdown格式）
- 每日扫描报告
- 交互流程文档
所有报告以 Markdown 格式输出，便于在各种平台查看和分享。
"""

import os
import logging
from datetime import datetime
from typing import List

import config
from models import (
    ChangeRecord, ChangeCategory, ImpactLevel,
    ScanResult, WeeklyReport, InteractionFlow,
)

logger = logging.getLogger(__name__)


# =============================================================================
# 竞品周报
# =============================================================================

def generate_weekly_report(
    report_data: WeeklyReport,
    output_dir: str = None,
) -> str:
    """
    生成竞品周报（Markdown格式）。

    Args:
        report_data: 周报数据
        output_dir: 输出目录，默认为配置中的周报目录

    Returns:
        生成的报告文件路径
    """
    if output_dir is None:
        output_dir = config.WEEKLY_REPORT_DIR
    os.makedirs(output_dir, exist_ok=True)

    # 按竞品分组变更
    changes_by_competitor = {}
    for change in report_data.changes:
        if change.competitor not in changes_by_competitor:
            changes_by_competitor[change.competitor] = []
        changes_by_competitor[change.competitor].append(change)

    # 统计信息
    total_changes = len(report_data.changes)
    high_impact = sum(1 for c in report_data.changes if c.impact == ImpactLevel.HIGH)
    medium_impact = sum(1 for c in report_data.changes if c.impact == ImpactLevel.MEDIUM)

    # 生成 Markdown 内容
    md_lines = []
    md_lines.append(f"# 竞品监控周报")
    md_lines.append("")
    md_lines.append(f"> 报告日期：{report_data.report_date}")
    md_lines.append(f"> 监控周期：{report_data.period_start} ~ {report_data.period_end}")
    md_lines.append(f"> 生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M')}")
    md_lines.append("")

    # 概览
    md_lines.append("## 📊 本周概览")
    md_lines.append("")
    md_lines.append(f"- 共监控到 **{total_changes}** 条变更动态")
    md_lines.append(f"- 高影响变更 **{high_impact}** 条")
    md_lines.append(f"- 中影响变更 **{medium_impact}** 条")
    md_lines.append(f"- 涉及 **{len(changes_by_competitor)}** 个竞品")
    md_lines.append("")

    # 摘要
    if report_data.summary:
        md_lines.append("## 📝 本周摘要")
        md_lines.append("")
        md_lines.append(report_data.summary)
        md_lines.append("")

    # 重点事项
    if report_data.key_highlights:
        md_lines.append("## 🔔 重点事项")
        md_lines.append("")
        for highlight in report_data.key_highlights:
            md_lines.append(f"- ⚠️ {highlight}")
        md_lines.append("")

    # 各竞品详情
    md_lines.append("## 📋 竞品详情")
    md_lines.append("")

    for competitor_name, changes in changes_by_competitor.items():
        md_lines.append(f"### {competitor_name}")
        md_lines.append("")

        for change in changes:
            impact_icon = {"高": "🔴", "中": "🟡", "低": "🟢"}.get(change.impact.value, "⚪")
            md_lines.append(f"#### {impact_icon} [{change.category.value}] {change.summary}")
            md_lines.append("")
            md_lines.append(f"{change.details}")
            md_lines.append("")
            md_lines.append(f"- **影响等级**: {change.impact.value}")
            if change.impact_reason:
                md_lines.append(f"- **评估原因**: {change.impact_reason}")
            if change.source_urls:
                md_lines.append(f"- **信息来源**: {', '.join(change.source_urls[:3])}")
            md_lines.append("")

    # 建议
    if report_data.recommendations:
        md_lines.append("## 💡 建议与行动项")
        md_lines.append("")
        for i, rec in enumerate(report_data.recommendations, 1):
            md_lines.append(f"{i}. {rec}")
        md_lines.append("")

    # 页脚
    md_lines.append("---")
    md_lines.append(f"*本报告由竞品监控系统自动生成 | {datetime.now().strftime('%Y-%m-%d %H:%M')}*")

    # 写入文件
    content = "\n".join(md_lines)
    filename = f"竞品周报_{report_data.report_date}.md"
    filepath = os.path.join(output_dir, filename)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

    logger.info(f"竞品周报已生成: {filepath}")
    return filepath


# =============================================================================
# 每日扫描报告
# =============================================================================

def generate_scan_report(
    scan_results: List[ScanResult],
    output_dir: str = None,
) -> str:
    """
    生成每日新功能扫描报告。

    Args:
        scan_results: 各竞品的扫描结果
        output_dir: 输出目录

    Returns:
        报告文件路径
    """
    if output_dir is None:
        output_dir = config.DAILY_SCAN_DIR
    os.makedirs(output_dir, exist_ok=True)

    scan_date = scan_results[0].scan_date if scan_results else datetime.now().strftime("%Y-%m-%d")

    # 统计
    total = len(scan_results)
    with_features = sum(1 for r in scan_results if r.has_new_features)

    md_lines = []
    md_lines.append(f"# 竞品新功能扫描报告")
    md_lines.append("")
    md_lines.append(f"> 扫描日期：{scan_date}")
    md_lines.append(f"> 扫描竞品数：{total}")
    md_lines.append(f"> 发现新功能：{with_features} 个竞品")
    md_lines.append("")

    # 有新功能的竞品
    if with_features > 0:
        md_lines.append("## 🆕 发现新功能")
        md_lines.append("")

        for result in scan_results:
            if result.has_new_features:
                md_lines.append(f"### {result.competitor}")
                md_lines.append("")
                if result.summary:
                    md_lines.append(f"{result.summary}")
                    md_lines.append("")
                if result.new_features:
                    for feature in result.new_features:
                        md_lines.append(f"- ✨ {feature}")
                    md_lines.append("")

    # 无新功能的竞品
    no_feature_results = [r for r in scan_results if not r.has_new_features]
    if no_feature_results:
        md_lines.append("## ✅ 未发现新功能")
        md_lines.append("")
        for result in no_feature_results:
            md_lines.append(f"- **{result.competitor}**: {result.summary}")
        md_lines.append("")

    # 搜索结果详情
    md_lines.append("## 📎 搜索结果详情")
    md_lines.append("")

    for result in scan_results:
        md_lines.append(f"### {result.competitor}")
        md_lines.append("")
        if result.entries:
            for entry in result.entries:
                md_lines.append(f"- [{entry.title}]({entry.url})")
                if entry.snippet:
                    md_lines.append(f"  > {entry.snippet}")
        else:
            md_lines.append("- 无搜索结果")
        md_lines.append("")

    md_lines.append("---")
    md_lines.append(f"*扫描报告由竞品监控系统自动生成 | {datetime.now().strftime('%Y-%m-%d %H:%M')}*")

    # 写入文件
    content = "\n".join(md_lines)
    filename = f"扫描报告_{scan_date}.md"
    filepath = os.path.join(output_dir, filename)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

    logger.info(f"扫描报告已生成: {filepath}")
    return filepath


# =============================================================================
# 交互流程文档
# =============================================================================

def generate_interaction_doc(
    flow_data: InteractionFlow,
    output_dir: str = None,
) -> str:
    """
    生成交互流程文档。

    Args:
        flow_data: 交互流程数据
        output_dir: 输出目录

    Returns:
        文档文件路径
    """
    if output_dir is None:
        output_dir = config.FLOW_DIR
    os.makedirs(output_dir, exist_ok=True)

    md_lines = []
    md_lines.append(f"# 交互流程分析：{flow_data.competitor} - {flow_data.feature}")
    md_lines.append("")
    md_lines.append(f"> 竞品：{flow_data.competitor}")
    md_lines.append(f"> 功能：{flow_data.feature}")
    md_lines.append(f"> 生成日期：{flow_data.generated_at[:10]}")
    md_lines.append("")

    # 证据校验
    if getattr(flow_data, "evidence_status", "") and flow_data.evidence_status != "unknown":
        md_lines.append("## 功能证据校验")
        md_lines.append("")
        status_label = {
            "exact": "已找到目标功能证据",
            "similar": "未找到目标功能，仅发现相似功能",
            "not_found": "未找到此功能",
        }.get(flow_data.evidence_status, flow_data.evidence_status)
        md_lines.append(f"- **状态**: {status_label}")
        if getattr(flow_data, "evidence_reason", ""):
            md_lines.append(f"- **说明**: {flow_data.evidence_reason}")
        similar_features = getattr(flow_data, "similar_features", []) or []
        if similar_features:
            md_lines.append("")
            md_lines.append("### 相似功能线索")
            md_lines.append("")
            for item in similar_features[:8]:
                md_lines.append(f"- {item.get('name', '相似功能')}: {item.get('description', '')} {item.get('url', '')}".strip())
        md_lines.append("")

    # 流程概述
    if flow_data.flow_description:
        md_lines.append("## 📋 流程概述")
        md_lines.append("")
        md_lines.append(flow_data.flow_description)
        md_lines.append("")

    # 操作步骤
    if flow_data.steps:
        md_lines.append("## 🔄 操作步骤")
        md_lines.append("")
        md_lines.append("| 步骤 | 操作描述 | UI元素 | 预期结果 | 备注 |")
        md_lines.append("|------|----------|--------|----------|------|")
        for step in flow_data.steps:
            md_lines.append(
                f"| {step.step_number} | {step.description} | "
                f"{step.ui_element} | {step.expected_result} | {step.notes} |"
            )
        md_lines.append("")

        # 详细步骤（表格之外的详细说明）
        md_lines.append("### 步骤详情")
        md_lines.append("")
        for step in flow_data.steps:
            md_lines.append(f"**步骤 {step.step_number}: {step.description}**")
            md_lines.append("")
            if step.ui_element:
                md_lines.append(f"- UI元素: {step.ui_element}")
            if step.expected_result:
                md_lines.append(f"- 预期结果: {step.expected_result}")
            if step.notes:
                md_lines.append(f"- 备注: {step.notes}")
            md_lines.append("")

    # 信息来源
    if flow_data.source_urls:
        md_lines.append("## 🔗 信息来源")
        md_lines.append("")
        for url in flow_data.source_urls[:10]:
            md_lines.append(f"- {url}")
        md_lines.append("")

    md_lines.append("---")
    md_lines.append(f"*交互流程文档由竞品监控系统自动生成 | {datetime.now().strftime('%Y-%m-%d %H:%M')}*")

    # 写入文件
    content = "\n".join(md_lines)
    safe_name = flow_data.feature.replace(" ", "_").replace("/", "_")
    filename = f"交互流程_{flow_data.competitor}_{safe_name}.md"
    filepath = os.path.join(output_dir, filename)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

    logger.info(f"交互流程文档已生成: {filepath}")
    return filepath


# =============================================================================
# 辅助：生成 JSON 数据文件（用于后续分析或对比）
# =============================================================================

def save_raw_data(data: dict, filename: str, output_dir: str = None) -> str:
    """
    保存原始数据为 JSON 文件，便于后续对比分析。

    Args:
        data: 要保存的数据
        filename: 文件名
        output_dir: 输出目录

    Returns:
        文件路径
    """
    import json
    if output_dir is None:
        output_dir = config.OUTPUT_DIR
    os.makedirs(output_dir, exist_ok=True)

    filepath = os.path.join(output_dir, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    logger.info(f"原始数据已保存: {filepath}")
    return filepath


# =============================================================================
# 完整流程框架报告
# =============================================================================

def generate_framework_report(framework, output_dir: str = None) -> str:
    """
    生成完整流程框架文档（Markdown格式）。
    包含6大章节：信息架构、用户旅程、决策点、异常处理、状态流转、跨功能关联。

    Args:
        framework: ProductFramework 数据对象
        output_dir: 输出目录

    Returns:
        生成的报告文件路径
    """
    if output_dir is None:
        output_dir = config.FRAMEWORK_DIR
    os.makedirs(output_dir, exist_ok=True)

    md_lines = []

    # 文档头部
    md_lines.append(f"# {framework.product_name}完整流程框架文档")
    md_lines.append("")
    md_lines.append(f"> **产品**: {framework.product_name}")
    md_lines.append(f"> **URL**: {framework.product_url}")
    md_lines.append(f"> **生成时间**: {framework.generated_at[:19]}")
    md_lines.append(f"> **爬取页面数**: {framework.total_pages_crawled}")
    md_lines.append(f"> **识别功能数**: {framework.total_features_identified}")
    md_lines.append("")
    md_lines.append("---")
    md_lines.append("")

    # 目录
    md_lines.append("# 目录")
    md_lines.append("")
    md_lines.append("- [一、产品整体信息架构](#一产品整体信息架构)")
    md_lines.append("  - [1.1 顶层导航结构](#11-顶层导航结构)")
    md_lines.append("  - [1.2 功能模块划分](#12-功能模块划分)")
    md_lines.append("  - [1.3 页面层级关系](#13-页面层级关系)")
    md_lines.append("  - [1.4 完整页面清单](#14-完整页面清单)")
    md_lines.append("- [二、完整用户旅程](#二完整用户旅程)")
    md_lines.append("- [三、关键决策点汇总](#三关键决策点汇总)")
    md_lines.append("- [四、异常处理流程](#四异常处理流程)")
    md_lines.append("- [五、数据流与状态流转](#五数据流与状态流转)")
    md_lines.append("- [六、跨功能关联](#六跨功能关联)")
    md_lines.append("")
    md_lines.append("---")
    md_lines.append("")

    # 第一章：信息架构
    _render_chapter1_information_architecture(md_lines, framework)

    # 第二章：用户旅程
    _render_chapter2_user_journeys(md_lines, framework)

    # 第三章：决策点
    _render_chapter3_decision_points(md_lines, framework)

    # 第四章：异常处理
    _render_chapter4_exception_flows(md_lines, framework)

    # 第五章：状态流转
    _render_chapter5_state_transitions(md_lines, framework)

    # 第六章：跨功能关联
    _render_chapter6_cross_function_links(md_lines, framework)

    # 页脚
    md_lines.append("---")
    md_lines.append(f"*本报告由竞品监控系统自动生成 | {datetime.now().strftime('%Y-%m-%d %H:%M')}*")

    # 写入 Markdown 文件
    content = "\n".join(md_lines)
    safe_name = framework.product_name.replace(" ", "_").replace("/", "_")
    filename = f"{safe_name}完整流程框架.md"
    filepath = os.path.join(output_dir, filename)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

    logger.info(f"完整流程框架文档已生成: {filepath}")

    # 同时保存 JSON 数据
    save_raw_data(
        framework.to_dict(),
        f"{safe_name}_framework_data.json",
        output_dir,
    )

    return filepath


def _render_chapter1_information_architecture(md_lines, framework):
    """渲染第一章：产品整体信息架构"""
    md_lines.append("## 一、产品整体信息架构")
    md_lines.append("")

    # 1.1 导航结构
    md_lines.append("### 1.1 顶层导航结构（树状图）")
    md_lines.append("")
    md_lines.append("```")

    if framework.navigation_tree:
        _render_nav_tree(md_lines, framework.navigation_tree, framework.product_name, 0)
    else:
        md_lines.append(f"{framework.product_name}")
        md_lines.append("└── (导航结构未识别)")

    md_lines.append("```")
    md_lines.append("")

    # 1.2 功能模块划分
    md_lines.append("### 1.2 功能模块划分")
    md_lines.append("")

    if framework.feature_modules:
        md_lines.append("| 模块编号 | 功能模块 | 所属层级 | 核心用途 | 入口路径 | 前置条件 | 复杂度 | 置信度 | 数据来源 |")
        md_lines.append("|---------|---------|---------|---------|---------|---------|-------|---------|---------|")
        for m in framework.feature_modules:
            structured = getattr(m, "structured_data", {}) or {}
            data_sources = structured.get("data_sources", "")
            if isinstance(data_sources, list):
                data_sources = "、".join(data_sources)
            md_lines.append(
                f"| {m.module_id} | {m.name} | {m.level} | {m.purpose} | "
                f"{m.entry_path} | {m.prerequisite} | {m.complexity} | "
                f"{structured.get('confidence', 'inferred')} | {data_sources} |"
            )
    else:
        md_lines.append("(未识别到功能模块)")
    md_lines.append("")

    # 1.3 页面层级关系
    md_lines.append("### 1.3 页面层级关系")
    md_lines.append("")
    md_lines.append("```")
    if framework.page_hierarchy:
        md_lines.append(framework.page_hierarchy)
    else:
        md_lines.append("(页面层级关系未生成)")
    md_lines.append("```")
    md_lines.append("")

    # 1.4 完整页面清单
    md_lines.append("### 1.4 完整页面清单")
    md_lines.append("")
    if framework.page_evidence:
        md_lines.append("| 页面编号 | 页面名称 | URL | 功能入口 |")
        md_lines.append("|---------|---------|-----|---------|")
        for index, page in enumerate(framework.page_evidence, 1):
            features = page.get("features", []) if isinstance(page, dict) else []
            feature_names = "、".join([
                str(item.get("name", "") if isinstance(item, dict) else item)
                for item in features
                if item
            ])
            md_lines.append(
                f"| P{index:03d} | {page.get('title', '')} | {page.get('url', '')} | {feature_names} |"
            )
    else:
        md_lines.append("(未采集到页面级证据，待补采)")
    md_lines.append("")
    md_lines.append("---")
    md_lines.append("")


def _render_nav_tree(md_lines, nodes, prefix="", indent=0):
    """递归渲染导航树"""
    if indent == 0:
        md_lines.append(prefix)

    for i, node in enumerate(nodes):
        connector = "├── " if i < len(nodes) - 1 else "└── "
        child_prefix = "│   " if i < len(nodes) - 1 else "    "

        name = node.name if hasattr(node, "name") else node.get("name", "")
        node_type = node.node_type if hasattr(node, "node_type") else node.get("node_type", "")

        type_tag = f" [{node_type}]" if node_type and node_type != "page" else ""
        md_lines.append(f"{'│   ' * indent}{connector}{name}{type_tag}")

        children = node.children if hasattr(node, "children") else node.get("children", [])
        if children:
            _render_nav_tree_lines(md_lines, children, indent + 1)


def _render_nav_tree_lines(md_lines, nodes, indent):
    """渲染导航树的子级行"""
    for i, node in enumerate(nodes):
        connector = "├── " if i < len(nodes) - 1 else "└── "

        name = node.name if hasattr(node, "name") else node.get("name", "")
        node_type = node.node_type if hasattr(node, "node_type") else node.get("node_type", "")

        type_tag = f" [{node_type}]" if node_type and node_type != "page" else ""
        md_lines.append(f"{'│   ' * indent}{connector}{name}{type_tag}")

        children = node.children if hasattr(node, "name") else node.get("children", [])
        if hasattr(node, "children"):
            children = node.children
        else:
            children = node.get("children", [])

        if children:
            _render_nav_tree_lines(md_lines, children, indent + 1)


def _render_chapter2_user_journeys(md_lines, framework):
    """渲染第二章：完整用户旅程"""
    md_lines.append("## 二、完整用户旅程")
    md_lines.append("")

    if not framework.user_journeys:
        md_lines.append("(未提取到用户旅程)")
        md_lines.append("")
        md_lines.append("---")
        md_lines.append("")
        return

    for i, journey in enumerate(framework.user_journeys, 1):
        module_id = ""
        for m in framework.feature_modules:
            if m.name == journey.feature_name:
                module_id = f" {m.module_id}"
                break

        md_lines.append(f"### 2.{i} 功能{module_id}: {journey.feature_name}")
        md_lines.append("")

        if journey.entry_point:
            md_lines.append(f"**入口**: {journey.entry_point}")
            md_lines.append("")

        journey_structured = getattr(journey, "structured_data", {}) or {}
        if journey_structured.get("journey_confidence"):
            md_lines.append(f"**旅程置信度**: {journey_structured.get('journey_confidence')}")
            md_lines.append("")

        # 渲染步骤树
        md_lines.append("```")
        md_lines.append(f"{journey.feature_name}")
        md_lines.append(f"├─ 入口: {journey.entry_point}")
        md_lines.append("│")

        # 正常流步骤
        for step in journey.steps:
            if not step.is_exception:
                md_lines.append(f"├─ 步骤 {step.step_id}: {step.description}")
                if step.ui_element:
                    md_lines.append(f"│   ├─ UI元素: {step.ui_element}")
                if step.user_action:
                    md_lines.append(f"│   ├─ 用户操作: {step.user_action}")
                if step.system_feedback:
                    md_lines.append(f"│   └─ 系统反馈: {step.system_feedback}")
                step_structured = getattr(step, "structured_data", {}) or {}
                if step_structured.get("confidence"):
                    md_lines.append(f"│   ├─ 置信度: {step_structured.get('confidence')}")
                if step_structured.get("evidence"):
                    md_lines.append(f"│   └─ 依据: {step_structured.get('evidence')}")

        branch_flows = journey_structured.get("branch_flows", [])
        if branch_flows:
            md_lines.append("│")
            md_lines.append("├─ 分支路径:")
            for branch in branch_flows:
                md_lines.append(f"│   ├── {branch}")

        # 异常流
        if journey.exception_flows:
            md_lines.append("│")
            md_lines.append("├─ 异常流:")
            for ef in journey.exception_flows:
                md_lines.append(f"│   ├── {ef}")

        md_lines.append("│")
        md_lines.append("└─ 出口: 完成操作")
        md_lines.append("```")
        md_lines.append("")

        # 正常流汇总
        if journey.normal_flow:
            md_lines.append("**正常流程**: " + " → ".join(journey.normal_flow))
            md_lines.append("")

    md_lines.append("---")
    md_lines.append("")


def _render_chapter3_decision_points(md_lines, framework):
    """渲染第三章：关键决策点汇总"""
    md_lines.append("## 三、关键决策点汇总")
    md_lines.append("")

    if not framework.decision_points:
        md_lines.append("(未识别到决策点)")
        md_lines.append("")
        md_lines.append("---")
        md_lines.append("")
        return

    md_lines.append("| 序号 | 所在位置 | 决策内容 | 可选项 | 决策依据 | UX影响 |")
    md_lines.append("|------|---------|---------|-------|---------|-------|")

    for i, dp in enumerate(framework.decision_points, 1):
        options_str = " / ".join(dp.options[:3]) if dp.options else "-"
        md_lines.append(
            f"| {i} | {dp.location} | {dp.decision} | "
            f"{options_str} | {dp.criteria} | {dp.ux_implication} |"
        )

    md_lines.append("")
    md_lines.append("---")
    md_lines.append("")


def _render_chapter4_exception_flows(md_lines, framework):
    """渲染第四章：异常处理流程"""
    md_lines.append("## 四、异常处理流程")
    md_lines.append("")

    if not framework.exception_flows:
        md_lines.append("(未分析到异常流程)")
        md_lines.append("")
        md_lines.append("---")
        md_lines.append("")
        return

    md_lines.append("| 序号 | 异常场景 | 触发条件 | 系统响应 | 恢复路径 | 异常类型 |")
    md_lines.append("|------|---------|---------|---------|---------|---------|")

    for i, ef in enumerate(framework.exception_flows, 1):
        md_lines.append(
            f"| {i} | {ef.scenario} | {ef.trigger} | "
            f"{ef.system_response} | {ef.recovery_path} | {ef.error_type} |"
        )

    md_lines.append("")
    md_lines.append("---")
    md_lines.append("")


def _render_chapter5_state_transitions(md_lines, framework):
    """渲染第五章：数据流与状态流转"""
    md_lines.append("## 五、数据流与状态流转")
    md_lines.append("")

    if not framework.state_transitions:
        md_lines.append("(未分析到状态流转)")
        md_lines.append("")
        md_lines.append("---")
        md_lines.append("")
        return

    # 按实体分组
    entities = {}
    for st in framework.state_transitions:
        if st.entity not in entities:
            entities[st.entity] = []
        entities[st.entity].append(st)

    for entity, transitions in entities.items():
        md_lines.append(f"### 实体: {entity}")
        md_lines.append("")
        md_lines.append("```")
        md_lines.append(f"状态流转 - {entity}")
        md_lines.append("")

        for st in transitions:
            condition_str = f" (条件: {st.conditions})" if st.conditions else ""
            md_lines.append(f"  {st.from_state} ──[{st.trigger}]──> {st.to_state}{condition_str}")

        md_lines.append("```")
        md_lines.append("")

        # 表格形式
        md_lines.append("| 起始状态 | 目标状态 | 触发动作 | 前置条件 |")
        md_lines.append("|---------|---------|---------|---------|")
        for st in transitions:
            md_lines.append(f"| {st.from_state} | {st.to_state} | {st.trigger} | {st.conditions or '-'} |")
        md_lines.append("")

    md_lines.append("---")
    md_lines.append("")


def _render_chapter6_cross_function_links(md_lines, framework):
    """渲染第六章：跨功能关联"""
    md_lines.append("## 六、跨功能关联")
    md_lines.append("")

    if not framework.cross_function_links:
        md_lines.append("(未分析到跨功能关联)")
        md_lines.append("")
        md_lines.append("---")
        md_lines.append("")
        return

    # 关联表格
    md_lines.append("### 关联关系列表")
    md_lines.append("")
    md_lines.append("| 序号 | 源功能 | 目标功能 | 关联类型 | 关联描述 |")
    md_lines.append("|------|-------|---------|---------|---------|")

    for i, cfl in enumerate(framework.cross_function_links, 1):
        md_lines.append(
            f"| {i} | {cfl.source_feature} | {cfl.target_feature} | "
            f"{cfl.relationship} | {cfl.description} |"
        )

    md_lines.append("")

    # 关联矩阵
    features = list(set(
        [cfl.source_feature for cfl in framework.cross_function_links] +
        [cfl.target_feature for cfl in framework.cross_function_links]
    ))

    if len(features) > 1:
        md_lines.append("### 关联矩阵")
        md_lines.append("")

        # 表头
        header = "| 功能 | " + " | ".join(features[:8]) + " |"
        md_lines.append(header)
        separator = "|------|" + "|".join(["------"] * min(len(features), 8)) + "|"
        md_lines.append(separator)

        # 矩阵内容
        link_map = {}
        for cfl in framework.cross_function_links:
            key = (cfl.source_feature, cfl.target_feature)
            link_map[key] = cfl.relationship

        for src in features[:8]:
            row = f"| {src} |"
            for tgt in features[:8]:
                if src == tgt:
                    row += " - |"
                elif (src, tgt) in link_map:
                    rel = link_map[(src, tgt)]
                    short_rel = rel[:4] if len(rel) > 4 else rel
                    row += f" {short_rel} |"
                else:
                    row += " · |"
            md_lines.append(row)

        md_lines.append("")

    md_lines.append("---")
    md_lines.append("")
