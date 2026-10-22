import { useEffect, useState } from "react";
import {
  subscribeSyncStatus,
  triggerAutoSync,
  type SyncStatus,
} from "../offline/syncEngine";

export default function SyncStatusBadge({ darkMode = false }: { darkMode?: boolean }) {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    isSyncing: false,
    pendingCount: 0,
    lastSyncedAt: null,
    error: null,
  });
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeSyncStatus((newStatus) => {
      setStatus(newStatus);
    });
    return unsubscribe;
  }, []);

  const handleManualSync = async () => {
    if (status.isSyncing) return;
    setSyncMessage("Syncing...");
    await triggerAutoSync();
    setSyncMessage(status.isOnline ? "Sync complete!" : "You are offline. Changes saved locally.");
    setTimeout(() => setSyncMessage(null), 3000);
  };

  const isOnline = status.isOnline;
  const isSyncing = status.isSyncing;
  const pending = status.pendingCount;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleManualSync}
        title={
          isOnline
            ? pending > 0
              ? `${pending} change(s) waiting to sync. Click to sync now.`
              : "Connected to cloud. Click to sync now."
            : "Offline mode. All data is saved on this device."
        }
        className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition active:scale-95 ${
          !isOnline
            ? "border-amber-400/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
            : isSyncing
            ? "border-blue-400/30 bg-blue-500/10 text-blue-500"
            : pending > 0
            ? "border-teal-400/30 bg-teal-500/10 text-teal-600 dark:text-teal-400 hover:bg-teal-500/20"
            : darkMode
            ? "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            !isOnline
              ? "bg-amber-500"
              : isSyncing
              ? "animate-ping bg-blue-500"
              : pending > 0
              ? "bg-teal-400"
              : "bg-emerald-500"
          }`}
        />

        <span>
          {syncMessage ||
            (!isOnline
              ? "Offline"
              : isSyncing
              ? "Syncing..."
              : pending > 0
              ? `Sync (${pending})`
              : "Synced")}
        </span>

        {isOnline && !isSyncing && (
          <span className="opacity-60 hover:opacity-100" aria-hidden="true">
            ↻
          </span>
        )}
      </button>
    </div>
  );
}
