import { publicAccount } from './security.mjs';

// Sync — A receipt revalidates identity; clients then reload authorized current data.
// It carries no learner answers, file references, credentials or offline-demo imports.
export function syncReceipt(account, now) {
  return { protocol: 'academy-sync-v1', server_time: now,
    account: publicAccount(account), scope: 'authorized-current-data' };
}
