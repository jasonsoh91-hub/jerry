#!/usr/bin/env python3
"""
Dell Monitors Scraper - Final Attempt for All 74 Products
With retry logic, longer timeouts, and multiple strategies
"""

import asyncio
import pandas as pd
import re
import time
import json
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

# Configuration
BASE_URL = "https://www.dell.com/en-my/shop/monitors-monitor-accessories/sac/monitors/all-monitors"
OUTPUT_CSV = "dell_all_74_monitors.csv"
OUTPUT_EXCEL = "dell_all_74_monitors.xlsx"
TOTAL_PAGES = 7
REQUEST_DELAY = 3  # Increased delay
PAGE_TIMEOUT = 60000  # 60 seconds
PRODUCT_TIMEOUT = 45000  # 45 seconds
MAX_RETRIES = 3
BRAND = "DELL"

# Dell Model Nomenclature
DELL_MODEL_PATTERN = r'^([A-Z]{1,3})(\d{2})(\d{2})([A-Z]+)$'

def parse_dell_model_number(model_id):
    """Parse Dell model number"""
    if not model_id or len(model_id) < 5:
        return None

    match = re.match(DELL_MODEL_PATTERN, model_id.replace('-', ''))
    if not match:
        return None

    prefix = match.group(1)
    size = match.group(2)
    year = match.group(3)
    suffix = match.group(4)

    class_map = {
        'U': 'UltraSharp',
        'UP': 'UltraSharp PremierColor',
        'P': 'Professional',
        'C': 'Collaboration',
        'S': 'Studio/Home',
        'SE': 'Special Edition',
        'E': 'Essential',
        'AW': 'Alienware',
        'G': 'Gaming',
    }

    product_class = class_map.get(prefix, prefix)

    resolution_tier = 'N/A'
    if 'Q' in suffix:
        resolution_tier = 'QHD (1440p/2K)'
    elif 'H' in suffix:
        resolution_tier = 'FHD (1080p)'
    elif 'K' in suffix:
        resolution_tier = '5K/6K/8K'
    elif 'D' in suffix:
        resolution_tier = 'QHD (1440p/2K)'
    elif 'T' in suffix:
        resolution_tier = 'Touchscreen'

    features = []
    if 'W' in suffix: features.append('Ultrawide')
    if 'C' in suffix: features.append('USB-C Hub')
    if 'E' in suffix: features.append('Ethernet')
    if 'T' in suffix: features.append('Touchscreen')
    if 'G' in suffix or 'F' in suffix: features.append('Gaming Sync')

    return {
        'screen_size': f"{size}\"",
        'product_class': product_class,
        'resolution_tier': resolution_tier,
        'features': features,
    }

async def fetch_with_retry(page, url, timeout_ms):
    """Fetch URL with retry logic"""
    for attempt in range(MAX_RETRIES):
        try:
            await page.goto(url, timeout=timeout_ms, wait_until="domcontentloaded")
            return True
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                print(f"       ⚠️  Attempt {attempt + 1} failed, retrying...")
                await asyncio.sleep(REQUEST_DELAY * 2)
            else:
                print(f"       ❌ All {MAX_RETRIES} attempts failed")
                return False
    return False

async def extract_products_from_page(page, page_num):
    """Extract products from a page with retry"""
    url = f"{BASE_URL}?page={page_num}" if page_num > 1 else BASE_URL

    for attempt in range(MAX_RETRIES):
        try:
            print(f"  📄 Page {page_num} (attempt {attempt + 1}/{MAX_RETRIES})")

            await page.goto(url, timeout=PAGE_TIMEOUT, wait_until="domcontentloaded")
            await asyncio.sleep(REQUEST_DELAY)

            # Dismiss cookies
            try:
                cookie_btn = page.locator("#onetrust-accept-btn-handler")
                if await cookie_btn.is_visible():
                    await cookie_btn.click()
                    await asyncio.sleep(1)
            except:
                pass

            # Wait for products
            await page.wait_for_selector("article[data-product-id]", timeout=15000)

            products = []
            page_source = await page.content()
            pattern = r'data-product-detail="(\{[^"]+\})"'
            matches = re.findall(pattern, page_source)

            for match in matches:
                try:
                    match = match.replace('&quot;', '"')
                    product_json = json.loads(match)

                    for product_id, data in product_json.items():
                        title = data.get('title', '')
                        pd_url = data.get('pdUrl', '')

                        if pd_url and title:
                            products.append({
                                'product_id': product_id,
                                'title': title,
                                'url': pd_url
                            })
                except:
                    continue

            print(f"     ✅ Found {len(products)} products")
            return products

        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                print(f"     ⚠️  Error: {e}, retrying...")
                await asyncio.sleep(REQUEST_DELAY * 3)
            else:
                print(f"     ❌ Failed to load page {page_num}")
                return []

