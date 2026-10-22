const fs = require('fs');
const path = require('path');

function patchFile(relativePath, transform) {
  const fullPath = path.resolve(relativePath);
  if (!fs.existsSync(fullPath)) return;
  const original = fs.readFileSync(fullPath, 'utf8');
  const updated = transform(original);
  if (original !== updated) {
    fs.writeFileSync(fullPath, updated, 'utf8');
    console.log(`Patched ${relativePath}`);
  } else {
    console.log(`No changes needed for ${relativePath}`);
  }
}

// 1. Products.tsx
patchFile('frontend/src/components/Products.tsx', (code) => {
  if (code.includes('smartApiRequest')) return code;
  code = `import { smartApiRequest } from "../offline/offlineApi";\n` + code;
  const regex = /async function apiRequest\(path: string, options: RequestInit = \{\}\) \{[\s\S]*?return result;\s*\}/;
  return code.replace(regex, `async function apiRequest(path: string, options: RequestInit = {}) {\n  return smartApiRequest(path, options);\n}`);
});

// 2. StockIn.tsx
patchFile('frontend/src/components/StockIn.tsx', (code) => {
  if (code.includes('smartApiRequest')) return code;
  code = `import { smartApiRequest } from "../offline/offlineApi";\n` + code;
  const regex = /async function request<T>\([\s\S]*?return result as T;\s*\}/;
  return code.replace(regex, `async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {\n  return smartApiRequest<T>(endpoint, options);\n}`);
});

// 3. StockOut.tsx
patchFile('frontend/src/components/StockOut.tsx', (code) => {
  if (code.includes('smartApiRequest')) return code;
  code = `import { smartApiRequest } from "../offline/offlineApi";\n` + code;
  const regex = /async function request\(path: string, options: RequestInit = \{\}\) \{[\s\S]*?return result;\s*\}/;
  return code.replace(regex, `async function request(path: string, options: RequestInit = {}) {\n  return smartApiRequest(path, options);\n}`);
});

// 4. CurrentStock.tsx
patchFile('frontend/src/components/CurrentStock.tsx', (code) => {
  if (code.includes('smartApiRequest')) return code;
  code = `import { smartApiRequest } from "../offline/offlineApi";\n` + code;
  const regex = /async function request\(path: string\) \{[\s\S]*?return result;\s*\}/;
  return code.replace(regex, `async function request(path: string) {\n  return smartApiRequest(path);\n}`);
});

// 5. Reports.tsx
patchFile('frontend/src/components/Reports.tsx', (code) => {
  if (code.includes('smartApiRequest')) return code;
  code = `import { smartApiRequest } from "../offline/offlineApi";\n` + code;
  
  // Replace the inResponse / outResponse fetch
  const target = `const [inResponse, outResponse] = await Promise.all([
        fetch(\`\${API_BASE}/stock/in\`, { headers }),
        fetch(\`\${API_BASE}/stock/out\`, { headers }),
      ]);`;
  const targetCRLF = `const [inResponse, outResponse] = await Promise.all([\r\n        fetch(\`\${API_BASE}/stock/in\`, { headers }),\r\n        fetch(\`\${API_BASE}/stock/out\`, { headers }),\r\n      ]);`;

  const replacement = `const [inJson, outJson] = await Promise.all([
        smartApiRequest("/stock/in"),
        smartApiRequest("/stock/out"),
      ]);`;

  if (code.includes(targetCRLF)) {
    code = code.replace(targetCRLF, replacement);
  } else if (code.includes(target)) {
    code = code.replace(target, replacement);
  }

  // Remove the old inResponse.status check
  const checkBlock = `if (
        inResponse.status === 401 ||
        outResponse.status === 401
      ) {
        throw new Error(
          "Session expired. Please log in again."
        );
      }

      if (!inResponse.ok || !outResponse.ok) {
        throw new Error(
          "Failed to load stock report data. Please verify your connection."
        );
      }

      const inJson = await inResponse.json();
      const outJson = await outResponse.json();`;

  const checkBlockCRLF = checkBlock.replace(/\n/g, '\r\n');

  if (code.includes(checkBlockCRLF)) {
    code = code.replace(checkBlockCRLF, `// Data retrieved from smart API / offline cache`);
  } else if (code.includes(checkBlock)) {
    code = code.replace(checkBlock, `// Data retrieved from smart API / offline cache`);
  }

  return code;
});

// 6. Companies.tsx
patchFile('frontend/src/components/Companies.tsx', (code) => {
  if (code.includes('smartApiRequest')) return code;
  code = `import { smartApiRequest } from "../offline/offlineApi";\n` + code;

  // fetchCompanies
  const oldFetch = `const response = await fetch(\`\${API}/companies\`, {
        headers: {
          ...(token ? { Authorization: \`Bearer \${token}\` } : {}),
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Unable to fetch companies");
        return;
      }`;
  const oldFetchCRLF = oldFetch.replace(/\n/g, '\r\n');
  const newFetch = `const data = await smartApiRequest("/companies");`;

  if (code.includes(oldFetchCRLF)) code = code.replace(oldFetchCRLF, newFetch);
  else if (code.includes(oldFetch)) code = code.replace(oldFetch, newFetch);

  // createCompany
  const oldCreate = `const response = await fetch(\`\${API}/companies\`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: \`Bearer \${token}\` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Failed to create company");
        return;
      }`;
  const oldCreateCRLF = oldCreate.replace(/\n/g, '\r\n');
  const newCreate = `const data = await smartApiRequest("/companies", {
        method: "POST",
        body: JSON.stringify(payload),
      });`;

  if (code.includes(oldCreateCRLF)) code = code.replace(oldCreateCRLF, newCreate);
  else if (code.includes(oldCreate)) code = code.replace(oldCreate, newCreate);

  return code;
});

console.log('Component patching finished.');
