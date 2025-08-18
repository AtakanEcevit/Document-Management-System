// src/app/pages/detail/detail.page.ts
import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

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
import { firstValueFrom } from 'rxjs';

@Component({
    standalone: true,
    selector: 'app-detail',
    imports: [
        CommonModule, FormsModule,
        SplitterModule, AutoCompleteModule, DropdownModule,
        InputTextModule, InputTextareaModule,
        ButtonModule, ToastModule, SkeletonModule,
        DialogModule, ListboxModule, ProgressBarModule, SidebarModule,
        CardModule, TooltipModule, SpeedDialModule, TagModule, ConfirmDialogModule,
        TabViewModule, SliderModule, ChipModule
    ],
    providers: [MessageService, ConfirmationService],
    styles: [`
    .header {
      display:flex; align-items:center; gap:.75rem; padding:.75rem;
      border:1px solid rgba(255,255,255,.08); border-radius:.9rem;
      background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
      box-shadow: 0 6px 18px rgba(0,0,0,.2), 0 12px 32px rgba(0,0,0,.18);
      position: sticky; top: 0; z-index: 6; backdrop-filter: blur(8px);
    }
    .hdr-title { font-weight:800; display:flex; align-items:center; gap:.5rem; min-width:0; }
    .hdr-title .name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .meta { opacity:.8; }
    .grow { flex: 1 1 auto; }
    .panel-pad { padding: .75rem; height: 100%; box-sizing: border-box; }
    .field { display:grid; gap:.4rem; margin-bottom:.9rem; }
    .label { opacity:.85; font-size:.94rem; }
    .cardish{
      background: rgba(255,255,255,.02);
      border: 1px solid rgba(255,255,255,.08);
      border-radius: .9rem;
      box-shadow: 0 1px 2px rgba(0,0,0,.25), 0 10px 20px rgba(0,0,0,.15);
      transition: box-shadow .2s ease, transform .08s ease, border-color .2s ease;
    }
    .cardish:hover{ box-shadow: 0 6px 18px rgba(0,0,0,.25), 0 12px 32px rgba(0,0,0,.25); }
    .btns { display:flex; flex-wrap:wrap; gap:.5rem; align-items:center; }
    .small { font-size:.9rem; }
    .grid-auto-fit{ display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; }
    .chip-trend { cursor:pointer; }
    .chip-trend:hover{ transform: translateY(-1px); }
    .splitter-controls { display:flex; gap:.4rem; align-items:center; }
    .statusbar {
      display:flex; align-items:center; gap:.75rem; padding:.35rem .6rem; margin-top:.5rem;
      border:1px dashed rgba(255,255,255,.08); border-radius:.6rem; font-size:.9rem;
    }
    .tabpad { padding-top:.25rem; }
  `],
    template: `
    <p-toast></p-toast>
    <p-confirmDialog></p-confirmDialog>

    <!-- Header -->
    <div class="header" [attr.aria-busy]="savingAll">
      <i class="pi pi-file-pdf" style="font-size:1.25rem;"></i>
      <div class="hdr-title">
        <span class="name">{{ doc?.filename || 'Belge' }}</span>
        <p-tag [severity]="isDirty ? 'warning' : 'success'" [value]="isDirty ? 'Kayıtsız' : 'Kaydedildi'" rounded></p-tag>
        <p-tag *ngIf="!online" severity="danger" value="Çevrimdışı" rounded class="small"></p-tag>
      </div>
      <span class="meta small">Yüklendi: {{ doc?.uploadedAt }}</span>
      <span class="grow"></span>

      <div class="splitter-controls small meta">
        <button pButton icon="pi pi-chevron-left" class="p-button-text p-button-sm" pTooltip="Sol paneli gizle/göster" (click)="toggleLeft()"></button>
        <button pButton icon="pi pi-chevron-right" class="p-button-text p-button-sm" pTooltip="Sağ paneli gizle/göster" (click)="toggleRight()"></button>
        <button pButton icon="pi pi-window-maximize" class="p-button-text p-button-sm" pTooltip="Panel boyutlarını sıfırla" (click)="resetPanels()"></button>
        <button pButton [outlined]="!zenMode" icon="pi pi-eye" label="Zen" class="p-button-sm" (click)="toggleZen()" pTooltip="PDF'e odaklan (Zen)"></button>
      </div>

      <!-- TEK KAYDET -->
      <button pButton label="Kaydet" icon="pi pi-check"
              class="p-button-sm p-button-success" (click)="saveAll()"
              [disabled]="savingAll || !isDirty" pTooltip="Ctrl+S"></button>
    </div>

    <!-- 3-Pane -->
    <p-splitter
      styleClass="p-mt-3"
      [gutterSize]="8"
      [panelSizes]="panelSizes"
      [minSizes]="[16,40,20]"
      (onResizeEnd)="saveSplitter($event)"
      [style]="{height: 'calc(100vh - 250px)'}">

      <!-- Sol -->
      <ng-template pTemplate>
        <div class="panel-pad cardish" [style.display]="leftHidden ? 'none' : 'block'">
          <h3 style="margin-top:.25rem;">Belge Bilgileri</h3>
          <div class="field">
            <div class="label">Belge ID</div>
            <div style="display:flex; gap:.5rem;">
              <input pInputText [value]="id" readonly aria-label="Belge ID">
              <button pButton class="p-button-text p-button-sm" icon="pi pi-copy" (click)="copy(id)" pTooltip="ID'yi kopyala"></button>
            </div>
          </div>
          <div class="field">
            <div class="label">Dosya Adı</div>
            <input pInputText [value]="doc?.filename" readonly aria-label="Dosya adı">
          </div>
          <div class="field">
            <div class="label">Yüklenme</div>
            <input pInputText [value]="doc?.uploadedAt" readonly aria-label="Yüklenme tarihi">
          </div>

          <div class="statusbar">
            <span class="meta small">Son kayıt: {{lastSavedAt || '—'}}</span>
            <span *ngIf="savingAll" class="small">• Kaydediliyor…</span>
            <span class="grow"></span>
            <span class="small meta" *ngIf="isDirty">Değişiklikler kaydedilmedi.</span>
          </div>
        </div>
      </ng-template>

      <!-- Orta: PDF -->
      <ng-template pTemplate>
        <div class="panel-pad cardish">
          <ng-container *ngIf="!loading; else pdfLoading">
            <iframe [src]="pdfSafeUrl" style="width:100%; height:100%; border:0; border-radius:.6rem;" title="Belge önizleme"></iframe>
          </ng-container>
          <ng-template #pdfLoading>
            <p-skeleton height="100%" borderRadius="12px"></p-skeleton>
          </ng-template>
        </div>
      </ng-template>

      <!-- Sağ: Tabs -->
      <ng-template pTemplate>
        <div class="panel-pad cardish" [style.display]="rightHidden ? 'none' : 'block'">
          <p-tabView>
            <!-- Etiketler -->
            <p-tabPanel header="Etiketler">
              <div class="tabpad">
                <div class="field">
                  <div class="label">Etiketler</div>
                  <p-autoComplete
                    [(ngModel)]="tagsArr"
                    (ngModelChange)="onDirty()"
                    [suggestions]="tagSuggestions"
                    (completeMethod)="searchTagSuggestions($event)"
                    [multiple]="true"
                    [dropdown]="true"
                    [virtualScroll]="true"
                    [forceSelection]="false"
                    placeholder="etiket ekle"
                    [style]="{width: '100%'}"
                    inputAriaLabel="Etiketleri düzenle">
                  </p-autoComplete>
                  <div *ngIf="trendTags.length" class="meta small" style="margin-top:.35rem;">Trend:</div>
                  <div *ngIf="trendTags.length" style="display:flex; gap:.35rem; flex-wrap:wrap; margin-top:.25rem;">
                    <p-chip *ngFor="let t of trendTags" class="chip-trend" [label]="t" (click)="addTag(t)"></p-chip>
                  </div>
                </div>

                <!-- Tag Şablonları -->
                <div class="field">
                  <div class="label">Tag Şablonları</div>
                  <div style="display:flex; gap:.5rem; align-items:center; flex-wrap:wrap;">
                    <input pInputText [(ngModel)]="tplName" placeholder="ör. Sözleşme paketi" style="flex:1 1 auto;" (keyup.enter)="saveTagTemplate()">
                    <button pButton label="Kaydet" icon="pi pi-save" class="p-button-sm" (click)="saveTagTemplate()"></button>
                  </div>
                  <div *ngIf="tagTemplates.length" style="display:flex; flex-wrap:wrap; gap:.35rem; margin-top:.5rem;">
                    <p-chip *ngFor="let tpl of tagTemplates; let i = index"
                            [label]="tpl.name"
                            (click)="applyTagTemplate(i)"
                            removable
                            (onRemove)="deleteTagTemplate(i)"></p-chip>
                  </div>
                </div>
              </div>
            </p-tabPanel>

            <!-- Özet -->
            <p-tabPanel header="Özet">
              <div class="tabpad">
                <div class="field">
                  <div class="label">Hedef uzunluk: {{targetWords}} kelime</div>
                  <p-slider [(ngModel)]="targetWords" [min]="60" [max]="240" [step]="5" (onChange)="onSummaryMetrics()"></p-slider>
                </div>

                <div class="field">
                  <div class="label">Özet</div>
                  <textarea pInputTextarea rows="12" [(ngModel)]="summary" (ngModelChange)="onDirty(); onSummaryMetrics()"
                            placeholder="Belgenin özlü bir özeti…" aria-label="Belge özeti"></textarea>
                  <div class="meta" style="display:flex; gap:.5rem; align-items:center; flex-wrap:wrap;">
                    <span>Kelime: {{summaryWords}}</span>
                    <p-progressBar [value]="summaryScore" [showValue]="false" style="flex:1"></p-progressBar>
                    <span [style.color]="summaryColor">{{summaryHint}}</span>
                    <button pButton class="p-button-text p-button-sm" icon="pi pi-minus-circle" label="Kısalt" (click)="smartShorten()"></button>
                    <button pButton class="p-button-text p-button-sm" icon="pi pi-plus-circle" label="Genişlet" (click)="smartExpand()"></button>
                    <button pButton class="p-button-text p-button-sm" icon="pi pi-times" label="Temizle" (click)="summary=''; onSummaryMetrics(); onDirty()"></button>
                  </div>
                </div>
              </div>
            </p-tabPanel>

            <!-- Özellikler -->
            <p-tabPanel header="Özellikler">
              <div class="tabpad">
                <div class="field">
                  <div class="label">Kategori</div>
                  <p-dropdown
                    [options]="categoryOptions"
                    [(ngModel)]="cat"
                    (ngModelChange)="onDirty()"
                    [filter]="true"
                    [editable]="true"
                    placeholder="ör. Finans, İK, Sözleşme"
                    optionLabel="label"
                    optionValue="value"
                    [showClear]="true"
                    ariaLabel="Kategori seç">
                  </p-dropdown>
                </div>

                <div class="field">
                  <div class="label">Önizleme</div>
                  <a pButton icon="pi pi-eye" label="Önizleme" class="p-button-sm" [href]="previewUrl" target="_blank"></a>
                </div>

                <div class="statusbar">
                  <span class="meta small">Son kayıt: {{lastSavedAt || '—'}}</span>
                  <span *ngIf="savingAll" class="small">• Kaydediliyor…</span>
                  <span class="grow"></span>
                  <span class="small meta" *ngIf="isDirty">Değişiklikler kaydedilmedi.</span>
                </div>
              </div>
            </p-tabPanel>
          </p-tabView>
        </div>
      </ng-template>
    </p-splitter>

    <!-- Speed-Dial -->
    <p-speedDial [model]="dialItems" direction="up" type="quarter-circle" [style]="{position:'fixed', right:'16px', bottom:'16px'}"></p-speedDial>

    <!-- Komut Paleti (Ctrl+K) -->
    <p-dialog [(visible)]="paletteOpen" [modal]="true" [draggable]="false" [resizable]="false"
              [style]="{width:'520px'}" header="Komut Paleti (Ctrl+K)">
      <div class="p-input-icon-left" style="margin-bottom:.5rem;">
        <i class="pi pi-search"></i>
        <input pInputText type="text" [(ngModel)]="paletteQuery" placeholder="Komut ara..." (input)="filterCommands()" aria-label="Komut ara">
      </div>
      <p-listbox [options]="filteredCommands" [(ngModel)]="selectedCommand"
                 [style]="{maxHeight:'320px'}" (onChange)="runCommand(selectedCommand)"
                 optionLabel="label"></p-listbox>
    </p-dialog>

    <!-- Yardım / Kısayollar -->
    <p-dialog [(visible)]="helpOpen" [modal]="true" [style]="{width:'560px'}" header="Kısayollar ve İpuçları">
      <ul class="small">
        <li><b>Ctrl+S</b>: Kaydet</li>
        <li><b>Ctrl+K</b>: Komut paleti</li>
        <li><b>?</b>: Bu yardım</li>
        <li><b>Zen</b>: PDF'e odaklan (Sol/Sağ paneller gizlenir)</li>
        <li><b>Sol/Sağ panel</b>: üst bardaki oklar ile gizle/göster</li>
        <li>Özet hedefi: {{targetWords}} kelime. 80–120 arası önerilir.</li>
      </ul>
    </p-dialog>

    <!-- Yerel Geçmiş -->
    <p-dialog [(visible)]="historyOpen" [modal]="true" [style]="{width:'560px'}" header="Yerel Değişiklik Geçmişi">
      <div *ngIf="!history.length" class="meta">Henüz bir kayıt yok.</div>
      <ul *ngIf="history.length" class="small">
        <li *ngFor="let h of history">{{h.when}} — {{h.msg}}</li>
      </ul>
      <div class="btns" style="justify-content:flex-end;">
        <button pButton class="p-button-text" icon="pi pi-trash" label="Geçmişi temizle" (click)="clearHistory()"></button>
      </div>
    </p-dialog>

    <!-- Benzer Dokümanlar -->
    <p-sidebar [(visible)]="similarOpen" position="right" [baseZIndex]="10000" [style]="{width:'420px'}">
      <h3>Benzer Dokümanlar</h3>
      <div *ngIf="similarLoading">
        <p-skeleton height="2rem" class="p-mb-2"></p-skeleton>
        <p-skeleton height="2rem" class="p-mb-2"></p-skeleton>
        <p-skeleton height="2rem" class="p-mb-2"></p-skeleton>
      </div>
      <div *ngIf="!similarLoading && !similar?.length" class="meta">Bulunamadı.</div>
      <div *ngIf="!similarLoading && similar?.length" class="grid-auto-fit">
        <div *ngFor="let s of similar" class="cardish" style="padding:.75rem;">
          <div style="font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" [title]="s.filename">
            {{s.filename}}
          </div>
          <div class="meta">{{s.uploadedAt}} • {{s.category || '—'}}</div>
          <div class="meta">Benzerlik: {{(s._sim || 0) | number:'1.0-2'}}</div>
          <div style="margin-top:.5rem; display:flex; gap:.5rem;">
            <button pButton label="Aç" class="p-button-sm" (click)="openDoc(s.id)"></button>
            <a pButton label="İndir" class="p-button-sm p-button-outlined" [href]="api.downloadUrl(s.id)"
               [attr.download]="s.filename"></a>
          </div>
        </div>
      </div>
    </p-sidebar>
  `
})
export class DetailPage implements OnInit {
    // ---- Router & Doc ----
    id!: string;
    doc?: DocInfo;

