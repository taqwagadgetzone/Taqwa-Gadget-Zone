// হোম স্ক্রিনে ইনস্টল করার জন্য সার্ভিস ওয়ার্কার। কোনো ক্যাশ নেই — সবসময় নেটওয়ার্ক থেকে নেয়,
// যাতে নতুন ডিপ্লয় সঙ্গে সঙ্গে দেখা যায় এবং পুরোনো ফাইল আটকে না থাকে।
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
