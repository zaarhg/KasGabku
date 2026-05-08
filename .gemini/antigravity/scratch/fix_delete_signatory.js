import fs from 'fs';
const path = 'c:\\Users\\ahmdz\\OneDrive - UGM 365\\kas-gabku\\src\\services\\master-data.js';
let content = fs.readFileSync(path, 'utf8');

const target = 'export async function deleteSignatory(signatoryId) {\n    const { count, error: countError } = await supabase\n        .from(\'generated_documents\')\n        .select(\'id\', { count: \'exact\', head: true })\n        .or(`signer_mengetahui_id.eq.${signatoryId},signer_bendahara_id.eq.${signatoryId}`);\n\n    if (countError) throw countError;\n\n    if (count > 0) {\n        throw new Error(\'Penandatangan tidak bisa dihapus karena sudah tercatat dalam dokumen PDF yang pernah dibuat. Silakan nonaktifkan saja.\');\n    }';

const replacement = 'export async function deleteSignatory(signatoryId) {\n    if (!signatoryId) throw new Error(\'ID penandatangan tidak valid.\');\n\n    const { count, error: countError } = await supabase\n        .from(\'generated_documents\')\n        .select(\'id\', { count: \'exact\', head: true })\n        .or(`signer_mengetahui_id.eq.${signatoryId},signer_bendahara_id.eq.${signatoryId}`);\n\n    if (countError) {\n        console.error(\'Check usage error:\', countError);\n        throw new Error(\'Gagal memeriksa penggunaan penandatangan: \' + countError.message);\n    }\n\n    if (count > 0) {\n        throw new Error(`Penandatangan tidak bisa dihapus karena sudah tercatat dalam ${count} dokumen PDF yang pernah dibuat. Silakan nonaktifkan saja.`);\n    }';

// Use a more flexible regex for line endings
const regex = /export async function deleteSignatory\(signatoryId\) \{\s*const \{ count, error: countError \} = await supabase\s*\.from\('generated_documents'\)\s*\.select\('id', \{ count: 'exact', head: true \}\)\s*\.or\(`signer_mengetahui_id\.eq\.\${signatoryId},signer_bendahara_id\.eq\.\${signatoryId}`\);\s*if \(countError\) throw countError;\s*if \(count > 0\) \{\s*throw new Error\('Penandatangan tidak bisa dihapus karena sudah tercatat dalam dokumen PDF yang pernah dibuat\. Silakan nonaktifkan saja\.'\);\s*\}/;

let cleanContent = content.replace(regex, replacement);

if (content !== cleanContent) {
    fs.writeFileSync(path, cleanContent, 'utf8');
    console.log('Update successful');
} else {
    console.log('Target not found with regex');
}
