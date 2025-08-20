import { Routes } from '@angular/router';

export const routes: Routes = [
    // Giriş: Arşiv (Library)
    {
        path: '',
        loadComponent: () => import('./pages/library/library.page').then(m => m.LibraryPage),
        data: { anim: 'library' }
    },

    // Analiz (yükleme/iş akışı ekranı)
    {
        path: 'home',
        loadComponent: () => import('./pages/home/home.page').then(m => m.HomePage),
        data: { anim: 'home' }
    },

    // Yeni detay rotası
    {
        path: 'documents/:id',
        loadComponent: () => import('./pages/detail/detail.page').then(m => m.DetailPage),
        data: { anim: 'detail' }
    },

    // Geçiş için eski yol da aynı componente gitsin
    {
        path: 'detail/:hash',
        loadComponent: () => import('./pages/detail/detail.page').then(m => m.DetailPage),
        data: { anim: 'detail' }
    },

    // Semantic modülü
    {
        path: 'semantic',
        loadComponent: () => import('./pages/semantic/semantic.page').then(m => m.SemanticPage),
        data: { anim: 'semantic' }
    },

    // Diğer her şey → root
    { path: '**', redirectTo: '' }
];
