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
  styles: [`
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
      color-scheme: dark;
    }
    .detail-bg{
      background:
        radial-gradient(1200px 600px at 10% -10%, rgba(130,103,255,.08), transparent 60%),
        radial-gradient(900px 520px at 110% 10%, rgba(47,159,255,.07), transparent 50%),
        var(--surface-0);
      position:relative; min-height: 100dvh; display:block;
      padding:.5rem;
    }
    .detail-bg::before{
      content:''; position:fixed; inset:-20vh; pointer-events:none; z-index:-1;
      background-image: url("data:image/svg+xml;utf8,\
      <svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'>\
      <filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.6' numOctaves='2' stitchTiles='stitch'/></filter>\
      <rect width='120' height='120' filter='url(%23n)' opacity='0.012'/></svg>");
      background-size: 240px 240px;
    }
    .header {
      position: sticky; top: 0; z-index: 6; backdrop-filter: blur(8px);
      display:flex; align-items:center; gap:.75rem; padding:.75rem;
      border:1px solid var(--border); border-radius:.9rem;
      background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
      box-shadow: 0 6px 18px rgba(0,0,0,.2), 0 12px 32px rgba(0,0,0,.18);
      flex-wrap: wrap;
    }
    .header .saving-stripe{
      position:absolute; left:0; right:0; bottom:-2px; height:2px;
      background: linear-gradient(90deg, var(--brand), var(--accent));
      border-radius:2px; opacity:.95;
      box-shadow: 0 0 18px color-mix(in hsl, var(--brand), white 15%);
    }
    .hdr-title { font-weight:800; display:flex; align-items:center; gap:.5rem; min-width:0; }
    .hdr-title .name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width: 40vw; }
    .meta { opacity:.8; }
    .grow { flex: 1 1 auto; }

    .quick-stats{ display:flex; gap:.35rem; margin-right:.5rem; flex-wrap:wrap; }
    .pill{
      display:inline-flex; align-items:center; gap:.35rem; padding:.2rem .55rem;
      border-radius:999px; font-weight:600; color:#dfe9f7; opacity:.9;
      background: linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.04));
      border:1px solid var(--border);
    }
    @media (max-width: 1100px){
      .quick-stats{ display:none; }
      .header .meta.small{ display:none; }
    }

    .panel-pad { flex: 1 1 auto; min-height: 0; height: auto; padding: .75rem; box-sizing: border-box; }
    .field { display:grid; gap:.4rem; margin-bottom:.9rem; }
    .label { opacity:.85; font-size:.94rem; }
    .cardish{
      background: linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02));
      border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--elev-1);
      transition: box-shadow .2s ease, transform .08s ease, border-color .2s ease;
      animation: pop .18s ease;
    }
    .cardish:hover{ box-shadow: 0 6px 18px rgba(0,0,0,.25), 0 12px 32px rgba(0,0,0,.25); }
    .btns { display:flex; flex-wrap:wrap; gap:.5rem; align-items:center; }
    .small { font-size:.9rem; }
    .grid-auto-fit{ display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; }
    .splitter-controls { display:flex; gap:.4rem; align-items:center; flex-wrap: wrap; }

    .statusbar {
      display:flex; align-items:center; gap:.75rem; padding:.35rem .6rem; margin-top:.5rem;
      border:1px dashed var(--border); border-radius:.6rem; font-size:.9rem;
    }

    *::-webkit-scrollbar{ width:10px; height:10px;}
    *::-webkit-scrollbar-thumb{
      background: linear-gradient(180deg, rgba(255,255,255,.18), rgba(255,255,255,.08));
      border: 2px solid transparent; border-radius: 999px; background-clip: padding-box;
    }
    *::-webkit-scrollbar-track{ background: transparent;}

    :host ::ng-deep .p-splitter-panel { min-width: 0; min-height: 0; display:flex; }
    :host ::ng-deep .p-splitter-gutter{ background: transparent; }
    :host ::ng-deep .p-splitter-gutter-handle{
      width: 6px; border-radius: 999px;
      background: linear-gradient(180deg, rgba(255,255,255,.16), rgba(255,255,255,.06));
      transition: transform .15s ease, background .2s ease;
    }
    :host ::ng-deep .p-splitter-gutter:hover .p-splitter-gutter-handle{
      transform: scaleX(1.2); background: color-mix(in hsl, var(--brand), white 10%);
    }

    .right-pane { display: flex; flex-direction: column; min-height: 0; }
    :host ::ng-deep .right-pane .p-tabview { height: 100%; display:flex; flex-direction: column; min-height: 0; }
    :host ::ng-deep .right-pane .p-tabview-panels {
      flex: 1 1 auto; min-height: 0; overflow: hidden; padding-right: .25rem;
      background:
        radial-gradient(60% 40% at 60% 0%, rgba(255,255,255,.03), transparent 60%),
        linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,.01));
      border-radius: .6rem;
    }

    :host ::ng-deep .p-tabview-panel{ min-height:0; }
    :host ::ng-deep .p-tabview-panel[hidden]{ display:none !important; }
    :host ::ng-deep .p-tabview-panel:not([hidden]){
      height:100% !important; display:flex !important; flex-direction:column; min-height:0;
    }

    .tab-scroll{ flex:1 1 auto; min-height:0; overflow:auto; }

    :host ::ng-deep .p-tabview-nav li.p-highlight .p-tabview-nav-link{
      color: #fff; font-weight: 700;
      background: linear-gradient(180deg, color-mix(in hsl, var(--brand), #000 10%), transparent);
      border-bottom: 2px solid var(--brand);
      position:relative;
    }
    :host ::ng-deep .p-tabview-nav li.p-highlight .p-tabview-nav-link::after{
      content:''; position:absolute; left:10%; right:10%; bottom:-2px; height:2px;
      background: linear-gradient(90deg, var(--brand), var(--accent));
      box-shadow:0 0 14px color-mix(in hsl, var(--brand), white 25%);
      border-radius:2px;
    }

    .center-pane{
      display:flex; flex: 1 1 auto; min-height:0; align-items:stretch; justify-content:stretch;
      background:
        radial-gradient(40% 50% at 60% 0%, rgba(255,255,255,.04), transparent 60%),
        linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.01));
    }

    .pdf-frame{ width:100%; height:100%; border:0; border-radius:.6rem; flex: 1 1 auto; }

    .viewer-toolbar{
      position:absolute; right: 1rem; bottom: 1rem; z-index: 5;
      display:flex; align-items:center; gap:.4rem;
      padding:.35rem; border-radius: 999px;
      background: rgba(10,14,20,.55); backdrop-filter: blur(8px);
      border:1px solid var(--border); box-shadow: var(--elev-2);
    }
    .viewer-toolbar .btn{
      display:inline-flex; align-items:center; justify-content:center;
      width:34px; height:34px; border-radius: 999px;
      background: linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.06));
      border:1px solid var(--border); cursor:pointer;
      transition: transform .06s ease, background .2s ease;
    }
    .viewer-toolbar .btn:hover{ transform: translateY(-1px); }
    .viewer-toolbar .badge{
      padding:.15rem .5rem; border-radius:999px; font-size:.85rem;
      background: rgba(255,255,255,.06); border:1px solid var(--border);
    }

    .chat-fab-wrap{ position: fixed; right: 18px; bottom: 18px; z-index: 50; display:flex; align-items:center; gap:12px; }
    .chat-fab{
      position: relative; width: 56px; height: 56px; border-radius: 999px;
      display:flex; align-items:center; justify-content:center;
      background: linear-gradient(180deg, color-mix(in hsl, var(--brand), #000 8%), color-mix(in hsl, var(--brand), #000 20%));
      border: 1px solid var(--border); box-shadow: 0 16px 48px rgba(0,0,0,.45);
      cursor:pointer; transition: transform .08s ease;
    }
    .chat-fab:hover{ transform: translateY(-1px); }
    .chat-fab i{ font-size: 1.25rem; color: #eef2ff; }
    .fab-attn{ animation: wiggle 2.6s ease-in-out 2; }
    @keyframes wiggle{ 0%,100%{ transform: translateY(0) } 6%{ transform: translateY(-2px) } 12%{ transform: translateY(0) } 18%{ transform: translateY(-1px) } 24%{ transform: translateY(0) } }
    .fab-ping{ position:absolute; inset:0; border-radius:999px; border: 2px solid var(--accent); animation: fabPing 1.6s ease-out infinite; pointer-events:none; }
    @keyframes fabPing{ 0%{ transform: scale(1); opacity:.6; } 80%{ transform: scale(1.6); opacity:0; } 100%{ transform: scale(1.8); opacity:0; } }
    .fab-coach{
      position: relative; padding:.45rem .6rem; border-radius:10px; font-weight:700;
      background: linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.06));
      border:1px solid var(--border); box-shadow: 0 10px 28px rgba(0,0,0,.4); color:#eef2ff; user-select:none; animation: coachIn .18s ease-out;
    }
    .fab-coach::after{ content:''; position:absolute; right:-8px; top:50%; transform: translateY(-50%); width:0; height:0; border-left: 8px solid rgba(255,255,255,.10); border-top: 8px solid transparent; border-bottom: 8px solid transparent; filter: drop-shadow(0 0 0 var(--border)); }
    @keyframes coachIn{ from{ transform: translateY(4px); opacity:.7 } to{ transform:none; opacity:1 } }

    .chat-float{
      position: fixed; right: 18px; bottom: calc(18px + 56px + 12px); z-index: 40;
      width: 380px; max-width: calc(100vw - 32px);
      height: 480px; max-height: calc(100vh - 140px);
      display:flex; flex-direction:column;
      background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03));
      border: 1px solid var(--border); border-radius: 14px;
      box-shadow: 0 22px 60px rgba(0,0,0,.55), 0 8px 26px rgba(0,0,0,.35);
      overflow: hidden;
    }

    .typing { display:inline-flex; gap:.3rem; align-items:center; }
    .typing .dot{ width:6px; height:6px; border-radius:999px; background: #dbeafe; opacity:.9; animation: bounce 1s infinite ease-in-out; }
    .typing .dot:nth-child(2){ animation-delay: .15s;}
    .typing .dot:nth-child(3){ animation-delay: .3s;}
    @keyframes bounce{ 0%, 80%, 100%{ transform: translateY(0); opacity:.6; } 40%{ transform: translateY(-4px); opacity:1; } }

    @keyframes greenPulse { from{ box-shadow:0 0 0 0 rgba(16,185,129,.35);} to{ box-shadow:0 0 0 14px rgba(16,185,129,0);} }
    .p-button.pulse{ animation: greenPulse .8s ease-out 1; }

    @keyframes pop { from{ transform: scale(.98); opacity:.8 } to{ transform: scale(1); opacity:1 } }

    @media (prefers-reduced-motion: reduce){
      *{ animation: none !important; transition: none !important; }
    }
  `],
  template: `
  <div class="detail-bg">
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

      <div class="quick-stats small">
        <span class="pill"><i class="pi pi-file"></i> {{pageCount || '—'}} syf</span>
        <span class="pill" *ngIf="cat"><i class="pi pi-folder"></i> {{cat}}</span>
        <span class="pill"><i class="pi pi-tags"></i> {{tagsArr?.length || 0}}</span>
      </div>

      <div class="splitter-controls small meta">
        <button pButton icon="pi pi-chevron-left" class="p-button-text p-button-sm" pTooltip="Sol paneli gizle/göster" (click)="toggleLeft()"></button>
        <button pButton icon="pi pi-chevron-right" class="p-button-text p-button-sm" pTooltip="Sağ paneli gizle/göster" (click)="toggleRight()"></button>
        <button pButton icon="pi pi-window-maximize" class="p-button-text p-button-sm" pTooltip="Panel boyutlarını sıfırla" (click)="resetPanels()"></button>
        <button pButton [outlined]="!zenMode" icon="pi pi-eye" label="Zen" class="p-button-sm" (click)="toggleZen()" pTooltip="PDF'e odaklan (Zen)"></button>
        <button pButton [outlined]="!dense" icon="pi pi-compress" class="p-button-sm" label="{{dense ? 'Rahat' : 'Sıkışık'}}" (click)="toggleDensity()" pTooltip="Yoğunluk"></button>
      </div>

      <button pButton label="Kaydet" icon="pi pi-check"
              class="p-button-sm p-button-success" (click)="saveAll()"
              [ngClass]="{'pulse': savedPulse}" [disabled]="savingAll || !isDirty"
              pTooltip="Ctrl+S"></button>

      <div *ngIf="savingAll" class="saving-stripe"></div>
    </div>

    <!-- 3-Pane Splitter -->
    <p-splitter
      [gutterSize]="10"
      [panelSizes]="panelSizes"
      [minSizes]="minSizes"
      (onResizeEnd)="saveSplitter($event)"
      [style]="{ height: splitterHeight }">

      <!-- Left -->
      <ng-template pTemplate>
        <div class="panel-pad cardish">
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

      <!-- Center: PDF -->
      <ng-template pTemplate>
        <div class="panel-pad cardish center-pane" style="position:relative;">
          <ng-container *ngIf="!pdfError; else pdfErrorTpl">
            <ng-container *ngIf="pdfBlobUrl; else loadingTpl">
              <object class="pdf-frame" [data]="pdfBlobUrl" type="application/pdf">
                <iframe class="pdf-frame" [src]="pdfBlobUrl" style="border:0;"></iframe>
              </object>
            </ng-container>
          </ng-container>

          <ng-template #loadingTpl>
            <div class="meta" style="padding:.5rem;">PDF yükleniyor…</div>
          </ng-template>

          <ng-template #pdfErrorTpl>
            <div class="meta" style="padding:.5rem;">
              PDF görüntülenemedi. <a [href]="previewUrl" target="_blank">Tarayıcıda aç</a>.
            </div>
          </ng-template>

          <div class="viewer-toolbar">
            <button class="btn" pTooltip="Yenile" (click)="reloadPdf()"><i class="pi pi-refresh"></i></button>
            <button class="btn" pTooltip="Tarayıcıda aç" (click)="openInNewTab()"><i class="pi pi-external-link"></i></button>
            <button class="btn" pTooltip="İndir" (click)="downloadPdf()"><i class="pi pi-download"></i></button>
          </div>
        </div>
      </ng-template>

      <!-- Right: Tabs -->
      <ng-template pTemplate>
        <div class="panel-pad cardish right-pane">
          <p-tabView [(activeIndex)]="tabIndex" (activeIndexChange)="onTabChange($event)">
            <p-tabPanel header="Etiketler">
              <div class="tab-scroll">
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
                    placeholder="etiket ekle (↵ ile ekle, , ile ayır)"
                    [style]="{width: '100%'}"
                    inputAriaLabel="Etiketleri düzenle">
                  </p-autoComplete>
                  <div *ngIf="trendTags.length" class="meta small" style="margin-top:.35rem;">Trend:</div>
                  <div *ngIf="trendTags.length" style="display:flex; gap:.35rem; flex-wrap:wrap; margin-top:.25rem;">
                    <p-chip *ngFor="let t of trendTags" class="chip-trend" [label]="t" (click)="addTag(t)"></p-chip>
                  </div>
                </div>

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

            <p-tabPanel header="Özet">
              <div class="tab-scroll">
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

            <p-tabPanel header="Özellikler">
              <div class="tab-scroll">
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
                  <span class="meta small">Son kayıt: {{lastSavedAt || '—'}} </span>
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

    <p-speedDial [model]="dialItems" direction="up" type="quarter-circle"
                 [style]="{position:'fixed', left:'16px', bottom:'16px', zIndex:35}"></p-speedDial>

    <div class="chat-fab-wrap">
      <div class="fab-coach" *ngIf="fabIntro">Sohbeti deneyin 👋</div>
      <button class="chat-fab" (click)="toggleChat()"
              [ngClass]="{'fab-attn': fabIntro}"
              pTooltip="{{chatOpen ? 'Kapat' : 'Sohbet'}}" tooltipPosition="left" aria-label="Sohbeti aç/kapat">
        <i class="pi" [ngClass]="chatOpen ? 'pi-times' : 'pi-comments'"></i>
        <span class="fab-ping" *ngIf="fabIntro"></span>
      </button>
    </div>

    <div class="chat-float" *ngIf="chatOpen">
      <div class="chat-head">
        <i class="pi pi-sparkles"></i>
        <div class="title">Belge Sohbeti</div>
        <span class="grow"></span>
        <button class="iconbtn" (click)="fxMuted = !fxMuted; saveFxPref()" pTooltip="{{fxMuted ? 'Sesi Aç' : 'Sesi Kapat'}}">
          <i class="pi" [ngClass]="fxMuted ? 'pi-volume-off' : 'pi-volume-up'"></i>
        </button>
        <button class="iconbtn" (click)="resetChat()" pTooltip="Yeni Sohbet">
          <i class="pi pi-refresh"></i>
        </button>
        <button class="iconbtn" (click)="toggleChat()" pTooltip="Kapat">
          <i class="pi pi-times"></i>
        </button>
      </div>

      <div class="chat-body" #floatChatLog>
        <div *ngIf="!chatSessionId" class="meta" style="margin-bottom:.5rem;">
          Bu belgeyle sohbet etmek için bir oturum başlatın.
          <button pButton label="Yeni Sohbet" icon="pi pi-comments" class="p-button-sm" (click)="startChat()" [disabled]="chatBusy"></button>
        </div>

        <ng-container *ngIf="chatSessionId">
          <div *ngFor="let m of chatMessages" style="display:flex;">
            <div class="bubble" [ngClass]="m.role==='user' ? 'bubble-user enter-right' : 'bubble-ai enter-left'">
              <div>{{m.content}}</div>
              <div class="meta small" *ngIf="m.createdAt">{{m.createdAt}}</div>
            </div>
          </div>
          <div *ngIf="chatBusy" class="bubble bubble-ai typing enter-left">
            <span class="dot"></span><span class="dot"></span><span class="dot"></span>
          </div>
        </ng-container>
      </div>

      <div class="chat-input">
        <textarea pInputTextarea [(ngModel)]="chatInput" rows="2" placeholder="Sorunu yaz…"
                  [disabled]="!chatSessionId || chatBusy" style="flex:1"></textarea>
        <button pButton label="Gönder" icon="pi pi-send"
                (click)="sendChat()" [disabled]="!chatSessionId || chatBusy || !chatInput.trim()"></button>
      </div>
    </div>
  </div>
  `
})
export class DetailPage implements OnInit, OnDestroy {
  id!: string;
  doc?: DocInfo;

