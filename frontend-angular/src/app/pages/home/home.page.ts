import { Component, OnInit, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpClientModule, HttpEvent, HttpEventType, HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { ApiService, DocInfo } from '../../services/api.service';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { CheckboxModule } from 'primeng/checkbox';
import { ToastModule } from 'primeng/toast';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { ChipModule } from 'primeng/chip';
import { SidebarModule } from 'primeng/sidebar';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { SpeedDialModule } from 'primeng/speeddial';
import { MessageService, ConfirmationService, MenuItem } from 'primeng/api';

type UploadStatus = 'queued' | 'uploading' | 'done' | 'error' | 'canceled';

type UploadItem = {
    id: string;
    file: File;
    name: string;
    size: number;
    type: string;
    status: UploadStatus;
    progress: number;          // 0-100
    loaded: number;            // bytes
    total: number;             // bytes
    error?: string;
    hash?: string;             // server returned id
    sub?: Subscription;        // active request subscription for cancel
};

@Component({
    standalone: true,
    selector: 'app-home',
    imports: [
        CommonModule, FormsModule, HttpClientModule,
        CardModule, ButtonModule, InputTextModule, CheckboxModule, ToastModule,
        ProgressBarModule, TagModule, TooltipModule, DialogModule, TableModule, ChipModule,
        SidebarModule, ConfirmDialogModule, SpeedDialModule
    ],
    providers: [MessageService, ConfirmationService],
    styleUrl: './home.page.css',
    templateUrl: './home.page.html'
})
export class HomePage implements OnInit {
    @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

    dragOver = false;
    queue: UploadItem[] = [];
    recent: DocInfo[] = [];

    // Settings
    autoStart = JSON.parse(localStorage.getItem('homeAutoStart') || 'true');
    autoOpenDetail = JSON.parse(localStorage.getItem('homeAutoOpen') || 'true');
    maxSizeMB = Number(localStorage.getItem('homeMaxSizeMB') || 50);

    // Totals
    totalProgress = 0;
    doneCount = 0;
    errorCount = 0;

    // FAB actions
    dialItems: MenuItem[] = [
        { icon: 'pi pi-file-import', tooltipOptions: { tooltipLabel: 'Dosya seç' }, command: () => this.fileInput?.nativeElement?.click() },
        { icon: 'pi pi-play', tooltipOptions: { tooltipLabel: 'Tümünü başlat' }, command: () => this.startAll(), disabled: !this.hasQueued() },
        { icon: 'pi pi-times', tooltipOptions: { tooltipLabel: 'Sırayı temizle' }, command: () => this.clearQueue(), disabled: !this.canClear() },
        { icon: 'pi pi-folder-open', tooltipOptions: { tooltipLabel: 'Kütüphane' }, command: () => this.router.navigate(['/']) }
    ];

    constructor(
        public api: ApiService,
        private http: HttpClient,
        private router: Router,
        private msg: MessageService,
        private confirm: ConfirmationService
    ) { }

    ngOnInit(): void {
        this.api.listDocuments({ sort: 'date_desc', limit: 50 }).subscribe(({ items }) => {
            this.recent = items || [];
        });
    }

    // ---- DnD ----
    onDragOver(ev: DragEvent) { ev.preventDefault(); this.dragOver = true; }
    onDragLeave(_ev: DragEvent) { this.dragOver = false; }
    onDrop(ev: DragEvent) {
        ev.preventDefault();
        this.dragOver = false;
        const files = Array.from(ev.dataTransfer?.files || []);
        this.queueFiles(files);
    }

    // ---- Paste upload (Ctrl/Cmd+V) ----
    @HostListener('document:paste', ['$event'])
    onPaste(ev: ClipboardEvent) {
        const items = Array.from(ev.clipboardData?.items || []);
        const files: File[] = [];
        for (const it of items) {
            if (it.kind === 'file') {
                const f = it.getAsFile();
                if (f) files.push(f);
            }
        }
        if (files.length) this.queueFiles(files);
    }

    // ---- File input ----
    onFileInput(ev: Event) {
        const input = ev.target as HTMLInputElement;
        const files = Array.from(input.files || []);
        if (!files.length) return;
        this.queueFiles(files);
        input.value = ''; // reset
    }

    // ---- Queue mgmt ----
    queueFiles(files: File[]) {
        const max = this.maxSizeMB * 1024 * 1024;
        const accepted = files.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
        const rejected = files.filter(f => !accepted.includes(f) || f.size > max);

        for (const f of accepted) {
            if (f.size > max) { rejected.push(f); continue; }
            const it: UploadItem = {
                id: Math.random().toString(36).slice(2),
                file: f, name: f.name, size: f.size, type: f.type || 'application/pdf',
                status: 'queued', progress: 0, loaded: 0, total: f.size
            };
            this.queue.push(it);
        }
        if (rejected.length) this.toast('warn', 'Bazı dosyalar alınmadı', `${rejected.length} dosya kriterlere uymuyor (PDF olmalı ve ${this.maxSizeMB}MB'dan küçük).`);

        if (this.autoStart) this.startAll();
        this.computeTotals();
    }

    hasQueued() { return this.queue.some(q => q.status === 'queued' || q.status === 'error'); }
    canClear() { return this.queue.length > 0 && !this.queue.some(q => q.status === 'uploading'); }

    startAll() {
        for (const it of this.queue) if (it.status === 'queued' || it.status === 'error') this.start(it);
    }

    // --- Upload /api/v1/files
    start(it: UploadItem) {
        const uploadUrl = this.api.uploadUrl();
        const fd = new FormData(); fd.append('file', it.file, it.name);

        it.status = 'uploading';
        it.progress = 0; it.loaded = 0; it.total = it.size; it.error = undefined;

        const sub = this.http.post(uploadUrl, fd, { reportProgress: true, observe: 'events' })
            .subscribe({
                next: (event: HttpEvent<any>) => {
                    if (event.type === HttpEventType.UploadProgress) {
                        const total = event.total || it.total || it.size;
                        it.loaded = event.loaded || 0;
                        it.total = total;
                        it.progress = Math.round(100 * it.loaded / Math.max(1, total));
                        this.computeTotals();
                    } else if (event.type === HttpEventType.Response) {
                        it.status = 'done';
                        const body: any = event.body || {};
                        it.hash = body?.id ?? body?.file_hash ?? undefined;
                        it.progress = 100; it.loaded = it.total;
                        this.computeTotals();
                        this.toast('success', 'Yüklendi', it.name);
                        // Recent yeniden çek
                        this.api.listDocuments({ sort: 'date_desc', limit: 50 }).subscribe(({ items }) => this.recent = items || []);
                        if (this.autoOpenDetail && it.hash) this.openDetail(it.hash);
                    }
                },
                error: (err: HttpErrorResponse) => {
                    if (it.status === 'canceled') return;
                    it.status = 'error';
                    it.error = (err?.error && (err.error.detail || err.error.title)) || err.message || 'Yükleme sırasında hata';
                    this.computeTotals();
                    this.toast('error', 'Hata', `${it.name}: ${it.error}`);
                }
            });
        it.sub = sub;
    }

    cancel(it: UploadItem) {
        if (it.sub) { it.sub.unsubscribe(); }
        it.status = 'canceled'; it.error = undefined;
        this.computeTotals();
    }
    remove(it: UploadItem) {
        if (it.sub) it.sub.unsubscribe();
        this.queue = this.queue.filter(x => x.id !== it.id);
        this.computeTotals();
    }
    retry(it: UploadItem) {
        it.status = 'queued'; it.error = undefined; it.progress = 0; it.loaded = 0;
        this.start(it);
    }

    clearQueue() {
        if (this.queue.some(q => q.status === 'uploading')) return;
        this.queue = [];
        this.computeTotals();
    }

    // ---- Totals & computed
    private computeTotals() {
        const totalBytes = this.queue.reduce((a, b) => a + (b.total || b.size || 0), 0);
        const loadedBytes = this.queue.reduce((a, b) => a + (b.loaded || 0), 0);
        this.totalProgress = totalBytes ? Math.round(100 * loadedBytes / totalBytes) : 0;
        this.doneCount = this.queue.filter(q => q.status === 'done').length;
        this.errorCount = this.queue.filter(q => q.status === 'error').length;
    }
    get queuedCount() { return this.queue.filter(q => q.status === 'queued').length; }
    get uploadingCount() { return this.queue.filter(q => q.status === 'uploading').length; }

    // ---- Helpers
    trackById(_i: number, it: UploadItem) { return it.id; }
    formatSize(n: number | undefined) {
        if (!n && n !== 0) return '0 B';
        const kb = 1024, mb = kb * 1024, gb = mb * 1024;
        if (n >= gb) return (n / gb).toFixed(2) + ' GB';
        if (n >= mb) return (n / mb).toFixed(2) + ' MB';
        if (n >= kb) return (n / kb).toFixed(1) + ' KB';
        return n + ' B';
    }
    severity(st: UploadStatus) {
        return st === 'done' ? 'success' : st === 'uploading' ? 'info' : st === 'error' ? 'danger' : st === 'canceled' ? 'warn' : 'secondary';
    }
    statusText(st: UploadStatus) {
        return st === 'done' ? 'Tamamlandı' : st === 'uploading' ? 'Yükleniyor' : st === 'error' ? 'Hata' : st === 'canceled' ? 'İptal' : 'Bekliyor';
    }
    openDetail(id?: string) { if (!id) return; this.router.navigate(['/documents', id]); }

    // ---- Settings
    resetSettings() {
        this.autoStart = true; this.autoOpenDetail = true; this.maxSizeMB = 50;
        this.persistSettings();
    }
    persistSettings() {
        localStorage.setItem('homeAutoStart', JSON.stringify(this.autoStart));
        localStorage.setItem('homeAutoOpen', JSON.stringify(this.autoOpenDetail));
        localStorage.setItem('homeMaxSizeMB', String(this.maxSizeMB));
    }

    // Shortcuts
    @HostListener('document:keydown.u', ['$event'])
    onU(ev: KeyboardEvent) { ev.preventDefault(); this.fileInput?.nativeElement?.click(); }

    @HostListener('window:beforeunload', ['$event'])
    onBeforeUnload(event: BeforeUnloadEvent) {
        if (this.queue.some(q => q.status === 'uploading')) {
            event.preventDefault();
            event.returnValue = '';
        }
    }

    settingsOpen = false;

    // Toast helper
    private toast(sev: 'success' | 'info' | 'warn' | 'error', sum?: string, det?: string) {
        this.msg.add({ severity: sev, summary: sum, detail: det, life: 2600 });
    }
}
