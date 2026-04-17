// src/app/pages/detail/detail.page.ts
import { Component, HostListener, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { HttpClient, HttpClientModule } from '@angular/common/http';

import { ApiService, DocInfo } from '../../services/api.service';

import { SplitterModule } from 'primeng/splitter';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { SkeletonModule } from 'primeng/skeleton';
import { DialogModule } from 'primeng/dialog';
import { ListboxModule } from 'primeng/listbox';
import { ProgressBarModule } from 'primeng/progressbar';
import { SidebarModule } from 'primeng/sidebar';
import { CardModule } from 'primeng/card';
import { TooltipModule } from 'primeng/tooltip';
import { SpeedDialModule } from 'primeng/speeddial';
import { TagModule } from 'primeng/tag';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TabViewModule } from 'primeng/tabview';
import { SliderModule } from 'primeng/slider';
import { ChipModule } from 'primeng/chip';

import { MessageService, ConfirmationService, MenuItem } from 'primeng/api';
import { firstValueFrom, Subject, debounceTime } from 'rxjs';

type ChatMsg = { role: 'user' | 'assistant'; content: string; createdAt?: string };

@Component({
    standalone: true,
    selector: 'app-detail',
    imports: [
        CommonModule, FormsModule, HttpClientModule,
        SplitterModule, AutoCompleteModule, DropdownModule,
        InputTextModule, InputTextareaModule,
        ButtonModule, ToastModule, SkeletonModule,
        DialogModule, ListboxModule, ProgressBarModule, SidebarModule,
        CardModule, TooltipModule, SpeedDialModule, TagModule, ConfirmDialogModule,
        TabViewModule, SliderModule, ChipModule
    ],
    providers: [MessageService, ConfirmationService],
    styleUrl: './detail.page.css',
    templateUrl: './detail.page.html'
})
export class DetailPage implements OnInit, OnDestroy {
    id!: string;
    doc?: DocInfo;

    // —— PDF (Blob + native viewer)
    pdfBlobUrl?: SafeResourceUrl;
    private blobObjectUrl?: string;
    pdfError = false;
    pdfLoading = false;
    pdfMeta: { filename?: string; size?: string } = {};
    private lastPdfReqToken = 0;

    pageCount = 0;

    previewUrl = '';
    downloadUrl = '';

    tabIndex = +(localStorage.getItem('detailTab') || '0');
    onTabChange(i: number) {
        this.tabIndex = i;
        localStorage.setItem('detailTab', String(i));
        setTimeout(() => this.pokePdfResize(), 0);
    }

    tagsArr: string[] = [];
    tagSuggestions: string[] = [];
    trendTags: string[] = [];
    categoryOptions: { label: string; value: string }[] = [];
    cat = '';

    summary = '';
    summaryWords = 0;
    summaryScore = 0;
    summaryHint = '';
    summaryColor = '#9ca3af';
    targetWords = 100;

    lastSavedAt = '';
    loading = true;
    savingAll = false;
    reanalyzing = false;
    isDirty = false;
    zenMode = false;
    savedPulse = false;

    online = navigator.onLine;

    paletteOpen = false;
    paletteQuery = '';
    selectedCommand: any = null;
    commands = [
        { id: 'save', label: 'Kaydet (Ctrl+S)' },
        { id: 'reanalyze', label: 'Yeniden Analiz' },
        { id: 'download', label: 'PDF İndir' },
        { id: 'openPreview', label: 'Tarayıcıda Aç' },
        { id: 'similar', label: 'Benzer Dokümanları Göster' },
        { id: 'shorten', label: 'Özeti Kısalt (~120 kelime)' },
        { id: 'expand', label: 'Özeti Genişlet (~250 kelime)' },
        { id: 'copyTags', label: 'Etiketleri Panoya Kopyala' },
        { id: 'share', label: 'Bağlantıyı Kopyala' }
    ];
    filteredCommands = [...this.commands];

    similarOpen = false;
    similarLoading = false;
    similar: Array<DocInfo & { _sim?: number }> = [];

    panelSizes: number[] = JSON.parse(localStorage.getItem('detailSplitter') || '[16,64,20]');
    leftHidden = false;
    rightHidden = false;

