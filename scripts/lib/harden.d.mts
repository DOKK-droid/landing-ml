export const ALGORITHM: 'sha256';
export function sri(data: Uint8Array | string): string;
export function localPath(url: string | null | undefined): string | null;
export function inlineScripts(html: string): string[];
export function decodeEntities(text: string): string;
export interface InlineStyles { elements: string[]; attributes: string[] }
export function inlineStyles(html: string): InlineStyles;
export function buildCsp(scriptBodies: string[], options?: { connect?: string[]; styles?: InlineStyles }): string;
export function hardenHtml(html: string, readAsset: (path: string) => Uint8Array | null, options?: { connect?: string[] }): string;
export function parseCsp(csp: string): Record<string, string[]>;
export function checkHtml(html: string, readAsset: (path: string) => Uint8Array | null | Promise<Uint8Array | null>): Promise<string[]>;
export function checkHeaders(headers: Record<string, string>): string[];
export interface Manifest { version: number; files: Record<string, { integrity: string; bytes: number }>; [meta: string]: unknown }
export function buildManifest(files: Map<string, Uint8Array>, meta?: Record<string, unknown>): Manifest;
export function compareWithManifest(
  manifest: Manifest,
  actual: Map<string, Uint8Array>,
  options?: { complete?: boolean },
): { changed: string[]; extra: string[]; missing: string[]; ok: boolean };
export function buildIdOf(html: string): string | null;
