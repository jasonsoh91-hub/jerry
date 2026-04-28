import { NextRequest, NextResponse } from 'next/server';
import { listCachedProducts, getCacheStats, getCachedProduct, searchCachedProduct } from '@/lib/productCache';

/**
 * Browse cached products API
 * GET /api/browse-cache - List all cached products organized by category/brand
 * GET /api/browse-cache?model=U2424H - Search for specific product
 */

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const model = searchParams.get('model');

    // If model parameter provided, search for specific product
    if (model) {
      console.log('🔍 Searching cache for model:', model);

      const product = searchCachedProduct(model);

      if (product) {
        return NextResponse.json({
          success: true,
          found: true,
          product: product
        });
      } else {
        return NextResponse.json({
          success: true,
          found: false,
          message: `Product with model "${model}" not found in cache`
        });
      }
    }

    // Otherwise, list all cached products
    console.log('📋 Browsing all cached products');

    const { categories } = listCachedProducts();
    const stats = getCacheStats();

    // Format the response for better readability
    const formattedCategories: any = {};

    for (const [categoryName, categoryData] of Object.entries(categories)) {
      formattedCategories[categoryName] = {
        brands: {},
        totalProducts: 0
      };

      for (const [brandName, models] of Object.entries(categoryData.brands)) {
        formattedCategories[categoryName].brands[brandName] = {
          models: models,
          count: models.length
        };
        formattedCategories[categoryName].totalProducts += models.length;
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalFiles: stats.totalFiles,
        totalSize: `${(stats.totalSize / 1024).toFixed(2)} KB`,
        totalSizeBytes: stats.totalSize
      },
      categories: formattedCategories,
      summary: {
        totalCategories: Object.keys(categories).length,
        totalBrands: Object.values(categories).reduce((sum, cat) => sum + Object.keys(cat.brands).length, 0),
        totalProducts: stats.totalFiles
      }
    });

  } catch (error) {
    console.error('❌ Error browsing cache:', error);

    return NextResponse.json(
      {
        error: 'Failed to browse cache',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/browse-cache - Clear all cached products
 */
export async function DELETE(request: NextRequest) {
  try {
    const fs = await import('fs');
    const path = await import('path');

    const cacheDir = path.join(process.cwd(), 'product-cache');

    if (fs.existsSync(cacheDir)) {
      // Delete all files and subdirectories
      function deleteFolderRecursive(dirPath: string) {
        if (fs.existsSync(dirPath)) {
          const files = fs.readdirSync(dirPath);
          files.forEach((file: string) => {
            const filePath = path.join(dirPath, file);
            if (fs.statSync(filePath).isDirectory()) {
              deleteFolderRecursive(filePath);
            } else {
              fs.unlinkSync(filePath);
            }
          });
          fs.rmdirSync(dirPath);
        }
      }

      deleteFolderRecursive(cacheDir);

      return NextResponse.json({
        success: true,
        message: 'Cache cleared successfully'
      });
    } else {
      return NextResponse.json({
        success: true,
        message: 'Cache directory does not exist'
      });
    }

  } catch (error) {
    console.error('❌ Error clearing cache:', error);

    return NextResponse.json(
      {
        error: 'Failed to clear cache',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
