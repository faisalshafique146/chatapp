import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideChatRealtimeConfig } from '../core/realtime/chat-realtime.config';
import { authInterceptor } from '../core/services/auth.interceptor';
import { BACKEND_BASE_URL } from '../core/config/backend.config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes),
    provideChatRealtimeConfig({
      enabled: true,
      url: BACKEND_BASE_URL
    })
  ]
};
