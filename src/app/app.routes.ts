import { Routes } from '@angular/router';
import { authGuard, guestGuard } from '../core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'auth/sign-in'
  },
  {
    path: 'auth/sign-in',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('../features/auth/pages/sign-in/sign-in.component').then(
        (module) => module.SignInComponent
      )
  },
  {
    path: 'auth/sign-up',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('../features/auth/pages/sign-up/sign-up.component').then(
        (module) => module.SignUpComponent
      )
  },
  {
    path: 'chat',
    canActivate: [authGuard],
    loadComponent: () =>
      import('../features/chat/components/chat-layout/chat-layout.component').then(
        (module) => module.ChatLayoutComponent
      )
  },
  {
    path: '**',
    redirectTo: 'auth/sign-in'
  }
];
