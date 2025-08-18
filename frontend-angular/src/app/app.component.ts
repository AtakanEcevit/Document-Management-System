import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ScrollTopModule } from 'primeng/scrolltop';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet, RouterLink, RouterLinkActive, ButtonModule, ScrollTopModule],
    styles: [`
    .brand { font-weight: 800; letter-spacing: .3px; }
    .header-inner { display:flex; align-items:center; gap: .75rem; }
    .header-gap { flex: 1 1 auto; }
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
      <span class="header-gap"></span>
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
