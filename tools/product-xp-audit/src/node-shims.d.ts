declare module "node:fs/promises" {
  const fs: {
    mkdir(path: string, options?: { recursive?: boolean }): Promise<void>
    writeFile(path: string, data: string): Promise<void>
  }
  export default fs
}
declare module "node:path" {
  const path: { join(...parts: string[]): string }
  export default path
}
declare const process: { argv: string[]; env: Record<string, string | undefined>; exit(code?: number): never }
