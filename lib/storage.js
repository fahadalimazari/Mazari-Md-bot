const fs = require('fs');
const path = require('path');

/**
 * Safely reads a JSON file. If it fails to parse, backs up the corrupted file 
 * and returns the default data to prevent the bot from crashing or wiping data on next save.
 */
function safeReadJson(filePath, defaultData = {}) {
    try {
        if (!fs.existsSync(filePath)) {
            // Ensure directory exists
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            
            // Create file with default data if it doesn't exist
            atomicWriteJson(filePath, defaultData);
            return defaultData;
        }

        const rawData = fs.readFileSync(filePath, 'utf8');
        // Prevent parsing empty string (which throws error)
        if (!rawData || rawData.trim() === '') {
            return defaultData;
        }
        
        return JSON.parse(rawData);
    } catch (error) {
        console.error(`[STORAGE] Error reading JSON from ${filePath}:`, error.message);
        
        // Backup the corrupted file just in case it had valuable data
        if (fs.existsSync(filePath)) {
            try {
                const backupPath = `${filePath}.corrupt.${Date.now()}`;
                fs.copyFileSync(filePath, backupPath);
                console.log(`[STORAGE] Backed up corrupted file to ${backupPath}`);
            } catch (backupError) {
                console.error(`[STORAGE] Failed to backup corrupted file:`, backupError.message);
            }
        }
        
        return defaultData; // Return defaults, but we DO NOT overwrite the original file here to give a chance for recovery
    }
}

/**
 * Atomically writes data to a JSON file to prevent corruption during crashes or restarts.
 * Writes to a .tmp file first, then synchronously renames it.
 */
function atomicWriteJson(filePath, data) {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const tempPath = `${filePath}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
        fs.renameSync(tempPath, filePath);
        
        return true;
    } catch (error) {
        console.error(`[STORAGE] Error writing atomically to ${filePath}:`, error.message);
        return false;
    }
}

async function atomicWriteJsonAsync(filePath, data) {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            await fs.promises.mkdir(dir, { recursive: true });
        }

        const tempPath = `${filePath}.tmp`;
        await fs.promises.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
        await fs.promises.rename(tempPath, filePath);
        
        return true;
    } catch (error) {
        console.error(`[STORAGE] Error writing atomically (async) to ${filePath}:`, error.message);
        return false;
    }
}

module.exports = {
    safeReadJson,
    atomicWriteJson,
    atomicWriteJsonAsync
};
