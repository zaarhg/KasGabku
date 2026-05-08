import fs from 'fs';
const path = 'c:\\Users\\ahmdz\\OneDrive - UGM 365\\kas-gabku\\src\\styles\\style.css';
let content = fs.readFileSync(path, 'utf8');

const target = 'grid-template-columns: repeat(4, minmax(0, 1fr));\n        grid-auto-columns: unset;';
// Replace with regex to be safe about whitespace
const cleanContent = content.replace(
    /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);\s*grid-auto-columns:\s*unset;/g,
    'grid-template-columns: none;\n        grid-auto-columns: 1fr;'
);

if (content !== cleanContent) {
    fs.writeFileSync(path, cleanContent, 'utf8');
    console.log('Update successful');
} else {
    console.log('Target not found');
}
