#!/usr/bin/env python3
"""
Dell Monitors Full Specs Scraper
Extracts detailed specifications for all 74 Dell monitors from Malaysia store
"""

import asyncio
import pandas as pd
import re
import time
import json
from datetime import datetime
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

# Configuration
BASE_URL = "https://www.dell.com/en-my/shop/monitors-monitor-accessories/sac/monitors/all-monitors"
OUTPUT_FILE = "dell_monitors_full_specs.csv"
TOTAL_PAGES = 7
REQUEST_DELAY = 2  # seconds between requests

# Dell Malaysia store
BRAND = "DELL"

async def extract_products_from_page(page, page_num):
    """Extract all product URLs from a listing page"""
    try:
        url = f"{BASE_URL}?page={page_num}" if page_num > 1 else BASE_URL
        print(f"  📄 Loading page {page_num}: {url}")

        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(REQUEST_DELAY)

        # Dismiss cookie consent if present
        try:
            cookie_btn = page.locator("#onetrust-accept-btn-handler")
            if await cookie_btn.is_visible():
                await cookie_btn.click()
                await asyncio.sleep(1)
                print(f"     ✅ Cookie dialog dismissed")
        except:
            pass

        # Wait for products to load
        await page.wait_for_selector("article[data-product-id]", timeout=10000)

        # Extract products using data-product-detail attribute
        products = []

        # Method 1: Parse from page source (data-product-detail)
        page_source = await page.content()
        pattern = r'data-product-detail="(\{[^"]+\})"'
        matches = re.findall(pattern, page_source)

        for match in matches:
            try:
                # Decode HTML entities
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

        print(f"     ✅ Found {len(products)} products on page {page_num}")
        return products

    except Exception as e:
        print(f"     ❌ Error on page {page_num}: {e}")
        return []

async def extract_model_from_title(title):
    """Extract model code from title"""
    # Common patterns: SE2726D, U2725QE, P2425H
    patterns = [
        r'([A-Z]+\d+[A-Z]*)\s*Monitor',  # SE2726D Monitor
        r'([A-Z]+\d+[A-Z]*)\s*-',  # SE2726D-
        r'-\s*([A-Z]+\d+[A-Z]*)\s*\/',  # - SE2726D /
        r'([A-Z]{2,5}\d{3,5}[A-Z]{0,2})',  # General model pattern
    ]

    for pattern in patterns:
        match = re.search(pattern, title, re.IGNORECASE)
        if match:
            return match.group(1).upper()

    return "N/A"

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

