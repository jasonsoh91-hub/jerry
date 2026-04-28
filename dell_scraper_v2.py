#!/usr/bin/env python3
"""
Dell Monitors Full Specs Scraper v2
With Dell model number nomenclature parsing
"""

import asyncio
import pandas as pd
import re
import time
import json
from datetime import datetime
from playwright.async_api import async_playwright

# Configuration
BASE_URL = "https://www.dell.com/en-my/shop/monitors-monitor-accessories/sac/monitors/all-monitors"
OUTPUT_CSV = "dell_monitors_full_specs.csv"
OUTPUT_EXCEL = "dell_monitors_full_specs.xlsx"
TOTAL_PAGES = 7
REQUEST_DELAY = 2
BRAND = "DELL"

# Dell Model Nomenclature Patterns
DELL_MODEL_PATTERN = r'^([A-Z]{1,3})(\d{2})(\d{2})([A-Z]+)$'

def parse_dell_model_number(model_id):
    """
    Parse Dell model number using official nomenclature
    Example: U4924DW -> UltraSharp, 49", 2024, QHD, Ultrawide, USB-C
    """
    if not model_id or len(model_id) < 5:
        return None

    # Match pattern like: U4924DW, P2426HE, AW2725DF
    match = re.match(DELL_MODEL_PATTERN, model_id.replace('-', ''))

    if not match:
        return None

    prefix = match.group(1)      # U, P, S, SE, AW, UP, C, etc.
    size = match.group(2)        # First 2 digits = size in inches
    year = match.group(3)        # Last 2 digits = market year (24 = 2024)
    suffix = match.group(4)      # Feature letters

    # Parse Class
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

    # Parse Resolution Tier from suffix
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

    # Parse Feature Flags
    features = []
    if 'W' in suffix:
        features.append('Ultrawide (21:9/32:9)')
    if 'C' in suffix:
        features.append('USB-C Hub')
    if 'E' in suffix:
        features.append('Ethernet (RJ45)')
    if 'T' in suffix:
        features.append('Touchscreen')
    if 'D' in suffix:
        features.append('QHD Display')
    if 'H' in suffix:
        features.append('FHD Display')
    if 'G' in suffix or 'F' in suffix:
        features.append('Gaming Sync (G-Sync/FreeSync)')
    if 'R' in suffix:
        features.append('Red/Cyan/Magenta color')

    return {
        'model_id': model_id,
        'product_class': product_class,
        'screen_size': f"{size}\"",
        'model_year': f"20{year}",
        'resolution_tier': resolution_tier,
        'features': features,
        'full_specs': f"{product_class} {size}\" {20+int(year)} {', '.join(features)}"
    }

async def extract_products_from_page(page, page_num):
    """Extract all product URLs from a listing page"""
    try:
        url = f"{BASE_URL}?page={page_num}" if page_num > 1 else BASE_URL
        print(f"  📄 Page {page_num}")

        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(REQUEST_DELAY)

        # Dismiss cookie consent
        try:
            cookie_btn = page.locator("#onetrust-accept-btn-handler")
            if await cookie_btn.is_visible():
                await cookie_btn.click()
                await asyncio.sleep(1)
        except:
            pass

        await page.wait_for_selector("article[data-product-id]", timeout=10000)

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

        print(f"     ✅ {len(products)} products")
        return products

    except Exception as e:
        print(f"     ❌ Error: {e}")
        return []

def get_resolution_format(width, height):
    """Get resolution format label"""
    resolution_map = {
        (1920, 1080): 'FHD',
        (2560, 1440): 'QHD',
        (3840, 2160): '4K UHD',
        (1920, 1200): 'WUXGA',
        (2560, 1600): 'WQXGA',
        (3440, 1440): 'UWQHD',
        (3840, 1600): 'WUHD',
        (5120, 1440): '5K2K',
        (1366, 768): 'HD',
        (1600, 900): 'HD+',
        (1280, 1024): 'SXGA',
        (2560, 1080): 'UWFHD',
    }
    return resolution_map.get((width, height), '')

async def extract_model_from_title_or_id(title, product_id):
    """Extract model code from title or product ID"""
    # Try to extract from title using common patterns
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

    # Fallback: extract from product ID (remove 210- prefix if present)
    if product_id:
        # Extract from 210-XXXXXXX format
        match = re.search(r'210-([A-Z0-9]+)', product_id)
        if match:
            return match.group(1)
        # Or use the ID directly if it looks like a model
        if re.match(r'^[A-Z]{2,4}\d{2}\d{2}[A-Z]+$', product_id):
            return product_id

    return "N/A"

