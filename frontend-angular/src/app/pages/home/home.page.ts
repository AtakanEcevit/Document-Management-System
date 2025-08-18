// src/app/pages/home/home.page.ts
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
import { MessageService, ConfirmationService } from 'primeng/api';

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
        SidebarModule, ConfirmDialogModule
    ],
    providers: [MessageService, ConfirmationService],
    styles: [`
    :host { display:block; }
    .wrap { display:grid; gap:1rem; }
    .row { display:grid; gap:1rem; grid-template-columns: 1fr; }
    @media (min-width: 1100px){
      .row { grid-template-columns: 1fr 420px; align-items:start; }
    }

    .cardish{
      border-radius: .9rem;
      border: 1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.02);
      box-shadow: 0 1px 2px rgba(0,0,0,.25), 0 10px 20px rgba(0,0,0,.15);
      transition: transform .08s ease, box-shadow .2s ease, border-color .2s ease;
    }
    .cardish:hover{ box-shadow: 0 6px 18px rgba(0,0,0,.25), 0 12px 32px rgba(0,0,0,.25); }
    .pad { padding: .9rem; }

    .dropzone{
      border: 2px dashed rgba(255,255,255,.18);
      border-radius: .9rem;
      padding: 2rem;
      text-align:center;
      transition: background .15s ease, border-color .15s ease;
      background: rgba(255,255,255,.02);
    }
    .dropzone.dragover{
      background: rgba(56,189,248,.08);
      border-color: rgba(56,189,248,.6);
    }
    .meta { opacity:.75; }
    .btns { display:flex; gap:.5rem; flex-wrap:wrap; align-items:center; }
    .grid-auto-fit{ display:grid; grid-template-columns: repeat(auto-fit, minmax(260px,1fr)); gap:.75rem; }

    .queue-item{
      display:grid; gap:.35rem;
      padding:.75rem; border-radius:.7rem;
      border:1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.02);
    }
    .title-line{ display:flex; gap:.5rem; align-items:center; min-width:0; }
    .name{ font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .grow{ flex:1 1 auto; }
    .actions{ display:flex; gap:.35rem; flex-wrap:wrap; }
    .statusbar{ display:flex; align-items:center; gap:.5rem; }
    .small{ font-size:.9rem; }

    .sidebar-section{ display:grid; gap:.5rem; }
    .pill{ padding:.25rem .5rem; border-radius:999px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.02); }
  `],
    template: `
    <p-toast></p-toast>
    <p-confirmDialog></p-confirmDialog>

    <div class="wrap">
      <!-- Upload & Queue -->
      <div class="row">
        <div class="cardish pad">
          <div style="display:flex; align-items:center; gap:.75rem; justify-content:space-between;">
            <div style="display:flex; align-items:center; gap:.5rem;">
              <i class="pi pi-upload" style="font-size:1.2rem;"></i>
              <div>
                <div style="font-weight:800;">Belgeleri Yükle</div>
                <div class="meta small">PDF sürükle-bırak yap veya dosya seç.</div>
              </div>
            </div>
            <div class="btns">
              <label class="p-button p-component" for="fileInput">
                <i class="pi pi-file-import p-button-icon p-button-icon-left"></i>
                <span class="p-button-label">Dosya Seç</span>
              </label>
              <input #fileInput id="fileInput" type="file" multiple accept=".pdf,application/pdf" (change)="onFileInput($event)" style="display:none" />
              <button pButton class="p-button-secondary" icon="pi pi-play" label="Tümünü Başlat" (click)="startAll()" [disabled]="!hasQueued()"></button>
              <button pButton class="p-button-text" icon="pi pi-times" label="Sırayı Temizle" (click)="clearQueue()" [disabled]="!canClear()"></button>
              <button pButton class="p-button-text" icon="pi pi-cog" label="Ayarlar" (click)="settingsOpen = true"></button>
            </div>
          </div>

          <div class="dropzone" [class.dragover]="dragOver"
               (dragover)="onDragOver($event)" (dragleave)="onDragLeave($event)" (drop)="onDrop($event)">
            <div style="font-size:1.1rem; font-weight:700;">PDF'leri buraya bırak</div>
            <div class="meta">Maks {{maxSizeMB}} MB / dosya • Sadece PDF</div>
          </div>

          <!-- Toplam ilerleme -->
          <div class="statusbar" style="margin-top:.75rem;" *ngIf="queue.length">
            <p-tag [value]="queue.length + ' dosya'"></p-tag>
            <span class="small meta">Tamamlanan: {{doneCount}} • Hatalı: {{errorCount}}</span>
            <span class="grow"></span>
            <p-progressBar [value]="totalProgress" [showValue]="false" style="min-width:160px;"></p-progressBar>
            <span class="small">{{totalProgress | number:'1.0-0'}}%</span>
          </div>

          <!-- Kuyruk listesi -->
          <div class="grid-auto-fit" style="margin-top:.75rem;" *ngIf="queue.length; else empty">
            <div class="queue-item" *ngFor="let it of queue">
              <div class="title-line">
                <p-tag [severity]="severity(it.status)" [value]="statusText(it.status)"></p-tag>
                <div class="name" [title]="it.name">{{it.name}}</div>
                <span class="meta small">{{(it.size/1024/1024) | number:'1.2-2'}} MB</span>
              </div>
              <p-progressBar [value]="it.progress" [showValue]="false"></p-progressBar>
              <div class="statusbar small">
                <span class="meta">{{it.progress | number:'1.0-0'}}%</span>
                <span class="meta">•</span>
                <span class="meta">{{it.loaded | number}} / {{it.total | number}} bayt</span>
                <span class="grow"></span>
                <div class="actions">
                  <button pButton class="p-button-text p-button-sm" icon="pi pi-play" *ngIf="it.status==='queued' || it.status==='error'" (click)="start(it)" pTooltip="Yüklemeyi başlat"></button>
                  <button pButton class="p-button-text p-button-sm" icon="pi pi-undo" *ngIf="it.status==='error'" (click)="retry(it)" pTooltip="Tekrar dene"></button>
                  <button pButton class="p-button-text p-button-sm" icon="pi pi-times" *ngIf="it.status==='queued' || it.status==='error' || it.status==='canceled'" (click)="remove(it)" pTooltip="Kuyruktan kaldır"></button>
                  <button pButton class="p-button-text p-button-sm" icon="pi pi-ban" *ngIf="it.status==='uploading'" (click)="cancel(it)" pTooltip="İptal et"></button>
                  <button pButton class="p-button-text p-button-sm" icon="pi pi-external-link" *ngIf="it.status==='done' && it.hash" (click)="openDetail(it.hash)" pTooltip="Detay"></button>
                </div>
              </div>
              <div class="small" *ngIf="it.error" style="color:#f87171;">Hata: {{it.error}}</div>
            </div>
          </div>
          <ng-template #empty>
            <div class="meta small" style="text-align:center; padding:.75rem;">Henüz kuyrukta dosya yok.</div>
          </ng-template>
        </div>

        <!-- Sağ Panel: İpuçları & Son yüklenenler -->
        <div class="cardish pad">
          <div style="font-weight:800; margin-bottom:.25rem;">Hızlı İpuçları</div>
          <ul class="small">
            <li><b>U</b> tuşu ile dosya seçici açılır.</li>
            <li>Yükleme bittiğinde <b>otomatik detaya geç</b> seçeneği ile hızlan.</li>
            <li>Hata olursa <b>tekrar dene</b> ve dosya adında özel karakter kullanmamaya dikkat et.</li>
          </ul>

          <div style="margin-top:.75rem; font-weight:800;">Son Yüklenenler</div>
          <div class="sidebar-section" *ngIf="recent?.length; else norecent">
            <div class="queue-item" *ngFor="let d of recent | slice:0:6">
              <div style="display:flex; align-items:center; gap:.5rem;">
                <i class="pi pi-file-pdf"></i>
                <div class="name" [title]="d.filename">{{d.filename}}</div>
              </div>
              <div class="small meta">{{d.uploadedAt}} • {{d.category || '—'}}</div>
              <div class="actions">
                <button pButton class="p-button-text p-button-sm" icon="pi pi-eye" label="Detay" (click)="openDetail(d.id)"></button>
                <a pButton class="p-button-text p-button-sm" icon="pi pi-download" label="İndir" [href]="api.downloadUrl(d.id)" [attr.download]="d.filename"></a>
              </div>
            </div>
          </div>
          <ng-template #norecent><div class="meta small">Henüz yüklenmiş belge yok.</div></ng-template>
        </div>
      </div>
    </div>

    <!-- Ayarlar -->
    <p-dialog [(visible)]="settingsOpen" [modal]="true" [style]="{width:'520px'}" header="Yükleme Ayarları">
      <div class="sidebar-section">
        <div class="pill">
          <p-checkbox [(ngModel)]="autoStart" [binary]="true" inputId="autoStart" (ngModelChange)="persistSettings()"></p-checkbox>
          <label for="autoStart" style="margin-left:.35rem;">Dosyalar eklendiğinde otomatik başlat</label>
        </div>
        <div class="pill">
          <p-checkbox [(ngModel)]="autoOpenDetail" [binary]="true" inputId="autoOpen" (ngModelChange)="persistSettings()"></p-checkbox>
          <label for="autoOpen" style="margin-left:.35rem;">Yükleme bitince detaya git</label>
        </div>
        <div class="pill">
          <label for="maxSize">Maks dosya boyutu (MB)</label>
          <input pInputText id="maxSize" type="number" [(ngModel)]="maxSizeMB" (ngModelChange)="persistSettings()" style="width:120px; margin-left:.5rem;">
        </div>
      </div>
      <div class="btns" style="justify-content:flex-end; margin-top:.75rem;">
        <button pButton class="p-button-text" label="Varsayılanlara dön" (click)="resetSettings()"></button>
        <button pButton label="Kapat" (click)="settingsOpen=false"></button>
      </div>
    </p-dialog>
  `
})
export class HomePage implements OnInit {
    @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