async def extract_product_specs(page, product):
    """Extract detailed specifications from a product page"""
    product_id = product.get('product_id', '')
    url = product.get('url', '')
    title = product.get('title', '')

    if not url:
        return None

    try:
        print(f"    🔍 Scraping: {product_id} - {title[:50]}")

        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(REQUEST_DELAY)

        specs = {
            'Model': '',
            'Brand': BRAND,
            'Brief Naming': title,
            'Size': 'N/A',
            'Resolution': 'N/A',
            'Response Time': 'N/A',
            'Refresh Rate': 'N/A',
            'Compatible Ports': 'N/A',
            'Warranty': 'N/A'
        }

        # Extract Model from title
        specs['Model'] = await extract_model_from_title(title)

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

        # === Size ===
        # First try from title
        size_patterns = [
            r'(\d{2})\s*["\-]"',
            r'(\d{2}\.\d)\s*["\-]',
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

        # If not in title, check page source
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
        # Check title first
        title_upper = title.upper()
        if 'QHD' in title_upper and '27' in title_upper:
            specs['Resolution'] = '2560 x 1440 QHD'
        elif '4K' in title_upper:
            specs['Resolution'] = '3840 x 2160 4K UHD'
        elif 'FHD' in title_upper or 'FULL HD' in title_upper:
            specs['Resolution'] = '1920 x 1080 FHD'
        elif not specs['Resolution'] or specs['Resolution'] == 'N/A':
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
        if not specs['Refresh Rate'] or specs['Refresh Rate'] == 'N/A':
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
        if 'Mini DisplayPort' in page_source: ports_found.append('Mini DisplayPort')

        if ports_found:
            specs['Compatible Ports'] = ', '.join(ports_found)

        # === Warranty ===
        warranty_patterns = [
            r'(\d+)\s*(?:Year|Years)\s*(?:Hardware|Standard|Limited)?\s*warranty',
            r'warranty[^\d]*(\d+)\s*(?:year|month)',
            r'(\d+)\s*year\s*hardware\s*warranty',
        ]

        for pattern in warranty_patterns:
            match = re.search(pattern, page_source, re.IGNORECASE)
            if match:
                warranty_period = int(match.group(1))
                if warranty_period > 0 and warranty_period <= 10:
                    specs['Warranty'] = f"{warranty_period} Year{'s' if warranty_period > 1 else ''}"
                    break

        # Default warranty if not found (Dell typically offers 3 years)
        if specs['Warranty'] == 'N/A':
            specs['Warranty'] = '3 Years'

        return specs

    except Exception as e:
        print(f"       ❌ Error extracting specs: {e}")
        return None

async def main():
    print("=" * 80)
    print("🚀 Dell Monitors Full Specs Scraper")
    print("=" * 80)
    print(f"Target: {TOTAL_PAGES} pages, ~74 monitors")
    print(f"Output: {OUTPUT_FILE}")
    print("=" * 80)
    print()

    async with async_playwright() as p:
        # Launch browser (headless=False for debugging, set to True for production)
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()

        # Set viewport
        await page.set_viewport_size({"width": 1920, "height": 1080})

        all_products = []
        all_specs = []

        try:
            # === Step 1: Discovery - Collect all product URLs ===
            print("📋 STEP 1: Discovering all products from listing pages")
            print("-" * 80)

            for page_num in range(1, TOTAL_PAGES + 1):
                products = await extract_products_from_page(page, page_num)
                all_products.extend(products)

                # Small delay between pages
                await asyncio.sleep(REQUEST_DELAY)

            # Remove duplicates
            seen_urls = set()
            unique_products = []
            for product in all_products:
                if product['url'] not in seen_urls:
                    seen_urls.add(product['url'])
                    unique_products.append(product)

            print(f"\n✅ Discovery complete: {len(unique_products)} unique products found")
            print(f"   (Expected: ~74, Found: {len(unique_products)})")
            print()

            # === Step 2 & 3: Deep Crawl & Extraction ===
            print("📋 STEP 2 & 3: Extracting detailed specifications")
            print("-" * 80)

            success_count = 0
            fail_count = 0

            for i, product in enumerate(unique_products, 1):
                print(f"\n[{i}/{len(unique_products)}]", end=" ")

                specs = await extract_product_specs(page, product)

                if specs:
                    all_specs.append(specs)
                    success_count += 1
                    print(f"    ✅ {specs['Size']:>8} | {specs['Resolution'][:20]:>20} | {specs['Response Time']:>10}")
                else:
                    fail_count += 1

                # Rate limiting between product page requests
                await asyncio.sleep(REQUEST_DELAY)

            # === Step 4: Save to CSV ===
            print("\n" + "=" * 80)
            print("📋 STEP 4: Saving results to CSV")
            print("-" * 80)

            if all_specs:
                df = pd.DataFrame(all_specs)

                # Reorder columns
                column_order = ['Model', 'Brand', 'Brief Naming', 'Size', 'Resolution',
                               'Response Time', 'Refresh Rate', 'Compatible Ports', 'Warranty']
                df = df[column_order]

                # Save to CSV
                df.to_csv(OUTPUT_FILE, index=False)
                print(f"✅ Saved to: {OUTPUT_FILE}")
                print(f"   Total rows: {len(df)}")
                print()

                # Statistics
                print("📊 Data Completeness:")
                for field in column_order:
                    filled = df[field].apply(lambda x: x != 'N/A' and pd.notna(x)).sum()
                    percent = int(filled / len(df) * 100)
                    bar = '█' * (percent // 5) + '░' * (20 - percent // 5)
                    print(f"   {field:20} {filled:3}/{len(df)} {percent:3}% {bar}")

                print()
                print("=" * 80)
                print(f"✅ SUCCESS: {success_count}/{len(unique_products)} products scraped")
                print(f"❌ Failed: {fail_count}/{len(unique_products)}")
                print("=" * 80)
            else:
                print("❌ No data extracted")

        except Exception as e:
            print(f"\n❌ Fatal Error: {e}")
            import traceback
            traceback.print_exc()

        finally:
            await browser.close()

    print("\n✅ Scraping Complete!")

if __name__ == "__main__":
    asyncio.run(main())
