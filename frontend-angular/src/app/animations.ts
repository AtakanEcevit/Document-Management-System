// Reusable UI + Route animations (respects reduced motion)
import {
    animate, query, stagger, style, transition, trigger, group
} from '@angular/animations';

const EASE = 'cubic-bezier(.2,.8,.2,1)';

/** -------- Element-level animations -------- */
export const fadeIn = trigger('fadeIn', [
    transition(':enter', [
        style({ opacity: 0, transform: 'translateY(6px)' }),
        animate('220ms ' + EASE, style({ opacity: 1, transform: 'none' }))
    ]),
    transition(':leave', [
        animate('160ms ' + EASE, style({ opacity: 0, transform: 'translateY(6px)' }))
    ])
]);

export const fadeInUp = trigger('fadeInUp', [
    transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px) scale(.98)' }),
        animate('240ms ' + EASE, style({ opacity: 1, transform: 'none' }))
    ]),
    transition(':leave', [
        animate('140ms ' + EASE, style({ opacity: 0, transform: 'translateY(4px) scale(.98)' }))
    ])
]);

export const scaleIn = trigger('scaleIn', [
    transition(':enter', [
        style({ opacity: 0, transform: 'scale(.98)' }),
        animate('180ms ' + EASE, style({ opacity: 1, transform: 'scale(1)' }))
    ]),
    transition(':leave', [
        animate('140ms ' + EASE, style({ opacity: 0, transform: 'scale(.98)' }))
    ])
]);

export const listStagger = trigger('listStagger', [
    transition('* <=> *', [
        query(':enter', [
            style({ opacity: 0, transform: 'translateY(6px) scale(.98)' }),
            stagger(40, animate('260ms ' + EASE, style({ opacity: 1, transform: 'none' })))
        ], { optional: true }),
        query(':leave', [
            stagger(20, animate('140ms ' + EASE, style({ opacity: 0, transform: 'translateY(2px) scale(.98)' })))
        ], { optional: true })
    ])
]);

/** -------- Route-level animations -------- */
export const routeFadeSlide = trigger('routeFadeSlide', [
    transition('* <=> *', [
        query(':enter, :leave', [
            style({ position: 'absolute', top: 0, left: 0, width: '100%' })
        ], { optional: true }),
        group([
            query(':leave', [
                style({ opacity: 1, transform: 'translateY(0) scale(1)' }),
                animate('220ms ' + EASE, style({ opacity: 0, transform: 'translateY(6px) scale(.98)' }))
            ], { optional: true }),
            query(':enter', [
                style({ opacity: 0, transform: 'translateY(-6px) scale(.98)' }),
                animate('260ms ' + EASE, style({ opacity: 1, transform: 'none' }))
            ], { optional: true })
        ])
    ])
]);

export const routeSlideH = trigger('routeSlideH', [
    transition('* <=> *', [
        query(':enter, :leave', [
            style({ position: 'absolute', top: 0, left: 0, width: '100%' })
        ], { optional: true }),
        group([
            query(':leave', [
                style({ opacity: 1, transform: 'translateX(0)' }),
                animate('220ms ' + EASE, style({ opacity: 0, transform: 'translateX(-12px)' }))
            ], { optional: true }),
            query(':enter', [
                style({ opacity: 0, transform: 'translateX(12px)' }),
                animate('280ms ' + EASE, style({ opacity: 1, transform: 'translateX(0)' }))
            ], { optional: true })
        ])
    ])
]);


export const routeSimpleFade = trigger('routeSimpleFade', [
    transition('* <=> *', [
        // sadece gireni fade’le
        query(':enter', [
            style({ opacity: 0 }),
            animate('200ms cubic-bezier(.2,.8,.2,1)', style({ opacity: 1 }))
        ], { optional: true })
    ])
]);