#!/usr/bin/env python3
"""
Dell Monitors Scraper - Fresh Start
Based on your template with improvements from previous session
"""

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
import pandas as pd
import time
import json
import re

# Configuration
OUTPUT_CSV = "Dell_Monitors_Full_List.csv"
OUTPUT_EXCEL = "Dell_Monitors_Full_List.xlsx"
BASE_URL = "https://www.dell.com/en-my/shop/monitors-monitor-accessories/sac/monitors/all-monitors"

def setup_driver(headless=True):
    """Setup Chrome WebDriver"""
    options = Options()
    if headless:
        options.add_argument('--headless=new')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--window-size=1920,1080')

    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    driver.set_page_load_timeout(45)
    driver.implicitly_wait(15)

    return driver

def dismiss_cookie_consent(driver):
    """Dismiss cookie consent dialog"""
    try:
        time.sleep(2)
        cookie_btn = driver.find_element(By.CSS_SELECTOR, "#onetrust-accept-btn-handler")
        driver.execute_script("arguments[0].click();", cookie_btn)
        time.sleep(2)
        print("✅ Cookie dialog dismissed")
        return True
    except:
        return False

def extract_products_from_listing(driver):
    """Extract products from listing page using updated selectors"""
    products = []
    page_source = driver.page_source

    # Method 1: Look for data-product-detail (new Dell structure)
    pattern1 = r'data-product-detail="(\{[^"]+\})"'
    matches1 = re.findall(pattern1, page_source)

    for match in matches1:
        try:
            match = match.replace('&quot;', '"')
            product_json = json.loads(match)

            for product_id, data in product_json.items():
                title = data.get('title', '')
                pd_url = data.get('pdUrl', '')
                price = data.get('dellPrice', '') or data.get('marketPrice', '')

                if pd_url and title:
                    products.append({
                        'product_id': product_id,
                        'name': title,
                        'link': pd_url,
                        'price': price
                    })
        except:
            continue

    # Method 2: Look for article elements with product data
    if not products:
        try:
            articles = driver.find_elements(By.CSS_SELECTOR, "article[data-product-id]")
            print(f"Found {len(articles)} product articles")

            for article in articles:
                try:
                    product_id = article.get_attribute('data-product-id')
                    product_detail = article.get_attribute('data-product-detail')

                    if product_detail:
                        product_detail = product_detail.replace('&quot;', '"')
                        data = json.loads(product_detail)
                        product_data = data.get(product_id, {})

                        title = product_data.get('title', '')
                        pd_url = product_data.get('pdUrl', '')
                        price = product_data.get('dellPrice', '')

                        if pd_url and not any(p['product_id'] == product_id for p in products):
                            products.append({
                                'product_id': product_id,
                                'name': title,
                                'link': pd_url,
                                'price': price
                            })
                except:
                    continue
        except Exception as e:
            print(f"Error with article extraction: {e}")

    print(f"✅ Extracted {len(products)} products from listing page")
    return products

def get_resolution_format(width, height):
    """Get resolution format label (FHD, QHD, 4K, etc.)"""
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

