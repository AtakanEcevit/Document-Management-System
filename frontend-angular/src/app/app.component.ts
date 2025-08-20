import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ScrollTopModule } from 'primeng/scrolltop';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet, RouterLink, RouterLinkActive, ButtonModule, ScrollTopModule],
    styles: [`
    .app-header{
      position: sticky; top: 0; z-index: 1000;
      border-bottom: 1px solid rgba(255,255,255,.08);
      background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
      backdrop-filter: blur(8px);
      box-shadow: 0 4px 14px rgba(0,0,0,.18);
    }
    .container{ max-width: 1200px; margin: 0 auto; padding: 0 16px; }
    .header-inner{ display:flex; align-items:center; gap:.75rem; }
    .brand{ font-weight:800; letter-spacing:.3px; user-select:none; }
    .gradient-text{
      background: linear-gradient(90deg,#8ab4ff,#7dd3fc,#86efac);
      -webkit-background-clip:text; background-clip:text; color: transparent;
    }
    .nav{ display:flex; gap:.75rem; }
    .nav a{ text-decoration:none; opacity:.88; padding:.35rem .5rem; border-radius:.5rem; }
    .nav a.active{ background: rgba(255,255,255,.08); opacity:1; }
    .gap{ flex:1 1 auto; }
    main.container{ padding: .75rem 16px; }
  `],
    template: `
    <header class="app-header">
      <div class="container header-inner" style="padding-top:.6rem; padding-bottom:.6rem;">
        <div class="brand gradient-text">Doc Intelligence</div>

        <nav class="nav">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}">Arşiv</a>
          <a routerLink="/home" routerLinkActive="active">Analiz</a>
          <a routerLink="/semantic" routerLinkActive="active">Semantic</a>
        </nav>

        <span class="gap"></span>

        <a pButton label="Geri Bildirim" class="p-button-text"></a>
      </div>
    </header>

    <main class="container">
      <router-outlet></router-outlet>
    </main>

    <p-scrollTop></p-scrollTop>
  `
})
export class AppComponent { }
