import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDocFromServer } from "firebase/firestore";
import { readFileSync } from "fs";

const config = JSON.parse(readFileSync("./firebase-applet-config.json"));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  try {
    console.log("Checking DB...");
    await getDocFromServer(doc(db, "test", "connection"));
    console.log("Success!");
    process.exit(0);
  } catch (e) {
    console.error("Failed:", e.message);
    process.exit(1);
  }
}
run();
