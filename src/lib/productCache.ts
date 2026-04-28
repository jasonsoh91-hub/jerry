import fs from 'fs';
import path from 'path';

/**
 * Product Cache System with Hierarchical Organization
 * Stores crawled product information locally to avoid repeated API calls
 * Organized by: product-cache/{category}/{brand}/{model}.json
 */

const CACHE_DIR = path.join(process.cwd(), 'product-cache');
const CACHE_EXPIRY_DAYS = 30; // Cache expires after 30 days

export interface CachedProductInfo {
  model: string;
  briefName: string;
  size: string;
  resolution: string;
  refreshRate: string;
  responseTime: string;
  ports: string;
  warranty: string;
  source?: string;
  productUrl?: string;
  cachedAt: string;
  expiresAt: string;
}

/**
 * Detect product category from product name
 */
export function detectCategory(productName: string): string {
  const name = productName.toLowerCase();

  if (name.includes('monitor') || name.includes('display') || /[\d]{2,3}[\s-]*inch/i.test(name)) {
    return 'monitor';
  }
  if (name.includes('tablet') || name.includes('ipad') || name.includes('galaxy tab') || name.includes('surface')) {
    return 'tablet';
  }
  if (name.includes('iphone') || name.includes('samsung galaxy') && !name.includes('galaxy tab') || name.includes('pixel') || name.includes('oneplus') || name.includes('phone')) {
    return 'phone';
  }
  if (name.includes('laptop') || name.includes('notebook') || name.includes('thinkpad') || name.includes('macbook') || name.includes('xps')) {
    return 'laptop';
  }
  if (name.includes('keyboard')) {
    return 'keyboard';
  }
  if (name.includes('mouse') || name.includes('mice')) {
    return 'mouse';
  }

  return 'other';
}

/**
 * Detect brand from product name
 */
export function detectBrand(productName: string): string {
  const name = productName.toLowerCase();

  const brands = {
    'dell': 'dell',
    'hp': 'hp',
    'lenovo': 'lenovo',
    'thinkpad': 'lenovo',
    'samsung': 'samsung',
    'lg': 'lg',
    'asus': 'asus',
    'acer': 'acer',
    'msi': 'msi',
    'apple': 'apple',
    'macbook': 'apple',
    'ipad': 'apple',
    'iphone': 'apple',
    'microsoft': 'microsoft',
    'surface': 'microsoft',
    'google': 'google',
    'pixel': 'google',
    'oneplus': 'oneplus',
    'razer': 'razer',
    'logitech': 'logitech',
    'corsair': 'corsair'
  };

  for (const [brandKey, brandName] of Object.entries(brands)) {
    if (name.includes(brandKey)) {
      return brandName;
    }
  }

  return 'generic';
}

/**
 * Initialize cache directory and subdirectories
 */
export function initCache() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    console.log('📁 Created product cache directory:', CACHE_DIR);
  }
}

/**
 * Generate organized cache path: product-cache/{category}/{brand}/{model}.json
 */
