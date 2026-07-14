"""
竞品监控 - 站点深度爬取模块

专注于深度爬取单个产品的网站结构，不同于 scraper.py 的搜索式抓取。
从首页开始，递归提取导航结构和内部链接，构建完整的站点地图和功能模块列表。
"""

import re
import time
import random
import logging
import requests
from typing import List, Dict, Optional, Set, Tuple
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse, urldefrag
from collections import deque

import config
from scraper import _request_with_retry, _get_headers

logger = logging.getLogger(__name__)


# =============================================================================
# 数据容器
# =============================================================================

class PageData:
    """爬取的页面数据"""
    def __init__(self, url: str, title: str = "", content: str = "",
                 links: List[str] = None, nav_items: List[Dict] = None,
                 depth: int = 0, html: str = ""):
        self.url = url
        self.title = title
        self.content = content  # 页面正文摘要
        self.links = links or []  # 页面内的所有链接
        self.nav_items = nav_items or []  # 导航项 [{name, url, level}]
        self.depth = depth  # 爬取深度
        self.html = html  # 原始 HTML（用于后续解析）
        self.features = []  # 识别到的功能入口

    def to_dict(self) -> Dict:
        return {
            "url": self.url,
            "title": self.title,
            "content": self.content[:500] + "..." if len(self.content) > 500 else self.content,
            "links": self.links[:30],
            "nav_items": self.nav_items,
            "depth": self.depth,
            "features": self.features,
        }


class CrawlResult:
    """站点爬取结果"""
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.pages: Dict[str, PageData] = {}  # url -> PageData
        self.navigation_tree: List[Dict] = []  # 导航树结构
        self.all_links: Set[str] = set()  # 所有发现的链接
        self.sitemap_urls: List[str] = []  # 从 sitemap.xml 获取的 URL
        self.features: List[Dict] = []  # 从页面功能入口汇总出的功能模块
        self.sitemap_navigation: List[Dict] = []  # 从 sitemap URL 推断出的导航/功能入口
        self.errors: List[str] = []

    @property
    def total_pages(self) -> int:
        return len(self.pages)

    def to_dict(self) -> Dict:
        return {
            "base_url": self.base_url,
            "total_pages": self.total_pages,
            "pages": {url: p.to_dict() for url, p in list(self.pages.items())[:180]},
            "navigation_tree": self.navigation_tree,
            "features": self.features[:200],
            "sitemap_navigation": self.sitemap_navigation[:200],
            "all_links_count": len(self.all_links),
            "sitemap_urls_count": len(self.sitemap_urls),
            "sitemap_urls": self.sitemap_urls[:200],
            "errors": self.errors[:10],
        }


# =============================================================================
# 工具函数
# =============================================================================

def _normalize_url(url: str) -> str:
    """URL 标准化：去除 fragment，统一格式"""
    url, _ = urldefrag(url)
    url = url.rstrip("/")
    return url


def _is_same_domain(url: str, base_url: str) -> bool:
    """判断是否同域"""
    try:
        parsed_url = urlparse(url)
        parsed_base = urlparse(base_url)
        return parsed_url.netloc == parsed_base.netloc
    except Exception:
        return False


def _is_valid_crawl_url(url: str, base_url: str) -> bool:
    """判断 URL 是否值得爬取"""
    if not url or url.startswith("#") or url.startswith("javascript:"):
        return False
    if not _is_same_domain(url, base_url):
        return False

    parsed = urlparse(url)
    path = parsed.path.lower()

    # 排除静态资源
    static_extensions = {
        ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".ico",
        ".css", ".js", ".xml", ".json", ".pdf", ".zip", ".rar",
        ".mp3", ".mp4", ".avi", ".mov", ".woff", ".woff2", ".ttf",
    }
    if any(path.endswith(ext) for ext in static_extensions):
        return False

    # 排除常见无用路径
    exclude_patterns = [
        "/cdn-cgi/", "/.well-known/", "/wp-json/", "/feed",
        "/tag/", "/author/", "/page/", "utm_", "ref=",
    ]
    if any(pattern in url.lower() for pattern in exclude_patterns):
        return False

    return True


