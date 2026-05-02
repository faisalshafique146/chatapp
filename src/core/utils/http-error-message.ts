import { HttpErrorResponse } from '@angular/common/http';

function extractServerMessage(payload: unknown): string | null {
  if (!payload) {
    return null;
  }

  if (typeof payload === 'string') {
    return payload.trim() || null;
  }

  if (typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;

    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }
  }

  return null;
}

export function getHttpErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
  }

  const serverMessage = extractServerMessage(error.error);

  if (serverMessage) {
    return serverMessage;
  }

  if (error.status === 0) {
    return typeof navigator !== 'undefined' && navigator.onLine
      ? 'Cannot reach the server. Please make sure the backend is running and try again.'
      : 'You appear to be offline. Check your connection and try again.';
  }

  switch (error.status) {
    case 400:
      return 'The request could not be processed. Please check your input and try again.';
    case 401:
      return 'Your session is not valid anymore. Please sign in again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'We could not find the requested data.';
    case 409:
      return 'That already exists. Please use a different value.';
    case 413:
      return 'The file is too large. Please choose a smaller file.';
    case 422:
      return 'Some fields need attention. Please review the form and try again.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    case 500:
      return 'The server had a problem processing your request. Please try again later.';
    default:
      return error.message || fallback;
  }
}