def extract_product_specs(driver, product):
    """Extract detailed specs from product page"""
    product_id = product.get('product_id', '')
    url = product.get('link', '')

    if not url:
        return None

    try:
        print(f"   Scraping: {product_id}")
        driver.get(url)
        time.sleep(3)

        specs = {
            'product_id': product_id,
            'name': product.get('name', ''),
            'size': '',
            'resolution': '',
            'refresh_rate': '',
            'response_time': '',
            'panel_type': '',
            'ports': '',
            'price': product.get('price', ''),
            'link': url
        }

        page_source = driver.page_source

        # Response Time - Multiple patterns
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
                    specs['response_time'] = f"{rt}ms"
                    break

        # Size - Enhanced extraction from title first
        title = specs['name']

        # Method 1: Extract from title (most reliable)
        title_patterns = [
            r'(\d{2})\s*["\-]"',  # 24" or 24-
            r'(\d{2}\.\d)\s*["\-]',  # 23.8" or 24.5-
            r'(\d{2})\s*(?:Inch|"|Monitor)\b',
            r'Dell\s+(?:Pro\s+)?(\d{2}\.?\d*)',
        ]

        size_found = False
        for pattern in title_patterns:
            match = re.search(pattern, title)
            if match:
                try:
                    size_str = match.group(1)
                    size = float(size_str)
                    if 14 <= size <= 75:
                        specs['size'] = f"{size} Inch"
                        size_found = True
                        break
                except:
                    continue

        # Method 2: Page source patterns if not found in title
        if not size_found:
            size_patterns = [
                r'Diagonal\s+Size[^0-9\n]*[\d.]+\s*mm[^0-9\n]*(\d+(?:\.\d+)?)\s*inches',
                r'"screenSize"\s*:\s*"(\d+(?:\.\d+)?)',
                r'screenSize["\']?\s*:\s*["\']?(\d+(?:\.\d+)?)',
                r'(\d{2}\.?\d*)\s*(?:inch|in|")\s*(?:monitor|display)',
            ]

            for pattern in size_patterns:
                match = re.search(pattern, page_source, re.IGNORECASE)
                if match:
                    try:
                        size = float(match.group(1))
                        if 14 <= size <= 75:
                            specs['size'] = f"{size} Inch"
                            size_found = True
                            break
                    except:
                        continue

        # Resolution - Check title first for common formats
        title = specs['name'].upper()

        # Title-based resolution detection
        if 'QHD' in title and '27' in title:
            specs['resolution'] = '2560 x 1440 QHD'
        elif '4K' in title:
            specs['resolution'] = '3840 x 2160 4K UHD'
        elif 'FHD' in title or 'FULL HD' in title:
            specs['resolution'] = '1920 x 1080 FHD'
        elif not specs['resolution']:  # If not found in title, search page
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
                        # Add format label
                        format_label = get_resolution_format(width, height)
                        if format_label:
                            specs['resolution'] = f"{width} x {height} {format_label}"
                        else:
                            specs['resolution'] = f"{width} x {height}"

                        try:
                            if res_match.group(3):
                                specs['refresh_rate'] = f"{res_match.group(3)}Hz"
                        except:
                            pass
                    break

        # Refresh rate fallback
        if not specs['refresh_rate']:
            refresh_match = re.search(r'(\d+)\s*Hz', page_source, re.IGNORECASE)
            if refresh_match:
                hz = int(refresh_match.group(1))
                if 60 <= hz <= 500:
                    specs['refresh_rate'] = f"{hz}Hz"

        # Panel Type
        panel_patterns = [
            r'Panel\s+Technology[^>]*>([^<]{5,50})</',
            r'"panelType"\s*:\s*"([^"]+)"'
        ]

        for pattern in panel_patterns:
            match = re.search(pattern, page_source)
            if match:
                panel = match.group(1).strip()
                if len(panel) < 50:
                    specs['panel_type'] = panel
                    break

        # Ports
        ports = []
        if 'DisplayPort' in page_source: ports.append('DisplayPort')
        if 'HDMI' in page_source: ports.append('HDMI')
        if 'USB-C' in page_source or 'USB Type-C' in page_source: ports.append('USB-C')
        if 'VGA' in page_source: ports.append('VGA')
        if 'Thunderbolt' in page_source: ports.append('Thunderbolt')
        if 'RJ45' in page_source or 'Ethernet' in page_source: ports.append('Ethernet')

        specs['ports'] = ', '.join(ports) if ports else ''

        return specs

    except Exception as e:
        print(f"   ❌ Error: {e}")
        return None

def main():
    print("🚀 Dell Monitors Scraper - Fresh Start")
    print("=" * 70)

    # Setup
    driver = setup_driver(headless=False)  # Set headless=True to hide browser

    try:
        # Navigate to URL
        print(f"\n📄 Loading: {BASE_URL}")
        driver.get(BASE_URL)
        time.sleep(5)

        # Dismiss cookie consent
        dismiss_cookie_consent(driver)

        # Extract products from listing page
        products = extract_products_from_listing(driver)

        if not products:
            print("❌ No products found!")
            return

        print(f"\n📋 Found {len(products)} products")
        print("📋 Scraping detailed specs...\n")

        # Scrape each product
        all_monitors = []

        for i, product in enumerate(products, 1):
            print(f"[{i}/{len(products)}] {product['product_id']}", end='')

            specs = extract_product_specs(driver, product)

            if specs:
                all_monitors.append(specs)
                print(f" ✅ {specs['size'] or 'N/A':>8} | {specs['resolution'] or 'N/A':>15} | {specs['response_time'] or 'N/A':>8}")
            else:
                print(" ❌")

            time.sleep(2)  # Rate limiting

        # Save results
        print("\n" + "=" * 70)
        print("💾 Saving results...")

        if all_monitors:
            # Save to CSV
            df = pd.DataFrame(all_monitors)
            df.to_csv(OUTPUT_CSV, index=False)
            print(f"✅ CSV saved: {OUTPUT_CSV}")

            # Save to Excel
            df.to_excel(OUTPUT_EXCEL, index=False, engine='openpyxl')
            print(f"✅ Excel saved: {OUTPUT_EXCEL}")

            # Statistics
            print("\n📊 Statistics:")
            print(f"Total Products: {len(all_monitors)}")
            print(f"Response Time: {df['response_time'].notna().sum()}/{len(all_monitors)}")
            print(f"Size: {df['size'].notna().sum()}/{len(all_monitors)}")
            print(f"Resolution: {df['resolution'].notna().sum()}/{len(all_monitors)}")

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

    finally:
        driver.quit()
        print("\n✅ Scraping Complete!")

if __name__ == "__main__":
    main()
