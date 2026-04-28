#!/usr/bin/env python3
"""
Scrape Dell U2424H monitor specifications
"""

import asyncio
import pandas as pd
import json
from playwright.async_api import async_playwright

async def scrape_u2424h():
    """Scrape U2424H specifications"""

    url = "https://www.dell.com/en-us/shop/dell-ultrasharp-24-usb-c-hub-monitor-u2424he/apd/210-bkry/monitors-monitor-accessories"

    print(f"🔍 Scraping: {url}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        await page.set_viewport_size({"width": 1920, "height": 1080})

        await page.goto(url, timeout=60000)
        await asyncio.sleep(3)

        # Dismiss cookies
        try:
            cookie_btn = page.locator("#onetrust-accept-btn-handler")
            if await cookie_btn.is_visible():
                await cookie_btn.click()
                await asyncio.sleep(1)
        except:
            pass

        page_source = await page.content()

        specs = {
            'Model': 'U2424H',
            'Full Product Name': 'Dell UltraSharp 24 USB-C Hub Monitor - U2424H',
            'Brand': 'DELL',
            'Brief Naming': 'Dell UltraSharp Series LED Monitor',
            'Size': '24"',
            'Resolution': '',
            'Response Time': '',
            'Refresh Rate': '',
            'Compatible Ports': '',
            'Warranty': '3 Years'
        }

        # Extract Resolution
        import re

        # Try to find resolution from title or content
        title_patterns = [
            r'1920\s*[x×]\s*1080',
            r'FHD|Full HD'
        ]

        title_upper = page_source.upper()
        if 'FHD' in title_upper or 'FULL HD' in title_upper:
            specs['Resolution'] = '1920 x 1080 FHD'

        # Check for WUXGA
        if 'WUXGA' in title_upper:
            specs['Resolution'] = '1920 x 1200 WUXGA'

        # Extract from page content
        res_match = re.search(r'(\d{3,4})\s*[x×]\s*(\d{3,4})', page_source)
        if res_match and not specs['Resolution']:
            width = int(res_match.group(1))
            height = int(res_match.group(2))
            if width >= 1000 and height >= 500:
                format_map = {
                    (1920, 1080): 'FHD',
                    (1920, 1200): 'WUXGA',
                    (2560, 1440): 'QHD',
                    (3840, 2160): '4K UHD'
                }
                format_label = format_map.get((width, height), '')
                specs['Resolution'] = f"{width} x {height} {format_label}" if format_label else f"{width} x {height}"

        # Response Time
        resp_patterns = [
            r'Response\s+Time[^0-9\n]*(\d+(?:\.\d+)?)\s*ms',
            r'(\d+(?:\.\d+)?)\s*ms\s*\(Normal\)',
        ]

        for pattern in resp_patterns:
            match = re.search(pattern, page_source, re.IGNORECASE)
            if match:
                rt = float(match.group(1))
                if 0.1 <= rt <= 20:
                    specs['Response Time'] = f"{rt}ms"
                    break

        # Refresh Rate
        refresh_match = re.search(r'(\d+)\s*Hz', page_source, re.IGNORECASE)
        if refresh_match:
            hz = int(refresh_match.group(1))
            if 60 <= hz <= 240:
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

        print("✅ Scraped specs:")
        for key, value in specs.items():
            print(f"   {key}: {value}")

        await browser.close()

        return specs

if __name__ == "__main__":
    specs = asyncio.run(scrape_u2424h())

    # Load existing database
    try:
        with open('/Users/jasonsoh/Documents/Jerry/public/dell_monitors.json', 'r') as f:
            data = json.load(f)

        # Add U2424H
        data.append(specs)

        # Save updated database
        with open('/Users/jasonsoh/Documents/Jerry/public/dell_monitors.json', 'w') as f:
            json.dump(data, f, indent=2)

        print(f"\n✅ Added U2424H to database")
        print(f"📊 Total products in database: {len(data)}")

    except Exception as e:
        print(f"❌ Error updating database: {e}")
