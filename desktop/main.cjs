
const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");

let mainWindow;
let backendProcess;

function getPaths() {
  if (app.isPackaged) {
    return {
      backendFolder: path.join(process.resourcesPath, "backend"),
      nodeExe: path.join(process.resourcesPath, "runtime", "node.exe"),
      frontendFile: path.join(app.getAppPath(), "frontend", "dist", "index.html"),
    };
  }

  return {
    backendFolder: path.join(__dirname, "..", "backend"),
    nodeExe: path.join(__dirname, "runtime", "node.exe"),
    frontendFile: path.join(__dirname, "..", "frontend", "dist", "index.html"),
  };
}

function startBackend() {
  const { backendFolder, nodeExe } = getPaths();
  const serverFile = path.join(backendFolder, "dist", "server.js");

  if (!fs.existsSync(nodeExe)) {
    throw new Error(`Bundled Node.js not found: ${nodeExe}`);
  }

  if (!fs.existsSync(serverFile)) {
    throw new Error(`Backend server not found: ${serverFile}`);
  }

  backendProcess = spawn(nodeExe, [serverFile], {
    cwd: backendFolder,
    env: {
      ...process.env,
      NODE_ENV: app.isPackaged ? "production" : "development",
    },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  backendProcess.stdout.on("data", (data) => {
    console.log("BACKEND:", data.toString().trim());
  });

  backendProcess.stderr.on("data", (data) => {
    console.error("BACKEND ERROR:", data.toString().trim());
  });

  backendProcess.on("error", (error) => {
    console.error("BACKEND START FAILED:", error.message);
  });

  backendProcess.on("exit", (code) => {
    console.log("BACKEND STOPPED:", code);
  });
}

function createWindow() {
  const { frontendFile } = getPaths();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 650,
    title: "Syncora Technologies",
    icon: path.join(__dirname, "assets", "syncora.ico"),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, code, description, url) => {
      console.error("PAGE LOAD ERROR:", code, description, url);
    }
  );

  mainWindow.loadFile(frontendFile);
}

app.whenReady().then(() => {
  try {
    startBackend();
    createWindow();
  } catch (error) {
    console.error("APPLICATION START FAILED:", error);
  }
});

app.on("before-quit", () => {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
