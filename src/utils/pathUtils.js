/**
 * Utility functions for handling asset paths
 */

/**
 * Resolve asset path with alias support
 * @param {string} path - The path to resolve
 * @returns {string} - Resolved path
 */
export const resolveAssetPath = (path) => {
  if (!path) return '';
  
  // Handle alias paths
  if (path.startsWith('@/public/')) {
    return path.replace('@/public/', '/');
  }
  
  if (path.startsWith('@/')) {
    return path.replace('@/', '/');
  }
  
  // Handle relative paths
  if (path.startsWith('../')) {
    // Convert relative paths to absolute
    return path.replace(/^\.\.\//, '/');
  }
  
  // Return as-is for absolute paths and URLs
  return path;
};

/**
 * Check if a path is a valid URL
 * @param {string} path - The path to check
 * @returns {boolean} - True if it's a valid URL
 */
export const isValidUrl = (path) => {
  try {
    new URL(path);
    return true;
  } catch {
    return false;
  }
};

/**
 * Get example paths for different types
 */
export const getExamplePaths = () => ({
  local: '/images/background/banner.jpeg',
  alias: '@/public/images/background/banner.jpeg',
  relative: '../../public/images/background/banner.jpeg',
  external: 'https://example.com/image.jpg'
});
