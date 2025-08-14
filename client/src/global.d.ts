export {};

declare global {
  interface Window {
    electronAPI: {
      serverAddress: string;
    };
  }
}
