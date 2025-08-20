// ==========================================================
// src/app/pages/library/library.page.ts (Animated version)
// ==========================================================
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
import { TooltipModule } from 'primeng/tooltip';
import { MessageService, ConfirmationService, PrimeNGConfig } from 'primeng/api';
import { fadeIn, fadeInUp, scaleIn, listStagger } from '../../animations';

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
        SkeletonModule, SidebarModule, ToastModule, ConfirmDialogModule,
        TooltipModule
    ],
    providers: [MessageService, ConfirmationService],
    animations: [fadeIn, fadeInUp, scaleIn, listStagger],
    styles: [`
    /* ---------- Design tokens ---------- */
    :host{
      --brand-h: 256; --brand-s: 86%; --brand-l: 64%;
      --brand: hsl(var(--brand-h) var(--brand-s) var(--brand-l));
      --accent: hsl(198 86% 62%);
      --surface-0:#0b0f14; --surface-1:#10161f; --surface-2:#121a25;
      --border: rgba(255,255,255,.08);
      --muted: #a3b0c2;
      --radius: 12px;
      --elev-1: 0 1px 2px rgba(0,0,0,.18), 0 10px 26px rgba(0,0,0,.22);
      --elev-2: 0 2px 8px rgba(0,0,0,.24), 0 20px 36px rgba(0,0,0,.24);
    }

    /* ---------- Background with gradient noise ---------- */
    .library-bg{
      background:
        radial-gradient(1200px 600px at 10% -10%, rgba(130,103,255,.08), transparent 60%),
        radial-gradient(900px 520px at 110% 10%, rgba(47,159,255,.07), transparent 50%),
        var(--surface-0);
      position:relative; display:block; min-height:100%;
    }
    .library-bg::before{
      content:''; position:fixed; inset:-20vh; pointer-events:none; z-index:-1;
      background-image: url("data:image/svg+xml;utf8,\
      <svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'>\
      <filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.6' numOctaves='2' stitchTiles='stitch'/></filter>\
      <rect width='120' height='120' filter='url(%23n)' opacity='0.012'/>\
      </svg>");
      background-size: 240px 240px;
    }

    /* ---------- Toolbar (glass) ---------- */
    .toolbar { 
      display:flex; gap:.75rem; align-items:flex-end; flex-wrap:wrap; 
      padding:.65rem; border:1px solid var(--border); border-radius:.9rem;
      background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
      box-shadow: 0 6px 18px rgba(0,0,0,.2), 0 12px 32px rgba(0,0,0,.18);
      backdrop-filter: blur(8px);
      position: sticky; top: .5rem; z-index: 5;
    }
    .toolbar .p-inputtext{ min-width: 260px; }
    .view-toggle { display:flex; gap:.25rem; }
    .meta { opacity:.75; }

    /* Quick stats */
    .quick-stats{ display:flex; gap:.35rem; align-items:center; flex-wrap:wrap; margin-top:.5rem; }
    .pill{ padding:.25rem .55rem; border-radius:999px; border:1px solid var(--border); background:rgba(255,255,255,.03); }

    /* ---------- Cards & grid ---------- */
    .grid-auto-fit{ display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:1rem; }
    .cardish{
      background: linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02));
      border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--elev-1);
      transition: box-shadow .2s ease, transform .08s ease, border-color .2s ease;
      animation: pop .18s ease;
    }
    .card-item{
      border-radius: var(--radius);
      border: 1px solid var(--border);
      background: rgba(255,255,255,.02);
      box-shadow: var(--elev-1);
      padding: .9rem;
      display:grid; gap: .5rem;
      transition: transform .08s ease, box-shadow .2s ease;
      cursor: pointer;
    }
    .card-item:hover{ transform: translateY(-2px); box-shadow: var(--elev-2); }
    .file-title{ font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .actions{ display:flex; gap:.5rem; justify-content:flex-end; }
    .chips{ display:flex; flex-wrap:wrap; gap:.35rem; }

    /* Selected state */
    .selected { outline: 2px solid color-mix(in hsl, var(--brand), white 10%); outline-offset: 2px; border-radius:.6rem; }
    tr.selected{ background: rgba(124,77,255,.08); }

    /* Filters & sticky actions */
    .filters { display:flex; flex-wrap:wrap; gap:.5rem; }
    .sticky-actions{
      position: sticky; top: calc(.5rem + 64px); z-index: 4;
      display:flex; gap:.5rem; flex-wrap:wrap; align-items:center;
      padding:.5rem; border:1px solid var(--border);
      border-radius:.6rem; background: rgba(15, 17, 28, .65); backdrop-filter: blur(8px);
      box-shadow: var(--elev-1);
    }

    /* Table tweaks */
    .list-compact td { padding:.5rem .65rem; }
    :host ::ng-deep .p-table thead th{ position:sticky; top:0; background:var(--surface-1); z-index:1; }

    /* Highlight */
    .highlight mark{ background: rgba(56,189,248,.35); color: inherit; padding:0 .1rem; border-radius:.2rem; }

    /* Scrollbars */
    *::-webkit-scrollbar{ width:10px; height:10px;}
    *::-webkit-scrollbar-thumb{
      background: linear-gradient(180deg, rgba(255,255,255,.18), rgba(255,255,255,.08));
      border: 2px solid transparent; border-radius: 999px; background-clip: padding-box;
    }
    *::-webkit-scrollbar-track{ background: transparent;}

    /* Button pulse (save view) */
    @keyframes greenPulse { from{ box-shadow:0 0 0 0 rgba(16,185,129,.35);} to{ box-shadow:0 0 0 14px rgba(16,185,129,0);} }
    .p-button.pulse{ animation: greenPulse .8s ease-out 1; }

    /* Micro animation */
    @keyframes pop { from{ transform: scale(.98); opacity:.8 } to{ transform: scale(1); opacity:1 } }

    /* Density toggle */
    :host ::ng-deep body.compact .card-item{ padding:.6rem !important; }
    :host ::ng-deep body.compact .p-inputtext, :host ::ng-deep body.compact .p-dropdown, :host ::ng-deep body.compact .p-multiselect{
      font-size: 13px; line-height:1.15;
    }

    @media (prefers-reduced-motion: reduce){
      *{ animation: none !important; transition: none !important; }
    }
  `],
    template: `
  <div class="library-bg" [@fadeIn]>
    <p-toast></p-toast>
    <p-confirmDialog></p-confirmDialog>

    <!-- Üst Araç Çubuğu -->
    <div class="toolbar" [@fadeIn]>
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
        <button pButton class="p-button-text" [outlined]="view!=='grid'" icon="pi pi-th-large" (click)="setView('grid')" aria-label="Grid" pTooltip="Grid"></button>
        <button pButton class="p-button-text" [outlined]="view!=='list'" icon="pi pi-bars" (click)="setView('list')" aria-label="Liste" pTooltip="Liste"></button>
      </div>

      <button pButton class="p-button-text" icon="pi pi-compress" [outlined]="!dense" label="{{dense ? 'Rahat' : 'Sıkışık'}}" (click)="toggleDensity()" pTooltip="Yoğunluk"></button>

      <button pButton class="p-button-text" icon="pi pi-save" label="Görünümü Kaydet" (click)="saveView()" [ngClass]="{'pulse': savedPulse}"></button>
      <button pButton class="p-button-text" icon="pi pi-refresh" (click)="reload()" aria-label="Yenile" pTooltip="Yenile"></button>
    </div>

    <!-- Quick stats -->
    <div class="quick-stats" *ngIf="total>=0" [@fadeInUp]>
      <span class="pill"><i class="pi pi-database"></i> {{ total }} sonuç</span>
      <span class="pill" *ngIf="total>0"><i class="pi pi-list"></i> {{ first + 1 }}–{{ Math.min(first + rows, total) }}</span>
      <span class="pill" *ngIf="hasActiveFilters()"><i class="pi pi-filter"></i> Filtre etkin</span>
    </div>

    <!-- Aktif filtre özet pill'leri -->
    <div class="filters" *ngIf="hasActiveFilters()" style="margin-top:.5rem;" [@fadeIn]>
      <span class="pill" *ngIf="q">Arama: "{{q}}" <button pButton class="p-button-text p-button-sm" icon="pi pi-times" (click)="q=''; onFiltersChanged()"></button></span>
      <span class="pill" *ngIf="catFilter">Kategori: {{catFilter}} <button pButton class="p-button-text p-button-sm" icon="pi pi-times" (click)="catFilter=undefined; onFiltersChanged()"></button></span>
      <span class="pill" *ngFor="let t of tagFilter">#{{t}} <button pButton class="p-button-text p-button-sm" icon="pi pi-times" (click)="removeTagFilter(t)"></button></span>
      <span class="pill" *ngIf="dateFrom">Başlangıç: {{dateFrom | date:'yyyy-MM-dd'}}</span>
      <span class="pill" *ngIf="dateTo">Bitiş: {{dateTo | date:'yyyy-MM-dd'}}</span>
      <button pButton class="p-button-text" label="Filtreleri temizle" (click)="clearFilters()"></button>
    </div>

    <!-- Toplu Aksiyonlar (Sticky) -->
    <div class="sticky-actions" *ngIf="selected.length" [@fadeInUp]>
      <span class="meta">{{selected.length}} seçildi</span>
      <button pButton icon="pi pi-refresh" label="Yeniden Analiz" class="p-button-sm"
              (click)="confirmReanalyzeSelected()"></button>
      <button pButton icon="pi pi-download" label="CSV (sayfa)" class="p-button-sm p-button-outlined"
              (click)="exportCsv()"></button>
      <button pButton icon="pi pi-times" class="p-button-text p-button-sm"
              (click)="selected=[]" aria-label="Seçimi temizle"></button>
    </div>

    <!-- Loading skeleton grid -->
    <div *ngIf="loading" class="grid-auto-fit" style="margin-top:1rem;" [@listStagger]="8">
      <div *ngFor="let _ of [1,2,3,4,5,6,7,8]" class="card-item" [@scaleIn]>
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
    <div *ngIf="!loading && !pageItems?.length" class="cardish" style="padding:24px; text-align:center; margin-top:16px;" [@fadeIn]>
      <div style="font-weight:700; margin-bottom:6px;">Sonuç bulunamadı</div>
      <div class="meta">Filtreleri temizlemeyi veya farklı bir anahtar kelime denemeyi deneyin.</div>
    </div>

    <!-- GRID görünüm -->
    <div *ngIf="!loading && pageItems?.length && view==='grid'" class="grid-auto-fit" style="margin-top:1rem;" [@listStagger]="pageItems?.length">
      <div *ngFor="let d of pageItems" class="card-item" [class.selected]="isSelected(d)"
           (click)="toggleSelect(d)" (dblclick)="open(d.id)" pTooltip="Çift tık: Aç" [@scaleIn]>
        <div class="file-title highlight" [innerHTML]="highlight(d.filename)"></div>
        <div class="meta">{{ d.uploadedAt }} • {{ d.category || 'Kategori yok' }}</div>
        <div class="chips" *ngIf="d.tags?.length">
          <ng-container *ngFor="let t of d.tags">
            <p-chip [label]="t"></p-chip>
          </ng-container>
        </div>
        <div class="actions">
          <button pButton icon="pi pi-eye" class="p-button-text" (click)="open(d.id); $event.stopPropagation();" aria-label="Detaya git" pTooltip="Detaya git"></button>
          <a pButton icon="pi pi-download" class="p-button-text"
             [href]="api.downloadUrl(d.id)" [attr.download]="d.filename"
             (click)="$event.stopPropagation()" aria-label="İndir" pTooltip="İndir"></a>
          <button pButton icon="pi pi-search" class="p-button-text" (click)="openPreview(d); $event.stopPropagation();" aria-label="Önizleme" pTooltip="Önizleme"></button>
        </div>
      </div>
    </div>

    <!-- LİSTE görünüm -->
    <div *ngIf="!loading && pageItems?.length && view==='list'" [@fadeInUp]>
      <p-table 
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
          <tr [class.selected]="isSelected(d)" [@fadeInUp]>
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
              <button pButton icon="pi pi-eye" class="p-button-text" (click)="open(d.id)" aria-label="Detaya git" pTooltip="Detaya git"></button>
              <a pButton icon="pi pi-download" class="p-button-text"
                 [href]="api.downloadUrl(d.id)" [attr.download]="d.filename" aria-label="İndir" pTooltip="İndir"></a>
              <button pButton icon="pi pi-search" class="p-button-text" (click)="openPreview(d)" aria-label="Önizleme" pTooltip="Önizleme"></button>
            </td>
          </tr>
        </ng-template>
      </p-table>
    </div>

    <!-- Sayfalama (grid & list için ortak) -->
    <div [@fadeIn] *ngIf="!loading && total>rows">
      <p-paginator 
                 styleClass="p-mt-3"
                 [rows]="rows" [totalRecords]="total" [first]="first"
                 (onPageChange)="onPage($event)"></p-paginator>
    </div>

    <!-- Önizleme yan paneli -->
    <p-sidebar
      [(visible)]="previewOpen"
      position="right"
      [baseZIndex]="10000"
      [style]="{width:'560px'}"
      (onHide)="onPreviewHide()"
    >
      <h3 style="margin-top:0;" [@fadeIn]>Önizleme</h3>

      <div *ngIf="!previewDoc" class="meta" [@fadeIn]>Seçili belge yok.</div>

      <div *ngIf="previewDoc" [@fadeInUp]>
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

        <div class="p-mb-2 meta">Hızlı önizleme için düşük çözünürlüklü PDF gömülür.</div>

        <div style="height:60vh" class="cardish" [@fadeIn]>
          <!-- DOM'u yeniden kurmak için guard -->
          <ng-container *ngIf="previewIframeReady && previewSafeUrl; else previewLoading">
            <iframe
              [src]="previewSafeUrl"
              style="width:100%;height:100%;border:0;border-radius:.6rem;"
              referrerpolicy="no-referrer"
            ></iframe>
          </ng-container>
          <ng-template #previewLoading>
            <div class="meta" style="padding:.75rem;">Önizleme hazırlanıyor…</div>
          </ng-template>
        </div>
      </div>
    </p-sidebar>
  </div>
  `
})
export class LibraryPage implements OnInit {
    @ViewChild('searchBox') searchBox!: ElementRef<HTMLInputElement>;
    @ViewChild('uploader') uploader?: any;