    // ---- URLs & viewer ----
    pdfUrl = '';
    previewUrl = '';
    downloadUrl = '';
    pdfSafeUrl!: SafeResourceUrl;

    // ---- Etiket & kategori ----
    tagsArr: string[] = [];
    tagSuggestions: string[] = [];
    trendTags: string[] = [];
    categoryOptions: { label: string; value: string }[] = [];
    cat = '';

    // ---- Özet & kalite metrikleri ----
    summary = '';
    summaryWords = 0;
    summaryScore = 0;
    summaryHint = '';
    summaryColor = '#9ca3af';
    targetWords = 100;

    // ---- UI durumları ----
    lastSavedAt = '';
    loading = true;
    savingAll = false;
    reanalyzing = false;
    isDirty = false;
    zenMode = false;

    // ---- Online/Offline ----
    online = navigator.onLine;

    // ---- Komut Paleti ----
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

    // ---- Benzer dokümanlar paneli ----
    similarOpen = false;
    similarLoading = false;
    similar: Array<DocInfo & { _sim?: number }> = [];

    // ---- Splitter durumları ----
    panelSizes: number[] = JSON.parse(localStorage.getItem('detailSplitter') || '[20,55,25]');
    leftHidden = false;
    rightHidden = false;

    // ---- SpeedDial ----
    dialItems: MenuItem[] = [
        { icon: 'pi pi-refresh', tooltipOptions: { tooltipLabel: 'Yeniden Analiz' }, command: () => this.confirmReAnalyze() },
        { icon: 'pi pi-compass', tooltipOptions: { tooltipLabel: 'Benzerler' }, command: () => this.toggleSimilarPanel(true) },
        { icon: 'pi pi-download', tooltipOptions: { tooltipLabel: 'PDF İndir' }, command: () => window.open(this.downloadUrl, '_blank') },
        { icon: 'pi pi-link', tooltipOptions: { tooltipLabel: 'Paylaş' }, command: () => this.copyShareLink() },
    ];

