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
    styleUrl: './library.page.css',
    templateUrl: './library.page.html'
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
