#!/usr/bin/env python3
"""
Debug Dell page structure
"""

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager
import time
import re

# Setup
options = Options()
options.add_argument('--window-size=1920,1080')
service = Service(ChromeDriverManager().install())
driver = webdriver.Chrome(service=service, options=options)

# Try different URLs
urls = [
    "https://www.dell.com/en-my/shop/computer-monitors/",
    "https://www.dell.com/en-my/shop/monitors-monitor-accessories/sac/monitors/all-monitors",
]

for url in urls:
    print(f"\n{'='*70}")
    print(f"Trying: {url}")
    print(f"{'='*70}")

    driver.get(url)
    time.sleep(5)

    # Dismiss cookies
    try:
        cookie_btn = driver.find_element(By.CSS_SELECTOR, "#onetrust-accept-btn-handler")
        driver.execute_script("arguments[0].click();", cookie_btn)
        time.sleep(2)
        print("✅ Cookies dismissed")
    except:
        print("ℹ️  No cookies")

    page_source = driver.page_source

    # Check for products
    # Method 1: data-product-detail
    matches1 = re.findall(r'data-product-detail="(\{[^"]+\})"', page_source)
    print(f"data-product-detail: {len(matches1)} matches")

    # Method 2: article elements
    articles = driver.find_elements(By.CSS_SELECTOR, "article[data-product-id]")
    print(f"article elements: {len(articles)} found")

    # Method 3: Look for any product-related elements
    print("\nLooking for product-related CSS classes:")
    all_elements = driver.find_elements(By.CSS_SELECTOR, "[class*='product']")
    classes = set()
    for elem in all_elements[:20]:
        class_attr = elem.get_attribute('class')
        if class_attr:
            classes.add(class_attr)

    for cls in list(classes)[:10]:
        print(f"  - {cls}")

    # Save page source for inspection
    with open(f'/tmp/dell_page_{urls.index(url)}.html', 'w') as f:
        f.write(page_source[:5000])
    print(f"\n📁 Saved page source snippet: /tmp/dell_page_{urls.index(url)}.html")

print(f"\n💡 Browser open for 30 seconds...")
time.sleep(30)

driver.quit()
print("✅ Done!")
