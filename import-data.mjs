// Firebase Data Import Script
// চালানোর জন্য: node import-data.mjs backup.json

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';

const firebaseConfig = {
  apiKey: "AIzaSyBrv0ozKeYX-yN-Keye3jSeJAA-RBNG1as",
  authDomain: "ai-studio-applet-webapp-3acac.firebaseapp.com",
  projectId: "ai-studio-applet-webapp-3acac",
  storageBucket: "ai-studio-applet-webapp-3acac.firebasestorage.app",
  messagingSenderId: "644340342654",
  appId: "1:644340342654:web:c74d7c431b62ec55ff9d2f",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const backupFile = process.argv[2] || 'backup.json';
const data = JSON.parse(readFileSync(backupFile, 'utf-8'));

async function importCollection(collectionName, items) {
  if (!items || items.length === 0) {
    console.log(`⏭️  ${collectionName}: কোনো ডেটা নেই`);
    return;
  }
  console.log(`📤 ${collectionName}: ${items.length}টি ডেটা আপলোড হচ্ছে...`);
  let count = 0;
  for (const item of items) {
    const { id, ...rest } = item;
    await setDoc(doc(collection(db, collectionName), id), rest);
    count++;
    if (count % 10 === 0) console.log(`   ${count}/${items.length} সম্পন্ন`);
  }
  console.log(`✅ ${collectionName}: ${count}টি সম্পন্ন`);
}

console.log('🚀 Firebase-এ ডেটা আপলোড শুরু হচ্ছে...\n');

await importCollection('products', data.products);
await importCollection('sales', data.sales);
await importCollection('expenses', data.expenses);

console.log('\n✅ সব ডেটা সফলভাবে আপলোড হয়েছে!');
process.exit(0);
