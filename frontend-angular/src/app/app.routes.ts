import { Routes } from '@angular/router';

export const routes: Routes = [
    { path: '', loadComponent: () => import('./pages/library/library.page').then(m => m.LibraryPage) },
    { path: 'home', loadComponent: () => import('./pages/home/home.page').then(m => m.HomePage) },

    // Yeni kaynak-temelli alias
    { path: 'documents/:id', loadComponent: () => import('./pages/detail/detail.page').then(m => m.DetailPage) },

    // Geçiş için eski yol da aynı componente gitsin
    { path: 'detail/:hash', loadComponent: () => import('./pages/detail/detail.page').then(m => m.DetailPage) },

    { path: 'semantic', loadComponent: () => import('./pages/semantic/semantic.page').then(m => m.SemanticPage) },
    { path: '**', redirectTo: '' }
];