def _extract_text_content(soup: BeautifulSoup) -> str:
    """从 BeautifulSoup 对象中提取正文内容"""
    # 移除不需要元素
    for elem in soup(["script", "style", "noscript", "iframe", "svg"]):
        elem.decompose()

    # 尝试提取主要内容区域
    main_content = (
        soup.find("main") or
        soup.find("article") or
        soup.find("div", {"role": "main"}) or
        soup.find("div", class_=re.compile(r"(content|main|post|article)", re.I)) or
        soup.find("div", id=re.compile(r"(content|main|app)", re.I)) or
        soup.body
    )

    if main_content:
        text = main_content.get_text(separator="\n", strip=True)
    else:
        text = soup.get_text(separator="\n", strip=True)

    # 清理空行
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    text = "\n".join(lines)

    # 限制长度
    if len(text) > 6000:
        text = text[:6000] + "\n...(内容已截断)"

    return text


def _extract_page_title(soup: BeautifulSoup) -> str:
    """提取页面标题"""
    # 优先使用 h1
    h1 = soup.find("h1")
    if h1:
        title = h1.get_text(strip=True)
        if title:
            return title

    # 其次 title 标签
    title_tag = soup.find("title")
    if title_tag:
        title = title_tag.get_text(strip=True)
        if title:
            return title

    return ""


# =============================================================================
# 导航提取
# =============================================================================

def extract_navigation(html: str, base_url: str) -> List[Dict]:
    """
    从 HTML 中提取导航菜单结构。

    Args:
        html: 页面 HTML
        base_url: 基础 URL

    Returns:
        导航项列表 [{name, url, level, children}]
    """
    soup = BeautifulSoup(html, "html.parser")
    nav_items = []

    # 常见导航容器选择器
    nav_selectors = [
        "nav",
        "[role='navigation']",
        ".navbar",
        ".nav",
        ".navigation",
        ".header-nav",
        ".main-nav",
        "#nav",
        "#navigation",
        ".menu",
        ".main-menu",
        "#menu",
        "header .links",
        "header ul",
    ]

    nav_container = None
    for selector in nav_selectors:
        nav_container = soup.select_one(selector)
        if nav_container:
            break

    if not nav_container:
        # 降级：查找页面顶部的 ul 列表
        for ul in soup.find_all("ul"):
            links = ul.find_all("a", href=True)
            if 3 <= len(links) <= 50:  # 合理范围的导航
                nav_container = ul
                break

    if not nav_container:
        return nav_items

    def _parse_nav_list(parent_elem, level: int = 0) -> List[Dict]:
        """递归解析导航列表"""
        items = []

        # 直接子 li 元素
        li_elements = parent_elem.find_all("li", recursive=False)
        if not li_elements:
            li_elements = parent_elem.find_all("li")

        for li in li_elements[:30]:  # 限制最大导航项数
            link = li.find("a", href=True)
            if not link:
                continue

            name = link.get_text(strip=True)
            if not name or len(name) > 50:
                continue

            href = link.get("href", "")
            if href:
                full_url = urljoin(base_url, href)
            else:
                full_url = ""

            item = {
                "name": name,
                "url": full_url,
                "level": level,
                "children": [],
            }

            # 递归解析子菜单
            sub_list = li.find(["ul", "div"], class_=re.compile(r"(sub|dropdown|menu|child)", re.I))
            if not sub_list:
                sub_list = li.find("ul")
            if sub_list:
                item["children"] = _parse_nav_list(sub_list, level + 1)

            items.append(item)

        return items

    # 解析顶层导航
    # 如果是 ul 或 ol，直接解析其 li
    if nav_container.name in ["ul", "ol"]:
        nav_items = _parse_nav_list(nav_container, 0)
    else:
        # 查找内部的 ul
        top_ul = nav_container.find(["ul", "ol"])
        if top_ul:
            nav_items = _parse_nav_list(top_ul, 0)
        else:
            nav_items = _parse_nav_list(nav_container, 0)

    logger.info(f"导航提取完成，发现 {len(nav_items)} 个顶层导航项")
    return nav_items


