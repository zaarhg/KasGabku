const fs = require('fs');
const filePath = 'c:\\Users\\ahmdz\\OneDrive - UGM 365\\kas-gabku\\src\\styles\\style.css';
let content = fs.readFileSync(filePath, 'utf8');

const marker = '/* Custom Admin Action Grid Layout Fix */';
const startMarker = ' / *   C u s t o m   A d m i n   A c t i o n   G r i d   L a y o u t   * /';

const startIndex = content.indexOf(startMarker);
const markerIndex = content.indexOf(marker);

if (startIndex !== -1 && markerIndex !== -1) {
    const cleanContent = content.substring(0, startIndex) + content.substring(markerIndex);
    fs.writeFileSync(filePath, cleanContent, 'utf8');
    console.log('Cleanup successful');
} else {
    console.log('Markers not found');
}
