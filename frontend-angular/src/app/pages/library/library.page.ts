// src/app/pages/library/library.page.ts
import { Component, OnInit, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';

import { ApiService, DocInfo } from '../../services/api.service';

import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { ChipModule } from 'primeng/chip';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { MultiSelectModule } from 'primeng/multiselect';
import { CalendarModule } from 'primeng/calendar';
import { SkeletonModule } from 'primeng/skeleton';
import { SidebarModule } from 'primeng/sidebar';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { PaginatorModule } from 'primeng/paginator';
import { CheckboxModule } from 'primeng/checkbox';
import { FileUploadModule } from 'primeng/fileupload';

import { MessageService, ConfirmationService } from 'primeng/api';

type DocRow = DocInfo;

@Component({
    standalone: true,
    selector: 'app-library',
    imports: [
        CommonModule, FormsModule,
        TableModule, CardModule, PaginatorModule,
        ChipModule, InputTextModule, ButtonModule,
        DropdownModule, MultiSelectModule, CalendarModule, CheckboxModule,
        FileUploadModule,
        SkeletonModule, SidebarModule, ToastModule, ConfirmDialogModule
    ],
    providers: [MessageService, ConfirmationService],
    styles: [`
    .toolbar { display:flex; gap:.75rem; align-items:flex-end; flex-wrap:wrap; }
    .meta { opacity:.75; }
    .grid-auto-fit{ display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:1rem; }
    .card-item{
      border-radius: var(--radius-md);
      border: 1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.02);
      box-shadow: var(--shadow-1);
      padding: var(--space-4);
      display:grid; gap: .5rem;
      transition: transform .08s ease, box-shadow .2s ease;
      cursor: pointer;
    }
    .card-item:hover{ transform: translateY(-2px); box-shadow: var(--shadow-2); }
    .file-title{ font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .actions{ display:flex; gap:.5rem; justify-content:flex-end; }
    .chips{ display:flex; flex-wrap:wrap; gap:.35rem; }
    .view-toggle { display:flex; gap:.25rem; }
    .selected { outline: 2px solid rgba(99,102,241,.7); outline-offset: 2px; border-radius:.6rem; }
    .filters { display:flex; flex-wrap:wrap; gap:.5rem; }
    .pill{ padding:.25rem .5rem; border-radius:999px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.02); }
    .sticky-actions{
      position: sticky; top: .5rem; z-index: 4;
      display:flex; gap:.5rem; flex-wrap:wrap; align-items:center;
      padding:.5rem; border:1px solid rgba(255,255,255,.08);
      border-radius:.6rem; background: rgba(15, 17, 28, .65); backdrop-filter: blur(8px);
    }
    .list-compact td { padding:.4rem .6rem; }
    .highlight mark{ background: rgba(56,189,248,.35); color: inherit; padding:0 .1rem; border-radius:.2rem; }
  `],
    template: `
  <p-toast></p-toast>
  <p-confirmDialog></p-confirmDialog>

  <!-- Üst Araç Çubuğu -->
  <div class="toolbar">
    <div class="p-input-icon-left">
      <i class="pi pi-search"></i>
      <input #searchBox pInputText type="text" placeholder="Ara ( / ile odak )"
             [(ngModel)]="q" (ngModelChange)="onFiltersChanged()">
    </div>

    <p-dropdown [options]="categoryOptions" [(ngModel)]="catFilter"
                placeholder="Kategori" [showClear]="true"
                (onChange)="onFiltersChanged()"></p-dropdown>

    <p-multiSelect [options]="tagOptions" [(ngModel)]="tagFilter"
                   defaultLabel="Etiketler" [filter]="true" [showClear]="true"
                   (onChange)="onFiltersChanged()"></p-multiSelect>

    <p-calendar [(ngModel)]="dateFrom" dateFormat="yy-mm-dd" placeholder="Başlangıç"
                (onSelect)="onFiltersChanged()" [showIcon]="true"></p-calendar>
    <p-calendar [(ngModel)]="dateTo" dateFormat="yy-mm-dd" placeholder="Bitiş"
                (onSelect)="onFiltersChanged()" [showIcon]="true"></p-calendar>

    <p-dropdown [options]="sortOptions" [(ngModel)]="sortBy" placeholder="Sırala"
                (onChange)="onFiltersChanged()"></p-dropdown>

    <span style="flex:1 1 auto;"></span>

    <!-- Yükleme (PrimeNG customUpload) -->
    <p-fileUpload
      #uploader
      mode="basic"
      [customUpload]="true"
      [auto]="true"
      [showUploadButton]="false"
      [showCancelButton]="false"
      [multiple]="false"
      [accept]="'.pdf,application/pdf'"
      [maxFileSize]="50_000_000"
      [chooseLabel]="'PDF Yükle'"
      (uploadHandler)="onUpload($event)">
    </p-fileUpload>

    <!-- Görünüm toggle -->
    <div class="view-toggle">
      <button pButton class="p-button-text" [outlined]="view!=='grid'" icon="pi pi-th-large" (click)="setView('grid')" aria-label="Grid"></button>
      <button pButton class="p-button-text" [outlined]="view!=='list'" icon="pi pi-bars" (click)="setView('list')" aria-label="Liste"></button>
    </div>

    <button pButton class="p-button-text" icon="pi pi-save" label="Görünümü Kaydet" (click)="saveView()"></button>
    <button pButton class="p-button-text" icon="pi pi-refresh" (click)="reload()" aria-label="Yenile"></button>
  </div>

  <!-- Aktif filtre özet pill'leri -->
  <div class="filters" *ngIf="hasActiveFilters()" style="margin-top:.5rem;">
    <span class="pill" *ngIf="q">Arama: "{{q}}" <button pButton class="p-button-text p-button-sm" icon="pi pi-times" (click)="q=''; onFiltersChanged()"></button></span>
    <span class="pill" *ngIf="catFilter">Kategori: {{catFilter}} <button pButton class="p-button-text p-button-sm" icon="pi pi-times" (click)="catFilter=undefined; onFiltersChanged()"></button></span>
    <span class="pill" *ngFor="let t of tagFilter">#{{t}} <button pButton class="p-button-text p-button-sm" icon="pi pi-times" (click)="removeTagFilter(t)"></button></span>
    <span class="pill" *ngIf="dateFrom">Başlangıç: {{dateFrom | date:'yyyy-MM-dd'}}</span>
    <span class="pill" *ngIf="dateTo">Bitiş: {{dateTo | date:'yyyy-MM-dd'}}</span>
    <button pButton class="p-button-text" label="Filtreleri temizle" (click)="clearFilters()"></button>
  </div>

  <!-- Toplu Aksiyonlar (Sticky) -->
  <div class="sticky-actions" *ngIf="selected.length">
    <span class="meta">{{selected.length}} seçildi</span>
    <button pButton icon="pi pi-refresh" label="Yeniden Analiz" class="p-button-sm"
            (click)="confirmReanalyzeSelected()"></button>
    <button pButton icon="pi pi-download" label="CSV (sayfa)" class="p-button-sm p-button-outlined"
            (click)="exportCsv()"></button>
    <button pButton icon="pi pi-times" class="p-button-text p-button-sm"
            (click)="selected=[]" aria-label="Seçimi temizle"></button>
  </div>

  <!-- Loading skeleton grid -->
  <div *ngIf="loading" class="grid-auto-fit" style="margin-top:1rem;">
    <div *ngFor="let _ of [1,2,3,4,5,6,7,8]" class="card-item">
      <p-skeleton width="60%" height="1.2rem"></p-skeleton>
      <p-skeleton width="40%" height="1rem"></p-skeleton>
      <div style="display:flex; gap:.4rem; flex-wrap:wrap;">
        <p-skeleton width="64px" height="24px" borderRadius="999px"></p-skeleton>
        <p-skeleton width="72px" height="24px" borderRadius="999px"></p-skeleton>
        <p-skeleton width="56px" height="24px" borderRadius="999px"></p-skeleton>
      </div>
      <div class="actions"><p-skeleton width="96px" height="2rem" borderRadius="8px"></p-skeleton></div>
    </div>
  </div>

  <!-- Empty -->
  <div *ngIf="!loading && !pageItems?.length" class="cardish" style="padding:24px; text-align:center; margin-top:16px;">
    <div style="font-weight:700; margin-bottom:6px;">Sonuç bulunamadı</div>
    <div class="meta">Filtreleri temizlemeyi veya farklı bir anahtar kelime denemeyi deneyin.</div>
  </div>

  <!-- GRID görünüm -->
  <div *ngIf="!loading && pageItems?.length && view==='grid'" class="grid-auto-fit" style="margin-top:1rem;">
    <div *ngFor="let d of pageItems" class="card-item" [class.selected]="isSelected(d)"
         (click)="toggleSelect(d)" (dblclick)="open(d.id)">
      <div class="file-title highlight" [innerHTML]="highlight(d.filename)"></div>
      <div class="meta">{{ d.uploadedAt }} • {{ d.category || 'Kategori yok' }}</div>
      <div class="chips" *ngIf="d.tags?.length">
        <ng-container *ngFor="let t of d.tags">
          <p-chip [label]="t"></p-chip>
        </ng-container>
      </div>
      <div class="actions">
        <button pButton icon="pi pi-eye" class="p-button-text" (click)="open(d.id); $event.stopPropagation();" aria-label="Detaya git"></button>
        <a pButton icon="pi pi-download" class="p-button-text"
           [href]="api.downloadUrl(d.id)" [attr.download]="d.filename"
           (click)="$event.stopPropagation()" aria-label="İndir"></a>
        <button pButton icon="pi pi-search" class="p-button-text" (click)="openPreview(d); $event.stopPropagation();" aria-label="Önizleme"></button>
      </div>
    </div>
  </div>

  <!-- LİSTE görünüm -->
  <p-table *ngIf="!loading && pageItems?.length && view==='list'"
           class="list-compact p-mt-3"
           [value]="pageItems"
           [paginator]="false"
           [responsiveLayout]="'scroll'">
    <ng-template pTemplate="header">
      <tr>
        <th style="width:1%"><p-checkbox [(ngModel)]="allChecked" [binary]="true" (onChange)="toggleSelectAll()"></p-checkbox></th>
        <th>Dosya</th>
        <th>Yüklenme</th>
        <th>Kategori</th>
        <th>Etiketler</th>
        <th style="width:1%"></th>
      </tr>
    </ng-template>
    <ng-template pTemplate="body" let-d>
      <tr [class.selected]="isSelected(d)">
        <td><p-checkbox [ngModel]="isSelected(d)" [binary]="true" (onChange)="toggleSelect(d)"></p-checkbox></td>
        <td class="highlight" [innerHTML]="highlight(d.filename)"></td>
        <td>{{ d.uploadedAt }}</td>
        <td>{{ d.category }}</td>
        <td>
          <ng-container *ngFor="let t of d.tags">
            <p-chip [label]="t" class="p-mr-2 p-mb-2"></p-chip>
          </ng-container>
        </td>
        <td class="p-text-right">
          <button pButton icon="pi pi-eye" class="p-button-text" (click)="open(d.id)" aria-label="Detaya git"></button>
          <a pButton icon="pi pi-download" class="p-button-text"
             [href]="api.downloadUrl(d.id)" [attr.download]="d.filename" aria-label="İndir"></a>
          <button pButton icon="pi pi-search" class="p-button-text" (click)="openPreview(d)" aria-label="Önizleme"></button>
        </td>
      </tr>
    </ng-template>
  </p-table>

  <!-- Sayfalama (grid & list için ortak) -->
  <p-paginator *ngIf="!loading && total>rows"
               styleClass="p-mt-3"
               [rows]="rows" [totalRecords]="total" [first]="first"
               (onPageChange)="onPage($event)"></p-paginator>

  <!-- Önizleme yan paneli -->
  <p-sidebar [(visible)]="previewOpen" position="right" [baseZIndex]="10000" [style]="{width:'560px'}">
    <h3 style="margin-top:0;">Önizleme</h3>
    <div *ngIf="!previewDoc" class="meta">Seçili belge yok.</div>
    <div *ngIf="previewDoc">
      <div style="font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" [title]="previewDoc.filename">
        {{previewDoc.filename}}
      </div>
      <div class="meta">{{previewDoc.uploadedAt}} • {{previewDoc.category || '—'}}</div>
      <div class="chips" style="margin:.5rem 0;" *ngIf="previewDoc.tags?.length">
        <ng-container *ngFor="let t of previewDoc.tags">
          <p-chip [label]="t"></p-chip>
        </ng-container>
      </div>
      <div class="p-mb-2" style="display:flex; gap:.5rem;">
        <button pButton label="Aç" icon="pi pi-eye" class="p-button-sm" (click)="open(previewDoc.id)"></button>
        <a pButton label="İndir" icon="pi pi-download" class="p-button-sm p-button-outlined"
           [href]="api.downloadUrl(previewDoc.id)" [attr.download]="previewDoc.filename"></a>
      </div>
      <div style="height:60vh" class="cardish">
        <iframe *ngIf="previewSafeUrl" [src]="previewSafeUrl" style="width:100%;height:100%;border:0;border-radius:.6rem;"></iframe>
      </div>
    </div>
  </p-sidebar>
  `
})
export class LibraryPage implements OnInit {
    @ViewChild('searchBox') searchBox!: ElementRef<HTMLInputElement>;
    @ViewChild('uploader') uploader?: any;

    // ---- Filtre durumları
    q = '';
    catFilter?: string;
    tagFilter: string[] = [];
    dateFrom?: Date | null;
    dateTo?: Date | null;
    sortBy: 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' | 'cat_asc' = 'date_desc';

    // ---- Facet seçenekleri
    categoryOptions: { label: string; value: string }[] = [];
    tagOptions: { label: string; value: string }[] = [];

    // ---- Görünüm & sayfalama
    view: 'grid' | 'list' = (localStorage.getItem('libViewMode') as any) || 'grid';
    rows = 12;
    first = 0;
    total = 0;
    pageItems: DocRow[] = [];

    // ---- Seçim
    selected: DocRow[] = [];
    allChecked = false;

    // ---- Durum
    loading = false;

    // ---- Önizleme
    previewOpen = false;
    previewDoc?: DocRow;
    previewSafeUrl?: SafeResourceUrl;

    // Sıralama seçenekleri (UI)
    sortOptions = [
        { label: 'Tarih (Yeni → Eski)', value: 'date_desc' },
        { label: 'Tarih (Eski → Yeni)', value: 'date_asc' },
        { label: 'Ad (A → Z)', value: 'name_asc' },
        { label: 'Ad (Z → A)', value: 'name_desc' },
        { label: 'Kategori', value: 'cat_asc' },
    ];

    constructor(
        public api: ApiService,
        private router: Router,
        private route: ActivatedRoute,
        private san: DomSanitizer,
        private toast: MessageService,
        private confirm: ConfirmationService
    ) { }

    ngOnInit() {
        // URL query → filtreler
        this.route.queryParamMap.subscribe(qp => {
            const q = qp.get('q'); const cat = qp.get('cat'); const tags = qp.get('tags'); const sort = qp.get('sort');
            if (q !== null) this.q = q;
            if (cat !== null) this.catFilter = cat || undefined;
            if (tags !== null) this.tagFilter = tags ? tags.split(',') : [];
            if (sort !== null) this.sortBy = (sort as any) || 'date_desc';
            this.first = Number(qp.get('offset') || 0);
            this.rows = Number(qp.get('limit') || 12);
            this.fetchPage();
        });

        // Facet’ler (fallback)
        this.api.listFiles(undefined, 1000).subscribe(rows => {
            const cats = new Set<string>(), tags = new Set<string>();
            for (const d of rows || []) {
                if (d.category) cats.add(d.category);
                (d.tags || []).map(x => x.trim()).filter(Boolean).forEach(t => tags.add(t));
            }
            this.categoryOptions = Array.from(cats).sort().map(v => ({ label: v, value: v }));
            this.tagOptions = Array.from(tags).sort().map(v => ({ label: v, value: v }));
        });
    }

    // ---- Sayfalı veri çekme
    fetchPage() {
        this.loading = true;
        const params = {
            q: this.q || undefined,
            category: this.catFilter || undefined,
            tags: this.tagFilter?.length ? this.tagFilter : undefined,
            dateFrom: this.dateFrom ? this.formatDate(this.dateFrom) : undefined,
            dateTo: this.dateTo ? this.formatDate(this.dateTo) : undefined,
            sort: this.sortBy,
            offset: this.first,
            limit: this.rows
        };
        this.api.listDocuments(params).subscribe({
            next: (res) => { this.pageItems = res.items || []; this.total = res.total || 0; this.loading = false; },
            error: _ => { this.pageItems = []; this.total = 0; this.loading = false; }
        });
    }

    // ---- Upload (customUpload) ----
    onUpload(ev: any) {
        const file = ev?.files?.[0];
        if (!file) return;

        this.api.upload(file).subscribe({
            next: (doc) => {
                this.toast.add({ severity: 'success', summary: 'Yüklendi', detail: doc?.filename || 'Dosya', life: 2000 });
                this.uploader?.clear?.();
                this.reload();
            },
            error: (err) => {
                console.error('Upload error', err);
                this.toast.add({ severity: 'error', summary: 'Yükleme başarısız', detail: 'Sunucuya ulaşılamadı', life: 2500 });
                this.uploader?.clear?.();
            }
        });
    }

    // ---- UI event’leri
    onFiltersChanged() { this.first = 0; this.syncQuery(); this.fetchPage(); }
    onPage(e: any) { this.first = e.first; this.rows = e.rows; this.syncQuery(); this.fetchPage(); }
    setView(v: 'grid' | 'list') { this.view = v; localStorage.setItem('libViewMode', v); }

    saveView() {
        const payload = { rows: this.rows, sortBy: this.sortBy, view: this.view };
        localStorage.setItem('libSavedView', JSON.stringify(payload));
        this.toast.add({ severity: 'success', summary: 'Kaydedildi', detail: 'Görünüm tercihlerin saklandı.', life: 1800 });
    }
    reload() { this.fetchPage(); }

    syncQuery() {
        const qp: any = {
            q: this.q || null,
            cat: this.catFilter || null,
            tags: this.tagFilter.length ? this.tagFilter.join(',') : null,
            sort: this.sortBy || null,
            offset: this.first || null,
            limit: this.rows || null
        };
        this.router.navigate([], { relativeTo: this.route, queryParams: qp, queryParamsHandling: 'merge' });
    }

    clearFilters() {
        this.q = ''; this.catFilter = undefined; this.tagFilter = []; this.dateFrom = this.dateTo = null;
        this.onFiltersChanged();
    }
    removeTagFilter(tag: string) { this.tagFilter = this.tagFilter.filter(t => t !== tag); this.onFiltersChanged(); }

    // ---- Seçim
    isSelected(d: DocRow) { return this.selected.some(x => x.id === d.id); }
    toggleSelect(d: DocRow) {
        const i = this.selected.findIndex(x => x.id === d.id);
        if (i >= 0) this.selected.splice(i, 1);
        else this.selected.push(d);
        this.allChecked = this.pageItems.length > 0 && this.pageItems.every(x => this.isSelected(x));
    }
    toggleSelectAll() {
        if (this.allChecked) { this.selected = this.selected.filter(s => !this.pageItems.some(x => x.id === s.id)); this.allChecked = false; }
        else { this.pageItems.forEach(d => { if (!this.isSelected(d)) this.selected.push(d); }); this.allChecked = true; }
    }

    // ---- Önizleme
    openPreview(d: DocRow) {
        this.previewDoc = d;
        this.previewOpen = true;
        this.previewSafeUrl = this.san.bypassSecurityTrustResourceUrl(this.api.inlineUrl(d.id));
    }

    // ---- Aksiyonlar
    open(id: string) { this.router.navigate(['/documents', id]); }

    confirmReanalyzeSelected() {
        if (!this.selected.length) return;
        this.confirm.confirm({
            message: `${this.selected.length} belgeyi yeniden analiz etmek istiyor musunuz?`,
            header: 'Yeniden Analiz',
            icon: 'pi pi-exclamation-triangle',
            accept: () => this.reanalyzeSelected()
        });
    }

    reanalyzeSelected() {
        let ok = 0, fail = 0;
        const seq = (i: number) => {
            if (i >= this.selected.length) {
                this.toast.add({ severity: 'success', summary: 'Bitti', detail: `Başarılı: ${ok}, Hatalı: ${fail}`, life: 2500 });
                this.reload();            // <-- EKLE
                this.selected = [];       // tercihen seçimi temizle
                this.allChecked = false;  // tercihen checkbox reset
                return;
            }
            const h = this.selected[i].id;
            this.api.reanalyze(h).subscribe({
                next: () => { ok++; seq(i + 1); },
                error: () => { fail++; seq(i + 1); }
            });
        };
        seq(0);
    }

    exportCsv() {
        const rows = this.pageItems.map(d => ({
            id: d.id,
            filename: d.filename,
            uploadedAt: d.uploadedAt,
            category: d.category || '',
            tags: (d.tags || []).join('; ')
        }));
        const header = Object.keys(rows[0] || { id: '', filename: '', uploadedAt: '', category: '', tags: '' }).join(',');
        const body = rows.map(r => [r.id, this.csvCell(r.filename), r.uploadedAt, this.csvCell(r.category), this.csvCell(r.tags)].join(',')).join('\n');
        const csv = header + '\n' + body;
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'library_page_export.csv';
        a.click();
        URL.revokeObjectURL(a.href);
    }
    private csvCell(s: string) { if (s == null) return ''; const needQuote = /[",\n]/.test(s); return needQuote ? `"${s.replace(/"/g, '""')}"` : s; }

    // ---- Kısayollar
    @HostListener('document:keydown.slash', ['$event'])
    onSlash(ev: KeyboardEvent) { ev.preventDefault(); this.searchBox?.nativeElement?.focus(); }

    @HostListener('document:keydown.escape', ['$event'])
    onEsc(_ev: KeyboardEvent) { if (this.previewOpen) this.previewOpen = false; else this.selected = []; }

    @HostListener('document:keydown.enter', ['$event'])
    onEnter(ev: KeyboardEvent) {
        if (this.selected.length === 1) { ev.preventDefault(); this.open(this.selected[0].id); }
        else if (!this.previewOpen && this.pageItems.length) { ev.preventDefault(); this.openPreview(this.pageItems[0]); }
    }

    // ---- Yardımcılar
    highlight(text?: string): SafeHtml {
        const t = text || '';
        if (!this.q) return t as any;
        const esc = this.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`(${esc})`, 'ig');
        const html = t.replace(re, '<mark>$1</mark>');
        return this.san.bypassSecurityTrustHtml(html);
    }
    hasActiveFilters() { return !!(this.q || this.catFilter || this.tagFilter.length || this.dateFrom || this.dateTo); }
    formatDate(d: Date) { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); return `${y}-${m}-${day}`; }
}
