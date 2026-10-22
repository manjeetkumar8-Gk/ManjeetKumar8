import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import type jsPDF from "jspdf";

export async function exportPdfFile(
  doc: jsPDF,
  filename: string,
  title: string = "Stock Report"
): Promise<{ success: boolean; message: string }> {
  try {
    if (Capacitor.isNativePlatform()) {
      // Running inside Android or iOS native app
      const dataUri = doc.output("datauristring");
      const base64Data = dataUri.split(",")[1];

      const savedFile = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
      });

      // Present native share dialog (allows saving to Files/Downloads, WhatsApp, Drive, Print)
      await Share.share({
        title,
        text: `Syncora Stock Management - ${title}`,
        url: savedFile.uri,
        dialogTitle: "Save or Share PDF Report",
      });

      return {
        success: true,
        message: "PDF generated! Choose 'Save to Downloads' or share via WhatsApp/Drive.",
      };
    } else {
      // Running on Desktop (Electron / Web / Mac / Windows)
      doc.save(filename);
      return {
        success: true,
        message: "PDF report downloaded successfully.",
      };
    }
  } catch (error) {
    console.error("PDF export error:", error);
    // Fallback if Capacitor share was cancelled or failed
    try {
      doc.save(filename);
      return {
        success: true,
        message: "PDF report downloaded.",
      };
    } catch (fallbackError) {
      return {
        success: false,
        message: "Could not export PDF report. Please try again.",
      };
    }
  }
}

export async function exportCsvFile(
  csvContent: string,
  filename: string,
  title: string = "Stock CSV Report"
): Promise<{ success: boolean; message: string }> {
  try {
    if (Capacitor.isNativePlatform()) {
      // Base64 encode for native filesystem write
      const utf8Bytes = new TextEncoder().encode("\uFEFF" + csvContent);
      let binary = "";
      const len = utf8Bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(utf8Bytes[i]);
      }
      const base64Data = btoa(binary);

      const savedFile = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
      });

      await Share.share({
        title,
        text: `Syncora Stock Management - ${title}`,
        url: savedFile.uri,
        dialogTitle: "Save or Share CSV Report",
      });

      return {
        success: true,
        message: "CSV generated! Choose 'Save to Downloads' or open in Excel / Sheets.",
      };
    } else {
      const blob = new Blob(["\uFEFF" + csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      return {
        success: true,
        message: "CSV report exported successfully. You can open this file in Excel or Sheets.",
      };
    }
  } catch (error) {
    console.error("CSV export error:", error);
    return {
      success: false,
      message: "Could not export CSV report. Please try again.",
    };
  }
}
