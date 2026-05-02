/** Khi user mở hòm thư (/mail hoặc modal thư) — menu ẩn badge cho đến khi có thư mới (unread tăng). */
export const MAIL_INBOX_VIEWED_EVENT = 'petaria:mail-inbox-viewed';

export function dispatchMailInboxViewed() {
  window.dispatchEvent(new Event(MAIL_INBOX_VIEWED_EVENT));
}

/** Sau claim / đọc thư — refresh badge (cùng tên với mail poll). */
export const MAIL_UNREAD_REFRESH_EVENT = 'petaria:mail-unread-refresh';

export function dispatchMailUnreadRefresh() {
  window.dispatchEvent(new Event(MAIL_UNREAD_REFRESH_EVENT));
}
