export interface IElectronAPI {
  fetchFilters: () => Promise<{ [key: string]: unknown }>;
  OnEvent: CB | null;
  start: (
    type: Type,
    location: string,
    range: { start: number; end: number },
    link?: string
  ) => void;
  showFilePathError: () => Promise<unknown>;
  openFilePicker: () => Promise<unknown>;
}

declare global {
  interface Window {
    MyApi: IElectronAPI;
  }
}

type LogLevel = "info" | "error" | "warn" | "table";
export type CB = (
  Type:
    | "progress"
    | "count"
    | "complete"
    | "error"
    | "details"
    | "warn"
    | "data",
  message: number | boolean | string | null | object | Array<unknown>
) => void;
