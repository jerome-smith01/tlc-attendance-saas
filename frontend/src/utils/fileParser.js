import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// Helper to convert to title case
function toTitleCase(str) {
  if (!str) return '';
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}

/**
 * Parses a membership expiry date string in MM/DD/YYYY format
 * and returns an ISO date string (YYYY-MM-DD) suitable for DB storage,
 * or null if the value is missing or unparseable.
 */
function parseMembershipExp(raw) {
  if (!raw) return null;
  const str = String(raw).trim();
  if (!str) return null;
  // Expected format: MM/DD/YYYY
  const parts = str.split('/');
  if (parts.length === 3) {
    const [month, day, year] = parts;
    if (year.length === 4 && !isNaN(Number(month)) && !isNaN(Number(day)) && !isNaN(Number(year))) {
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }
  return null;
}

function processRows(rows) {
  const parsedMembers = [];

  for (const row of rows) {
    // If the row is completely empty
    if (!row['Last Name'] && !row['First Name'] && !row['Member Number']) {
      continue;
    }

    // Extract only the allowed fields. IGNORE EVERYTHING ELSE.
    const rawLastName = row['Last Name'] != null ? String(row['Last Name']).trim() : '';
    const rawFirstName = row['First Name'] != null ? String(row['First Name']).trim() : '';
    const rawNickname = row['Nickname'] != null ? String(row['Nickname']).trim() : '';
    const rawMemberId = row['Member Number'] != null ? String(row['Member Number']).trim() : '';

    if (!rawMemberId) {
      // Skip rows that don't have a Member Number (likely not actual youth members)
      continue;
    }

    // 1. Determine first_name (Nickname preferred)
    let finalFirstName = rawFirstName;
    if (rawNickname && rawNickname.toLowerCase() !== rawFirstName.toLowerCase()) {
      finalFirstName = rawNickname;
    }
    finalFirstName = toTitleCase(finalFirstName);

    // 2. Determine last_initial
    let lastInitial = '';
    if (rawLastName.length > 0) {
      // Take the first character, handle any stray quotes
      const cleanLastName = rawLastName.replace(/^["']|["']$/g, '');
      if (cleanLastName.length > 0) {
        lastInitial = cleanLastName.charAt(0).toUpperCase();
      }
    }

    // 3. member_id
    const memberId = rawMemberId;

    // 4. membership_exp — parse MM/DD/YYYY → ISO YYYY-MM-DD
    const membershipExp = parseMembershipExp(row['Membership Exp.']);

    parsedMembers.push({
      first_name: finalFirstName,
      last_initial: lastInitial,
      member_id: memberId,
      // tlc_id is populated later upon first scan
      tlc_id: null,
      membership_exp: membershipExp
    });
  }

  return parsedMembers;
}

/**
 * Parses an Excel (.xlsx / .xls) file from TLC.
 */
function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Read rows as array of arrays to find header row (row 2 in TLC Excel exports)
        const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        let headerRowIndex = rawRows.findIndex(row =>
          Array.isArray(row) && row.some(cell => typeof cell === 'string' && (
            cell.trim().toLowerCase() === 'last name' ||
            cell.trim().toLowerCase() === 'member number'
          ))
        );

        if (headerRowIndex === -1) {
          headerRowIndex = 0;
        }

        const rows = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex });
        resolve(processRows(rows));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parses a CSV file from TLC.
 */
function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve(processRows(results.data));
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}

/**
 * Parses TLC Attendance CSV or Excel export, strictly extracting ONLY the allowed fields
 * to prevent PII leakage (like home addresses) into our database.
 * 
 * @param {File} file - The CSV or Excel file from an <input type="file" />
 * @returns {Promise<Array>} A promise that resolves to an array of processed members.
 */
export function parseTlcRosterFile(file) {
  const fileName = (file && file.name) ? file.name.toLowerCase() : '';
  const fileType = (file && file.type) ? file.type.toLowerCase() : '';

  const isExcel = fileName.endsWith('.xlsx') ||
    fileName.endsWith('.xls') ||
    fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    fileType === 'application/vnd.ms-excel';

  if (isExcel) {
    return parseExcelFile(file);
  }
  return parseCsvFile(file);
}

// Backward compatibility export
export const parseTlcRosterCsv = parseTlcRosterFile;