    dragOver = false;
    queue: UploadItem[] = [];
    recent: DocInfo[] = [];

    // Settings (tek tip: 50MB)
    autoStart = JSON.parse(localStorage.getItem('homeAutoStart') || 'true');
    autoOpenDetail = JSON.parse(localStorage.getItem('homeAutoOpen') || 'true');
    maxSizeMB = Number(localStorage.getItem('homeMaxSizeMB') || 50);

    // Totals
    totalProgress = 0;
    doneCount = 0;
    errorCount = 0;

    constructor(
        public api: ApiService,
        private http: HttpClient,
        private router: Router,
        private msg: MessageService,
        private confirm: ConfirmationService
    ) { }

    ngOnInit(): void {
        // Son yüklenenler: BE sıralasın
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

    // --- Upload sadece /api/v1/files (ApiService.uploadUrl), progress ile
    start(it: UploadItem) {
        const uploadUrl = this.api.uploadUrl(); // tek kaynak
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
                        // Contract: 'id' (geçiş için 'file_hash' fallback)
                        it.hash = body?.id ?? body?.file_hash ?? undefined;
                        it.progress = 100; it.loaded = it.total;
                        this.computeTotals();
                        this.toast('success', 'Yüklendi', it.name);
                        // Recent listesini tazele
                        this.api.listDocuments({ sort: 'date_desc', limit: 50 }).subscribe(({ items }) => this.recent = items || []);
                        if (this.autoOpenDetail && it.hash) this.openDetail(it.hash);
                    }
                },
                error: (err: HttpErrorResponse) => {
                    if (it.status === 'canceled') return; // cancel handled separately
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

    // ---- Totals
    private computeTotals() {
        const totalBytes = this.queue.reduce((a, b) => a + (b.total || b.size || 0), 0);
        const loadedBytes = this.queue.reduce((a, b) => a + (b.loaded || 0), 0);
        this.totalProgress = totalBytes ? Math.round(100 * loadedBytes / totalBytes) : 0;
        this.doneCount = this.queue.filter(q => q.status === 'done').length;
        this.errorCount = this.queue.filter(q => q.status === 'error').length;
    }

    // ---- Helpers
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
