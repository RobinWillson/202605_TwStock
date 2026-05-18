// TwStock Extension - Project 1: TradeHistory Background Script
// This file executes directly in the context of the active tab containing the 對帳單.html

(async function () {
  console.log("TradeHistory script starting execution...");

  try {
    // 1. Retrieve the trigger action from chrome.storage.local
    const { currentAction } = await chrome.storage.local.get('currentAction') || { currentAction: 'Fetch History' };
    console.log(`Action detected: ${currentAction}`);

    // 2. Locate all table elements
    const tables = Array.from(document.querySelectorAll('table'));
    if (tables.length === 0) {
      throw new Error("No tables found on the active page. Ensure you have the statement HTML page open.");
    }

    console.log("tables", tables) //debug..



    // 4. Extract and parse Transaction Details (find table containing both "成交" and "日期")
    let detailsContainerTable = null;
    for (let i = 2; i < tables.length; i++) {
      const text = tables[i].innerText;
      if (text.includes("成交") && text.includes("日期")) {
        detailsContainerTable = tables[i];
        break;
      }
    }

    if (!detailsContainerTable) {
      throw new Error("Could not find table containing both '成交' and '日期'.");
    }

    // Get the innermost table to avoid outer layout rows
    const detailsTable = detailsContainerTable.querySelector('table') || detailsContainerTable;
    const trs = Array.from(detailsTable.querySelectorAll('tr'));
    if (trs.length < 3) {
      throw new Error("Transaction details table has insufficient rows (requires header and data rows).");
    }

    // 5. Reconstruct the 17-column header keys from two-row titles (tr[0] & tr[1])
    const tr0 = trs[0];
    const tr1 = trs[1];
    const tr0Cells = Array.from(tr0.querySelectorAll('td'));
    const tr1Cells = Array.from(tr1.querySelectorAll('td'));

    const numCols = 17;
    const grid = Array.from({ length: 2 }, () => Array(numCols).fill(null));

    // Helper function to clean text (removes newlines, whitespace, and special characters)
    function cleanHeader(text) {
      return text.replace(/[\r\n\s]/g, '').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
    }

    // Populate grid row 0
    let colIndex = 0;
    tr0Cells.forEach(cell => {
      while (grid[0][colIndex] !== null) {
        colIndex++;
      }
      const cleaned = cleanHeader(cell.innerText);
      const rowspan = parseInt(cell.getAttribute('rowspan') || '1', 10);

      grid[0][colIndex] = cleaned;
      if (rowspan === 2) {
        grid[1][colIndex] = cleaned;
      }
      colIndex++;
    });

    // Populate grid row 1
    colIndex = 0;
    tr1Cells.forEach(cell => {
      while (grid[1][colIndex] !== null) {
        colIndex++;
      }
      const cleaned = cleanHeader(cell.innerText);
      grid[1][colIndex] = cleaned;
      colIndex++;
    });

    // Build combined keys
    const columnKeys = [];
    for (let c = 0; c < numCols; c++) {
      const primary = grid[0][c];
      const secondary = grid[1][c];
      if (primary === secondary || !secondary) {
        columnKeys.push(primary);
      } else {
        columnKeys.push(`${primary}_${secondary}`);
      }
    }

    console.log("Reconstructed 17-column keys:", columnKeys);

    // 6. Extract data rows (starting from tr[2]) and construct final key-value object
    const finalResult = {};
    let parsedCount = 0;

    for (let i = 2; i < trs.length; i++) {
      const row = trs[i];
      const tds = Array.from(row.querySelectorAll('td'));
      if (tds.length === 0) continue;

      const firstCellText = tds[0].innerText.trim();

      // Check if it's the "本期合計" summary row or doesn't have a valid ROC date format (e.g. "114/03/05")
      if (firstCellText.includes("本期合計") || !/^\d+\/\d+\/\d+$/.test(firstCellText)) {
        console.log(`Skipping non-data row: "${firstCellText}"`);
        continue;
      }

      // Reconcile cells and key mapping
      const tradeObj = {};
      tds.forEach((td, index) => {
        if (index >= numCols) return; // Keep safe boundaries

        const key = columnKeys[index];
        const rawVal = td.innerText.replace(/[\r\n\s]/g, '').replace(/,/g, ''); // strip spaces, newlines, commas

        // Format dates (成交日期 & 交割日期)
        if (key === '成交日期' || key === '交割日期') {
          const parts = rawVal.split('/');
          if (parts.length === 3) {
            const adYear = parseInt(parts[0], 10) + 1911;
            const month = parts[1].padStart(2, '0');
            const day = parts[2].padStart(2, '0');
            tradeObj[key] = `${adYear}${month}${day}`;
          } else {
            tradeObj[key] = rawVal;
          }
        }
        // Format transaction category (交易類別)
        else if (key === '交易類別') {
          tradeObj[key] = rawVal.includes('買') ? 'Buy' : 'Sell';
        }
        // Parse numeric values correctly (exclude stock codes)
        else if (key !== '股票代碼' && /^-?\d+(\.\d+)?$/.test(rawVal)) {
          tradeObj[key] = rawVal.includes('.') ? parseFloat(rawVal) : parseInt(rawVal, 10);
        }
        // Keep string values
        else {
          tradeObj[key] = rawVal;
        }
      });

      // Generate a unique Key for each row: {成交日期}_{交易類別}_{證券名稱}_{股數}_share_at_{單價}
      const tradeKey = `${tradeObj['成交日期']}_${tradeObj['交易類別']}_${tradeObj['證券名稱']}_${tradeObj['股數']}_share_at_${tradeObj['單價']}`;
      finalResult[tradeKey] = tradeObj;
      parsedCount++;
    }

    // 7. Output to console
    console.log("=== TWSTOCK TRANSACTION HISTORY PARSER RESULT ===");
    console.log(JSON.stringify(finalResult, null, 2));
    console.log("=================================================");

    // Also store parsed results in storage for other tabs or popup to consume
    await chrome.storage.local.set({
      parsedTradeHistory: finalResult,
      lastParsedTime: new Date().toISOString()
    });

    // 8. Upload parsed trade history to Supabase 'StockTradeHistory' table
    console.log("Uploading parsed trades to Supabase...");
    const url = self.SUPABASE_URL;
    const key = self.SUPABASE_KEY;

    if (!url || !key) {
      throw new Error("Supabase credentials not found. Make sure config.js is properly configured.");
    }

    const uploadRecords = Object.entries(finalResult).map(([key, value]) => {
      return {
        id: key,
        ...value
      };
    });

    if (uploadRecords.length > 0) {
      const response = await fetch(`${url}/rest/v1/StockTradeHistory`, {
        method: 'POST',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates' // perform upsert on conflict
        },
        body: JSON.stringify(uploadRecords)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to upload to Supabase: ${errorText}`);
      }
      console.log("Successfully uploaded to Supabase!");
      alert(`Successfully parsed, logged, and synced ${parsedCount} trades to Supabase!`);
    } else {
      alert(`Successfully parsed and logged 0 trades in the console!`);
    }

  } catch (err) {
    console.error("TradeHistory Parser Error:", err);
    alert(`Failed to parse TradeHistory: ${err.message}`);
  }
})();
