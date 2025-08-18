import { Component, OnInit, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { ApiService, DocInfo } from '../../services/api.service';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { MultiSelectModule } from 'primeng/multiselect';
import { CalendarModule } from 'primeng/calendar';
import { CheckboxModule } from 'primeng/checkbox';
import { ToastModule } from 'primeng/toast';
import { SidebarModule } from 'primeng/sidebar';
import { DialogModule } from 'primeng/dialog';
import { ChipModule } from 'primeng/chip';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';
import { PaginatorModule } from 'primeng/paginator';
import { ProgressBarModule } from 'primeng/progressbar';
import { MessageService } from 'primeng/api';

type SortBy = 'relevance' | 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' | 'cat_asc';

type HistoryEntry = {
    name?: string;
    q: string;
    catFilter?: string;
    tagFilter: string[];
    dateFrom: string | null;
    dateTo: string | null;
    hasTags: boolean;
    noCategory: boolean;
    when: string;
};

@Component({
    standalone: true,
    selector: 'app-semantic',
    imports: [
        CommonModule, FormsModule,
        InputTextModule, ButtonModule, DropdownModule, MultiSelectModule, CalendarModule, CheckboxModule,
        ToastModule, SidebarModule, DialogModule, ChipModule, TagModule, TooltipModule, TableModule, PaginatorModule, ProgressBarModule
    ],
    providers: [MessageService],
    styles: [`
    :host{ display:block; }
    .toolbar { display:flex; gap:.75rem; align-items:flex-end; flex-wrap:wrap; }
    .meta { opacity:.75; }
    .header-row{ display:flex; align-items:center; gap:.75rem; justify-content:space-between; }
    .right-tools{ display:flex; align-items:center; gap:.5rem; flex-wrap:wrap; }
    .view-toggle { display:flex; gap:.25rem; }
    .filters { display:flex; flex-wrap:wrap; gap:.5rem; }
    .pill{ padding:.25rem .5rem; border-radius:999px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.02); cursor:pointer; }
    .pill.active{ border-color: rgba(56,189,248,.5); background: rgba(56,189,248,.08); }
    .grid-auto-fit{ display:grid; grid-template-columns: repeat(auto-fit, minmax(300px,1fr)); gap:.75rem; }
    .cardish{
      border-radius: .9rem;
      border: 1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.02);
      box-shadow: 0 1px 2px rgba(0,0,0,.25), 0 10px 20px rgba(0,0,0,.15);
      transition: transform .08s ease, box-shadow .2s ease;
    }
    .cardish:hover{ transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,.25), 0 12px 32px rgba(0,0,0,.25); }
    .result-item{ padding:.9rem; display:grid; gap:.5rem; cursor:pointer; }
    .title{ font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .chips{ display:flex; flex-wrap:wrap; gap:.35rem; }
    .actions{ display:flex; gap:.35rem; justify-content:flex-end; }
    .highlight mark{ background: rgba(56,189,248,.35); color: inherit; padding:0 .1rem; border-radius:.2rem; }
    .list-compact td{ padding:.5rem .65rem; }
    .facets{ display:grid; gap:.5rem; }
    .facet-group{ padding:.75rem; border-radius:.75rem; border:1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.02); }
    .badges{ display:flex; flex-wrap:wrap; gap:.35rem; }
    .small{ font-size:.92rem; }
  `],
    template: `
    <p-toast></p-toast>

    <div class="header-row">
      <div class="toolbar">
        <div class="p-input-icon-left">
          <i class="pi pi-search"></i>
          <input #qInput pInputText type="text" placeholder="Anlamsal arama… ( / ile odak )"
                 [(ngModel)]="q" (keyup.enter)="runSearch()" (input)="onQueryChange()">
        </div>

        <p-dropdown [options]="sortOptions" [(ngModel)]="sortBy" (onChange)="rerank()" [style]="{width:'12rem'}"></p-dropdown>

        <p-dropdown [options]="categoryOptions" [(ngModel)]="catFilter" placeholder="Kategori" [showClear]="true" (onChange)="runSearch()"></p-dropdown>

        <p-multiSelect [options]="tagOptions" [(ngModel)]="tagFilter"
                       defaultLabel="Etiketler" [filter]="true" [showClear]="true"
                       (onChange)="runSearch()" display="chip"></p-multiSelect>

        <p-calendar [(ngModel)]="dateFrom" dateFormat="yy-mm-dd" placeholder="Başlangıç"
                    (onSelect)="runSearch()" [showIcon]="true"></p-calendar>
        <p-calendar [(ngModel)]="dateTo" dateFormat="yy-mm-dd" placeholder="Bitiş"
                    (onSelect)="runSearch()" [showIcon]="true"></p-calendar>

        <span style="flex:1 1 auto;"></span>

        <div class="view-toggle">
          <button pButton class="p-button-text" [outlined]="view!=='grid'" icon="pi pi-th-large" (click)="setView('grid')" aria-label="Grid"></button>
          <button pButton class="p-button-text" [outlined]="view!=='list'" icon="pi pi-bars" (click)="setView('list')" aria-label="Liste"></button>
        </div>

        <button pButton class="p-button-text" icon="pi pi-sliders-h" label="Ayarlar" (click)="settingsOpen=true"></button>
        <button pButton class="p-button-text" icon="pi pi-save" label="Aramayı Kaydet" (click)="openSaveSearch()"></button>
        <button pButton class="p-button-text" icon="pi pi-history" label="Geçmiş" (click)="historyOpen=true"></button>
        <button pButton class="p-button-text" icon="pi pi-download" label="CSV" (click)="exportCsv()" [disabled]="!results.length"></button>
      </div>

      <div class="right-tools meta">
        <span *ngIf="!loading">{{results.length | number}} sonuç</span>
        <p-tag *ngIf="useSemantic" severity="info" value="Semantic" rounded></p-tag>
        <p-tag *ngIf="expandSynonyms" severity="success" value="Sözlük" rounded></p-tag>
      </div>
    </div>

    <!-- Quick filters -->
    <div class="filters" style="margin-top:.5rem;">
      <span class="pill" (click)="quickRange('7d')">Son 7g</span>
      <span class="pill" (click)="quickRange('30d')">Son 30g</span>
      <span class="pill" (click)="quickRange('year')">Son 1y</span>
      <span class="pill" [class.active]="noCategory" (click)="toggleNoCategory()">Kategori yok</span>
      <span class="pill" [class.active]="hasTags" (click)="toggleHasTags()">Etiketli</span>
      <span class="pill" (click)="resetAll()">Sıfırla</span>
    </div>

    <div style="display:grid; grid-template-columns: 320px 1fr; gap:1rem; margin-top:1rem;">
      <!-- Facets -->
      <div class="facets">
        <div class="facet-group">
          <div class="meta small" style="margin-bottom:.35rem;">Kategoriler</div>
          <div class="badges">
            <p-chip *ngFor="let c of facetCats" [label]="c.label + ' (' + c.count + ')'" (click)="catFilter=c.label; runSearch();" pTooltip="Bu kategoride filtrele"></p-chip>
          </div>
        </div>
        <div class="facet-group">
          <div class="meta small" style="margin-bottom:.35rem;">Top Etiketler</div>
          <div class="badges">
            <p-chip *ngFor="let t of facetTags" [label]="t.label + ' (' + t.count + ')'" (click)="toggleTag(t.label)" pTooltip="Bu etiketi filtrele"></p-chip>
          </div>
        </div>
        <div class="facet-group">
          <div class="meta small" style="margin-bottom:.35rem;">Tercihler</div>
          <div class="small">
            <p-checkbox [(ngModel)]="useSemantic" [binary]="true" inputId="useSem"></p-checkbox>
            <label for="useSem" style="margin-left:.35rem;">Semantik sıralama (varsa API)</label>
          </div>
          <div class="small" style="margin-top:.35rem;">
            <p-checkbox [(ngModel)]="expandSynonyms" [binary]="true" inputId="syn"></p-checkbox>
            <label for="syn" style="margin-left:.35rem;">Sözlükle genişlet</label>
          </div>
        </div>
      </div>

      <!-- Results -->
      <div>
        <!-- GRID -->
        <div *ngIf="!loading && results.length && view==='grid'" class="grid-auto-fit">
          <div *ngFor="let d of pagedResults()" class="cardish result-item" (click)="open(d.id)">
            <div class="title highlight" [innerHTML]="highlight(d.filename)"></div>
            <div class="meta small">{{ d.uploadedAt }} • {{ d.category || '—' }}</div>
            <div class="small" *ngIf="d.summary" [innerHTML]="highlight(d.summary)"></div>
            <div class="chips" *ngIf="d.tags?.length">
              <p-chip *ngFor="let t of d.tags" [label]="t" (click)="addTagFilter(t); $event.stopPropagation();" pTooltip="Bu etikete filtrele"></p-chip>
            </div>
            <div class="actions">
              <button pButton icon="pi pi-eye" class="p-button-text" (click)="open(d.id); $event.stopPropagation();" aria-label="Detaya git"></button>
              <a pButton icon="pi pi-download" class="p-button-text" [href]="api.downloadUrl(d.id)" [attr.download]="d.filename" (click)="$event.stopPropagation()" aria-label="İndir"></a>
              <button pButton icon="pi pi-search" class="p-button-text" (click)="openPreview(d); $event.stopPropagation();" aria-label="Önizleme"></button>
            </div>
          </div>
        </div>

        <!-- LIST -->
        <p-table *ngIf="!loading && results.length && view==='list'"
                 class="list-compact p-mt-2"
                 [value]="pagedResults()"
                 [paginator]="false"
                 [responsiveLayout]="'scroll'">
          <ng-template pTemplate="header">
            <tr>
              <th>Dosya</th>
              <th>Yüklenme</th>
              <th>Kategori</th>
              <th>Etiketler</th>
              <th style="width:1%"></th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-d>
            <tr>
              <td class="highlight">
                <div class="title" [innerHTML]="highlight(d.filename)"></div>
                <div class="small meta" *ngIf="d.summary" [innerHTML]="highlight(d.summary)"></div>
              </td>
              <td>{{ d.uploadedAt }}</td>
              <td>{{ d.category || '—' }}</td>
              <td>
                <ng-container *ngFor="let t of d.tags">
                  <p-chip [label]="t" class="p-mr-2 p-mb-2" (click)="addTagFilter(t)" pTooltip="Bu etiketle filtrele"></p-chip>
                </ng-container>
              </td>
              <td class="p-text-right">
                <button pButton icon="pi pi-eye" class="p-button-text" (click)="open(d.id)" aria-label="Detaya git"></button>
                <a pButton icon="pi pi-download" class="p-button-text" [href]="api.downloadUrl(d.id)" [attr.download]="d.filename" aria-label="İndir"></a>
                <button pButton icon="pi pi-search" class="p-button-text" (click)="openPreview(d)" aria-label="Önizleme"></button>
              </td>
            </tr>
          </ng-template>
        </p-table>

        <!-- Empty / Loading -->
        <div *ngIf="loading" class="meta" style="padding:1rem;">Aranıyor…</div>
        <div *ngIf="!loading && !results.length" class="cardish" style="padding:24px; text-align:center;">
          <div style="font-weight:700; margin-bottom:6px;">Sonuç bulunamadı</div>
          <div class="meta">Sorguyu sadeleştirin veya filtreleri genişletin.</div>
        </div>

        <!-- Pager -->
        <p-paginator *ngIf="!loading && results.length>rows"
                     styleClass="p-mt-3"
                     [rows]="rows" [totalRecords]="results.length" [first]="first"
                     (onPageChange)="onPage($event)"></p-paginator>
      </div>
    </div>

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

    <!-- Ayarlar dialog -->
    <p-dialog [(visible)]="settingsOpen" [modal]="true" [style]="{width:'560px'}" header="Arama Ayarları">
      <div style="display:grid; gap:.6rem;">
        <div class="small">Relevance ağırlıkları (yerel):</div>
        <div class="pill">Dosya adı ağırlığı
          <input pInputText type="number" step="0.1" [(ngModel)]="wFile" style="width:90px; margin-left:.5rem;">
        </div>
        <div class="pill">Etiket ağırlığı
          <input pInputText type="number" step="0.1" [(ngModel)]="wTag" style="width:90px; margin-left:.5rem;">
        </div>
        <div class="pill">Özet ağırlığı
          <input pInputText type="number" step="0.1" [(ngModel)]="wSummary" style="width:90px; margin-left:.5rem;">
        </div>
        <div class="pill">Tazelik (recency) ağırlığı
          <input pInputText type="number" step="0.1" [(ngModel)]="wRecency" style="width:90px; margin-left:.5rem;">
        </div>
        <div class="pill">Sonuç sayısı
          <input pInputText type="number" [(ngModel)]="rows" style="width:90px; margin-left:.5rem;">
        </div>
        <div class="small meta">Not: Eğer ApiService içinde <code>semanticSearch()</code> varsa, önce onu kullanır; yoksa yerel sıralama uygulanır.</div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:.5rem; margin-top:.75rem;">
        <button pButton class="p-button-text" label="Varsayılan" (click)="resetWeights()"></button>
        <button pButton label="Uygula" (click)="runSearch()"></button>
      </div>
    </p-dialog>

    <!-- Kaydedilmiş arama -->
    <p-dialog [(visible)]="saveOpen" [modal]="true" [style]="{width:'460px'}" header="Aramayı Kaydet">
      <div class="p-inputgroup">
        <input pInputText [(ngModel)]="saveName" placeholder="ör. Sözleşmeler son 30g">
        <button pButton label="Kaydet" icon="pi pi-save" (click)="saveSearch()"></button>
      </div>
      <div class="small meta" style="margin-top:.5rem;">Geçmişten de ulaşabilirsiniz.</div>
    </p-dialog>

    <!-- Geçmiş -->
    <p-dialog [(visible)]="historyOpen" [modal]="true" [style]="{width:'560px'}" header="Arama Geçmişi">
      <div *ngIf="!history.length" class="meta">Geçmiş boş.</div>
      <div *ngIf="history.length" class="grid-auto-fit">
        <div *ngFor="let h of history; let i = index" class="cardish" style="padding:.75rem;">
          <div style="font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" [title]="h.name || h.q">
            {{h.name || h.q || 'Adsız arama'}}
          </div>
          <div class="meta small">{{h.when}}</div>
          <div class="meta small">{{summaryOf(h)}}</div>
          <div style="display:flex; gap:.35rem; margin-top:.5rem;">
            <button pButton class="p-button-sm" label="Çalıştır" (click)="applyHistory(i)"></button>
            <button pButton class="p-button-sm p-button-outlined" label="Sil" (click)="deleteHistory(i)"></button>
          </div>
        </div>
      </div>
    </p-dialog>
  `
})
export class SemanticPage implements OnInit {
    @ViewChild('qInput') qInput!: ElementRef<HTMLInputElement>;

    // Query & filters
    q = '';
    sortBy: SortBy = 'relevance';
    catFilter?: string;
    tagFilter: string[] = [];
    dateFrom?: Date | null;
    dateTo?: Date | null;
    hasTags = false;
    noCategory = false;

    // Options
    useSemantic = true;
    expandSynonyms = true;
    rows = 24;
    first = 0;

    // Weights for local scoring
    wFile = 3.0;
    wTag = 2.0;
    wSummary = 1.0;
    wRecency = 1.5;

    // Facets/options
    categoryOptions: { label: string; value: string }[] = [];
    tagOptions: { label: string; value: string }[] = [];
    facetCats: { label: string; count: number }[] = [];
    facetTags: { label: string; count: number }[] = [];

    // Results
    allDocs: DocInfo[] = [];
    results: DocInfo[] = [];
    loading = false;
    view: 'grid' | 'list' = (localStorage.getItem('semView') as any) || 'grid';

    // Preview
    previewOpen = false;
    previewDoc?: DocInfo;
    previewSafeUrl?: SafeResourceUrl;

    // Save/Search history
    saveOpen = false;
    saveName = '';
    historyOpen = false;
    history: HistoryEntry[] = [];

    sortOptions = [
        { label: 'İlgililik', value: 'relevance' },
        { label: 'Tarih (Yeni → Eski)', value: 'date_desc' },
        { label: 'Tarih (Eski → Yeni)', value: 'date_asc' },
        { label: 'Ad (A → Z)', value: 'name_asc' },
        { label: 'Ad (Z → A)', value: 'name_desc' },
        { label: 'Kategori', value: 'cat_asc' },
    ];

    settingsOpen = false;

    constructor(
        public api: ApiService,
        private router: Router,
        private san: DomSanitizer,
        private toast: MessageService
    ) { }

    ngOnInit(): void {
        // preload all docs (fallback & facets)
        this.api.listFiles(undefined, 1000).subscribe(rows => {
            this.allDocs = rows || [];
            this.buildFacetOptions(this.allDocs);
            this.runSearch();
        });

        // load history
        this.loadHistory();
    }

    // ----- Run search
    runSearch() {
        this.loading = true;
        const apiAny = this.api as any;

        const params: any = {
            q: this.q || undefined,
            category: this.catFilter || (this.noCategory ? null : undefined),
            tags: this.tagFilter?.length ? this.tagFilter : undefined,
            dateFrom: this.dateFrom ? this.toDateStr(this.dateFrom) : undefined,
            dateTo: this.dateTo ? this.toDateStr(this.dateTo) : undefined,
            hasTags: this.hasTags || undefined
        };

        const tryApi = this.useSemantic && typeof apiAny.semanticSearch === 'function';

        if (tryApi) {
            apiAny.semanticSearch(params).subscribe({
                next: (arr: DocInfo[]) => { this.results = (arr || []); this.postProcess(); },
                error: (_err: any) => { this.results = this.localSearch(); this.postProcess(); }
            });
        } else {
            this.results = this.localSearch();
            this.postProcess();
        }
    }

    private postProcess() {
        this.rerank();
        this.first = 0;
        this.computeFacets(this.results);
        this.loading = false;
        this.pushHistory({ q: this.q, catFilter: this.catFilter, tagFilter: [...this.tagFilter], dateFrom: this.dateFrom ? this.toDateStr(this.dateFrom) : null, dateTo: this.dateTo ? this.toDateStr(this.dateTo) : null, hasTags: this.hasTags, noCategory: this.noCategory, when: new Date().toLocaleString() });
    }

    // ----- Local fallback search + scoring
    private localSearch(): DocInfo[] {
        const docs = this.filterByParams(this.allDocs);
        const terms = this.queryTerms();
        const syn = this.expandSynonyms ? this.expandTerms(terms) : terms;

        const scored = docs.map(d => {
            const sFile = this.countMatches(d.filename || '', syn) * this.wFile;
            const sTag = this.countMatches(this.tagText(d), syn) * this.wTag;
            const sSum = this.countMatches((d.summary || ''), syn) * this.wSummary;
            const ageBoost = this.recencyBoost(d.uploadedAt) * this.wRecency;
            const base = sFile + sTag + sSum + ageBoost;
            return { d, score: base };
        });

        return scored
            .filter(x => x.score > 0 || terms.length === 0)
            .sort((a, b) => b.score - a.score)
            .map(x => x.d);
    }

    private filterByParams(arr: DocInfo[]): DocInfo[] {
        let out = [...arr];

        if (this.catFilter !== undefined && this.catFilter !== null) {
            out = out.filter(d => (d.category || '') === this.catFilter);
        } else if (this.noCategory) {
            out = out.filter(d => !d.category);
        }

        if (this.hasTags) {
            out = out.filter(d => (d.tags || []).length > 0);
        }

        if (this.tagFilter?.length) {
            const tags = new Set(this.tagFilter.map(t => t.toLowerCase()));
            out = out.filter(d => (d.tags || []).some(t => tags.has(String(t).toLowerCase())));
        }

        if (this.dateFrom) {
            const from = new Date(this.dateFrom); from.setHours(0, 0, 0, 0);
            out = out.filter(d => this.parseDate(d.uploadedAt) >= from);
        }
        if (this.dateTo) {
            const to = new Date(this.dateTo); to.setHours(23, 59, 59, 999);
            out = out.filter(d => this.parseDate(d.uploadedAt) <= to);
        }

        return out;
    }

    // ----- Rerank
    rerank() {
        const by = this.sortBy;
        if (by === 'relevance') {
            // already sorted in localSearch; if API, keep as is
        } else if (by === 'date_desc') {
            this.results.sort((a, b) => this.parseDate(b.uploadedAt).getTime() - this.parseDate(a.uploadedAt).getTime());
        } else if (by === 'date_asc') {
            this.results.sort((a, b) => this.parseDate(a.uploadedAt).getTime() - this.parseDate(b.uploadedAt).getTime());
        } else if (by === 'name_asc') {
            this.results.sort((a, b) => (a.filename || '').localeCompare(b.filename || ''));
        } else if (by === 'name_desc') {
            this.results.sort((a, b) => (b.filename || '').localeCompare(a.filename || ''));
        } else if (by === 'cat_asc') {
            this.results.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
        }
    }

    // ----- Pagination
    pagedResults() { return this.results.slice(this.first, this.first + this.rows); }
    onPage(e: any) { this.first = e.first; this.rows = e.rows; }

    // ----- Highlight and helpers
    highlight(text?: string): SafeHtml {
        const t = text || '';
        const terms = [...this.queryTerms(), ...(this.tagFilter || [])].filter(Boolean);
        if (!terms.length) return t as any;
        const esc = terms.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const re = new RegExp(`(${esc.join('|')})`, 'ig');
        const html = t.replace(re, '<mark>$1</mark>');
        return this.san.bypassSecurityTrustHtml(html);
    }

    // legacy helper artık kullanılmıyor ama dursun (başka yerlerde lazım olabilir)
    splitTags(s?: string): string[] { return (s || '').split(',').map(x => x.trim()).filter(Boolean); }
    private tagList(d: DocInfo): string[] { return (d.tags || []).map(t => String(t).trim()).filter(Boolean); }
    private tagText(d: DocInfo): string { return this.tagList(d).join(', '); }

    // ----- Query parsing
    onQueryChange() { /* future: live suggestions */ }
    queryTerms(): string[] {
        const raw = (this.q || '').toLowerCase().trim();
        if (!raw) return [];
        const parts = raw.split(/\s+/).filter(Boolean);
        const terms = parts.filter(p => !p.includes(':'));
        return terms;
    }
    expandTerms(terms: string[]): string[] {
        const map: Record<string, string[]> = {
            'contract': ['sözleşme', 'kontrat', 'mukavele'],
            'sözleşme': ['contract', 'kontrat', 'mukavele'],
            'invoice': ['fatura', 'irsaliye'],
            'fatura': ['invoice', 'irsaliye', 'e-fatura'],
            'budget': ['bütçe', 'plan'],
            'bütçe': ['budget', 'plan'],
            'report': ['rapor', 'analiz'],
            'analiz': ['analysis', 'report', 'inceleme'],
            'policy': ['politika', 'yönerge'],
            'hr': ['ik', 'insan kaynakları'],
            'finance': ['finans', 'mali'],
            'meeting': ['toplantı', 'tutanak'],
            'offer': ['teklif', 'quotation', 'proforma']
        };
        const out = new Set<string>(terms);
        for (const t of terms) {
            const add = map[t]; if (add) add.forEach(x => out.add(x));
        }
        return Array.from(out);
    }
    countMatches(haystack: string, needles: string[]): number {
        const s = haystack.toLowerCase();
        let n = 0;
        for (const w of needles) {
            if (!w) continue;
            const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`, 'g');
            const m = s.match(re);
            n += m ? m.length : 0;
        }
        return n;
    }
    recencyBoost(uploadedAt?: string): number {
        if (!uploadedAt) return 0;
        const days = Math.max(0, (Date.now() - this.parseDate(uploadedAt).getTime()) / (1000 * 60 * 60 * 24));
        // 0 gün → +2, 365 gün → 0
        return Math.max(0, 2 - (days / 365) * 2);
    }
    parseDate(s?: string): Date { return s ? new Date(s) : new Date(0); }
    toDateStr(d: Date) { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); return `${y}-${m}-${day}`; }

    // ----- Facets
    private buildFacetOptions(rows: DocInfo[]) {
        const cats = new Set<string>(), tags = new Set<string>();
        for (const d of rows || []) {
            if (d.category) cats.add(d.category);
            (d.tags || []).forEach(t => tags.add(String(t)));
        }
        this.categoryOptions = Array.from(cats).sort().map(v => ({ label: v, value: v }));
        this.tagOptions = Array.from(tags).sort().map(v => ({ label: v, value: v }));
    }
    private computeFacets(rows: DocInfo[]) {
        const cMap = new Map<string, number>(), tMap = new Map<string, number>();
        for (const d of rows) {
            const c = d.category || '—'; cMap.set(c, (cMap.get(c) || 0) + 1);
            (d.tags || []).forEach(t => tMap.set(String(t), (tMap.get(String(t)) || 0) + 1));
        }
        this.facetCats = Array.from(cMap.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 10);
        this.facetTags = Array.from(tMap.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 14);
    }
    addTagFilter(t: string) { if (!t) return; if (!this.tagFilter.includes(t)) { this.tagFilter = [...this.tagFilter, t]; this.runSearch(); } }
    toggleTag(t: string) { if (!t) return; if (this.tagFilter.includes(t)) this.tagFilter = this.tagFilter.filter(x => x !== t); else this.tagFilter = [...this.tagFilter, t]; this.runSearch(); }
    quickRange(kind: '7d' | '30d' | 'year') {
        const today = new Date();
        if (kind === '7d') this.dateFrom = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
        if (kind === '30d') this.dateFrom = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);
        if (kind === 'year') this.dateFrom = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
        this.dateTo = today; this.runSearch();
    }
    toggleNoCategory() { this.noCategory = !this.noCategory; this.runSearch(); }
    toggleHasTags() { this.hasTags = !this.hasTags; this.runSearch(); }
    resetAll() {
        this.q = ''; this.sortBy = 'relevance'; this.catFilter = undefined; this.tagFilter = []; this.dateFrom = this.dateTo = undefined; this.hasTags = false; this.noCategory = false;
        this.runSearch();
    }

    // ----- Preview / open
    openPreview(d: DocInfo) {
        this.previewDoc = d;
        this.previewOpen = true;
        this.previewSafeUrl = this.san.bypassSecurityTrustResourceUrl(this.api.inlineUrl(d.id));
    }
    open(id: string) { this.router.navigate(['/documents', id]); }

    // ----- View
    setView(v: 'grid' | 'list') { this.view = v; localStorage.setItem('semView', v); }

    // ----- Export
    exportCsv() {
        if (!this.results.length) return;
        const rows = this.results.map(d => ({
            id: d.id,
            filename: d.filename,
            uploadedAt: d.uploadedAt,
            category: d.category || '',
            tags: (d.tags || []).join('; ')
        }));
        const header = Object.keys(rows[0]).join(',');
        const body = rows.map(r =>
            [r.id, this.csvCell(r.filename), r.uploadedAt, this.csvCell(r.category), this.csvCell(r.tags)].join(',')
        ).join('\n');
        const csv = header + '\n' + body;
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'semantic_results.csv'; a.click(); URL.revokeObjectURL(a.href);
    }
    private csvCell(s: string) { if (s == null) return ''; const needQuote = /[",\n]/.test(s); return needQuote ? `"${s.replace(/"/g, '""')}"` : s; }

    // ----- Save / History
    openSaveSearch() { this.saveName = ''; this.saveOpen = true; }
    saveSearch() {
        const entry: HistoryEntry = this.currentQueryEntry();
        entry.name = this.saveName?.trim() || 'Kaydedilmiş arama';
        this.pushHistory(entry);
        this.saveOpen = false;
        this.toast.add({ severity: 'success', summary: 'Kaydedildi', detail: entry.name, life: 1600 });
    }
    applyHistory(i: number) {
        const h = this.history[i]; if (!h) return;
        this.q = h.q || '';
        this.catFilter = h.catFilter || undefined;
        this.tagFilter = [...(h.tagFilter || [])];
        this.dateFrom = h.dateFrom ? new Date(h.dateFrom) : undefined;
        this.dateTo = h.dateTo ? new Date(h.dateTo) : undefined;
        this.hasTags = !!h.hasTags; this.noCategory = !!h.noCategory;
        this.historyOpen = false; this.runSearch();
    }
    deleteHistory(i: number) {
        const name = this.history[i]?.name || this.history[i]?.q || 'Arama';
        this.history.splice(i, 1);
        localStorage.setItem('semHistory', JSON.stringify(this.history));
        this.toast.add({ severity: 'warn', summary: 'Silindi', detail: name, life: 1200 });
    }
    loadHistory() {
        try { this.history = JSON.parse(localStorage.getItem('semHistory') || '[]'); } catch { this.history = []; }
    }
    currentQueryEntry(): HistoryEntry {
        return {
            q: this.q, catFilter: this.catFilter, tagFilter: [...this.tagFilter],
            dateFrom: this.dateFrom ? this.toDateStr(this.dateFrom) : null,
            dateTo: this.dateTo ? this.toDateStr(this.dateTo) : null,
            hasTags: this.hasTags, noCategory: this.noCategory,
            when: new Date().toLocaleString()
        };
    }
    summaryOf(h: HistoryEntry) {
        const bits: string[] = [];
        if (h.q) bits.push(`"${h.q}"`);
        if (h.catFilter) bits.push(`cat:${h.catFilter}`);
        if (h.tagFilter?.length) bits.push(`#${h.tagFilter.join(', #')}`);
        if (h.dateFrom) bits.push(`>${h.dateFrom}`);
        if (h.dateTo) bits.push(`<${h.dateTo}`);
        if (h.hasTags) bits.push('has:tags');
        if (h.noCategory) bits.push('no:cat');
        return bits.join(' • ');
    }
    pushHistory(entry: HistoryEntry) {
        const list = this.history || [];
        list.unshift({ ...entry });
        this.history = list.slice(0, 50);
        localStorage.setItem('semHistory', JSON.stringify(this.history));
    }

    // ----- Hotkeys
    @HostListener('document:keydown.slash', ['$event'])
    onSlash(ev: KeyboardEvent) { ev.preventDefault(); this.qInput?.nativeElement?.focus(); }

    // ----- Settings helpers
    resetWeights() {
        this.wFile = 3.0;
        this.wTag = 2.0;
        this.wSummary = 1.0;
        this.wRecency = 1.5;
        this.rows = 24;
        this.toast.add({ severity: 'info', summary: 'Varsayılan ayarlar yüklendi', life: 1400 });
    }

    // Utils
    private toastMsg(sev: 'success' | 'info' | 'warn' | 'error', sum: string, det?: string) { this.toast.add({ severity: sev, summary: sum, detail: det, life: 1800 }); }

}
