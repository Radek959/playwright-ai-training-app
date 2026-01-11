/**
 * Utility function for handling test IDs with VITE_REFACTOR_SELECTORS flag
 * When flag is true, adds "refactored-" prefix to simulate selector changes
 */
export const getTestId = (baseId: string): string => {
  const refactorSelectors = import.meta.env.VITE_REFACTOR_SELECTORS === 'true';
  return refactorSelectors ? `refactored-${baseId}` : baseId;
};

/**
 * Utility function for handling element IDs with VITE_REFACTOR_SELECTORS flag
 * When flag is true, adds "new_" prefix to simulate ID changes
 */
export const getElementId = (baseId: string): string => {
  const refactorSelectors = import.meta.env.VITE_REFACTOR_SELECTORS === 'true';
  return refactorSelectors ? `new_${baseId}` : baseId;
};
