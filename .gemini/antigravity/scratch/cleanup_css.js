import fs from 'fs';
const path = 'c:\\Users\\ahmdz\\OneDrive - UGM 365\\kas-gabku\\src\\styles\\style.css';
let content = fs.readFileSync(path, 'utf8');

// Match the end of the previous section
const regex = /\.mobile-nav\s*{\s*touch-action:\s*manipulation\s*!important;\s*}\s*}/g;
const match = regex.exec(content);

if (match) {
    const cleanContent = content.substring(0, match.index + match[0].length) + '\n\n/* Custom Admin Action Grid Layout */\n.admin-action-grid {\n    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;\n}\n\n@media (max-width: 720px) {\n    .admin-action-grid {\n        grid-template-columns: 1fr !important;\n    }\n}\n';
    fs.writeFileSync(path, cleanContent, 'utf8');
    console.log('Cleanup successful at index ' + match.index);
} else {
    // Try a simpler marker
    const simpleMarker = '.mobile-nav {';
    const lastIndex = content.lastIndexOf(simpleMarker);
    if (lastIndex !== -1) {
        // Find the next two closing braces
        let closingBraces = 0;
        let pos = lastIndex;
        while (pos < content.length && closingBraces < 2) {
            if (content[pos] === '}') closingBraces++;
            pos++;
        }
        if (closingBraces === 2) {
            const cleanContent = content.substring(0, pos) + '\n\n/* Custom Admin Action Grid Layout */\n.admin-action-grid {\n    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;\n}\n\n@media (max-width: 720px) {\n    .admin-action-grid {\n        grid-template-columns: 1fr !important;\n    }\n}\n';
            fs.writeFileSync(path, cleanContent, 'utf8');
            console.log('Cleanup successful using simple marker at ' + lastIndex);
        } else {
             console.log('Could not find closing braces');
        }
    } else {
        console.log('Marker not found at all');
    }
}
