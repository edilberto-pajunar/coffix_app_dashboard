import { db } from "@/app/lib/firebase";
import {
  doc,
  DocumentData,
  onSnapshot,
  Unsubscribe,
  updateDoc,
} from "firebase/firestore";
import { COLLECTION_GLOBAL_SETTINGS } from "@/app/utils/constant";
import { GlobalSettings } from "../interface/global_settings";

const settingsRef = () => doc(db, "global", COLLECTION_GLOBAL_SETTINGS);

export const GlobalSettingsService = {
  listenToSettings: (
    onUpdate: (settings: GlobalSettings) => void
  ): Unsubscribe =>
    onSnapshot(settingsRef(), (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as GlobalSettings);
      }
    }),

  updateSettings: (data: Partial<GlobalSettings>) =>
    updateDoc(settingsRef(), data as DocumentData),
};