async def extract_model_from_title(title, product_id):
    """Extract model from title"""
    patterns = [
        r'([A-Z]+\d+[A-Z]*)\s*Monitor',
        r'([A-Z]+\d+[A-Z]*)\s*-',
        r'-\s*([A-Z]+\d+[A-Z]*)\s*\/',
        r'([A-Z]{2,5}\d{3,5}[A-Z]{0,2})',
    ]

    for pattern in patterns:
        match = re.search(pattern, title, re.IGNORECASE)
        if match:
            return match.group(1).upper()

    # Extract from product ID
    if product_id:
        match = re.search(r'210-([A-Z0-9]+)', product_id)
        if match:
            return match.group(1)
        if re.match(r'^[A-Z]{2,4}\d{2}\d{2}[A-Z]+$', product_id):
            return product_id

    return "N/A"

async def extract_product_specs(page, product):
    """Extract specs with retry logic"""
    product_id = product.get('product_id', '')
    url = product.get('url', '')
    title = product.get('title', '')

    if not url:
        return None

    # Try to extract model first
    model = await extract_model_from_title(title, product_id)

    specs = {
        'Model': model,
        'Brand': BRAND,
        'Product Class': '',
        'Brief Naming': title,
        'Size': 'N/A',
        'Resolution': 'N/A',
        'Response Time': 'N/A',
        'Refresh Rate': 'N/A',
        'Compatible Ports': 'N/A',
        'Warranty': '3 Years'
    }

    # Parse model number for size and class
    parsed = parse_dell_model_number(model)
    if parsed:
        specs['Size'] = parsed['screen_size']
        specs['Product Class'] = parsed['product_class']

    # Fetch page with retry
    for attempt in range(MAX_RETRIES):
        try:
            print(f"    [{attempt + 1}/{MAX_RETRIES}] {product_id}", end=" ")

            await page.goto(url, timeout=PRODUCT_TIMEOUT, wait_until="domcontentloaded")
            await asyncio.sleep(REQUEST_DELAY)

            page_source = await page.content()

            # Response Time
            resp_patterns = [
                r'Response\s+Time[^0-9\n]*(\d+(?:\.\d+)?)\s*ms',
                r'Response\s*:\s*(\d+(?:\.\d+)?)\s*ms',
                r'(\d+(?:\.\d+)?)\s*ms\s*\(Normal\)',
                r'Normal:\s*(\d+(?:\.\d+)?)\s*ms',
            ]

            for pattern in resp_patterns:
                match = re.search(pattern, page_source, re.IGNORECASE | re.MULTILINE)
                if match:
                    rt = float(match.group(1))
                    if 0.1 <= rt <= 20:
                        specs['Response Time'] = f"{rt}ms"
                        break

            # Size fallback
            if specs['Size'] == 'N/A':
                size_patterns = [
                    r'Diagonal\s+Size[^0-9\n]*[\d.]+\s*mm[^0-9\n]*(\d+(?:\.\d+)?)\s*inches',
                    r'"screenSize"\s*:\s*"(\d+(?:\.\d+)?)',
                    r'(\d{2}\.?\d*)\s*["\-"]\s*Monitor',
                ]

                for pattern in size_patterns:
                    match = re.search(pattern, page_source, re.IGNORECASE)
                    if match:
                        size = float(match.group(1))
                        if 14 <= size <= 75:
                            specs['Size'] = f"{size}\""
                            break

            # Resolution
            if specs['Resolution'] == 'N/A':
                title_upper = title.upper()

                if parsed and parsed['resolution_tier'] != 'N/A':
                    specs['Resolution'] = parsed['resolution_tier']
                elif 'QHD' in title_upper:
                    specs['Resolution'] = '2560 x 1440 QHD'
                elif '4K' in title_upper or 'UHD' in title_upper:
                    specs['Resolution'] = '3840 x 2160 4K UHD'
                elif 'FHD' in title_upper or 'FULL HD' in title_upper:
                    specs['Resolution'] = '1920 x 1080 FHD'
                elif 'WUXGA' in title_upper:
                    specs['Resolution'] = '1920 x 1200 WUXGA'
                elif 'UWQHD' in title_upper:
                    specs['Resolution'] = '3440 x 1440 UWQHD'
                else:
                    res_patterns = [
                        r'(\d{3,5})\s*[x×]\s*(\d{3,5})(?:\s*at\s*(\d+)\s*Hz)?',
                        r'"resolution"\s*:\s*"(\d{3,5})\s*[x×]\s*(\d{3,5})"',
                    ]

                    for pattern in res_patterns:
                        res_match = re.search(pattern, page_source, re.IGNORECASE)
                        if res_match:
                            width = int(res_match.group(1))
                            height = int(res_match.group(2))

                            if width >= 1000 and height >= 500:
                                format_map = {
                                    (1920, 1080): 'FHD',
                                    (2560, 1440): 'QHD',
                                    (3840, 2160): '4K UHD',
                                    (1920, 1200): 'WUXGA',
                                    (3440, 1440): 'UWQHD',
                                }
                                format_label = format_map.get((width, height), '')
                                specs['Resolution'] = f"{width} x {height} {format_label}" if format_label else f"{width} x {height}"
                                break

            # Refresh Rate
            if specs['Refresh Rate'] == 'N/A':
                refresh_match = re.search(r'(\d+)\s*Hz', page_source, re.IGNORECASE)
                if refresh_match:
                    hz = int(refresh_match.group(1))
                    if 60 <= hz <= 500:
                        specs['Refresh Rate'] = f"{hz}Hz"

            # Ports
            ports = []
            if 'DisplayPort' in page_source: ports.append('DisplayPort')
            if 'HDMI' in page_source: ports.append('HDMI')
            if 'USB-C' in page_source or 'USB Type-C' in page_source: ports.append('USB-C')
            if 'VGA' in page_source: ports.append('VGA')
            if 'Thunderbolt' in page_source: ports.append('Thunderbolt')
            if 'RJ45' in page_source or 'Ethernet' in page_source: ports.append('Ethernet')

            specs['Compatible Ports'] = ', '.join(ports) if ports else ''

            print(f"✅ {specs['Size']:>8} | {specs['Resolution'][:20]:>20} | {specs['Response Time']:>10}")
            return specs

        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                print(f"⚠️  Error: {e}, retrying...")
                await asyncio.sleep(REQUEST_DELAY * 2)
            else:
                print(f"❌ Failed after {MAX_RETRIES} attempts")
                # Return partial specs
                return specs if specs.get('Response Time') != 'N/A' or specs.get('Resolution') != 'N/A' else None

    return None