def extract_page_features(html: str, url: str) -> List[Dict]:
    """
    从页面中提取功能入口和链接。

    Args:
        html: 页面 HTML
        url: 当前页面 URL

    Returns:
        功能入口列表 [{name, url, description}]
    """
    soup = BeautifulSoup(html, "html.parser")
    features = []
    seen_names = set()

    # 策略1：CTA 按钮（常见的主操作按钮）
    cta_selectors = [
        "a.btn", "button.btn",
        "a.cta", "button.cta",
        "a[href*='create']", "a[href*='start']",
        "a[href*='try']", "a[href*='get']",
        ".hero a", ".banner a",
        "[class*='card'] a",
        "[class*='feature'] a",
        "[class*='product'] a",
    ]

    for selector in cta_selectors:
        for elem in soup.select(selector):
            name = elem.get_text(strip=True)
            if name and 2 < len(name) < 30 and name not in seen_names:
                seen_names.add(name)
                href = elem.get("href", "")
                if href:
                    features.append({
                        "name": name,
                        "url": urljoin(url, href),
                        "description": "",
                    })

    # 策略2：卡片/区块中的功能入口
    card_selectors = [
        "[class*='card']",
        "[class*='feature']",
        "[class*='service']",
        "[class*='product-item']",
    ]

    for selector in card_selectors:
        for card in soup.select(selector)[:20]:
            title_elem = card.find(["h2", "h3", "h4", "strong"])
            if title_elem:
                name = title_elem.get_text(strip=True)
                if name and name not in seen_names and len(name) < 30:
                    seen_names.add(name)
                    link = card.find("a", href=True)
                    href = link.get("href", "") if link else ""

                    desc_elem = card.find(["p", "span"])
                    desc = desc_elem.get_text(strip=True)[:100] if desc_elem else ""

                    features.append({
                        "name": name,
                        "url": urljoin(url, href) if href else "",
                        "description": desc,
                    })

    # 去重
    unique_features = []
    seen_urls = set()
    for f in features:
        key = f["url"] or f["name"]
        if key not in seen_urls:
            seen_urls.add(key)
            unique_features.append(f)

    return unique_features


# =============================================================================
# 站点爬取核心逻辑
# =============================================================================

def crawl_site_structure(base_url: str, max_pages: int = None, max_depth: int = None) -> CrawlResult:
    """
    从首页开始，递归提取导航结构和内部链接。
    使用 BFS 策略逐层爬取。

    Args:
        base_url: 站点根 URL
        max_pages: 最大爬取页面数
        max_depth: 最大爬取深度

    Returns:
        CrawlResult 对象
    """
    if max_pages is None:
        max_pages = config.MAX_CRAWL_PAGES
    if max_depth is None:
        max_depth = config.MAX_CRAWL_DEPTH

    logger.info(f"开始深度爬取站点: {base_url}（最大 {max_pages} 页，深度 {max_depth}）")

    result = CrawlResult(base_url)
    base_url = _normalize_url(base_url)

    # BFS 爬取队列: (url, depth)
    queue = deque()
    visited: Set[str] = set()

    # 从首页开始
    start_url = base_url
    if not start_url.startswith("http"):
        start_url = "https://" + start_url
    queue.append((start_url, 0))

    while queue and len(result.pages) < max_pages:
        current_url, current_depth = queue.popleft()
        normalized = _normalize_url(current_url)

        if normalized in visited:
            continue
        visited.add(normalized)

        if not _is_valid_crawl_url(current_url, base_url) and current_url != start_url:
            continue

        # 爬取页面
        page_data = _crawl_single_page(current_url, current_depth)
        if not page_data:
            continue

        result.pages[normalized] = page_data
        result.all_links.update(page_data.links)

        logger.debug(f"已爬取 [{len(result.pages)}/{max_pages}]: {current_url}")

        # 首页特殊处理：提取导航结构
        if current_url == start_url and page_data.html:
            result.navigation_tree = extract_navigation(page_data.html, base_url)
            page_data.features = extract_page_features(page_data.html, current_url)

        # 将发现的链接加入队列
        if current_depth < max_depth:
            for link in page_data.links:
                link_normalized = _normalize_url(link)
                if (link_normalized not in visited and
                        _is_valid_crawl_url(link, base_url)):
                    queue.append((link, current_depth + 1))

        # 请求间隔
        time.sleep(config.REQUEST_DELAY)

    logger.info(f"站点爬取完成: {result.total_pages} 个页面, {len(result.all_links)} 个链接")
    return result


def _crawl_single_page(url: str, depth: int) -> Optional[PageData]:
    """爬取单个页面"""
    resp = _request_with_retry(url)
    if not resp:
        return None

    try:
        content_type = resp.headers.get("Content-Type", "")
        if "text/html" not in content_type and "application/xhtml" not in content_type:
            return None

        html = resp.text
        soup = BeautifulSoup(html, "html.parser")

        title = _extract_page_title(soup)
        content = _extract_text_content(soup)

        # 提取所有链接
        links = []
        for a_tag in soup.find_all("a", href=True):
            href = a_tag.get("href", "")
            if href:
                full_url = urljoin(url, href)
                full_url = _normalize_url(full_url)
                links.append(full_url)

        # 提取导航项
        nav_items = []
        nav_tree = extract_navigation(html, url)
        for item in nav_tree:
            nav_items.append({"name": item["name"], "url": item["url"], "level": item["level"]})
            for child in item.get("children", []):
                nav_items.append({"name": child["name"], "url": child["url"], "level": child["level"]})

        page = PageData(
            url=url,
            title=title,
            content=content,
            links=list(set(links)),
            nav_items=nav_items,
            depth=depth,
            html=html,
        )

        # 提取功能入口
        page.features = extract_page_features(html, url)

        return page

    except Exception as e:
        logger.error(f"解析页面失败: {url} - {e}")
        return None


