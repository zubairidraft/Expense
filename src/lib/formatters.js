export const CURRENCY_REGISTRY = {
  USD: { symbol: '$', name: 'US Dollar', minorUnits: 2 },
  PKR: { symbol: 'Rs', name: 'Pakistani Rupee', minorUnits: 2 },
  AED: { symbol: 'AED', name: 'UAE Dirham', minorUnits: 2 },
  EUR: { symbol: '€', name: 'Euro', minorUnits: 2 },
  GBP: { symbol: '£', name: 'British Pound', minorUnits: 2 },
  SAR: { symbol: 'SR', name: 'Saudi Riyal', minorUnits: 2 },
  INR: { symbol: '₹', name: 'Indian Rupee', minorUnits: 2 },
  JPY: { symbol: '¥', name: 'Japanese Yen', minorUnits: 0 },
  KWD: { symbol: 'KD', name: 'Kuwaiti Dinar', minorUnits: 3 },
  BHD: { symbol: 'BD', name: 'Bahraini Dinar', minorUnits: 3 },
  OMR: { symbol: 'RO', name: 'Omani Rial', minorUnits: 3 },
};

/**
 * Format a number according to international or South Asian (Lakh/Crore) system
 * @param {number|string} amount
 * @param {string} currencyCode
 * @param {'intl'|'lakh'} numberFormat
 * @returns {string} Formatted money string
 */
export function formatMoney(amount, currencyCode = 'USD', numberFormat = 'intl') {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '0';

  const currency = CURRENCY_REGISTRY[currencyCode] || { symbol: currencyCode, minorUnits: 2 };
  const decimals = currency.minorUnits;
  const isNegative = num < 0;
  const absNum = Math.abs(num);

  let formattedNumber = '';

  if (numberFormat === 'lakh') {
    // South Asian numbering system: 12,50,000.00
    const parts = absNum.toFixed(decimals).split('.');
    let integerPart = parts[0];
    const decimalPart = parts[1];

    if (integerPart.length > 3) {
      const lastThree = integerPart.substring(integerPart.length - 3);
      const remaining = integerPart.substring(0, integerPart.length - 3);
      formattedNumber = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
    } else {
      formattedNumber = integerPart;
    }

    if (decimals > 0 && decimalPart !== undefined) {
      formattedNumber += '.' + decimalPart;
    }
  } else {
    // International numbering system: 1,250,000.00
    formattedNumber = absNum.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  const prefix = isNegative ? '-' : '';
  return `${prefix}${currency.symbol} ${formattedNumber}`;
}