    dialItems: MenuItem[] = [
        { icon: 'pi pi-refresh', tooltipOptions: { tooltipLabel: 'Yeniden Analiz' }, command: () => this.confirmReAnalyze() },
        { icon: 'pi pi-compass', tooltipOptions: { tooltipLabel: 'Benzerler' }, command: () => this.toggleSimilarPanel(true) },
        { icon: 'pi pi-download', tooltipOptions: { tooltipLabel: 'PDF İndir' }, command: () => this.downloadPdf() },
        { icon: 'pi pi-link', tooltipOptions: { tooltipLabel: 'Paylaş' }, command: () => this.copyShareLink() },
    ];

    tplName = '';
    tagTemplates: { name: string; tags: string[] }[] = [];

    historyOpen = false;
    history: { when: string; msg: string }[] = [];
    private lastSnapshot: { tagsJson: string; cat: string; summary: string } = { tagsJson: '[]', cat: '', summary: '' };

    private autosave$ = new Subject<void>();
    private savingFromAuto = false;
    private lastSaveFxAt = 0;

    dense = localStorage.getItem('density') === 'compact';

    fabIntro = false;
    chatOpen = false;
    chatSessionId = '';
    chatMessages: ChatMsg[] = [];
    chatInput = '';
    chatBusy = false;
    fxMuted = localStorage.getItem('fxMuted') === '1';

    @ViewChild('floatChatLog') floatChatLog?: ElementRef<HTMLDivElement>;

    constructor(
        private route: ActivatedRoute,
        public api: ApiService,
        private router: Router,
        private san: DomSanitizer,
        private msg: MessageService,
        private confirm: ConfirmationService,
        private http: HttpClient
    ) { }

    private pokePdfResize() {
        try { window.dispatchEvent(new Event('resize')); } catch { }
    }

    ngOnInit(): void {
        this.id = this.route.snapshot.paramMap.get('id')
            || this.route.snapshot.paramMap.get('hash')
            || '';

        this.restoreChatIfAny();

        // URL'leri hazırla
        const baseInline = this.api.inlineUrl(this.id);
        const sep = baseInline.includes('?') ? '&' : '?';
        const inlineUrl = `${baseInline}${sep}v=${Date.now()}`;
        this.previewUrl = `${this.api.previewUrl(this.id)}?v=${Date.now()}`;
        this.downloadUrl = `${this.api.downloadUrl(this.id)}?v=${Date.now()}`;

        // PDF'yi Blob olarak getir ve göster
        this.loadPdfBlob(inlineUrl);

        // Doc meta
        this.api.getDoc(this.id).subscribe({
            next: (d: DocInfo) => {
                this.doc = d;
                this.tagsArr = d.tags || [];
                this.cat = d.category || '';
                this.summary = d.summary || '';
                this.snapshot();
                this.onSummaryMetrics();
                this.loading = false;
            },
            error: () => {
                this.loading = false;
                this.toast('error', 'Belge getirilemedi', 'Sunucudan yanıt alınamadı.');
                this.playFx('error');
            }
        });

        this.api.suggestCategories('', 100).subscribe({
            next: (arr: string[]) => this.categoryOptions = (arr || []).map(v => ({ label: v, value: v })),
            error: () => { }
        });
        this.api.suggestKeywords('', 12).subscribe({
            next: (arr: string[]) => this.trendTags = (arr || []).slice(0, 10),
            error: () => { }
        });

        this.loadTagTemplates();
        this.loadHistory();

        window.addEventListener('online', () => { this.online = true; this.toast('info', 'Bağlantı geri geldi'); this.playFx('open'); });
        window.addEventListener('offline', () => { this.online = false; this.toast('warn', 'Çevrimdışı'); });

        this.autosave$
            .pipe(debounceTime(1200))
            .subscribe(() => {
                this.savingFromAuto = true;
                this.saveAll().finally(() => this.savingFromAuto = false);
            });

        document.body.classList.toggle('compact', this.dense);

        this.fabIntro = true;
        setTimeout(() => this.fabIntro = false, 6000);

        if (!localStorage.getItem('chatPeeked')) {
            setTimeout(() => {
                this.chatOpen = true;
                this.playFx('open');
                setTimeout(() => {
                    if (this.chatOpen && this.chatMessages.length === 0) this.chatOpen = false;
                    localStorage.setItem('chatPeeked', '1');
                }, 2500);
            }, 900);
        }
    }

