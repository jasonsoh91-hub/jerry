/**
 * Product Pattern Recognition System
 * Analyzes product names and models to infer specifications when AI extraction fails
 * Supports multiple product categories and can be extended for new categories
 */

export interface ProductSpecs {
  model: string;
  briefName: string;
  size: string;
  resolution: string;
  refreshRate: string;
  responseTime: string;
  ports: string;
  warranty: string;
}

/**
 * Detect product category from product name
 */
export function detectProductCategory(productName: string): string {
  const name = productName.toLowerCase();

  // Monitors
  if (name.includes('monitor') || name.includes('display') || /[\d]{2,3}[\s-]*inch/i.test(name)) {
    return 'monitor';
  }

  // Tablets - check before phones since 'Galaxy Tab' contains 'Galaxy'
  if (name.includes('tablet') || name.includes('ipad') || name.includes('galaxy tab') || name.includes('surface')) {
    return 'tablet';
  }

  // Phones
  if (name.includes('iphone') || name.includes('samsung galaxy') && !name.includes('galaxy tab') || name.includes('pixel') || name.includes('oneplus') || name.includes('phone') || name.includes('smartphone')) {
    return 'phone';
  }

  // Laptops
  if (name.includes('laptop') || name.includes('notebook') || name.includes('thinkpad') || name.includes('macbook') || name.includes('xps') || /[\w]{2,4}[\s-]*\d{2,4}[\w]*$/i.test(productName)) {
    return 'laptop';
  }

  // Keyboards
  if (name.includes('keyboard')) {
    return 'keyboard';
  }

  // Mice
  if (name.includes('mouse') || name.includes('mice')) {
    return 'mouse';
  }

  return 'unknown';
}

/**
 * Infer monitor specifications from model number
 */
