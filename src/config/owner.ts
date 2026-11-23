// দোকানের মালিকের ইমেইল। শুধু এই অ্যাকাউন্টই হিসাব দেখতে ও বদলাতে পারবে।
// এই মান বদলালে firestore.rules-এর ইমেইলও একই রাখতে হবে।
export const OWNER_EMAIL = 'taqwagadgetzone@gmail.com';

export const isOwnerEmail = (email?: string | null) =>
  (email || '').trim().toLowerCase() === OWNER_EMAIL;
