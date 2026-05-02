/** Event name: Sidebar và các màn hình dùng chung để refresh hiển thị tiền. */
export const CURRENCY_UPDATE_EVENT = 'petaria:currency-update';

export function dispatchCurrencyUpdate() {
  window.dispatchEvent(new Event(CURRENCY_UPDATE_EVENT));
}