    Math = Math;

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
    savedPulse = false;
    dense = localStorage.getItem('density') === 'compact';

    // ---- Önizleme
    previewOpen = false;
    previewDoc?: DocRow;
    previewSafeUrl?: SafeResourceUrl | null;
    previewIframeReady = false;              // <— EKLENDİ: iframe'i yeniden kurma guard'ı

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
        private confirm: ConfirmationService,
        private primeng: PrimeNGConfig
    ) { }

    ngOnInit() {
        document.body.classList.toggle('compact', this.dense);
        this.primeng.ripple = true;

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

    toggleDensity() {
        this.dense = !this.dense;
        document.body.classList.toggle('compact', this.dense);
        localStorage.setItem('density', this.dense ? 'compact' : 'comfortable');
    }

    saveView() {
        const payload = { rows: this.rows, sortBy: this.sortBy, view: this.view };
        localStorage.setItem('libSavedView', JSON.stringify(payload));
        this.savedPulse = true; setTimeout(() => this.savedPulse = false, 800);
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

        // 1) mevcut iframe'i DOM'dan kaldır
        this.previewIframeReady = false;
        this.previewSafeUrl = null;

        // 2) cache-buster ile benzersiz URL
        const url = this.api.inlineUrl(d.id) + `&v=${Date.now()}`;

        // 3) bir tick sonra yeniden yarat
        setTimeout(() => {
            this.previewSafeUrl = this.san.bypassSecurityTrustResourceUrl(url);
            this.previewIframeReady = true;
        }, 0);
    }

    onPreviewHide() {
        // panel kapatılırken tamamen sıfırla (bir sonraki açılış tertemiz olsun)
        this.previewIframeReady = false;
        this.previewSafeUrl = null;
        this.previewDoc = undefined;
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
                this.reload();            // refresh
                this.selected = [];       // clear selection
                this.allChecked = false;  // reset checkbox
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
        const body = rows.map(r => [r.id, this.csvCell(r.filename), r.uploadedAt, this.csvCell(r.category), this.csvCell(r.tags)].join('\n'.includes(',') ? "," : ',')).join('\n');
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
