// src/app/services/api.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

/** --- Raw type from backend (nulls possible) --- */
export interface DocRaw {
    id?: string;                 // yeni (preferred)
    file_hash?: string | null;   // legacy alias
    filename?: string | null;
    uploadedAt?: string | null;  // camelCase (preferred)
    uploaded_at?: string | null; // legacy
    date?: string | null;        // very legacy
    tags?: string[] | null;      // preferred
    keywords?: string | null;    // legacy CSV (deprecated)
    summary?: string | null;
    category?: string | null;
}

/** --- Normalized type used across UI --- */
export interface DocInfo {
    id: string;
    filename: string;
    uploadedAt: string;          // ISO-8601 UTC
    tags: string[];
    summary?: string;
    category?: string;
}

export interface Paged<T> { items: T[]; total: number; }

/** Build HttpParams from a plain object */
function toParams(obj: Record<string, any> = {}): HttpParams {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(obj)) {
        if (v === undefined || v === null || v === '') continue;
        if (Array.isArray(v)) v.forEach(x => p = p.append(k, String(x)));
        else p = p.set(k, String(v));
    }
    return p;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
    /** Base URL: window.__APP_API_BASE__ (varsa) yoksa '/api/v1' */
    private BASE = this.resolveBase();

    constructor(private http: HttpClient) { }

    // ---------- URL Helpers ----------
    uploadUrl(): string { return `${this.BASE}/files`; }
    downloadUrl(id: string): string {
        return `${this.BASE}/files/${encodeURIComponent(id)}/download?disposition=attachment`;
    }
    inlineUrl(id: string): string {
        return `${this.BASE}/files/${encodeURIComponent(id)}/download?disposition=inline`;
    }
    previewUrl(id: string): string { return this.inlineUrl(id); }

    // ---------- Health ----------
    health(): Observable<{ ok: boolean; env?: string }> {
        return this.http.get<{ ok: boolean; env?: string }>(`${this.BASE}/health`);
    }

    // ---------- Simple list (legacy, BE’de deprecate olabilir) ----------
    listFiles(q?: string, limit: number = 100): Observable<DocInfo[]> {
        const params = toParams({ q, limit });
        return this.http.get<any>(`${this.BASE}/files`, { params }).pipe(
            map(res => this.normalizeList(res)),
            catchError(_ => of([]))
        );
    }

    // ---------- Paged list ----------
    listDocuments(params: {
        q?: string; category?: string; tags?: string[];
        dateFrom?: string; dateTo?: string; hasTags?: boolean;
        sort?: 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' | 'cat_asc';
        offset?: number; limit?: number;
    }): Observable<Paged<DocInfo>> {
        const httpParams = toParams(params as any);
        return this.http.get<any>(`${this.BASE}/documents`, { params: httpParams }).pipe(
            map(res => ({
                items: this.normalizeList(res?.items),
                total: res?.total ?? 0
            })),
            catchError(_ => of({ items: [], total: 0 }))
        );
    }

    // ---------- Document detail ----------
    getDocument(id: string): Observable<DocInfo> {
        const h = encodeURIComponent(id);
        return this.http.get<any>(`${this.BASE}/documents/${h}`).pipe(
            map(res => this.normalizeDoc(res)),
            catchError(_ => of(this.emptyDoc(id)))
        );
    }
    getDoc(id: string) { return this.getDocument(id); }

    // ---------- Upload (POST /files with field name "file") ----------
    upload(file: File) {
        const fd = new FormData();
        fd.append('file', file, file.name);
        return this.http.post<DocRaw>(`${this.BASE}/files`, fd)
            .pipe(map(res => this.normalizeDoc(res)));
    }

    // ---------- Single PATCH endpoint for metadata ----------
    patchDocument(
        id: string,
        patch: { category?: string | null; summary?: string | null; tags?: string[] | null }
    ) {
        return this.http
            .patch<DocRaw>(`${this.BASE}/documents/${encodeURIComponent(id)}`, patch)
            .pipe(map(res => this.normalize(res)));
    }

    // Küçük kısayollar (hepsi PATCH kullanır)
    setTags(id: string, tags: string[]) { return this.patchDocument(id, { tags }); }
    setCategory(id: string, category: string | null) { return this.patchDocument(id, { category }); }
    setSummary(id: string, summary: string | null) { return this.patchDocument(id, { summary }); }

    // ---------- Re-analyze document ----------
    reanalyze(id: string) {
        return this.http.post(`${this.BASE}/documents/${encodeURIComponent(id)}/reanalyze`, {});
    }

    // ---------- Suggestions (BE uçları) ----------
    suggestCategories(prefix: string = '', limit: number = 100): Observable<string[]> {
        const params = toParams({ prefix, limit });
        return this.http.get<string[]>(`${this.BASE}/documents/suggest/categories`, { params })
            .pipe(catchError(_ => of([])));
    }

    suggestKeywords(prefix: string = '', limit: number = 50): Observable<string[]> {
        const params = toParams({ prefix, limit });
        return this.http.get<string[]>(`${this.BASE}/documents/suggest/tags`, { params })
            .pipe(catchError(_ => of([])));
    }

    // ---------- Utils ----------
    private resolveBase(): string {
        const runtime = (window as any)['__APP_API_BASE__'];
        if (runtime) return String(runtime).replace(/\/+$/, '');
        return '/api/v1';
    }
    private splitTags(s?: string | null): string[] {
        return (s || '').split(',').map(x => x.trim()).filter(Boolean);
    }

    /** Keep both names to avoid “normalizeDoc vs normalize” mismatch */
    private normalizeDoc(res: any): DocInfo { return this.normalize(res); }

    private normalize(res: any): DocInfo {
        if (!res || typeof res !== 'object')
            return { id: '', filename: '', uploadedAt: '', tags: [] };

        const id = String(res.id ?? res.file_hash ?? '');
        const uploadedAt = String(res.uploadedAt ?? res.uploaded_at ?? res.date ?? '');
        const tags: string[] = Array.isArray(res.tags)
            ? res.tags.filter((t: any) => !!String(t).trim()).map((t: any) => String(t))
            : this.splitTags(res.keywords);

        return {
            id,
            filename: String(res.filename ?? ''),
            uploadedAt,
            category: res.category ?? undefined,
            tags,
            summary: res.summary ?? undefined,
        };
    }

    private normalizeList(res: any): DocInfo[] {
        const arr = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
        return (arr as any[]).map(r => this.normalize(r));
    }

    private emptyDoc(id: string): DocInfo {
        return { id: id || '', filename: '', uploadedAt: '', tags: [], category: undefined, summary: undefined };
    }
}