def crawl_page_tree(urls: List[str], base_url: str, max_depth: int = 2) -> Dict[str, PageData]:
    """
    按层级爬取一组 URL 的页面。

    Args:
        urls: 起始 URL 列表
        base_url: 基础 URL（用于同域过滤）
        max_depth: 最大深度

    Returns:
        {url: PageData} 字典
    """
    pages = {}
    queue = deque()
    visited = set()

    for url in urls:
        queue.append((url, 0))

    while queue and len(pages) < config.MAX_CRAWL_PAGES:
        current_url, depth = queue.popleft()
        normalized = _normalize_url(current_url)

        if normalized in visited:
            continue
        visited.add(normalized)

        if not _is_valid_crawl_url(current_url, base_url):
            continue

        page = _crawl_single_page(current_url, depth)
        if page:
            pages[normalized] = page

            if depth < max_depth:
                for link in page.links:
                    link_norm = _normalize_url(link)
                    if link_norm not in visited and _is_valid_crawl_url(link, base_url):
                        queue.append((link, depth + 1))

            time.sleep(config.REQUEST_DELAY)

    return pages


def build_sitemap(base_url: str) -> List[str]:
    """
    尝试获取 sitemap.xml，提取所有 URL。

    Args:
        base_url: 站点根 URL

    Returns:
        URL 列表
    """
    urls = []
    parsed = urlparse(base_url)
    sitemap_url = f"{parsed.scheme}://{parsed.netloc}/sitemap.xml"

    logger.info(f"尝试获取 sitemap: {sitemap_url}")
    resp = _request_with_retry(sitemap_url)

    if not resp:
        logger.info("未找到 sitemap.xml")
        return urls

    try:
        soup = BeautifulSoup(resp.text, "html.parser")

        # 解析 <url><loc> 标签
        for loc in soup.find_all("loc"):
            url = loc.get_text(strip=True)
            if url:
                urls.append(url)

        # 如果是 sitemap index，递归获取子 sitemap
        for sitemap_loc in soup.find_all("sitemap"):
            loc = sitemap_loc.find("loc")
            if loc:
                sub_url = loc.get_text(strip=True)
                if sub_url:
                    sub_resp = _request_with_retry(sub_url)
                    if sub_resp:
                        sub_soup = BeautifulSoup(sub_resp.text, "html.parser")
                        for loc_tag in sub_soup.find_all("loc"):
                            url = loc_tag.get_text(strip=True)
                            if url:
                                urls.append(url)

        logger.info(f"从 sitemap 获取 {len(urls)} 个 URL")
    except Exception as e:
        logger.error(f"解析 sitemap 失败: {e}")

    return urls


def _humanize_path_segment(segment: str) -> str:
    """把 URL path 片段转成可读名称。"""
    cleaned = re.sub(r"[-_]+", " ", segment or "").strip()
    if not cleaned:
        return ""
    return cleaned[:1].upper() + cleaned[1:]


