import { EventEmitter } from 'events';

export const notificationEmitter = new EventEmitter();
notificationEmitter.setMaxListeners(300);

export function emitNotification(notification: any) {
  try {
    notificationEmitter.emit('notification', notification);
  } catch (err) {
    console.error('[Events] Error emitting notification:', err);
  }
}
