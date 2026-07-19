declare const __GEMIHUB_DESKTOP__: boolean;

interface DesktopWorkspaceFiles {
  inventory(): Promise<Array<{ path: string; binary: boolean }>>;
  read(path: string): Promise<string>;
  create(path: string, content: string | ArrayBuffer): Promise<void>;
  update(path: string, content: string | ArrayBuffer): Promise<void>;
}

interface DesktopPluginAPI {
  workspaceFiles?: DesktopWorkspaceFiles;
  selectFile?(path: string): void;
  [key: string]: unknown;
}

function mimeType(name: string): string {
  const extension = name.split(".").pop()?.toLowerCase();
  return ({ beancount: "text/plain", bean: "text/plain", ledger: "text/plain", csv: "text/csv" } as Record<string, string>)[extension ?? ""] ?? "text/plain";
}

/** Apply only the compatibility surface selected by the host-specific build. */
export function adaptPluginAPI<T>(input: T): T {
  if (!__GEMIHUB_DESKTOP__) return input;
  const api = input as T & DesktopPluginAPI;
  const files = api.workspaceFiles;
  if (!files) throw new Error("Accounting requires GemiHub Desktop 0.8.1 or newer.");
  const selectFile = api.selectFile?.bind(api);
  return Object.assign(api, {
    drive: {
      async readFile(path: string) { return files.read(path); },
      async listFiles(folder?: string) {
        const prefix = folder?.replace(/^\/+|\/+$/g, "");
        return (await files.inventory())
          .filter((file) => !prefix || file.path.startsWith(`${prefix}/`))
          .map((file) => ({ id: file.path, name: file.path, mimeType: mimeType(file.path) }));
      },
      async createFile(name: string, content: string | ArrayBuffer) {
        await files.create(name, content);
        return { id: name, name };
      },
      async updateFile(path: string, content: string | ArrayBuffer) { await files.update(path, content); },
    async rebuildTree() { /* local Workspace tree updates immediately */ },
    },
    selectFile(path: string) { selectFile?.(path); },
  });
}

export const accountingMainViewLocation: "sidebar" | "main" = __GEMIHUB_DESKTOP__ ? "sidebar" : "main";
