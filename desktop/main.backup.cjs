const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 650,
    title: "Syncora Technologies",
    icon: path.join(__dirname, "assets", "syncora.ico"),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.webContents.on("did-fail-load", (_event, code, description, url) => {
    console.log("PAGE LOAD ERROR:", code, description, url);
  });

  win.webContents.on("console-message", (_event, details) => {
    console.log("BROWSER:", details.message);
  });

  win.loadFile(
    path.join(__dirname, "..", "frontend", "dist", "index.html")
  ).catch(error => console.log("FILE ERROR:", error));
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