  // —— PDF (Blob + native viewer)
  pdfBlobUrl?: SafeResourceUrl;
  private blobObjectUrl?: string;
  pdfError = false;
  pageCount = 0;

  previewUrl = '';
  downloadUrl = '';

  // Splitter sizing
  splitterHeight = 'calc(100dvh - 160px)';
  minSizes: number[] = [0, 20, 0];

  private savedLeft = +(localStorage.getItem('detailLeft') || '20');
  private savedRight = +(localStorage.getItem('detailRight') || '25');
  panelSizes: number[] = JSON.parse(localStorage.getItem('detailSplitter') || '[20,55,25]');

  leftHidden = false;
  rightHidden = false;
  zenMode = false;

  tabIndex = +(localStorage.getItem('detailTab') || '0');

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

  onTabChange(i: number) {
    this.tabIndex = i;
    localStorage.setItem('detailTab', String(i));
    setTimeout(() => this.pokePdfResize(), 0);
  }

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id')
      || this.route.snapshot.paramMap.get('hash')
      || '';

    this.restoreChatIfAny();

    const baseInline = this.api.inlineUrl(this.id);
    const sep = baseInline.includes('?') ? '&' : '?';
    const inlineUrl = `${baseInline}${sep}v=${Date.now()}`;
    this.previewUrl = `${this.api.previewUrl(this.id)}?v=${Date.now()}`;
    this.downloadUrl = `${this.api.downloadUrl(this.id)}?v=${Date.now()}`;

