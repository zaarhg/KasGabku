import fs from 'fs';
const path = 'c:\\Users\\ahmdz\\OneDrive - UGM 365\\kas-gabku\\src\\styles\\style.css';
let content = fs.readFileSync(path, 'utf8');

// Regex for the grid columns
const regex1 = /\.book-filter-grid\s*{\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);\s*}/g;
const replacement1 = '.book-filter-grid {\n        grid-template-columns: 180px 160px minmax(0, 1fr);\n    }';

// Regex for the form-group-wide
const regex2 = /\.book-filter-grid\s*\.form-group-wide\s*{\s*grid-column:\s*span\s*2;\s*}/g;
const replacement2 = '';

let cleanContent = content.replace(regex1, (match) => {
    // Check if it's the one inside the media query (which usually has more indentation)
    if (match.includes('        ')) {
        return replacement1;
    }
    return match;
});

cleanContent = cleanContent.replace(regex2, replacement2);

if (content !== cleanContent) {
    fs.writeFileSync(path, cleanContent, 'utf8');
    console.log('CSS update successful with regex');
} else {
    console.log('CSS target not found with regex');
    // Try even more flexible regex
    const flexibleRegex1 = /\.book-filter-grid\s*\{[^}]*repeat\(2,[^}]*\)\s*\}/g;
    cleanContent = content.replace(flexibleRegex1, replacement1);
    if (content !== cleanContent) {
         fs.writeFileSync(path, cleanContent, 'utf8');
         console.log('CSS update successful with flexible regex');
    } else {
         console.log('Final fallback failed');
    }
}
