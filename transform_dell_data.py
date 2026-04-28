#!/usr/bin/env python3
"""
Transform Dell Monitors Data
- Add Full Product Name column
- Extract Model from after "-"
- Remove Product Class column
- Update Brief Naming with series name
- Update Size from model number
"""

import pandas as pd
import re

# Read the existing CSV
df = pd.read_csv('dell_all_74_monitors.csv')

print(f"Original data shape: {df.shape}")
print(f"Original columns: {df.columns.tolist()}")
print()

# Step 1: Create "Full Product Name" column (copy from Brief Naming)
df.insert(0, 'Full Product Name', df['Brief Naming'])

# Step 2: Extract Model from product name (everything after "-")
def extract_model_from_name(product_name):
    """Extract model from product name - everything after '-'"""
    if pd.isna(product_name):
        return None

    # Pattern: extract after the last "-" (allow 1-5 letters, 2-5 digits, 0-2 letters)
    # Examples: P1425, P2424HT, SE2726D, AW3225QF, U3226Q
    match = re.search(r'-\s*([A-Z]{1,5}\d{2,5}[A-Z]{0,2})', product_name)
    if match:
        return match.group(1)

    # Fallback: check if it already looks like a model (anywhere in name)
    model_match = re.search(r'([A-Z]{1,5}\d{2,5}[A-Z]{0,2})', product_name)
    if model_match:
        return model_match.group(1)

    return None

# Apply model extraction - only where Model is N/A or missing
def extract_or_keep_model(row):
    """Extract model from name if current model is N/A or missing"""
    current_model = row['Model']
    product_name = row['Full Product Name']

    # If we already have a valid model (not N/A), keep it
    if pd.notna(current_model) and current_model != 'N/A' and current_model != '':
        return current_model

    # Otherwise, try to extract from product name
    return extract_model_from_name(product_name)

df['Model'] = df.apply(extract_or_keep_model, axis=1)

# Step 3: Define product series mapping
def get_series_name(model):
    """Get series name based on model prefix"""
    if pd.isna(model) or model == 'N/A' or model == '':
        return 'DELL LED Monitor'

    model_upper = model.upper()

    # Check AW first (2 chars), then SE (2 chars), then single chars
    if model_upper.startswith('AW'):
        return 'Dell Alienware Series LED Monitor'
    elif model_upper.startswith('SE'):
        return 'DELL SE Series LED Monitor'
    elif model_upper.startswith('P'):
        return 'DELL Pro Series LED Monitor'
    elif model_upper.startswith('U'):
        return 'Dell UltraSharp Series LED Monitor'
    elif model_upper.startswith('C'):
        return 'Dell C Series LED Monitor'
    elif model_upper.startswith('E'):
        return 'DELL E Series LED Monitor'
    elif model_upper.startswith('G'):
        return 'Dell Gaming Series LED Monitor'
    elif model_upper.startswith('S'):
        return 'DELL S Series LED Monitor'
    else:
        return 'DELL LED Monitor'

# Update Brief Naming with series name
df['Brief Naming'] = df['Model'].apply(get_series_name)

# Step 4: Extract size from model number (first digits)
def extract_size_from_model(model):
    """Extract screen size from model number (first digits)"""
    if pd.isna(model):
        return None

    # Extract first digits from model (e.g., P1425 -> 14, P2425 -> 24)
    match = re.search(r'[A-Z]*?(\d{2})', model)
    if match:
        size = match.group(1)
        # Remove leading zero and format
        return f"{int(size)}\""

    return None

# Apply size extraction - always prefer model-based extraction
df['Size'] = df['Model'].apply(lambda x: extract_size_from_model(x) if extract_size_from_model(x) else 'N/A')

# Step 5: Remove Product Class column
if 'Product Class' in df.columns:
    df = df.drop('Product Class', axis=1)

# Reorder columns
new_column_order = [
    'Full Product Name', 'Model', 'Brand', 'Brief Naming', 'Size',
    'Resolution', 'Response Time', 'Refresh Rate',
    'Compatible Ports', 'Warranty'
]

# Only keep columns that exist
df = df[[col for col in new_column_order if col in df.columns]]

# Show some examples
print("Transformed data sample:")
print("=" * 100)
for idx in range(min(10, len(df))):
    row = df.iloc[idx]
    model = str(row['Model']) if pd.notna(row['Model']) else 'N/A'
    name = str(row['Full Product Name'])[:60] if pd.notna(row['Full Product Name']) else 'N/A'
    brief = str(row['Brief Naming'])[:35] if pd.notna(row['Brief Naming']) else 'N/A'
    size = str(row['Size']) if pd.notna(row['Size']) else 'N/A'
    print(f"{model:15} | {name:60} | {brief:35} | {size}")

print()
print("=" * 100)
print("Column order:", df.columns.tolist())
print()

# Statistics
print(f"Total products: {len(df)}")
print(f"Models extracted: {df['Model'].notna().sum()}/{len(df)}")
print(f"Sizes extracted: {df[df['Size'] != 'N/A']['Size'].notna().sum()}/{len(df)}")
print()

# Show breakdown by series
print("Breakdown by Series:")
print(df['Brief Naming'].value_counts())
print()

# Save to new Excel file
output_file = 'dell_monitors_transformed.xlsx'
df.to_excel(output_file, index=False, engine='openpyxl')
print(f"✅ Saved to: {output_file}")

# Also save to CSV
csv_file = 'dell_monitors_transformed.csv'
df.to_csv(csv_file, index=False)
print(f"✅ Saved to: {csv_file}")