    ngOnDestroy(): void {
        if (this.blobObjectUrl) URL.revokeObjectURL(this.blobObjectUrl);
    }

    private humanSize(n?: number): string {
        if (!n || n <= 0) return '';
        const u = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(n) / Math.log(1024));
        return `${(n / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${u[i]}`;
    }

    private parseFilenameFromCD(cd?: string | null): string | undefined {
        if (!cd) return;
        const mStar = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(cd);
        if (mStar) return decodeURIComponent(mStar[1]);
        const m = /filename\s*=\s*"([^"]+)"/i.exec(cd) || /filename\s*=\s*([^;]+)/i.exec(cd);
        return m?.[1]?.trim();
    }

    private loadPdfBlob(url: string) {
        this.pdfError = false;
        this.pdfLoading = true;
        this.pdfMeta = {};

        if (this.blobObjectUrl) { URL.revokeObjectURL(this.blobObjectUrl); this.blobObjectUrl = undefined; }
        this.pdfBlobUrl = undefined;

        const token = ++this.lastPdfReqToken;

        this.http.get(url, { responseType: 'blob', observe: 'response' }).subscribe({
            next: (resp) => {
                if (token !== this.lastPdfReqToken) return;

                const blob = resp.body as Blob;
                const mime = blob?.type || 'application/pdf';
                const pdfBlob = mime.includes('pdf') ? blob : new Blob([blob], { type: 'application/pdf' });

                const cd = resp.headers.get('Content-Disposition');
                const cl = resp.headers.get('Content-Length');
                this.pdfMeta = {
                    filename: this.parseFilenameFromCD(cd) || this.doc?.filename,
                    size: this.humanSize(Number(cl) || pdfBlob.size)
                };

                this.blobObjectUrl = URL.createObjectURL(pdfBlob);
                this.pdfBlobUrl = this.san.bypassSecurityTrustResourceUrl(this.blobObjectUrl);
                this.pdfLoading = false;

                setTimeout(() => this.pokePdfResize(), 0);
            },
            error: (err) => {
                if (token !== this.lastPdfReqToken) return;
                console.error('PDF blob error', err);
                this.pdfError = true;
                this.pdfLoading = false;
            }
        });
    }

    reloadPdf() {
        const base = this.api.inlineUrl(this.id);
        const sep = base.includes('?') ? '&' : '?';
        const url = `${base}${sep}v=${Date.now()}`;
        this.loadPdfBlob(url);
    }
    openInNewTab() {
        if (!this.id) return;
        
        const base = this.api.inlineUrl(this.id);
        const sep = base.includes('?') ? '&' : '?';
        const url = `${base}${sep}v=${Date.now()}#view=FitH`; 
        window.open(url, '_blank', 'noopener');
    }
    downloadPdf() { window.open(this.downloadUrl, '_blank'); }


    // —— Tag & summary & misc —— //
    joinTags(a: string[]): string { return (a || []).map(x => x.trim()).filter(Boolean).join(', '); }
    addTag(t: string) {
        if (!t) return;
        if (!this.tagsArr.some(x => x.toLowerCase() === t.toLowerCase())) {
            this.tagsArr = [...this.tagsArr, t];
            this.onDirty();
        }
    }
    searchTagSuggestions(ev: { query: string }) {
        const q = ev?.query ?? '';
        this.api.suggestKeywords(q, 12).subscribe({
            next: (res: string[]) => {
                const already = new Set(this.tagsArr.map(x => x.toLowerCase()));
                this.tagSuggestions = (res || []).filter(x => !already.has(x.toLowerCase()));
            },
            error: () => { this.tagSuggestions = []; }
        });
    }

    onDirty() { this.isDirty = true; this.autosave$.next(); }

    async saveAll() {
        if (!this.id) return;
        const nextSnap = { tagsJson: JSON.stringify(this.tagsArr), cat: this.cat ?? '', summary: this.summary ?? '' };
        const prev = this.lastSnapshot;
        const patch: any = {};
        if (prev.tagsJson !== nextSnap.tagsJson) patch.tags = this.tagsArr;
        if (prev.cat !== nextSnap.cat) patch.category = this.cat || null;
        if (prev.summary !== nextSnap.summary) patch.summary = this.summary || null;

        if (!Object.keys(patch).length) { this.isDirty = false; return; }

        this.savingAll = true;
        try {
            await firstValueFrom(this.api.patchDocument(this.id, patch));
            this.lastSavedAt = new Date().toLocaleString();
            this.isDirty = false;
            this.lastSnapshot = nextSnap;
            const msg = Object.keys(patch).map(k => k === 'tags' ? 'Etiketler' : k === 'category' ? 'Kategori' : 'Özet').join(', ') + ' güncellendi.';
            this.toast('success', 'Kaydedildi', msg);
            this.pushHistory(msg);
            this.savedPulse = true; setTimeout(() => this.savedPulse = false, 800);

            if (this.savingFromAuto) {
                const now = Date.now();
                if (now - this.lastSaveFxAt > 2500) {
                    this.playFx('save');
                    this.lastSaveFxAt = now;
                }
            }
        } catch {
            this.toast('error', 'Kayıt sırasında hata', 'Bazı alanlar kaydedilemedi.');
            this.playFx('error');
        } finally {
            this.savingAll = false;
        }
    }

    confirmReAnalyze() {
        this.confirm.confirm({
            header: 'Yeniden Analiz',
            message: 'Bu belge için yeniden analiz başlatılsın mı?',
            icon: 'pi pi-exclamation-triangle',
            accept: () => this.reAnalyze()
        });
    }
    reAnalyze() {
        if (!this.id) return;
        this.reanalyzing = true;
        this.api.reanalyze(this.id).subscribe({
            next: () => { this.reanalyzing = false; this.toast('success', 'Yeniden analiz başlatıldı', 'Sonuçlar hazır olunca sayfayı yenileyin.'); this.playFx('open'); },
            error: () => { this.reanalyzing = false; this.toast('error', 'Yeniden analiz başarısız', 'Daha sonra tekrar deneyin.'); this.playFx('error'); }
        });
    }

    onSummaryMetrics() {
        const words = (this.summary || '').trim().split(/\s+/).filter(Boolean).length;
        this.summaryWords = words;

        const min = this.targetWords - 20;
        const max = this.targetWords + 20;
        let score = 0, hint = '';
        if (words === 0) { score = 0; hint = 'Özet boş'; this.summaryColor = '#ef4444'; }
        else if (words < min) { score = Math.round((words / Math.max(1, min)) * 70); hint = 'Kısa'; this.summaryColor = '#f59e0b'; }
        else if (words > max) { score = Math.round((max / words) * 70); hint = 'Uzun'; this.summaryColor = '#f59e0b'; }
        else { score = 100; hint = 'İdeal'; this.summaryColor = '#10b981'; }
        this.summaryScore = Math.max(0, Math.min(100, score));
        this.summaryHint = hint;
    }

    smartShorten() {
        if (!this.summary) return;
        const words = this.summary.trim().split(/\s+/);
        this.summary = words.slice(0, this.targetWords).join(' ');
        this.onSummaryMetrics(); this.onDirty();
    }
    smartExpand() {
        if (!this.summary) return;
        let s = this.summary.trim();
        while (s.split(/\s+/).length < this.targetWords) {
            s += ' Ayrıca,';
            if (s.split(/\s+/).length >= this.targetWords) break;
            s += ' bunun yanında';
            if (s.split(/\s+/).length >= this.targetWords) break;
            s += ' ve sonuç olarak';
            break;
        }
        this.summary = s;
        this.onSummaryMetrics(); this.onDirty();
    }

    @HostListener('document:keydown.control.k', ['$event'])
    openPalette(ev?: KeyboardEvent) { ev?.preventDefault?.(); this.paletteOpen = true; this.paletteQuery = ''; this.filteredCommands = [...this.commands]; }
    filterCommands() {
        const q = (this.paletteQuery || '').toLowerCase();
        this.filteredCommands = this.commands.filter(c => c.label.toLowerCase().includes(q));
    }
    runCommand(cmd: any) {
        if (!cmd) return;
        const id = cmd.id;
        this.paletteOpen = false;
        if (id === 'save') this.saveAll();
        if (id === 'reanalyze') this.confirmReAnalyze();
        if (id === 'download') this.downloadPdf();
        if (id === 'openPreview') this.openInNewTab();
        if (id === 'similar') this.toggleSimilarPanel(true);
        if (id === 'shorten') { this.smartShorten(); }
        if (id === 'expand') { this.smartExpand(); }
        if (id === 'copyTags') { this.copyTags(); }
        if (id === 'share') { this.copyShareLink(); }
    }

    toggleSimilarPanel(open: boolean) { this.similarOpen = open; if (open) this.loadSimilar(); }
    loadSimilar() {
        if (!this.doc) return;
        this.similarLoading = true;
        this.api.listFiles(undefined, 1000).subscribe(all => {
            const mine = new Set(this.doc?.tags || []);
            const sameCat = (d: DocInfo) => (d.category || '') === (this.doc?.category || '');
            const score = (d: DocInfo) => {
                let inter = 0; for (const t of d.tags || []) if (mine.has(t)) inter++;
                return inter + (sameCat(d) ? 1.5 : 0);
            };
            this.similar = (all || [])
                .filter(d => d.id !== this.id)
                .map(d => ({ ...d, _sim: score(d) }))
                .filter(d => (d._sim || 0) > 0)
                .sort((a, b) => (b._sim || 0) - (a._sim || 0))
                .slice(0, 8);
            this.similarLoading = false;
        }, _ => this.similarLoading = false);
    }
    openDoc(id: string) { window.open(`/documents/${id}`, '_blank'); }

    saveSplitter(ev: any) {
        if (ev?.sizes?.length === 3) {
            this.panelSizes = ev.sizes;
            localStorage.setItem('detailSplitter', JSON.stringify(this.panelSizes));
            setTimeout(() => this.pokePdfResize(), 0);
        }
    }
    toggleLeft() {
        this.leftHidden = !this.leftHidden;
        this.panelSizes = this.leftHidden
            ? [0, 75, 25]
            : JSON.parse(localStorage.getItem('detailSplitter') || '[16,64,20]');
        setTimeout(() => this.pokePdfResize(), 0);
    }
    toggleRight() {
        this.rightHidden = !this.rightHidden;
        this.panelSizes = this.rightHidden
            ? [25, 75, 0]
            : JSON.parse(localStorage.getItem('detailSplitter') || '[16,64,20]');
        setTimeout(() => this.pokePdfResize(), 0);
    }
    resetPanels() {
        this.leftHidden = this.rightHidden = false;
        this.panelSizes = [16, 64, 20];
        localStorage.setItem('detailSplitter', JSON.stringify(this.panelSizes));
        setTimeout(() => this.pokePdfResize(), 0);
    }
    toggleZen() {
        this.zenMode = !this.zenMode;
        if (this.zenMode) { this.leftHidden = true; this.rightHidden = true; this.panelSizes = [0, 100, 0]; }
        else { this.resetPanels(); }
        setTimeout(() => this.pokePdfResize(), 0);
    }
    toggleDensity() {
        this.dense = !this.dense;
        document.body.classList.toggle('compact', this.dense);
        localStorage.setItem('density', this.dense ? 'compact' : 'comfortable');
    }

    loadTagTemplates() {
        try { this.tagTemplates = JSON.parse(localStorage.getItem('tagTemplates') || '[]'); } catch { this.tagTemplates = []; }
    }
    saveTagTemplates() { localStorage.setItem('tagTemplates', JSON.stringify(this.tagTemplates)); }
    saveTagTemplate() {
        const name = (this.tplName || '').trim(); if (!name) return;
        const tags = [...this.tagsArr];
        const idx = this.tagTemplates.findIndex(t => t.name.toLowerCase() === name.toLowerCase());
        if (idx >= 0) this.tagTemplates[idx].tags = tags;
        else this.tagTemplates.push({ name, tags });
        this.saveTagTemplates(); this.tplName = '';
        this.toast('success', 'Şablon kaydedildi', name);
    }
    applyTagTemplate(i: number) {
        const tpl = this.tagTemplates[i]; if (!tpl) return;
        const set = new Set(this.tagsArr.map(x => x.toLowerCase()));
        for (const t of tpl.tags) if (!set.has(t.toLowerCase())) this.tagsArr.push(t);
        this.onDirty(); this.toast('info', 'Şablon uygulandı', tpl.name);
    }
    deleteTagTemplate(i: number) {
        const name = this.tagTemplates[i]?.name || '';
        this.tagTemplates.splice(i, 1); this.saveTagTemplates();
        this.toast('warn', 'Şablon silindi', name);
    }

    snapshot() { this.lastSnapshot = { tagsJson: JSON.stringify(this.tagsArr), cat: this.cat ?? '', summary: this.summary ?? '' }; }
    loadHistory() {
        try {
            this.history = JSON.parse(localStorage.getItem(`detailHistory:${this.id}`) || '[]');
        } catch {
            this.history = [];
        }
    }
    private pushHistory(msg: string) {
        if (!msg) return;
        const entry = { when: new Date().toLocaleString(), msg };
        this.history.unshift(entry);
        this.history = this.history.slice(0, 50);
        localStorage.setItem(`detailHistory:${this.id}`, JSON.stringify(this.history));
    }
    clearHistory() { this.history = []; localStorage.removeItem(`detailHistory:${this.id}`); }

    copyShareLink() {
        const url = window.location.href;
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(url);
            this.toast('success', 'Bağlantı kopyalandı', url);
        } else {
            const a = document.createElement('textarea');
            a.value = url; document.body.appendChild(a);
            a.select(); document.execCommand('copy'); document.body.removeChild(a);
            this.toast('success', 'Bağlantı kopyalandı', url);
        }
    }
    exportJson() {
        const data = {
            id: this.id,
            filename: this.doc?.filename,
            uploadedAt: this.doc?.uploadedAt,
            category: this.cat,
            tags: [...this.tagsArr],
            summary: this.summary
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `${this.doc?.filename || 'document'}.json`; a.click(); URL.revokeObjectURL(a.href);
    }
    copyTags() {
        const str = this.joinTags(this.tagsArr);
        if (!str) { this.toast('info', 'Kopyalanacak etiket yok'); return; }
        navigator.clipboard?.writeText(str);
        this.toast('success', 'Etiketler kopyalandı', str);
    }
    copy(text: string) { navigator.clipboard?.writeText(text); this.toast('info', 'Kopyalandı', text); }

    @HostListener('document:keydown.control.s', ['$event'])
    onSaveShortcut(ev: KeyboardEvent) { ev.preventDefault(); if (!this.savingAll) this.saveAll(); }
    @HostListener('document:keydown.shift./', ['$event'])
    onHelp(ev: KeyboardEvent) { ev.preventDefault(); this.helpOpen = true; }
    @HostListener('window:beforeunload', ['$event'])
    onBeforeUnload(event: BeforeUnloadEvent) {
        if (this.isDirty) { event.preventDefault(); event.returnValue = ''; }
    }

    private toast(sev: 'success' | 'info' | 'warn' | 'error', sum?: string, det?: string) {
        this.msg.add({ severity: sev, summary: sum, detail: det, life: 2600 });
    }

    private audioCache: Record<string, HTMLAudioElement | null> = {};
    private getFx(name: 'send' | 'receive' | 'open' | 'error' | 'save'): HTMLAudioElement {
        if (this.audioCache[name]) return this.audioCache[name]!;
        const data = this.fxData[name];
        const a = new Audio(`data:audio/wav;base64,${data}`);
        const vol: Record<string, number> = {
            send: 0.95, receive: 0.95, open: 0.9, error: 1.0, save: 1.0
        };
        a.volume = vol[name] ?? 0.9;
        this.audioCache[name] = a;
        return a;
    }
    playFx(name: 'send' | 'receive' | 'open' | 'error' | 'save') {
        if (this.fxMuted) return;
        try { const a = this.getFx(name); a.currentTime = 0; a.play(); } catch { /* sessiz */ }
    }
    saveFxPref() { localStorage.setItem('fxMuted', this.fxMuted ? '1' : '0'); }

    private fxData = {
        send: "UklGRkQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQwAAAAAAAB/f39/f39/f3///wAAgICAf39/fwAAgICAf39/fwAA",
        receive: "UklGRlYAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YRIAAAAAAACAgP8AAP//AACAgP8AAAD/AP8A/wD/AP8A",
        open: "UklGRlIAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YRAAAAAAAP8A/wAAAP8A/wD/AP8A/wAA",
        error: "UklGRlQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YRIAAAAAAP8AAAAA/wAAAAD/AAAAAP8A",
        save: "UklGRl8AAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YRIAAAAAAICAAAD/AP8A//8AAP8A//8AAP8A"
    } as const;

    helpOpen = false;

    // —— Chat bölümü —— //
    private scrollChatToBottom() {
        setTimeout(() => {
            const el = this.floatChatLog?.nativeElement;
            if (el) el.scrollTop = el.scrollHeight;
        });
    }
    private persistChat() {
        localStorage.setItem(`chatSession:${this.id}`, this.chatSessionId || '');
        localStorage.setItem(`chatMessages:${this.id}`, JSON.stringify(this.chatMessages || []));
    }
    private restoreChatIfAny() {
        const sid = localStorage.getItem(`chatSession:${this.id}`);
        const msgsJson = localStorage.getItem(`chatMessages:${this.id}`);
        if (sid) this.chatSessionId = sid;
        if (msgsJson) {
            try { this.chatMessages = JSON.parse(msgsJson) || []; } catch { this.chatMessages = []; }
        }
        if (this.chatSessionId && !msgsJson) {
            this.chatBusy = true;
            this.api.chatMessages(this.chatSessionId).subscribe({
                next: (msgs: any[]) => {
                    this.chatMessages = (msgs || []).map(m => ({
                        role: (m.role === 'system' ? 'assistant' : m.role) as 'user' | 'assistant',
                        content: m.content,
                        createdAt: m.createdAt
                    }));
                    this.chatBusy = false;
                    this.persistChat();
                    this.scrollChatToBottom();
                },
                error: _ => { this.chatBusy = false; }
            });
        }
    }
    toggleChat() {
        this.chatOpen = !this.chatOpen;
        if (this.chatOpen) {
            this.playFx('open');
            if (!this.chatSessionId) this.startChat();
            this.scrollChatToBottom();
        }
    }
    startChat() {
        if (!this.id) return;
        this.chatBusy = true;
        this.api.startChat(this.id).subscribe({
            next: (res) => {
                this.chatSessionId = res.session_id;
                this.chatMessages = [];
                this.chatBusy = false;
                this.persistChat();
                this.scrollChatToBottom();
            },
            error: _ => { this.chatBusy = false; this.toast('error', 'Sohbet başlatılamadı'); this.playFx('error'); }
        });
    }
    sendChat() {
        const text = (this.chatInput || '').trim();
        if (!text || !this.chatSessionId) return;

        const userMsg: ChatMsg = { role: 'user', content: text };
        this.chatMessages = [...this.chatMessages, userMsg];
        this.chatInput = '';
        this.chatBusy = true;
        this.persistChat();
        this.scrollChatToBottom();
        this.playFx('send');

        this.api.chatAsk(this.chatSessionId, text).subscribe({
            next: (res) => {
                const ai: ChatMsg = { role: 'assistant', content: res.answer };
                this.chatMessages = [...this.chatMessages, ai];
                this.chatBusy = false;
                this.persistChat();
                this.scrollChatToBottom();
                this.playFx('receive');
            },
            error: _ => { this.chatBusy = false; this.toast('error', 'Yanıt alınamadı'); this.playFx('error'); }
        });
    }
    resetChat() {
        if (this.chatSessionId) {
            localStorage.removeItem(`chatSession:${this.id}`);
            localStorage.removeItem(`chatMessages:${this.id}`);
        }
        this.chatSessionId = '';
        this.chatMessages = [];
        this.chatInput = '';
        this.playFx('open');
    }
}