async def extract_product_specs(page, product):
    """Extract detailed specifications from product page"""
    product_id = product.get('product_id', '')
    url = product.get('url', '')
    title = product.get('title', '')

    if not url:
        return None

    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(REQUEST_DELAY)

        specs = {
            'Model': '',
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

        # === PARSE DELL MODEL NUMBER ===
        # Extract model from title or ID
        model_from_title = await extract_model_from_title_or_id(title, product_id)
        specs['Model'] = model_from_title

        # Try to parse model number to get size
        parsed_model = parse_dell_model_number(model_from_title)
        if parsed_model:
            specs['Size'] = parsed_model['screen_size']
            specs['Product Class'] = parsed_model['product_class']

        page_source = await page.content()

        # === Response Time ===
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

        # === Size (if not already extracted from model number) ===
        if specs['Size'] == 'N/A':
            # Try to extract from title
            size_patterns = [
                r'(\d{2})\s*["\-]"',
                r'(\d{2}\.\d)\s*["\-"]',
                r'(\d{2})\s*(?:Inch|"|Monitor)\b',
            ]

            for pattern in size_patterns:
                match = re.search(pattern, title)
                if match:
                    try:
                        size = float(match.group(1))
                        if 14 <= size <= 75:
                            specs['Size'] = f"{size}\""
                            break
                    except:
                        continue

            # Fallback to page source
            if specs['Size'] == 'N/A':
                size_source_patterns = [
                    r'Diagonal\s+Size[^0-9\n]*[\d.]+\s*mm[^0-9\n]*(\d+(?:\.\d+)?)\s*inches',
                    r'"screenSize"\s*:\s*"(\d+(?:\.\d+)?)',
                    r'(\d{2}\.?\d*)\s*["\-"]\s*Monitor',
                ]

                for pattern in size_source_patterns:
                    match = re.search(pattern, page_source, re.IGNORECASE)
                    if match:
                        size = float(match.group(1))
                        if 14 <= size <= 75:
                            specs['Size'] = f"{size}\""
                            break

        # === Resolution ===
        title_upper = title.upper()

        # Check model number suffix first
        if parsed_model and parsed_model['resolution_tier'] != 'N/A':
            specs['Resolution'] = parsed_model['resolution_tier']
        # Check title for format keywords
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
            # Search page source
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
                        format_label = get_resolution_format(width, height)
                        if format_label:
                            specs['Resolution'] = f"{width} x {height} {format_label}"
                        else:
                            specs['Resolution'] = f"{width} x {height}"
                        break

        # === Refresh Rate ===
        refresh_match = re.search(r'(\d+)\s*Hz', page_source, re.IGNORECASE)
        if refresh_match:
            hz = int(refresh_match.group(1))
            if 60 <= hz <= 500:
                specs['Refresh Rate'] = f"{hz}Hz"

        # === Ports ===
        ports_found = []
        if 'DisplayPort' in page_source: ports_found.append('DisplayPort')
        if 'HDMI' in page_source: ports_found.append('HDMI')
        if 'USB-C' in page_source or 'USB Type-C' in page_source: ports_found.append('USB-C')
        if 'VGA' in page_source: ports_found.append('VGA')
        if 'Thunderbolt' in page_source: ports_found.append('Thunderbolt')
        if 'RJ45' in page_source or 'Ethernet' in page_source: ports_found.append('Ethernet')

        if ports_found:
            specs['Compatible Ports'] = ', '.join(ports_found)

        return specs

    except Exception as e:
        print(f"       ❌ Error: {e}")
        return None

async def main():
    print("=" * 80)
    print("🚀 Dell Monitors Full Specs Scraper v2")
    print("   With Dell Model Number Nomenclature Parsing")
    print("=" * 80)
    print()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        await page.set_viewport_size({"width": 1920, "height": 1080})

        all_products = []
        all_specs = []

        try:
            # === Discovery ===
            print("📋 STEP 1: Discovering products")
            print("-" * 80)

            for page_num in range(1, TOTAL_PAGES + 1):
                products = await extract_products_from_page(page, page_num)
                all_products.extend(products)
                await asyncio.sleep(REQUEST_DELAY)

            # Remove duplicates
            seen_urls = set()
            unique_products = []
            for product in all_products:
                if product['url'] not in seen_urls:
                    seen_urls.add(product['url'])
                    unique_products.append(product)

            print(f"\n✅ Found {len(unique_products)} unique products")
            print()

            # === Extraction ===
            print("📋 STEP 2: Extracting specifications")
            print("-" * 80)

            for i, product in enumerate(unique_products, 1):
                print(f"[{i}/{len(unique_products)}] {product['product_id']}", end=" ")

                specs = await extract_product_specs(page, product)

                if specs:
                    all_specs.append(specs)
                    print(f"✅ {specs['Size']:>8} | {specs['Product Class']:>20} | {specs['Resolution'][:25]:>25}")
                else:
                    print("❌")

                await asyncio.sleep(REQUEST_DELAY)

            # === Save ===
            print("\n" + "=" * 80)
            print("📋 STEP 3: Saving results")
            print("-" * 80)

            if all_specs:
                df = pd.DataFrame(all_specs)

                column_order = ['Model', 'Brand', 'Product Class', 'Brief Naming', 'Size',
                               'Resolution', 'Response Time', 'Refresh Rate',
                               'Compatible Ports', 'Warranty']
                df = df[column_order]

                # Save to CSV
                df.to_csv(OUTPUT_CSV, index=False)
                print(f"✅ CSV: {OUTPUT_CSV}")

                # Save to Excel
                df.to_excel(OUTPUT_EXCEL, index=False, engine='openpyxl')
                print(f"✅ Excel: {OUTPUT_EXCEL}")
                print()

                # Statistics
                print("📊 Data Completeness:")
                for field in column_order:
                    filled = df[field].apply(lambda x: x != 'N/A' and pd.notna(x)).sum()
                    percent = int(filled / len(df) * 100)
                    bar = '█' * (percent // 5) + '░' + '░' * (20 - percent // 5)
                    print(f"   {field:20} {filled:3}/{len(df)} {percent:3}% {bar}")

                # Show model parsing examples
                print("\n🔍 Dell Model Number Examples:")
                models_parsed = df[df['Model'] != 'N/A']['Model'].head(10).tolist()
                for model in models_parsed:
                    parsed = parse_dell_model_number(model)
                    if parsed:
                        print(f"   {model:15} → {parsed['screen_size']:>6} {parsed['product_class']:>20} {parsed['model_year']}")

        except Exception as e:
            print(f"\n❌ Error: {e}")
            import traceback
            traceback.print_exc()

        finally:
            await browser.close()

    print("\n✅ Complete!")

if __name__ == "__main__":
    asyncio.run(main())