export function inferMonitorSpecs(productName: string, model: string): Partial<ProductSpecs> {
  const modelUpper = (model || '').toUpperCase();
  const nameUpper = productName.toUpperCase();

  const specs: Partial<ProductSpecs> = {
    warranty: '1-3 Years' // Most monitors have 1-3 year warranty
  };

  // Extract actual diagonal screen size from model number or use known real measurements
  // Dell monitors often have actual diagonal slightly different from rounded model names

  // Known actual screen measurements for common Dell models
  const knownRealSizes: { [key: string]: string } = {
    'E2020H': '19.5 Inch',      // Marketed as 20", actual 19.5"
    'E2220H': '21.5 Inch',      // Marketed as 22", actual 21.5"
    'E2222H': '21.5 Inch',      // Marketed as 22", actual 21.5"
    'SE2425HM': '23.5 Inch',    // Marketed as 24", actual 23.5"
    'SE2425H': '23.5 Inch',     // Marketed as 24", actual 23.5"
    'U2425HM': '23.8 Inch',     // UltraSharp often 23.8"
    'U2424H': '23.8 Inch',      // UltraSharp 24" is actually 23.8"
    'U2425H': '23.8 Inch',      // Marketed as 24", actual 23.8"
    'U2725H': '27.0 Inch',      // Usually exactly 27.0"
    'P2422H': '23.8 Inch',      // Professional series often 23.8"
    'P2722H': '27.0 Inch',      // Professional 27" is exactly 27.0"
  };

  // Check if we have the exact model's real size
  for (const [exactModel, realSize] of Object.entries(knownRealSizes)) {
    if (modelUpper === exactModel || modelUpper.includes(exactModel)) {
      specs.size = realSize;
      console.log('✅ Found actual size for known model:', exactModel, '->', realSize);
      break;
    }
  }

  // If not found in database, try to extract from model number and apply typical corrections
  if (!specs.size) {
    const allNumbers = modelUpper.match(/\d{2}/g) || [];
    for (const num of allNumbers) {
      const sizeNum = parseInt(num);
      if (sizeNum >= 19 && sizeNum <= 49) {
        // Apply typical corrections for Dell model series
        if (modelUpper.includes('E') && sizeNum === 20) {
          specs.size = '19.5 Inch';  // E20" series are actually 19.5"
        } else if (modelUpper.includes('E') && sizeNum === 22) {
          specs.size = '21.5 Inch';  // E22" series are actually 21.5"
        } else if (modelUpper.includes('SE') && sizeNum === 24) {
          specs.size = '23.5 Inch';  // SE24" series are actually 23.5"
        } else if (modelUpper.includes('U') && sizeNum === 24) {
          specs.size = '23.8 Inch';  // U24" series are usually 23.8"
        } else if (modelUpper.includes('U') && sizeNum === 27) {
          specs.size = '27.0 Inch';  // U27" series are usually exactly 27.0"
        } else if (modelUpper.includes('P') && sizeNum === 24) {
          specs.size = '23.8 Inch';  // P24" series are usually 23.8"
        } else if (modelUpper.includes('P') && sizeNum === 27) {
          specs.size = '27.0 Inch';  // P27" series are usually exactly 27.0"
        } else {
          specs.size = `${sizeNum}.0 Inch`;  // Default: assume exact measurement
        }
        break;
      }
    }
  }

  // Dell Monitor Patterns
  if (nameUpper.includes('DELL')) {
    // IMPORTANT: Check series in order of specificity to avoid false positives
    // P2722HE contains both 'P' and 'E' - must check P-series BEFORE E-series

    if (modelUpper.includes('SE')) {
      // SE Series: High refresh rate 100Hz
      specs.refreshRate = '100Hz';
      specs.resolution = '1920 x 1080 FHD';
      specs.responseTime = '5ms';
      specs.ports = 'HDMI port and VGA port';
      specs.warranty = '3 Years';
      console.log('✅ Detected SE series monitor:', model, '-> 100Hz');
    } else if (modelUpper.includes('P24') || modelUpper.includes('P27')) {
      // P Series: Professional monitors - check BEFORE E-series
      // This handles P2722HE correctly (it's P-series, not E-series)
      specs.refreshRate = '60Hz';
      specs.resolution = '1920 x 1080 FHD';
      specs.responseTime = '5ms';
      specs.ports = 'DisplayPort, HDMI, USB-C, USB 3.2, RJ-45';
      specs.warranty = '3 Years';
      console.log('✅ Detected P series monitor:', model, '-> 60Hz');
    } else if (modelUpper.includes('U24') || modelUpper.includes('U27')) {
      // U Series: UltraSharp
      specs.refreshRate = '120Hz';
      specs.resolution = modelUpper.includes('U27') ? '2560 x 1440 QHD' : '1920 x 1080 FHD';
      specs.responseTime = '5ms';
      specs.ports = 'DisplayPort, HDMI, USB-C';
      specs.warranty = '3 Years';
      console.log('✅ Detected U series monitor:', model, '-> 120Hz');
    } else if (modelUpper.includes('S') && (modelUpper.includes('G') || modelUpper.includes('HG'))) {
      // S/HG Gaming series: High refresh rate
      specs.refreshRate = '165Hz';
      specs.responseTime = '1ms';
      specs.ports = 'DisplayPort, HDMI';
      specs.warranty = '3 Years';
      console.log('✅ Detected Gaming series monitor:', model, '-> 165Hz');
    } else if (modelUpper.includes('G24') || modelUpper.includes('G27')) {
      // G Series Gaming: High refresh rate
      specs.refreshRate = '165Hz';
      specs.resolution = modelUpper.includes('G27') ? '2560 x 1440 QHD' : '1920 x 1080 FHD';
      specs.responseTime = '1ms';
      specs.ports = 'DisplayPort, HDMI';
      specs.warranty = '3 Years';
      console.log('✅ Detected G series gaming monitor:', model, '-> 165Hz');
    } else if (modelUpper.includes('E')) {
      // E Series: Check AFTER P-series to avoid false positives
      // Only pure E-series models (not P-series or SE-series)
      if (modelUpper.includes('E2225HM') || modelUpper.includes('E2320HM') || modelUpper.includes('E2425HM')) {
        specs.refreshRate = '100Hz';
        specs.resolution = '1920 x 1080 FHD';
        specs.responseTime = '5ms';
        specs.ports = 'HDMI port and VGA port';
        specs.warranty = '3 Years';
        console.log('✅ Detected high-refresh E series monitor:', model, '-> 100Hz');
      } else {
        // Older E-series models may have lower refresh rates
        specs.refreshRate = '75Hz';  // Common for older E-series
        specs.resolution = '1920 x 1080 FHD';
        specs.responseTime = '5ms';
        specs.ports = 'HDMI port and VGA port';
        specs.warranty = '3 Years';
        console.log('✅ Detected standard E series monitor:', model, '-> 75Hz');
      }
    } else {
      // Default Dell monitor specs
      specs.refreshRate = '60Hz';
      specs.resolution = '1920 x 1080 FHD';
      specs.responseTime = '5ms';
      specs.ports = 'HDMI port and VGA port';
      console.log('⚠️ Using default Dell monitor specs for:', model);
    }
  }

  // Samsung Monitor Patterns
  if (nameUpper.includes('SAMSUNG')) {
    if (modelUpper.includes('U28') || modelUpper.includes('U32') || modelUpper.includes('U34')) {
      specs.refreshRate = '60Hz';
      specs.resolution = '3840 x 2160 4K';
      specs.responseTime = '4ms';
      specs.ports = 'DisplayPort, HDMI, USB-C';
    } else if (modelUpper.includes('G5') || modelUpper.includes('G7') || modelUpper.includes('G9')) {
      specs.refreshRate = '144Hz';
      specs.responseTime = '1ms';
      specs.ports = 'DisplayPort, HDMI';
    }
  }

  // LG Monitor Patterns
  if (nameUpper.includes('LG')) {
    if (modelUpper.includes('ULTRAGEAR') || modelUpper.includes('LG-')) {
      specs.refreshRate = '144Hz';
      specs.responseTime = '1ms';
      specs.ports = 'DisplayPort, HDMI';
    } else if (modelUpper.includes('UHD') || modelUpper.includes('4K')) {
      specs.refreshRate = '60Hz';
      specs.resolution = '3840 x 2160 4K';
      specs.ports = 'DisplayPort, HDMI';
    }
  }

  // ASUS Monitor Patterns
  if (nameUpper.includes('ASUS')) {
    if (modelUpper.includes('VG') || modelUpper.includes('ROG')) {
      specs.refreshRate = '180Hz';
      specs.responseTime = '1ms';
      specs.ports = 'DisplayPort, HDMI';
    } else if (modelUpper.includes('PA')) {
      specs.refreshRate = '60Hz';
      specs.ports = 'DisplayPort, HDMI, USB-C';
    }
  }

  // Default monitor specs if no patterns matched
  if (!specs.refreshRate) specs.refreshRate = '60Hz';
  if (!specs.resolution) specs.resolution = '1920 x 1080 FHD';
  if (!specs.responseTime) specs.responseTime = '5ms';
  if (!specs.ports) specs.ports = 'HDMI port and VGA port';

  return specs;
}