def infer_sitemap_navigation(sitemap_urls: List[str], base_url: str, limit: int = 200) -> List[Dict]:
    """
    从 sitemap URL 推断导航/功能入口。

    SPA 站点常常静态 HTML 里没有可解析导航，但 sitemap 会暴露真实栏目和工具页。
    这里不把它当最终结论，只作为后续框架分析的证据。
    """
    if not sitemap_urls:
        return []

    product_keywords = {
        "ai", "tool", "tools", "feature", "features", "creation", "create",
        "image", "video", "avatar", "design", "template", "templates",
        "workflow", "editor", "home", "pricing", "docs", "help", "use-cases",
        "case", "cases", "product", "products", "solution", "solutions",
    }
    excluded_segments = {"tag", "author", "page", "category"}
    groups: Dict[str, Dict] = {}
    seen_urls: Set[str] = set()

    def score_url(path_segments: List[str]) -> int:
        lowered = [s.lower() for s in path_segments]
        return sum(3 for s in lowered if s in product_keywords) + max(0, 4 - len(lowered))

    candidates = []
    for raw_url in sitemap_urls:
        if not raw_url or raw_url in seen_urls:
            continue
        seen_urls.add(raw_url)
        if not _is_valid_crawl_url(raw_url, base_url):
            continue
        parsed = urlparse(raw_url)
        segments = [s for s in parsed.path.split("/") if s]
        if not segments or any(s.lower() in excluded_segments for s in segments):
            continue
        if any(re.fullmatch(r"\d{4}|\d{6,}", s) for s in segments):
            continue
        candidates.append((score_url(segments), raw_url, segments))

    candidates.sort(key=lambda item: (-item[0], len(item[2]), item[1]))
    for _, raw_url, segments in candidates[:limit]:
        section_key = segments[0].lower()
        section_name = _humanize_path_segment(segments[0])
        leaf_name = _humanize_path_segment(segments[-1]) or section_name
        section_url = f"{urlparse(raw_url).scheme}://{urlparse(raw_url).netloc}/{segments[0]}"
        section = groups.setdefault(section_key, {
            "name": section_name,
            "url": section_url,
            "level": 0,
            "node_type": "section",
            "children": [],
            "_child_urls": set(),
        })
        if raw_url not in section["_child_urls"] and leaf_name.lower() != section_name.lower():
            section["children"].append({
                "name": leaf_name,
                "url": raw_url,
                "level": 1,
                "node_type": "feature" if any(s.lower() in product_keywords for s in segments) else "page",
            })
            section["_child_urls"].add(raw_url)

    navigation = []
    for item in groups.values():
        item.pop("_child_urls", None)
        navigation.append(item)
    return navigation[:limit]


def identify_features(pages_data: Dict[str, PageData]) -> List[Dict]:
    """
    从爬取的页面中识别所有功能模块。

    Args:
        pages_data: 爬取的页面数据

    Returns:
        功能模块列表 [{name, url, description, page_count}]
    """
    features = {}

    for url, page in pages_data.items():
        for feat in page.features:
            key = feat["name"]
            if key not in features:
                features[key] = {
                    "name": feat["name"],
                    "url": feat.get("url", url),
                    "description": feat.get("description", ""),
                    "page_count": 0,
                    "related_urls": [],
                }
            features[key]["page_count"] += 1
            features[key]["related_urls"].append(url)

    # 按出现频率排序
    sorted_features = sorted(features.values(), key=lambda x: x["page_count"], reverse=True)

    logger.info(f"功能识别完成: 发现 {len(sorted_features)} 个功能模块")
    return sorted_features


# =============================================================================
# 高级入口
# =============================================================================

def deep_crawl_product(product_url: str, product_name: str = "") -> CrawlResult:
    """
    对产品站点执行完整深度爬取流程。
    包括 sitemap 获取、站点结构爬取、功能识别。

    Args:
        product_url: 产品 URL
        product_name: 产品名称（用于日志）

    Returns:
        CrawlResult 对象
    """
    logger.info(f"===== 开始深度爬取产品: {product_name or product_url} =====")

    # 1. 尝试获取 sitemap
    sitemap_urls = build_sitemap(product_url)

    # 2. 执行 BFS 爬取
    result = crawl_site_structure(product_url)
    result.sitemap_urls = sitemap_urls

    # 3. 如果有 sitemap URL，补充爬取 sitemap 中的重要页面
    if sitemap_urls:
        existing_urls = set(result.pages.keys())
        new_urls = [u for u in sitemap_urls if _normalize_url(u) not in existing_urls
                     and _is_valid_crawl_url(u, product_url)]

        # 限制补充爬取数量
        extra_urls = new_urls[:60]
        if extra_urls:
            logger.info(f"从 sitemap 补充爬取 {len(extra_urls)} 个页面")
            extra_pages = crawl_page_tree(extra_urls, product_url, max_depth=1)
            result.pages.update(extra_pages)
            for page in extra_pages.values():
                result.all_links.update(page.links)

    # 4. 识别功能模块
    features = identify_features(result.pages)
    result.features = features
    result.sitemap_navigation = infer_sitemap_navigation(sitemap_urls, product_url)

    logger.info(
        f"深度爬取完成: {result.total_pages} 页, "
        f"{len(result.all_links)} 链接, "
        f"{len(features)} 功能模块, "
        f"{len(result.sitemap_navigation)} 个 sitemap 推断入口"
    )

    return result
