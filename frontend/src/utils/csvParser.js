import Papa from 'papaparse';

// Helper to convert to title case
function toTitleCase(str) {
  if (!str) return '';
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}

/**
 * Parses the TLC Attendance CSV export, strictly extracting ONLY the allowed fields
 * to prevent PII leakage (like home addresses) into our database.
 * 
 * @param {File} file - The CSV file from an <input type="file" />
 * @returns {Promise<Array>} A promise that resolves to an array of processed members.
 */
export function parseTlcRosterCsv(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedMembers = [];

        for (const row of results.data) {
          // If the row is completely empty (can happen even with skipEmptyLines sometimes)
          if (!row['Last Name'] && !row['First Name'] && !row['Member Number']) {
            continue;
          }

          // Extract only the allowed fields. IGNORE EVERYTHING ELSE.
          const rawLastName = row['Last Name'] ? row['Last Name'].trim() : '';
          const rawFirstName = row['First Name'] ? row['First Name'].trim() : '';
          const rawNickname = row['Nickname'] ? row['Nickname'].trim() : '';
          const rawMemberId = row['Member Number'] ? row['Member Number'].trim() : '';

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

          parsedMembers.push({
            first_name: finalFirstName,
            last_initial: lastInitial,
            member_id: memberId,
            // tlc_id is populated later upon first scan
            tlc_id: null
          });
        }

        resolve(parsedMembers);
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}
