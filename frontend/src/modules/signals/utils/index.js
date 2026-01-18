// Utility functions for signals module
// These utilities provide common functionality across signals components

// Export utility functions
export { default as signalsHelpers } from './signalsHelpers';
export { default as signalsValidators } from './signalsValidators';
export { default as signalsFormatters } from './signalsFormatters';

// Export individual functions for convenience
export {
  formatSignalDate,
  getSignalTimeAgo,
  getPlatformInfo,
  getPlatformLabel,
  getPlatformIcon,
  isValidSignal,
  filterSignalsByPlatform,
  filterSignalsByDateRange,
  sortSignalsByDate,
  groupSignalsByPlatform,
  calculateEngagementScore,
  truncateSignalContent,
  extractHashtags,
  extractMentions,
  isRecentSignal,
  getSignalUrl,
} from './signalsHelpers';

export {
  isValidEmail,
  isValidUrl,
  validateSignalTitle,
  validateSignalContent,
  validatePlatform,
  validateDateRange,
  validateKeywords,
  validateSignalsFilter,
  validateEmailDigestSettings,
  validateSignalAction,
  validateSignal,
} from './signalsValidators';

export {
  formatNumber,
  formatEngagementMetrics,
  formatSignalTitle,
  formatSignalContent,
  formatPlatformName,
  formatDisplayUrl,
  formatHashtags,
  formatMentions,
  formatAuthorName,
  formatSignalStatus,
  formatFileSize,
  formatDuration,
} from './signalsFormatters';