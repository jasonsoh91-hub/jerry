#!/usr/bin/env python3
"""
Fix resolution formats to follow: WIDTH x HEIGHT FORMAT
Examples:
- FHD (1080p) → 1920 x 1080 FHD
- QHD (1440p/2K) → 2560 x 1440 QHD
- 3840 x 2160 4K UHD → 3840 x 2160 4K UHD (already correct)
"""

import pandas as pd
import re

# Read the CSV
df = pd.read_csv('dell_monitors_transformed.csv')

print("Original resolution formats:")
print(df['Resolution'].value_counts())
print()

# Resolution mapping: tier/label → full resolution format
resolution_map = {
    'FHD (1080p)': '1920 x 1080 FHD',
    'QHD (1440p/2K)': '2560 x 1440 QHD',
    '5K/6K/8K': '5120 x 2880 5K',
    'Touchscreen': 'N/A',
    'QHD (1440p/2K)': '2560 x 1440 QHD',
}

def fix_resolution(resolution):
    """Fix resolution format to WIDTH x HEIGHT FORMAT"""
    if pd.isna(resolution) or resolution == '':
        return ''

    # If already in correct format (contains " x "), keep as is
    if ' x ' in str(resolution):
        return resolution

    # Otherwise, map from tier to full format
    res_str = str(resolution).strip()
    if res_str in resolution_map:
        return resolution_map[res_str]

    # If it's just a tier name, try to map it
    if 'FHD' in res_str:
        return '1920 x 1080 FHD'
    elif 'QHD' in res_str and 'UW' not in res_str:
        return '2560 x 1440 QHD'
    elif 'UWQHD' in res_str:
        return '3440 x 1440 UWQHD'
    elif '4K UHD' in res_str:
        return '3840 x 2160 4K UHD'
    elif 'WUXGA' in res_str:
        return '1920 x 1200 WUXGA'

    return resolution

# Apply the fix
df['Resolution'] = df['Resolution'].apply(fix_resolution)

print("Fixed resolution formats:")
print(df['Resolution'].value_counts())
print()

# Show some examples
print("Sample of fixed resolutions:")
print("=" * 80)
for idx in range(min(15, len(df))):
    row = df.iloc[idx]
    print(f"{row['Model']:15} | {row['Resolution']:30} | {row['Brief Naming']}")
print()

# Save to both CSV and Excel
df.to_csv('dell_monitors_transformed.csv', index=False)
print("✅ Updated CSV: dell_monitors_transformed.csv")

df.to_excel('dell_monitors_transformed.xlsx', index=False, engine='openpyxl')
print("✅ Updated Excel: dell_monitors_transformed.xlsx")

print()
print("Summary:")
print(f"Total products: {len(df)}")
print(f"Resolutions fixed: {len(df[df['Resolution'] != ''])}")
print(f"Empty resolutions: {len(df[df['Resolution'] == ''])}")