/**
 * Infer phone specifications from model name
 */
export function inferPhoneSpecs(productName: string, model: string): Partial<ProductSpecs> {
  const nameUpper = productName.toUpperCase();
  const modelUpper = (model || '').toUpperCase();

  const specs: Partial<ProductSpecs> = {
    warranty: '1-2 Years'
  };

  // iPhone Patterns
  if (nameUpper.includes('IPHONE')) {
    if (nameUpper.includes('PRO MAX')) {
      specs.size = '6.7 Inch';
      specs.resolution = '2796 x 1290';
      specs.refreshRate = '120Hz';
    } else if (nameUpper.includes('PRO')) {
      specs.size = '6.1 Inch';
      specs.resolution = '2556 x 1179';
      specs.refreshRate = '120Hz';
    } else if (nameUpper.includes('PLUS') || nameUpper.includes('14 PLUS') || nameUpper.includes('15 PLUS')) {
      specs.size = '6.7 Inch';
      specs.resolution = '2778 x 1284';
      specs.refreshRate = '60Hz';
    } else {
      specs.size = '6.1 Inch';
      specs.resolution = '2532 x 1170';
      specs.refreshRate = '60Hz';
    }
    specs.ports = 'Lightning port or USB-C';
    specs.responseTime = ''; // Not applicable for phones
  }

  // Samsung Galaxy Patterns
  if (nameUpper.includes('GALAXY') && nameUpper.includes('S24')) {
    if (nameUpper.includes('ULTRA')) {
      specs.size = '6.8 Inch';
      specs.resolution = '3120 x 1440';
      specs.refreshRate = '120Hz';
    } else if (nameUpper.includes('PLUS')) {
      specs.size = '6.7 Inch';
      specs.resolution = '3104 x 1440';
      specs.refreshRate = '120Hz';
    } else {
      specs.size = '6.2 Inch';
      specs.resolution = '2340 x 1080';
      specs.refreshRate = '120Hz';
    }
    specs.ports = 'USB-C port';
  }

  // Google Pixel Patterns
  if (nameUpper.includes('PIXEL')) {
    if (nameUpper.includes('PRO')) {
      specs.size = '6.7 Inch';
      specs.resolution = '2960 x 1440';
      specs.refreshRate = '120Hz';
    } else {
      specs.size = '6.3 Inch';
      specs.resolution = '2400 x 1080';
      specs.refreshRate = '120Hz';
    }
    specs.ports = 'USB-C port';
  }

  return specs;
}

