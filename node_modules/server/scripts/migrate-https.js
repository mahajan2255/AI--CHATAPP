const fs = require('fs');
const path = require('path');

const clientSrc = path.join(__dirname, '..', '..', 'client', 'src');

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            walk(filePath);
        } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
            let content = fs.readFileSync(filePath, 'utf8');
            let updated = false;
            // Replace http://localhost:3001 with https://localhost:3001
            if (content.includes('http://localhost:3001')) {
                content = content.replace(/http:\/\/localhost:3001/g, 'https://localhost:3001');
                updated = true;
            }
            // Also replace http://localhost:3000 just in case
            if (content.includes('http://localhost:3000')) {
                content = content.replace(/http:\/\/localhost:3000/g, 'https://localhost:3001');
                updated = true;
            }

            if (updated) {
                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`Updated ${filePath}`);
            }
        }
    }
}

console.log('Starting migration...');
if (fs.existsSync(clientSrc)) {
    walk(clientSrc);
} else {
    console.error('Client src not found:', clientSrc);
}
console.log('Migration complete.');
