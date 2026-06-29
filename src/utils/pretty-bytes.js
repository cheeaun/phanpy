import { i18n } from '@lingui/core';

import NF from './nf';

// https://tc39.es/ecma402/#table-sanctioned-single-unit-identifiers
const BYTES_UNITS = [
  'byte',
  'kilobyte',
  'megabyte',
  'gigabyte',
  'terabyte',
  'petabyte',
];
export default function prettyBytes(bytes) {
  const unitIndex = Math.min(
    Math.floor(Math.log2(bytes) / 10),
    BYTES_UNITS.length - 1,
  );
  const value = bytes / 1024 ** unitIndex;
  return NF(i18n.locale, {
    style: 'unit',
    unit: BYTES_UNITS[unitIndex],
    unitDisplay: 'narrow',
    maximumFractionDigits: 0,
  }).format(value);
}
