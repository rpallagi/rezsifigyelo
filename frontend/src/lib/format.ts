/** Hungarian number formatting utilities */

export const formatHuf = (value: number): string => {
  return Math.round(value).toLocaleString('hu-HU') + ' Ft';
};

export const formatNumber = (value: number, decimals = 0): string => {
  return value.toLocaleString('hu-HU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('hu-HU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const formatDateShort = (date: string): string => {
  return new Date(date).toLocaleDateString('hu-HU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

export const utilityLabel = (type: string, locale?: 'hu' | 'en'): string => {
  const labels: Record<string, Record<string, string>> = {
    hu: {
      villany: 'Villany',
      viz: 'Viz',
      csatorna: 'Csatorna',
    },
    en: {
      villany: 'Electricity',
      viz: 'Water',
      csatorna: 'Sewage',
    },
  };
  const lang = locale || 'hu';
  return labels[lang]?.[type] || labels['hu']?.[type] || type;
};

export const utilityUnit = (type: string): string => {
  return type === 'villany' ? 'kWh' : 'm³';
};