    this.loadPdfBlob(inlineUrl);

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

    this.applyPanelState();
  }

  ngOnDestroy(): void {
    if (this.blobObjectUrl) URL.revokeObjectURL(this.blobObjectUrl);
  }

  /** Splitter logic */
  private applyPanelState() {
    const left = this.leftHidden ? 0 : this.clamp(this.savedLeft, 0, 40);
    const right = this.rightHidden ? 0 : this.clamp(this.savedRight, 0, 40);
    let middle = 100 - left - right;
    if (middle < 20) {
      const deficit = 20 - middle;
      if (!this.leftHidden && left >= deficit) {
        this.savedLeft = Math.max(0, left - deficit);
      } else if (!this.rightHidden && right >= deficit) {
        this.savedRight = Math.max(0, right - deficit);
      }
      middle = 100 - (this.leftHidden ? 0 : this.savedLeft) - (this.rightHidden ? 0 : this.savedRight);
    }
    this.panelSizes = [
      this.leftHidden ? 0 : this.savedLeft,
      middle,
      this.rightHidden ? 0 : this.savedRight
    ];
    this.minSizes = [0, 20, 0];
    localStorage.setItem('detailSplitter', JSON.stringify(this.panelSizes));
    localStorage.setItem('detailLeft', String(this.savedLeft));
    localStorage.setItem('detailRight', String(this.savedRight));
    setTimeout(() => this.pokePdfResize(), 0);
  }

  private clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }

  saveSplitter(ev: any) {
    if (ev?.sizes?.length === 3) {
      const [l, m, r] = ev.sizes.map((x: number) => Math.round(x));
      if (!this.leftHidden) this.savedLeft = l;
      if (!this.rightHidden) this.savedRight = r;
      this.panelSizes = [l, m, r];
      localStorage.setItem('detailSplitter', JSON.stringify(this.panelSizes));
      localStorage.setItem('detailLeft', String(this.savedLeft));
      localStorage.setItem('detailRight', String(this.savedRight));
      setTimeout(() => this.pokePdfResize(), 0);
    }
  }

  toggleLeft() {
    this.leftHidden = !this.leftHidden;
    if (!this.leftHidden && this.panelSizes[1] < 40) this.savedLeft = 20;
    this.zenMode = this.leftHidden && this.rightHidden;
    this.applyPanelState();
  }

  toggleRight() {
    this.rightHidden = !this.rightHidden;
    if (!this.rightHidden && this.panelSizes[1] < 40) this.savedRight = 25;
    this.zenMode = this.leftHidden && this.rightHidden;
    this.applyPanelState();
  }

  resetPanels() {
    this.leftHidden = false; this.rightHidden = false; this.zenMode = false;
    this.savedLeft = 20; this.savedRight = 25;
    this.applyPanelState();
  }

  toggleZen() {
    this.zenMode = !this.zenMode;
    this.leftHidden = this.zenMode;
    this.rightHidden = this.zenMode;
    this.applyPanelState();
  }

  /** PDF */
  private loadPdfBlob(url: string) {
    this.pdfError = false;
    if (this.blobObjectUrl) { URL.revokeObjectURL(this.blobObjectUrl); this.blobObjectUrl = undefined; }
    this.pdfBlobUrl = undefined;

    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const mime = blob.type || 'application/pdf';
        const pdfBlob = mime.includes('pdf') ? blob : new Blob([blob], { type: 'application/pdf' });
        this.blobObjectUrl = URL.createObjectURL(pdfBlob);
        this.pdfBlobUrl = this.san.bypassSecurityTrustResourceUrl(this.blobObjectUrl);
      },
      error: (err) => {
        console.error('PDF blob error', err);
        this.pdfError = true;
      }
    });
  }

  reloadPdf() {
    const base = this.api.inlineUrl(this.id);
    const sep = base.includes('?') ? '&' : '?';
    const url = `${base}${sep}v=${Date.now()}`;
    this.loadPdfBlob(url);
  }
  openInNewTab() { window.open(this.previewUrl, '_blank'); }
  downloadPdf() { window.open(this.downloadUrl, '_blank'); }

  /** Density toggle (MISSING BEFORE) */
  toggleDensity() {
    this.dense = !this.dense;
    document.body.classList.toggle('compact', this.dense);
    localStorage.setItem('density', this.dense ? 'compact' : 'comfortable');
  }

  /** Tags & templates (load/save helpers that template calls) */
  loadTagTemplates() {
    try { this.tagTemplates = JSON.parse(localStorage.getItem('tagTemplates') || '[]'); }
    catch { this.tagTemplates = []; }
  }
  private saveTagTemplates() {
    localStorage.setItem('tagTemplates', JSON.stringify(this.tagTemplates));
  }
  saveTagTemplate() {
    const name = (this.tplName || '').trim();
    if (!name) return;
    const tags = [...this.tagsArr];
    const idx = this.tagTemplates.findIndex(t => t.name.toLowerCase() === name.toLowerCase());
    if (idx >= 0) this.tagTemplates[idx].tags = tags;
    else this.tagTemplates.push({ name, tags });
    this.saveTagTemplates();
    this.tplName = '';
    this.toast('success', 'Şablon kaydedildi', name);
  }
  applyTagTemplate(i: number) {
    const tpl = this.tagTemplates[i];
    if (!tpl) return;
    const set = new Set(this.tagsArr.map(x => x.toLowerCase()));
    for (const t of tpl.tags) if (!set.has(t.toLowerCase())) this.tagsArr.push(t);
    this.onDirty();
    this.toast('info', 'Şablon uygulandı', tpl.name);
  }
  deleteTagTemplate(i: number) {
    const name = this.tagTemplates[i]?.name || '';
    this.tagTemplates.splice(i, 1);
    this.saveTagTemplates();
    this.toast('warn', 'Şablon silindi', name);
  }

  /** Tag & summary misc */
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

  snapshot() { this.lastSnapshot = { tagsJson: JSON.stringify(this.tagsArr), cat: this.cat ?? '', summary: this.summary ?? '' }; }
  loadHistory() {
    try { this.history = JSON.parse(localStorage.getItem(`detailHistory:${this.id}`) || '[]'); } catch { this.history = []; }
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
    const data = { id: this.id, filename: this.doc?.filename, uploadedAt: this.doc?.uploadedAt, category: this.cat, tags: [...this.tagsArr], summary: this.summary };
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
  onBeforeUnload(event: BeforeUnloadEvent) { if (this.isDirty) { event.preventDefault(); (event as any).returnValue = ''; } }

  private toast(sev: 'success' | 'info' | 'warn' | 'error', sum?: string, det?: string) {
    this.msg.add({ severity: sev, summary: sum, detail: det, life: 2600 });
  }

  private audioCache: Record<string, HTMLAudioElement | null> = {};
  private getFx(name: 'send' | 'receive' | 'open' | 'error' | 'save'): HTMLAudioElement {
    if (this.audioCache[name]) return this.audioCache[name]!;
    const data = this.fxData[name];
    const a = new Audio(`data:audio/wav;base64,${data}`);
    const vol: Record<string, number> = { send: 0.95, receive: 0.95, open: 0.9, error: 1.0, save: 1.0 };
    a.volume = vol[name] ?? 0.9;
    this.audioCache[name] = a;
    return a;
  }
  playFx(name: 'send' | 'receive' | 'open' | 'error' | 'save') {
    if (this.fxMuted) return;
    try { const a = this.getFx(name); a.currentTime = 0; a.play(); } catch {}
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

  /** Chat */
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
    const newMsgs = [...this.chatMessages, userMsg];
    this.chatMessages = newMsgs;
    this.chatInput = '';
    this.chatBusy = true;
    this.persistChat();
    this.scrollChatToBottom();
    this.playFx('send');

    this.api.chatAsk(this.chatSessionId, text).subscribe({
      next: (res) => {
        const ai: ChatMsg = { role: 'assistant', content: res.answer };
        this.chatMessages = [...newMsgs, ai];
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