export function getCachePath(model: string, productName: string): string {
  const category = detectCategory(productName);
  const brand = detectBrand(productName);

  // Use model as filename if available, otherwise generate from product name
  const identifier = (model || productName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')).toLowerCase();

  // Create organized path: product-cache/monitor/dell/u2424h.json
  const organizedPath = path.join(CACHE_DIR, category, brand, `${identifier}.json`);

  // Ensure parent directories exist
  const parentDir = path.dirname(organizedPath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
    console.log('📁 Created cache subdirectory:', parentDir);
  }

  return organizedPath;
}

/**
 * Check if cached data exists and is still valid
 */
export function getCachedProduct(model: string, productName: string): CachedProductInfo | null {
  try {
    initCache();

    const cachePath = getCachePath(model, productName);

    if (!fs.existsSync(cachePath)) {
      console.log('🔍 Cache miss:', model || productName);
      return null;
    }

    // Read cached data
    const cachedData = JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as CachedProductInfo;

    // Check if cache has expired
    const now = new Date();
    const expiresAt = new Date(cachedData.expiresAt);

    if (now > expiresAt) {
      console.log('⏰ Cache expired for:', model || productName);
      fs.unlinkSync(cachePath); // Delete expired cache
      return null;
    }

    console.log('✅ Cache hit for:', model || productName, '(cached:', cachedData.cachedAt, ')');
    return cachedData;

  } catch (error) {
    console.error('❌ Error reading cache:', error);
    return null;
  }
}

/**
 * Save product info to cache
 */
export function saveToCache(
  model: string,
  productName: string,
  productInfo: any,
  source?: string,
  productUrl?: string
): void {
  try {
    initCache();

    const cachePath = getCachePath(model, productName);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const cachedData: CachedProductInfo = {
      model: productInfo.model || model,
      briefName: productInfo.briefName || productName,
      size: productInfo.size || '',
      resolution: productInfo.resolution || '',
      refreshRate: productInfo.refreshRate || '',
      responseTime: productInfo.responseTime || '',
      ports: productInfo.ports || '',
      warranty: productInfo.warranty || '',
      source: source,
      productUrl: productUrl,
      cachedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    };

    fs.writeFileSync(cachePath, JSON.stringify(cachedData, null, 2));
    console.log('💾 Saved to cache:', model || productName, '(expires:', expiresAt.toISOString() + ')');

  } catch (error) {
    console.error('❌ Error saving to cache:', error);
  }
}

/**
 * Clear all cached data
 */
export function clearCache(): void {
  try {
    if (fs.existsSync(CACHE_DIR)) {
      const files = fs.readdirSync(CACHE_DIR);
      files.forEach(file => {
        const filePath = path.join(CACHE_DIR, file);
        fs.unlinkSync(filePath);
      });
      console.log('🗑️ Cleared all cached data');
    }
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
  }
}

/**
 * Get cache statistics organized by category and brand
 */
export function getCacheStats(): {
  totalFiles: number;
  totalSize: number;
  categories: { [key: string]: { brands: { [key: string]: number } } };
} {
  try {
    initCache();

    let totalFiles = 0;
    let totalSize = 0;
    const categories: { [key: string]: { brands: { [key: string]: number } } } = {};

    // Recursively scan cache directory
    function scanDirectory(dirPath: string, relativePath: string = '') {
      const items = fs.readdirSync(dirPath);

      items.forEach(item => {
        const itemPath = path.join(dirPath, item);
        const stats = fs.statSync(itemPath);
        const relativeItemPath = path.join(relativePath, item);

        if (stats.isDirectory()) {
          scanDirectory(itemPath, relativeItemPath);
        } else if (item.endsWith('.json')) {
          totalFiles++;
          totalSize += stats.size;

          // Parse the path to extract category and brand
          const pathParts = relativeItemPath.split(path.sep);
          if (pathParts.length >= 2) {
            const category = pathParts[0];
            const brand = pathParts[1];

            if (!categories[category]) {
              categories[category] = { brands: {} };
            }
            if (!categories[category].brands[brand]) {
              categories[category].brands[brand] = 0;
            }
            categories[category].brands[brand]++;
          }
        }
      });
    }

    scanDirectory(CACHE_DIR);

    return {
      totalFiles,
      totalSize,
      categories
    };
  } catch (error) {
    console.error('❌ Error getting cache stats:', error);
    return { totalFiles: 0, totalSize: 0, categories: {} };
  }
}

/**
 * List all cached products organized by category and brand
 */
export function listCachedProducts(): {
  categories: { [key: string]: { brands: { [key: string]: string[] } } };
} {
  try {
    initCache();

    const categories: { [key: string]: { brands: { [key: string]: string[] } } } = {};

    function scanDirectory(dirPath: string, relativePath: string = '') {
      const items = fs.readdirSync(dirPath);

      items.forEach(item => {
        const itemPath = path.join(dirPath, item);
        const stats = fs.statSync(itemPath);
        const relativeItemPath = path.join(relativePath, item);

        if (stats.isDirectory()) {
          scanDirectory(itemPath, relativeItemPath);
        } else if (item.endsWith('.json')) {
          // Parse the path to extract category, brand, and model
          const pathParts = relativeItemPath.split(path.sep);
          if (pathParts.length >= 3) {
            const category = pathParts[0];
            const brand = pathParts[1];
            const model = item.replace('.json', '');

            if (!categories[category]) {
              categories[category] = { brands: {} };
            }
            if (!categories[category].brands[brand]) {
              categories[category].brands[brand] = [];
            }
            categories[category].brands[brand].push(model);
          }
        }
      });
    }

    scanDirectory(CACHE_DIR);

    return { categories };
  } catch (error) {
    console.error('❌ Error listing cached products:', error);
    return { categories: {} };
  }
}

/**
 * Search for cached product by model number (searches all categories/brands)
 */
export function searchCachedProduct(model: string): CachedProductInfo | null {
  try {
    initCache();

    const searchModel = model.toLowerCase();

    function searchDirectory(dirPath: string): CachedProductInfo | null {
      const items = fs.readdirSync(dirPath);

      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = fs.statSync(itemPath);

        if (stats.isDirectory()) {
          const result = searchDirectory(itemPath);
          if (result) return result;
        } else if (item.endsWith('.json')) {
          const fileModel = item.replace('.json', '').toLowerCase();
          if (fileModel.includes(searchModel) || searchModel.includes(fileModel)) {
            // Check if cache is valid
            const cachedData = JSON.parse(fs.readFileSync(itemPath, 'utf-8')) as CachedProductInfo;
            const now = new Date();
            const expiresAt = new Date(cachedData.expiresAt);

            if (now <= expiresAt) {
              console.log('✅ Found product in cache by model search:', model);
              return cachedData;
            } else {
              // Delete expired cache
              fs.unlinkSync(itemPath);
            }
          }
        }
      }

      return null;
    }

    return searchDirectory(CACHE_DIR);
  } catch (error) {
    console.error('❌ Error searching cache:', error);
    return null;
  }
}