/**
 * Infer laptop specifications from model name
 */
export function inferLaptopSpecs(productName: string, model: string): Partial<ProductSpecs> {
  const nameUpper = productName.toUpperCase();
  const modelUpper = (model || '').toUpperCase();

  const specs: Partial<ProductSpecs> = {
    warranty: '1-3 Years'
  };

  // MacBook Patterns
  if (nameUpper.includes('MACBOOK')) {
    if (nameUpper.includes('PRO') && nameUpper.includes('16')) {
      specs.size = '16 Inch';
      specs.resolution = '3456 x 2234';
    } else if (nameUpper.includes('PRO') && nameUpper.includes('14')) {
      specs.size = '14 Inch';
      specs.resolution = '3024 x 1964';
    } else if (nameUpper.includes('AIR')) {
      specs.size = '13.6 Inch';
      specs.resolution = '2560 x 1664';
    }
    specs.ports = 'USB-C ports (Thunderbolt), MagSafe charging';
    specs.refreshRate = '60Hz'; // Not applicable for laptops
    specs.responseTime = ''; // Not applicable for laptops
  }

  // ThinkPad Patterns
  if (nameUpper.includes('THINKPAD')) {
    if (nameUpper.includes('X1 CARBON')) {
      specs.size = '14 Inch';
      specs.resolution = '1920 x 1200 or 2880 x 1800';
      specs.ports = 'USB-C, USB-A, HDMI, Thunderbolt';
    } else if (nameUpper.includes('T14') || nameUpper.includes('T15')) {
      specs.size = nameUpper.includes('T15') ? '15 Inch' : '14 Inch';
      specs.resolution = '1920 x 1080 FHD';
      specs.ports = 'USB-C, USB-A, HDMI, Ethernet';
    }
    specs.refreshRate = '60Hz';
    specs.responseTime = '';
  }

  return specs;
}

/**
 * Infer tablet specifications from model name
 */
export function inferTabletSpecs(productName: string, model: string): Partial<ProductSpecs> {
  const nameUpper = productName.toUpperCase();
  const modelUpper = (model || '').toUpperCase();

  const specs: Partial<ProductSpecs> = {
    warranty: '1 Year'
  };

  // iPad Patterns
  if (nameUpper.includes('IPAD')) {
    if (nameUpper.includes('PRO') && nameUpper.includes('12.9')) {
      specs.size = '12.9 Inch';
      specs.resolution = '2732 x 2048';
    } else if (nameUpper.includes('PRO') && nameUpper.includes('11')) {
      specs.size = '11 Inch';
      specs.resolution = '2388 x 1668';
    } else if (nameUpper.includes('AIR')) {
      specs.size = '10.9 Inch';
      specs.resolution = '2360 x 1640';
    } else if (nameUpper.includes('MINI')) {
      specs.size = '8.3 Inch';
      specs.resolution = '2266 x 1488';
    }
    specs.ports = 'USB-C port';
    specs.refreshRate = modelUpper.includes('PRO') ? '120Hz' : '60Hz';
    specs.responseTime = '';
  }

  // Galaxy Tab Patterns
  if (nameUpper.includes('GALAXY TAB')) {
    if (nameUpper.includes('S9') && nameUpper.includes('PLUS')) {
      specs.size = '12.4 Inch';
      specs.resolution = '2800 x 1752';
    } else if (nameUpper.includes('S9')) {
      specs.size = '11 Inch';
      specs.resolution = '2560 x 1600';
    }
    specs.ports = 'USB-C port';
    specs.refreshRate = '120Hz';
    specs.responseTime = '';
  }

  return specs;
}

/**
 * Main function to infer specs based on product category
 */
export function inferSpecsByPattern(productName: string, model: string): Partial<ProductSpecs> {
  console.log('🔮 Inferring specs using pattern recognition for:', productName, 'model:', model);

  const category = detectProductCategory(productName);
  console.log('📊 Detected product category:', category);

  switch (category) {
    case 'monitor':
      return inferMonitorSpecs(productName, model);
    case 'phone':
      return inferPhoneSpecs(productName, model);
    case 'laptop':
      return inferLaptopSpecs(productName, model);
    case 'tablet':
      return inferTabletSpecs(productName, model);
    default:
      // For unknown categories, try to extract basic info
      return {
        size: '',
        resolution: '',
        refreshRate: '',
        responseTime: '',
        ports: '',
        warranty: '1 Year'
      };
  }
}