    // ---- Tag Templates ----
    tplName = '';
    tagTemplates: { name: string; tags: string[] }[] = [];

    // ---- Yerel Geçmiş ----
    historyOpen = false;
    history: { when: string; msg: string }[] = [];
    private lastSnapshot: { tagsJson: string; cat: string; summary: string } = { tagsJson: '[]', cat: '', summary: '' };

    constructor(
        private route: ActivatedRoute,
        public api: ApiService,
        private san: DomSanitizer,
        private msg: MessageService,
        private confirm: ConfirmationService
    ) { }

    ngOnInit(): void {
        this.id = this.route.snapshot.paramMap.get('id')
            || this.route.snapshot.paramMap.get('hash') // geçiş desteği
            || '';
        this.pdfUrl = this.api.inlineUrl(this.id);
        this.previewUrl = this.api.previewUrl(this.id);
        this.downloadUrl = this.api.downloadUrl(this.id);
        this.pdfSafeUrl = this.san.bypassSecurityTrustResourceUrl(this.pdfUrl);

        // Belgeyi yükle
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
            }
        });

        // Kategori seçenekleri
        this.api.suggestCategories('', 100).subscribe({
            next: (arr: string[]) => this.categoryOptions = (arr || []).map(v => ({ label: v, value: v })),
            error: () => { }
        });

        // Trend etiketler
        this.api.suggestKeywords('', 12).subscribe({
            next: (arr: string[]) => this.trendTags = (arr || []).slice(0, 10),
            error: () => { }
        });

        // Tag şablonları & geçmiş
        this.loadTagTemplates();
        this.loadHistory();

        // Online/Offline
        window.addEventListener('online', () => { this.online = true; this.toast('info', 'Bağlantı geri geldi'); });
        window.addEventListener('offline', () => { this.online = false; this.toast('warn', 'Çevrimdışı'); });
    }

    // ----- Etiket / kategori yardımcıları -----
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

    // ----- Dirty & Kaydet -----
    onDirty() { this.isDirty = true; }

    async saveAll() {
        if (!this.id) return;
        const nextSnap = { tagsJson: JSON.stringify(this.tagsArr), cat: this.cat ?? '', summary: this.summary ?? '' };
        const prev = this.lastSnapshot;
        const patch: any = {};
        if (prev.tagsJson !== nextSnap.tagsJson) patch.tags = this.tagsArr;
        if (prev.cat !== nextSnap.cat) patch.category = this.cat || null;
        if (prev.summary !== nextSnap.summary) patch.summary = this.summary || null;

        if (!Object.keys(patch).length) { this.toast('info', 'Değişiklik yok'); this.isDirty = false; return; }

        this.savingAll = true;
        try {
            await firstValueFrom(this.api.patchDocument(this.id, patch));
            this.lastSavedAt = new Date().toLocaleString();
            this.isDirty = false;
            this.lastSnapshot = nextSnap;
            const msg = Object.keys(patch).map(k => k === 'tags' ? 'Etiketler' : k === 'category' ? 'Kategori' : 'Özet').join(', ') + ' güncellendi.';
            this.toast('success', 'Kaydedildi', msg);
            this.pushHistory(msg);
        } catch {
            this.toast('error', 'Kayıt sırasında hata', 'Bazı alanlar kaydedilemedi.');
        } finally {
            this.savingAll = false;
        }
    }

    // ----- Yeniden analiz -----
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
            next: () => { this.reanalyzing = false; this.toast('success', 'Yeniden analiz başlatıldı', 'Sonuçlar hazır olunca sayfayı yenileyin.'); },
            error: () => { this.reanalyzing = false; this.toast('error', 'Yeniden analiz başarısız', 'Daha sonra tekrar deneyin.'); }
        });
    }

    // ----- Özet kalite ölçer + akıllı düzenleme -----
    onSummaryMetrics() {
        const words = (this.summary || '').trim().split(/\s+/).filter(Boolean).length;
        this.summaryWords = words;

        const min = this.targetWords - 20;
        const max = this.targetWords + 20;
        let score = 0, hint = '';
        if (words === 0) { score = 0; hint = 'Özet boş'; this.summaryColor = '#ef4444'; }
        else if (words < min) { score = Math.round((words / min) * 70); hint = 'Kısa'; this.summaryColor = '#f59e0b'; }
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

    // ----- Komut Paleti (Ctrl+K) -----
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
        if (id === 'download') window.open(this.downloadUrl, '_blank');
        if (id === 'openPreview') window.open(this.previewUrl, '_blank');
        if (id === 'similar') this.toggleSimilarPanel(true);
        if (id === 'shorten') { this.smartShorten(); }
        if (id === 'expand') { this.smartExpand(); }
        if (id === 'copyTags') { this.copyTags(); }
        if (id === 'share') { this.copyShareLink(); }
    }

    // ----- Benzer dokümanlar paneli -----
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

    // ----- Splitter & Zen -----
    saveSplitter(ev: any) {
        if (ev?.sizes?.length === 3) {
            this.panelSizes = ev.sizes;
            localStorage.setItem('detailSplitter', JSON.stringify(this.panelSizes));
        }
    }
    toggleLeft() {
        this.leftHidden = !this.leftHidden;
        this.panelSizes = this.leftHidden ? [0, 75, 25] : JSON.parse(localStorage.getItem('detailSplitter') || '[20,55,25]');
    }
    toggleRight() {
        this.rightHidden = !this.rightHidden;
        this.panelSizes = this.rightHidden ? [25, 75, 0] : JSON.parse(localStorage.getItem('detailSplitter') || '[20,55,25]');
    }
    resetPanels() {
        this.leftHidden = this.rightHidden = false;
        this.panelSizes = [20, 55, 25];
        localStorage.setItem('detailSplitter', JSON.stringify(this.panelSizes));
    }
    toggleZen() {
        this.zenMode = !this.zenMode;
        if (this.zenMode) { this.leftHidden = true; this.rightHidden = true; this.panelSizes = [0, 100, 0]; }
        else { this.resetPanels(); }
    }

    // ----- Tag Template yönetimi -----
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

    // ----- Yerel geçmiş -----
    snapshot() { this.lastSnapshot = { tagsJson: JSON.stringify(this.tagsArr), cat: this.cat ?? '', summary: this.summary ?? '' }; }
    loadHistory() {
        try { this.history = JSON.parse(localStorage.getItem(`detailHistory:${this.id}`) || '[]'); } catch { this.history = []; }
    }
    pushHistory(msg: string) {
        if (!msg) return;
        const entry = { when: new Date().toLocaleString(), msg };
        this.history.unshift(entry);
        this.history = this.history.slice(0, 50);
        localStorage.setItem(`detailHistory:${this.id}`, JSON.stringify(this.history));
    }
    clearHistory() { this.history = []; localStorage.removeItem(`detailHistory:${this.id}`); }

    // ----- Paylaş / Export / Kopyala -----
    copyShareLink() { const url = window.location.href; navigator.clipboard?.writeText(url); this.toast('success', 'Bağlantı kopyalandı', url); }
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
    copyTags() { const str = this.joinTags(this.tagsArr); navigator.clipboard?.writeText(str); this.toast('success', 'Etiketler kopyalandı', str); }
    copy(text: string) { navigator.clipboard?.writeText(text); this.toast('info', 'Kopyalandı', text); }

    // ----- Kısayollar -----
    @HostListener('document:keydown.control.s', ['$event'])
    onSaveShortcut(ev: KeyboardEvent) { ev.preventDefault(); if (!this.savingAll) this.saveAll(); }

    @HostListener('document:keydown.shift./', ['$event'])
    onHelp(ev: KeyboardEvent) { ev.preventDefault(); this.helpOpen = true; }

    // Sayfadan ayrılma uyarısı (kirli ise)
    @HostListener('window:beforeunload', ['$event'])
    onBeforeUnload(event: BeforeUnloadEvent) {
        if (this.isDirty) { event.preventDefault(); event.returnValue = ''; }
    }

    // ----- Toast helper -----
    private toast(sev: 'success' | 'info' | 'warn' | 'error', sum?: string, det?: string) {
        this.msg.add({ severity: sev, summary: sum, detail: det, life: 2600 });
    }

    // ---- Yardım / UI bayrakları ----
    helpOpen = false;
}