async def main():
    print("=" * 80)
    print("🚀 Dell Monitors - Final Attempt for All 74 Products")
    print("   With retry logic, 60s timeout, 3s delays")
    print("=" * 80)
    print()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        await page.set_viewport_size({"width": 1920, "height": 1080})

        all_products = []
        all_specs = []
        seen_urls = set()

        try:
            print("📋 STEP 1: Discovering products from all pages")
            print("-" * 80)

            for page_num in range(1, TOTAL_PAGES + 1):
                products = await extract_products_from_page(page, page_num)

                for product in products:
                    if product['url'] not in seen_urls:
                        seen_urls.add(product['url'])
                        all_products.append(product)

                await asyncio.sleep(REQUEST_DELAY)

            unique_count = len(all_products)
            print(f"\n✅ Discovery complete: {unique_count} unique products")
            print()

            if unique_count == 0:
                print("❌ No products found!")
                return

            print("📋 STEP 2: Extracting specifications")
            print("-" * 80)

            for i, product in enumerate(all_products, 1):
                print(f"[{i}/{unique_count}] {product['product_id']}")

                specs = await extract_product_specs(page, product)

                if specs:
                    all_specs.append(specs)

                await asyncio.sleep(REQUEST_DELAY)

            # Save results
            print("\n" + "=" * 80)
            print("📋 STEP 3: Saving results")
            print("-" * 80)

            if all_specs:
                df = pd.DataFrame(all_specs)

                column_order = ['Model', 'Brand', 'Product Class', 'Brief Naming', 'Size',
                               'Resolution', 'Response Time', 'Refresh Rate',
                               'Compatible Ports', 'Warranty']
                df = df[column_order]

                df.to_csv(OUTPUT_CSV, index=False)
                print(f"✅ CSV: {OUTPUT_CSV}")

                df.to_excel(OUTPUT_EXCEL, index=False, engine='openpyxl')
                print(f"✅ Excel: {OUTPUT_EXCEL}")
                print()

                # Statistics
                print("📊 Data Completeness:")
                for field in column_order:
                    filled = df[field].apply(lambda x: x != 'N/A' and pd.notna(x)).sum()
                    percent = int(filled / len(df) * 100)
                    bar = '█' * (percent // 5) + '░' * (20 - percent // 5)
                    print(f"   {field:20} {filled:3}/{len(df)} {percent:3}% {bar}")

                print()
                print(f"✅ Total products: {len(all_specs)}")
                print(f"🎯 Target: 74 products")
                print(f"📊 Coverage: {int(len(all_specs)/74*100)}%")

        except Exception as e:
            print(f"\n❌ Error: {e}")
            import traceback
            traceback.print_exc()

        finally:
            await browser.close()

    print("\n✅ Complete!")

if __name__ == "__main__":
    asyncio.run(main())
