import "@testing-library/jest-dom/vitest";
globalThis.IntersectionObserver = class {
  observe() {}
  disconnect() {}
};
