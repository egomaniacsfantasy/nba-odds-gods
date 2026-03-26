/// <reference types="vite/client" />

interface IdleDeadline {
  didTimeout: boolean;
  timeRemaining: () => number;
}

type IdleRequestCallback = (deadline: IdleDeadline) => void;

interface Window {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: {
      timeout?: number;
    },
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
}
